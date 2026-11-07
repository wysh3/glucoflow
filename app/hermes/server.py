"""Private HTTP adapter for the pinned Hermes runtime."""

from collections import deque
from base64 import b64decode
from dataclasses import dataclass
from hashlib import sha256
from hmac import compare_digest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import select
import signal
import socket
import subprocess
from struct import unpack
import sys
from tempfile import TemporaryDirectory
from threading import BoundedSemaphore, Lock
from time import monotonic
from urllib.parse import urlsplit

from runtime import (
    EXTRACT_BODY_BYTES, EXTRACT_PROMPT_SHA256, MAX_PROVIDER_CALLS, NATIVE_SKILL_ROOT,
    RECORD_PLAN_BODY_BYTES, RECORD_PLAN_PROMPT_SHA256, PROGRESS_STAGES, elapsed_ms,
)
from policy import LANGUAGE_NAMES, MONITOR_PATTERNS

VERSION = "0.23.0"
COMMIT = "2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19"
ROOT = Path(__file__).resolve().parent
UPSTREAM = ROOT / "vendor" / "hermes-agent"
MAX_BODY_BYTES = 128 * 1024
CHAT_TIMEOUT_SECONDS = 60
STARTUP_TIMEOUT_SECONDS = 25
EXTRACT_TIMEOUT_SECONDS = 55
RECORD_PLAN_TIMEOUT_SECONDS = 30
PNG_DATA_URL_PREFIX = "data:image/png;base64,"
ROW_LIMITS = {"encounters": 250, "orders": 300, "events": 1000, "tasks": 300}


@dataclass(frozen=True)
class Provider:
    base_url: str
    model: str
    key: str

    @classmethod
    def load(cls):
        base_url = os.getenv("MODEL_BASE_URL", "").strip().rstrip("/")
        model = os.getenv("MODEL_NAME", "").strip()
        key = os.getenv("MODEL_API_KEY", "").strip()
        if os.getenv("GUIDE_MODE") == "live":
            base_url = base_url or os.getenv("GUIDE_BASE_URL", "").strip().rstrip("/")
            model = model or os.getenv("GUIDE_MODEL_NAME", "").strip()
            key = key or os.getenv("GUIDE_API_KEY", "").strip()
        try:
            url = urlsplit(base_url)
            # Force port validation before the provider can be used.
            _ = url.port
            transport_allowed = url.scheme == "https" or (
                url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1", "::1")
            )
            if (transport_allowed and url.hostname and not url.username and not url.password
                    and not url.query and not url.fragment and len(base_url) <= 500
                    and 0 < len(model) <= 180 and 0 < len(key) <= 4096):
                return cls(base_url, model, key)
        except ValueError:
            pass
        return None


def bounded_env(name, default, minimum, maximum):
    value = int(os.getenv(name.replace("HERMES_", "GLUCO_"), os.getenv(name, str(default))))
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}.")
    return value


def worker_env(directory, provider=None):
    # The worker receives only the model credential. No app DB, Azure or service token
    # credentials, local Hermes configuration, proxy settings or user plugins are inherited.
    env = {
        "PATH": os.defpath,
        "HERMES_HOME": directory,
        "PYTHONPATH": str(UPSTREAM),
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONUNBUFFERED": "1",
        "HERMES_IGNORE_RULES": "1",
        "HERMES_CONTAINER": "1",
        "HERMES_BUNDLED_PLUGINS": str(Path(directory) / "disabled-plugins"),
    }
    if provider:
        env["GLUCOFLOW_MODEL_KEY"] = provider.key
    return env


def upstream_ready():
    try:
        marker = UPSTREAM / "SOURCE_COMMIT"
        if marker.is_file():
            actual = marker.read_text(encoding="ascii").strip()
        else:
            actual = subprocess.check_output(
                ["git", "-C", str(UPSTREAM), "rev-parse", "HEAD"],
                stderr=subprocess.DEVNULL, text=True, timeout=5,
            ).strip()
        if actual != COMMIT:
            return False
        with TemporaryDirectory(prefix="glucoflow-hermes-check-") as home:
            subprocess.run(
                [sys.executable, str(ROOT / "runtime.py"), "--check"], cwd=home,
                env=worker_env(home), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                check=True, timeout=STARTUP_TIMEOUT_SECONDS,
            )
        return True
    except (OSError, subprocess.SubprocessError, UnicodeError):
        return False


def validate_request(body):
    required = {"message", "workspace", "history", "requestId"}
    if not isinstance(body, dict) or not required <= body.keys() <= required | {"languageCode"}:
        raise ValueError()
    language_code = body.get("languageCode", "en-IN")
    message, workspace, history, request_id = (
        body["message"], body["workspace"], body["history"], body["requestId"]
    )
    if (not isinstance(language_code, str) or language_code not in LANGUAGE_NAMES
            or not isinstance(message, str) or not message.strip() or len(message) > 4000
            or not isinstance(request_id, str) or not 0 < len(request_id) <= 180
            or not isinstance(history, list) or len(history) > 8
            or not isinstance(workspace, dict) or workspace.get("synthetic") is not True
            or workspace.get("role") not in ("doctor", "nurse", "lab", "coordinator")):
        raise ValueError()
    for turn in history:
        if (not isinstance(turn, dict) or set(turn) != {"role", "content"}
                or turn["role"] not in ("user", "assistant")
                or not isinstance(turn["content"], str) or len(turn["content"]) > 4000):
            raise ValueError()
    for key, limit in ROW_LIMITS.items():
        rows = workspace.get(key)
        if not isinstance(rows, list) or len(rows) > limit or any(
            not isinstance(row, dict) or not isinstance(row.get("id"), str)
            or not 0 < len(row["id"]) <= 180
            or (key in ("orders", "events", "tasks") and not isinstance(row.get("encounterId"), str))
            or (key == "events" and row.get("orderId") is not None
                and not isinstance(row["orderId"], str))
            for row in rows
        ):
            raise ValueError()
    feeds = workspace.get("feeds")
    if not isinstance(feeds, dict) or any(
        not isinstance(feeds.get(name), dict) or type(feeds[name].get("connected")) is not bool
        or not isinstance(feeds[name].get("lastSyncAt"), str)
        or len(feeds[name]["lastSyncAt"]) > 64
        for name in ("HIS", "LIS")
    ):
        raise ValueError()
    snapshot = {key: workspace[key] for key in ("role", "synthetic", *ROW_LIMITS, "feeds")}
    snapshot["feeds"] = {
        name: {key: feeds[name][key] for key in ("connected", "lastSyncAt")}
        for name in ("HIS", "LIS")
    }
    applicable_skills = workspace.get("applicableSkills", [])
    skill_keys = {"id", "version", "pattern", "title", "encounterId", "orderId"}
    order_scopes = {(row["encounterId"], row["id"]) for row in snapshot["orders"]}
    if not isinstance(applicable_skills, list) or len(applicable_skills) > 100:
        raise ValueError()
    for skill in applicable_skills:
        if (not isinstance(skill, dict) or set(skill) != skill_keys
                or type(skill["version"]) is not int or not 0 < skill["version"] <= 1_000_000
                or skill["pattern"] not in MONITOR_PATTERNS
                or any(not isinstance(skill[key], str) or not 0 < len(skill[key]) <= 180
                       for key in ("id", "title", "encounterId", "orderId"))
                or (skill["encounterId"], skill["orderId"]) not in order_scopes):
            raise ValueError()
    snapshot["applicableSkills"] = applicable_skills
    playbooks = workspace.get("playbooks", [])
    if not isinstance(playbooks, list):
        raise ValueError()
    for playbook in playbooks:
        if (isinstance(playbook, dict) and playbook.get("status") == "approved"
                and type(playbook.get("version")) is int and 0 < playbook["version"] <= 1_000_000
                and isinstance(playbook.get("body"), str) and len(playbook["body"]) <= 2000):
            try:
                layout = json.loads(playbook["body"])
            except (ValueError, RecursionError):
                continue
            if layout in ({"handoverOrder": "owner-first"}, {"handoverOrder": "source-first"}):
                snapshot["handoverLayout"] = {**layout, "version": playbook["version"]}
                break
    return {
        "message": message.strip(), "workspace": snapshot, "languageCode": language_code,
        "history": [{**turn, "content": turn["content"][:1500]} for turn in history],
    }


def validate_png_part(part):
    if (not isinstance(part, dict) or set(part) != {"type", "image_url"}
            or part["type"] != "image_url" or not isinstance(part["image_url"], dict)
            or set(part["image_url"]) != {"url"}):
        raise ValueError()
    url = part["image_url"]["url"]
    if not isinstance(url, str) or not url.startswith(PNG_DATA_URL_PREFIX):
        raise ValueError()
    data = b64decode(url[len(PNG_DATA_URL_PREFIX):], validate=True)
    if len(data) < 33 or data[:16] != b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR":
        raise ValueError()
    width, height = unpack(">II", data[16:24])
    if not (0 < width <= 4096 and 0 < height <= 4096):
        raise ValueError()


def validate_one_call(body, operation):
    if not isinstance(body, dict) or set(body) != {
        "model", "max_completion_tokens", "response_format", "messages",
    }:
        raise ValueError()
    extract = operation == "extract"
    model, max_tokens, messages = body["model"], body["max_completion_tokens"], body["messages"]
    if (not isinstance(model, str) or not 0 < len(model) <= 180
            or type(max_tokens) is not int or not 0 < max_tokens <= (4096 if extract else 900)
            or body["response_format"] != {"type": "json_object"}
            or not isinstance(messages, list) or len(messages) != 2
            or any(not isinstance(message, dict) or set(message) != {"role", "content"} for message in messages)
            or messages[0]["role"] != "system" or messages[1]["role"] != "user"):
        raise ValueError()
    system, user = messages[0]["content"], messages[1]["content"]
    accepted = {EXTRACT_PROMPT_SHA256} if extract else RECORD_PLAN_PROMPT_SHA256
    if (not isinstance(system, str) or len(system) > 6000
            or sha256(system.encode()).hexdigest() not in accepted):
        raise ValueError()
    if extract:
        if not isinstance(user, list) or not 1 <= len(user) <= 3:
            raise ValueError()
        text = user[0]
        if (not isinstance(text, dict) or set(text) != {"type", "text"} or text["type"] != "text"
                or not isinstance(text["text"], str) or not 0 < len(text["text"].encode()) <= 256 * 1024):
            raise ValueError()
        for part in user[1:]:
            validate_png_part(part)
    elif not isinstance(user, str) or not user.strip():
        raise ValueError()
    return {"operation": operation, "model": model, "maxOutputTokens": max_tokens, "system": system, "user": user}


class ClientDisconnected(Exception):
    """The API abandoned a chat; no answer should be persisted."""


def run_isolated(command, *, cwd, env, payload, deadline, cancelled=lambda: False, progress=lambda stage: None):
    """Bound process lifetime, including when the requesting API disconnects.

    communicate drains stdout while waiting, unlike a wait() loop which could
    deadlock when the pipe fills. Reservations intentionally survive cancellation.
    """
    if cancelled():
        raise ClientDisconnected()
    started = monotonic()
    progress_path = Path(cwd, "progress.ndjson")
    env = {**env, "GLUCO_PROGRESS_PATH": str(progress_path)}
    seen = 0

    def report_progress():
        nonlocal seen
        if not progress_path.exists():
            return
        # The isolated runtime can report at most 24 small allowlisted codes.
        if progress_path.stat().st_size > 1024:
            raise ValueError("Progress journal limit exceeded")
        lines = progress_path.read_text(encoding="utf-8").splitlines()
        if len(lines) > 24:
            raise ValueError("Progress event limit exceeded")
        for stage in lines[seen:]:
            if stage not in PROGRESS_STAGES:
                raise ValueError("Invalid progress stage")
            progress(stage)
        seen = len(lines)

    with subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.PIPE,
                          stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                          text=True, start_new_session=True) as process:
        first = True
        try:
            while True:
                report_progress()
                if cancelled():
                    raise ClientDisconnected()
                remaining = deadline - (monotonic() - started)
                if remaining <= 0:
                    raise subprocess.TimeoutExpired(command, deadline)
                try:
                    output, _ = process.communicate(input=payload if first else None,
                                                    timeout=min(0.1, remaining))
                    report_progress()
                    if process.returncode:
                        raise subprocess.CalledProcessError(process.returncode, command)
                    return output
                except subprocess.TimeoutExpired:
                    first = False
        finally:
            if process.poll() is None:
                # All turn descendants belong to this private process group.
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.communicate()


class Service:
    def __init__(self):
        self.token = os.getenv("GLUCO_SERVICE_TOKEN", os.getenv("HERMES_SERVICE_TOKEN", "")).strip()
        self.provider = Provider.load()
        self.ready = upstream_ready()
        self.active = BoundedSemaphore(bounded_env("HERMES_MAX_CONCURRENT", 2, 1, 4))
        self.hourly_cap = bounded_env("HERMES_MAX_PROVIDER_CALLS_PER_HOUR", 60, 3, 1000)
        self.reservations = deque()
        self.lock = Lock()

    def health(self):
        configured = self.provider is not None and len(self.token) >= 24
        return {
            "available": self.ready and configured, "configured": configured,
            "engine": "hermes", "version": VERSION, "commit": COMMIT,
            "model": self.provider.model if configured else None,
            "extractionAvailable": self.ready and configured and
                (NATIVE_SKILL_ROOT / "document-extraction" / "SKILL.md").is_file(),
            "recordPlanAvailable": self.ready and configured and
                (NATIVE_SKILL_ROOT / "record-plan" / "SKILL.md").is_file(),
        }

    def reserve(self, calls):
        with self.lock:
            now = monotonic()
            while self.reservations and now - self.reservations[0][0] >= 3600:
                self.reservations.popleft()
            if sum(count for _, count in self.reservations) + calls > self.hourly_cap:
                return False
            self.reservations.append((now, calls))
            return True

    def run(self, job, cancelled=lambda: False, progress=lambda stage: None):
        operation = job.get("operation", "chat")
        health = self.health()
        availability, deadline, calls = {
            "chat": ("available", CHAT_TIMEOUT_SECONDS, MAX_PROVIDER_CALLS),
            "extract": ("extractionAvailable", EXTRACT_TIMEOUT_SECONDS, 1),
            "record-plan": ("recordPlanAvailable", RECORD_PLAN_TIMEOUT_SECONDS, 1),
        }[operation]
        if not health[availability]:
            return 503, {"error": "Gluco runtime is unavailable."}, {}
        if job.get("model", self.provider.model) != self.provider.model:
            return 422, {"error": "Requested model is not configured."}, {}
        if not self.active.acquire(blocking=False):
            return 429, {"error": "Gluco runtime is busy."}, {}
        started = monotonic()
        try:
            if not self.reserve(calls):
                return 429, {"error": "Gluco provider call budget reached."}, {}
            with TemporaryDirectory(prefix="glucoflow-hermes-") as home:
                output = run_isolated(
                    [sys.executable, str(ROOT / "runtime.py")], cwd=home,
                    env=worker_env(home, self.provider), payload=json.dumps({
                        **job, "model": self.provider.model, "baseUrl": self.provider.base_url,
                    }), deadline=deadline, cancelled=cancelled, progress=progress,
                )
                result = json.loads(output)
                timing = {**result["timing"], "workerMs": elapsed_ms(started)}
                if result["answer"] is not None:
                    return 200, result["answer"], timing
                return 503, {"error": "Gluco could not complete a verified response."}, timing
        except ClientDisconnected:
            return 499, {"error": "Chat was cancelled."}, {"workerMs": elapsed_ms(started)}
        except subprocess.TimeoutExpired:
            return 504, {"error": "Gluco exceeded its response deadline."}, {"workerMs": elapsed_ms(started)}
        except (OSError, subprocess.SubprocessError, ValueError):
            return 503, {"error": "Gluco could not complete a verified response."}, {"workerMs": elapsed_ms(started)}
        finally:
            self.active.release()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        # Suppress the default HTTP access log. No requests, bodies, headers or model errors.
        pass

    def send_json(self, status, payload, timing=None):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        if timing:
            self.send_header("X-Hermes-Timing", json.dumps(timing, separators=(",", ":")))
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def has_service_authorization(self):
        token = self.server.service.token
        provided = self.headers.get("Authorization", "").encode("utf-8")
        return len(token) >= 24 and compare_digest(provided, f"Bearer {token}".encode("utf-8"))

    def do_GET(self):
        if self.path == "/health":
            if "Authorization" in self.headers and not self.has_service_authorization():
                self.send_json(401, {"error": "Internal service authorization is required."})
                return
            service = self.server.service
            self.send_json(200 if service.ready else 503, service.health())
        else:
            self.send_json(404, {"error": "Unknown route."})

    def client_disconnected(self):
        # The body has already been fully read. Readability now means either a
        # closed peer (empty peek) or another HTTP byte; never consume that byte.
        try:
            readable, _, _ = select.select([self.connection], [], [], 0)
            return bool(readable) and self.connection.recv(1, socket.MSG_PEEK | socket.MSG_DONTWAIT) == b""
        except BlockingIOError:
            return False
        except OSError:
            return True

    def do_POST(self):
        limits = {"/chat": MAX_BODY_BYTES, "/extract": EXTRACT_BODY_BYTES, "/record-plan": RECORD_PLAN_BODY_BYTES}
        if self.path not in limits:
            self.send_json(404, {"error": "Unknown route."})
            return
        service = self.server.service
        if not self.has_service_authorization():
            self.send_json(401, {"error": "Internal service authorization is required."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length > limits[self.path]:
            self.send_json(413, {"error": "Gluco request is too large."})
            return
        if length <= 0 or self.headers.get_content_type() != "application/json":
            self.send_json(422, {"error": "A valid Gluco request is required."})
            return
        large = self.path == "/extract"
        if large and not self.server.extraction_requests.acquire(blocking=False):
            self.send_json(429, {"error": "Gluco extraction is busy."})
            return
        try:
            try:
                body = json.loads(self.rfile.read(length))
                job = validate_request(body) if self.path == "/chat" else validate_one_call(body, self.path[1:])
            except (ValueError, UnicodeError, RecursionError):
                self.send_json(422, {"error": "A valid scoped Gluco request is required."})
                return
            # Only interactive chat is client-cancellable. Durable extraction
            # jobs retain their existing lease/budget lifecycle independently.
            cancelled = self.client_disconnected if self.path == "/chat" else lambda: False
            streaming = self.path == "/chat" and self.headers.get("Accept") == "application/x-ndjson"
            if streaming:
                self.send_response(200)
                self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Connection", "close")
                self.end_headers()
                self.close_connection = True
                def emit(frame):
                    try:
                        self.wfile.write((json.dumps(frame, separators=(",", ":")) + "\n").encode("utf-8"))
                        self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError):
                        raise ClientDisconnected()
                try:
                    status, payload, timing = service.run(job, cancelled, lambda stage: emit({"type": "progress", "stage": stage}))
                    if not cancelled():
                        emit({"type": "result", "status": status, "payload": payload, "timing": timing})
                except ClientDisconnected:
                    pass
            else:
                status, payload, timing = service.run(job, cancelled)
                if not cancelled():
                    self.send_json(status, payload, timing)
        finally:
            if large:
                self.server.extraction_requests.release()


class Server(ThreadingHTTPServer):
    request_queue_size = 8

    def __init__(self, address, service):
        self.service = service
        self.sockets = BoundedSemaphore(12)
        self.extraction_requests = BoundedSemaphore(1)
        super().__init__(address, Handler)

    def process_request(self, request, client_address):
        if not self.sockets.acquire(blocking=False):
            self.shutdown_request(request)
            return
        request.settimeout(6)
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.sockets.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.sockets.release()

    def handle_error(self, *_):
        # Broken client connections or timeouts must not log headers or payloads.
        pass


if __name__ == "__main__":
    with Server((os.getenv("GLUCO_BIND_HOST", os.getenv("HERMES_BIND_HOST", "127.0.0.1")),
                 bounded_env("PORT", 8080, 1, 65535)), Service()) as server:
        server.serve_forever()
