"""Isolated worker using the pinned upstream Hermes AIAgent and tool registry."""

from contextlib import redirect_stdout
import json
import logging
import os
from pathlib import Path
import sys
from threading import Lock
from time import monotonic

from policy import CareTools, TOOL_NAMES, build_system_prompt

MAX_PROVIDER_CALLS = 3
MAX_OUTPUT_TOKENS = 650
MAX_PROVIDER_REQUEST_BYTES = 56 * 1024
PROVIDER_TIMEOUT_SECONDS = 8
EXTRACT_BODY_BYTES = 24 * 1024 * 1024
RECORD_PLAN_BODY_BYTES = 32 * 1024
EXTRACT_PROMPT_SHA256 = "bbb5256a12df9dd45bfa65a3c9bd4d8f119db255b77809ca8bc5a7dd7444d4bc"
RECORD_PLAN_PROMPT_SHA256 = frozenset({
    "8ed08a3d49d63e6b04853a53261c95a093ac3cb9175c7c15656a4d266e62935a",
    "53a9805030f2e350c596a91292bcd2ea053787e4fa6ac5917cc021dfdd5b248a",
})
NATIVE_SKILL_ROOT = Path(__file__).resolve().parent / "skills"
NATIVE_SKILLS = frozenset({"document-extraction", "record-plan", "source-handoff"})


PROGRESS_STAGES = frozenset({"starting", "model", "reading_sources", "preparing_reply", "validating"})


def emit_progress(stage):
    """Only fixed action codes enter the private per-turn telemetry journal."""
    path = os.environ.get("GLUCO_PROGRESS_PATH")
    if path and stage in PROGRESS_STAGES:
        with open(path, "a", encoding="utf-8") as stream:
            stream.write(stage + "\n")


def elapsed_ms(started):
    return round((monotonic() - started) * 1000)


def load_native_skill(name):
    from tools.skills_tool import skill_view

    if name not in NATIVE_SKILLS:
        raise ValueError("Unapproved native skill.")
    file = Path(os.environ["HERMES_HOME"], "skills", name, "SKILL.md")
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_bytes((NATIVE_SKILL_ROOT / name / "SKILL.md").read_bytes())
    viewed = json.loads(skill_view(name, preprocess=False))
    if (viewed.get("success") is not True or viewed.get("name") != name
            or viewed.get("linked_files") or not isinstance(viewed.get("content"), str)):
        raise RuntimeError("Native skill resolution failed.")
    return viewed["content"].split("---\n", 2)[2]


def scoped_client_kwargs(kwargs, timeout, check):
    import httpx

    client = httpx.Client(
        timeout=timeout, trust_env=False, follow_redirects=False, event_hooks={"request": [check]},
    )
    return {**kwargs, "http_client": client, "timeout": timeout, "max_retries": 0}


class CareTurnComplete(BaseException):
    """Private adapter control signal, raised only after validated terminal tool output.

    BaseException deliberately bypasses Hermes' generic tool-error/retry handler.
    It is caught at the adapter boundary; it is never a provider response or an
    arbitrary model instruction to stop. The normal agent cleanup still runs.
    """


def run_chat(job, timing, worker_started):
    emit_progress("starting")
    import httpx
    from run_agent import AIAgent
    from tools.registry import registry

    class WireBudget:
        def __init__(self):
            self.calls = 0
            self.lock = Lock()

        def check(self, request):
            with self.lock:
                if self.calls >= MAX_PROVIDER_CALLS:
                    raise httpx.RequestError("Provider call cap reached.")
                if request.method != "POST" or request.url != endpoint:
                    raise httpx.RequestError("Provider route rejected.")
                raw = request.content
                if len(raw) > MAX_PROVIDER_REQUEST_BYTES:
                    raise httpx.RequestError("Provider input cap reached.")
                payload = json.loads(raw)
                max_tokens = payload.get("max_completion_tokens", payload.get("max_tokens"))
                names = {tool["function"]["name"] for tool in payload.get("tools", [])}
                if (payload.get("model") != job["model"] or names != TOOL_NAMES
                        or type(max_tokens) is not int or not 0 < max_tokens <= MAX_OUTPUT_TOKENS
                        or payload.get("stream") is True or payload.get("store") is not False
                        or payload.get("n", 1) != 1):
                    raise httpx.RequestError("Provider request exceeds the configured agent surface.")
                if job["model"].startswith("gpt-6-luna") and payload.get("reasoning_effort") != "none":
                    raise httpx.RequestError("Unexpected chat reasoning budget.")
                self.calls += 1
                timing["providerCalls"] = self.calls
                emit_progress("model")

    endpoint = httpx.URL(job["baseUrl"] + "/chat/completions")
    budget = WireBudget()
    language_code = job.get("languageCode", "en-IN")
    tools = CareTools(job["workspace"], job["message"], skill_loader=load_native_skill, language_code=language_code)
    tools.register(registry)

    class CareAgent(AIAgent):
        def _create_openai_client(self, kwargs, *, reason, shared):
            # The pinned Hermes runtime creates a new client for each API attempt.
            # Share one wire budget across those clients, including retry paths.
            return super()._create_openai_client(
                scoped_client_kwargs(kwargs, PROVIDER_TIMEOUT_SECONDS, budget.check),
                reason=reason, shared=shared,
            )

        def _interruptible_api_call(self, *args, **kwargs):
            started = monotonic()
            try:
                return super()._interruptible_api_call(*args, **kwargs)
            finally:
                timing["providerMs"] += elapsed_ms(started)

        def _execute_tool_calls(self, assistant_message, messages, effective_task_id, api_call_count=0):
            calls = assistant_message.tool_calls
            if len(calls) != 1 or calls[0].function.name not in TOOL_NAMES:
                raise RuntimeError("Hermes returned an unexpected tool call batch.")
            emit_progress("preparing_reply" if calls[0].function.name == "care_respond" else "reading_sources")
            started = monotonic()
            try:
                super()._execute_tool_calls(assistant_message, messages, effective_task_id, api_call_count)
                if tools.output is not None:
                    # care_respond has already checked source scope and produced the
                    # authoritative app answer. A further model acknowledgement is
                    # discarded by the product, so it must not cost another call.
                    raise CareTurnComplete()
            finally:
                timing["toolMs"] += elapsed_ms(started)

    overrides = {"store": False, "parallel_tool_calls": False}
    # Custom OpenAI-compatible endpoints do not always receive reasoning_config.
    # Specify the configured model's wire setting rather than inheriting a slow default.
    if job["model"].startswith("gpt-6-luna"):
        overrides["reasoning_effort"] = "none"
    agent = CareAgent(
        model=job["model"], provider="custom", api_mode="chat_completions",
        base_url=job["baseUrl"], api_key=os.environ["GLUCOFLOW_MODEL_KEY"],
        enabled_toolsets=["glucoflow-care"], max_iterations=MAX_PROVIDER_CALLS,
        max_tokens=MAX_OUTPUT_TOKENS, run_budget_seconds=25, quiet_mode=True,
        skip_context_files=True, skip_memory=True, skip_background_review=True,
        save_trajectories=False, cwd=os.environ["HERMES_HOME"], fallback_model={},
        checkpoints_enabled=False, session_db=None, tool_progress_mode="off",
        request_overrides=overrides,
        reasoning_config={"enabled": False},
    )
    try:
        agent._disable_streaming = True
        agent._persist_disabled = True
        agent._api_max_retries = 1
        if agent.api_mode != "chat_completions" or agent.valid_tool_names != TOOL_NAMES:
            raise RuntimeError("Unexpected Hermes provider or tool surface.")
        started = monotonic()
        timing["startupMs"] = elapsed_ms(worker_started)
        try:
            try:
                agent.run_conversation(
                    job["message"],
                    system_message=build_system_prompt(language_code),
                    conversation_history=job["history"],
                )
            except CareTurnComplete:
                terminal_tool_completed = True
            else:
                terminal_tool_completed = False
        finally:
            timing["loopMs"] = elapsed_ms(started)
        if (not terminal_tool_completed or not tools.output
                or not 1 <= budget.calls <= MAX_PROVIDER_CALLS or monotonic() - started > 25):
            raise RuntimeError("Hermes did not complete a validated response.")
        emit_progress("validating")
        return {**tools.output, "engine": "hermes", "model": job["model"]}
    finally:
        agent.close()


def run_one_call(job, timing, worker_started):
    import httpx
    from run_agent import AIAgent

    extract = job["operation"] == "extract"
    skill = load_native_skill("document-extraction" if extract else "record-plan")
    if extract and skill != job["system"]:
        raise RuntimeError("The audited extraction prompt and native skill differ.")
    prompt = skill if extract else f"{skill.strip()}\n\n{job['system']}"
    endpoint = httpx.URL(job["baseUrl"] + "/chat/completions")
    timeout = 42 if extract else 12
    body_limit = EXTRACT_BODY_BYTES if extract else RECORD_PLAN_BODY_BYTES
    usage = {"prompt_tokens": None, "completion_tokens": None}
    expected_images = [item["image_url"]["url"] for item in job["user"]
                       if item["type"] == "image_url"] if extract else []

    def wire_guard(request):
        if timing["providerCalls"] or request.method != "POST" or request.url != endpoint:
            raise httpx.RequestError("One-call provider route rejected.")
        raw = request.content
        if len(raw) > body_limit:
            raise httpx.RequestError("Provider input cap reached.")
        payload = json.loads(raw)
        output_cap = payload.get("max_completion_tokens", payload.get("max_tokens"))
        images = [
            item["image_url"]["url"]
            for message in payload.get("messages", []) if message.get("role") == "user"
            and isinstance(message.get("content"), list)
            for item in message["content"] if item.get("type") == "image_url"
        ]
        if (payload.get("model") != job["model"] or payload.get("tools")
                or payload.get("response_format") != {"type": "json_object"}
                or type(output_cap) is not int or not 0 < output_cap <= job["maxOutputTokens"]
                or payload.get("stream") is True or payload.get("store") is not False
                or payload.get("n", 1) != 1 or images != expected_images):
            raise httpx.RequestError("Provider request exceeds the configured one-call surface.")
        timing["providerCalls"] = 1

    class SingleCallAgent(AIAgent):
        def _model_supports_vision(self):
            # This route requires native input. Hermes' generic vision fallback
            # could dispatch a second, unreserved auxiliary model call.
            return extract

        def _create_openai_client(self, kwargs, *, reason, shared):
            return super()._create_openai_client(
                scoped_client_kwargs(kwargs, timeout, wire_guard), reason=reason, shared=shared,
            )

        def _interruptible_api_call(self, *args, **kwargs):
            started = monotonic()
            try:
                response = super()._interruptible_api_call(*args, **kwargs)
                provider_usage = getattr(response, "usage", None)
                for key in usage:
                    value = getattr(provider_usage, key, None)
                    if type(value) is int and value >= 0:
                        usage[key] = value
                return response
            finally:
                timing["providerMs"] += elapsed_ms(started)

    overrides = {"store": False, "response_format": {"type": "json_object"}}
    if job["model"].startswith("gpt-6-luna"):
        overrides["reasoning_effort"] = "low" if extract else "none"
    agent = SingleCallAgent(
        model=job["model"], provider="custom", api_mode="chat_completions",
        base_url=job["baseUrl"], api_key=os.environ["GLUCOFLOW_MODEL_KEY"],
        enabled_toolsets=[], max_iterations=1, max_tokens=job["maxOutputTokens"],
        run_budget_seconds=timeout + 2, quiet_mode=True, skip_context_files=True,
        skip_memory=True, skip_background_review=True, save_trajectories=False,
        cwd=os.environ["HERMES_HOME"], fallback_model={}, checkpoints_enabled=False,
        session_db=None, tool_progress_mode="off", request_overrides=overrides,
        reasoning_config={"enabled": False},
    )
    try:
        agent._disable_streaming = True
        agent._persist_disabled = True
        agent._api_max_retries = 1
        if agent.api_mode != "chat_completions" or agent.valid_tool_names:
            raise RuntimeError("Unexpected one-call Hermes tool surface.")
        started = monotonic()
        timing["startupMs"] = elapsed_ms(worker_started)
        try:
            result = agent.run_conversation(job["user"], system_message=prompt)
        finally:
            timing["loopMs"] = elapsed_ms(started)
        content = result.get("final_response")
        if (timing["providerCalls"] != 1 or not result.get("completed") or result.get("interrupted")
                or not isinstance(content, str) or not content.strip() or len(content) > 65_536):
            raise RuntimeError("Hermes one-call job did not produce a result.")
        return {
            "engine": "hermes", "runtimeVersion": "0.23.0", "model": job["model"],
            "choices": [{"message": {"content": content}}], "usage": usage,
        }
    finally:
        agent.close()


def main():
    worker_started = monotonic()
    logging.disable(logging.CRITICAL)
    from hermes_cli.plugins_discovery import suppress_plugin_discovery

    with redirect_stdout(sys.stderr), suppress_plugin_discovery():
        if sys.argv[1:] == ["--check"]:
            import run_agent
            import tools.registry
            expected = Path(os.environ["PYTHONPATH"]) / "run_agent.py"
            if Path(run_agent.__file__).resolve() != expected.resolve():
                raise RuntimeError("Hermes imported from an unexpected path.")
            return
        job = json.load(sys.stdin)
        Path(os.environ["HERMES_HOME"], "config.yaml").write_text(json.dumps({
            "model": {"default": job["model"], "provider": "custom",
                      "base_url": job["baseUrl"], "context_length": 65536},
            "compression": {"enabled": False},
            "tools": {"tool_search": {"enabled": "off"}},
            "skills": {"auto_load": [], "project_discovery": False},
            "fallback_providers": [],
        }), encoding="utf-8")
        timing = {"providerMs": 0, "toolMs": 0, "providerCalls": 0}
        try:
            runner = run_chat if job.get("operation", "chat") == "chat" else run_one_call
            answer = runner(job, timing, worker_started)
        except Exception:
            # Emit only an outcome and numeric durations. Provider errors can contain
            # request data and credentials.
            answer = None
    json.dump({"answer": answer, "timing": timing}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
