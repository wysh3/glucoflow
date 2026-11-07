"""Operational precedence for independent source events."""
from copy import deepcopy
from datetime import UTC, datetime, timedelta
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from policy import CareTools
from server import validate_request
from test_sidecar import PAYLOAD


def add_event(snapshot, event_id, kind, source, occurred_at):
    snapshot["events"].append({
        "id": event_id, "kind": kind, "source": source, "orderId": "O-1",
        "encounterId": "E-1", "occurredAt": occurred_at,
    })


def order_response(snapshot, question="What is the order status?", kind="order_status"):
    tools = CareTools(snapshot, question)
    tools.read({"orderId": "O-1"})
    tools.respond({"kind": kind, "orderId": "O-1"})
    return tools.output


class SourcePolicyTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = deepcopy(PAYLOAD["workspace"])

    def test_cancellation_takes_priority_when_backdated(self):
        add_event(self.snapshot, "EV-2", "order_cancelled", "HIS", "2026-11-07T04:59:00Z")
        response = order_response(self.snapshot, "Monitor this order.", "monitor")
        self.assertEqual(response["sources"], ["EV-2"])
        self.assertIn("cancellation", response["reply"])
        self.assertEqual(response["proposals"], [])

    def test_correction_reopens_acknowledgement_even_if_backdated(self):
        add_event(self.snapshot, "EV-2", "result_validated", "LIS", "2026-11-07T05:03:00Z")
        add_event(self.snapshot, "EV-3", "result_acknowledged", "HIS", "2026-11-07T05:04:00Z")
        add_event(self.snapshot, "EV-4", "result_corrected", "LIS", "2026-11-07T05:03:00Z")
        response = order_response(self.snapshot, "Monitor acknowledgement.", "monitor")
        self.assertEqual(response["sources"], ["EV-4"])
        self.assertIn("correction", response["reply"])
        self.assertIn("acknowledgement", response["proposals"][0]["title"])
        self.assertEqual(response["proposals"][0]["body"], "result_acknowledgement")

    def test_stale_feed_keeps_missing_receipt_unverified(self):
        self.snapshot["feeds"]["LIS"]["lastSyncAt"] = (datetime.now(UTC) - timedelta(minutes=16)).isoformat()
        response = order_response(self.snapshot)
        self.assertIn("LIS feed is stale", response["reply"])
        self.assertNotIn("elapsed against", response["reply"])

    def test_fresh_feeds_show_configured_local_receipt_target(self):
        now = datetime.now(UTC)
        for feed in self.snapshot["feeds"].values():
            feed["lastSyncAt"] = now.isoformat()
        self.snapshot["events"][0]["occurredAt"] = (now - timedelta(minutes=33)).isoformat()
        response = order_response(self.snapshot)
        self.assertIn("33 min elapsed against the 30 min local receipt target", response["reply"])

    def test_received_specimen_does_not_propose_redundant_receipt_monitor(self):
        add_event(self.snapshot, "EV-2", "specimen_received", "LIS", "2026-11-07T05:03:00Z")
        response = order_response(self.snapshot, "Monitor specimen receipt.", "monitor")
        self.assertEqual(response["sources"], ["EV-2"])
        self.assertEqual(response["proposals"], [])

    def test_unqualified_summary_stays_inside_the_read_scope(self):
        self.snapshot["encounters"].append({"id": "E-2", "patientCode": "SYN-2"})
        self.snapshot["orders"].append({"id": "O-2", "encounterId": "E-2", "testName": "Neighbor order"})
        tools = CareTools(self.snapshot, "Summarize this order.")
        tools.read({"orderId": "O-1"})
        tools.respond({"kind": "summary"})
        self.assertNotIn("Neighbor order", tools.output["reply"])
        self.assertEqual(tools.output["sources"], ["EV-1"])

    def test_clinical_question_cannot_stage_a_workflow_proposal(self):
        tools = CareTools(self.snapshot, "What dose of insulin should I give?")
        tools.respond({"kind": "playbook", "handoverOrder": "owner-first"})
        self.assertIn("treatment decisions require your care team", tools.output["reply"])
        self.assertEqual(tools.output["proposals"], [])

    def test_handover_uses_only_the_approved_layout(self):
        payload = deepcopy(PAYLOAD)
        payload["workspace"]["playbooks"] = [
            {"status": "draft", "version": 3, "body": '{"handoverOrder":"owner-first"}'},
            {"status": "approved", "version": 2, "body": '{"handoverOrder":"source-first"}'},
        ]
        snapshot = validate_request(payload)["workspace"]
        tools = CareTools(snapshot, "Prepare the shift handover.")
        tools.read({})
        tools.respond({"kind": "handover"})
        body = tools.output["proposals"][0]["body"]
        self.assertIn("Playbook v2", body)
        self.assertLess(body.index("Evidence ·"), body.index("Encounter assignee ·"))

    def test_reads_and_renders_documented_context_with_encounter_provenance(self):
        self.snapshot["encounters"].append({"id": "E-2", "patientCode": "SYN-2",
                                             "documentedContext": ["Neighbor note"]})
        tools = CareTools(self.snapshot, "What is documented for SYN-1?")
        result = json.loads(tools.read({"lookup": "SYN-1"}))
        context = result["encounters"][0]["documentedContext"]
        self.assertEqual(context["origin"], "synthetic encounter record")
        self.assertEqual(context["entries"], ["DKA pathway documented"])
        tools.respond({"kind": "encounter_context"})
        self.assertIn("Recorded in synthetic encounter SYN-1", tools.output["reply"])
        self.assertIn("DKA pathway documented", tools.output["reply"])
        self.assertNotIn("Neighbor note", tools.output["reply"])
        self.assertEqual(tools.output["sources"], [])

    def test_localized_context_preserves_the_literal_note_and_demo_code(self):
        note = "Literal measurement 7.1 %"
        self.snapshot["encounters"][0]["documentedContext"] = [note]
        tools = CareTools(self.snapshot, "SYN-1", language_code="hi-IN")
        tools.read({"lookup": "SYN-1"})
        tools.respond({"kind": "encounter_context"})
        self.assertIn(f"• {note}", tools.output["reply"])
        self.assertIn("SYN-1", tools.output["reply"])
        self.assertIn("कृत्रिम", tools.output["reply"])

    def test_known_language_without_templates_is_labelled_english(self):
        tools = CareTools(self.snapshot, "Worklist", language_code="ta-IN")
        tools.respond({"kind": "help"})
        self.assertEqual(tools.output["languageCode"], "en-IN")
        self.assertTrue(tools.output["reply"].startswith("English fallback · Synthetic workspace"))

    def test_ambiguous_exact_name_cannot_select_an_encounter(self):
        self.snapshot["encounters"].append({"id": "E-2", "patientCode": "SYN-2", "patientName": "Demo"})
        tools = CareTools(self.snapshot, "What is documented for Demo?")
        result = json.loads(tools.read({"lookup": "demo"}))
        self.assertEqual(result["error"], "More than one record matches. Ask for an exact demo or specimen code.")
        tools.respond({"kind": "clarify"})
        self.assertEqual(tools.output["sources"], [])

    def test_handover_names_the_open_task_owner(self):
        self.snapshot["encounters"][0]["assignedTo"] = "Encounter clinician"
        self.snapshot["tasks"] = [
            {"id": "T-1", "encounterId": "E-1", "orderId": "O-1",
             "owner": "Lab team", "title": "Verify receipt", "status": "monitoring"},
            {"id": "T-2", "encounterId": "E-1", "orderId": "O-1",
             "owner": "Closed owner", "title": "Old task", "status": "source_confirmed"},
        ]
        tools = CareTools(self.snapshot, "Prepare a handover for SYN-1.")
        tools.read({"encounterId": "E-1"})
        tools.respond({"kind": "handover"})
        self.assertIn("Owner · Lab team", tools.output["reply"])
        self.assertNotIn("Closed owner", tools.output["reply"])

    def test_skill_annotation_uses_matching_fresh_pending_order(self):
        skill_id = "d60c40a2-2348-4115-90eb-02b6f56dfb38"
        payload = deepcopy(PAYLOAD)
        now = datetime.now(UTC).isoformat()
        for feed in payload["workspace"]["feeds"].values():
            feed["lastSyncAt"] = now
        payload["workspace"]["applicableSkills"] = [{
            "id": skill_id, "version": 2, "pattern": "specimen_receipt",
            "title": "Verify specimen handoff", "encounterId": "E-1", "orderId": "O-1",
        }]
        snapshot = validate_request(payload)["workspace"]
        tools = CareTools(snapshot, "Monitor specimen receipt.")
        read = json.loads(tools.read({"orderId": "O-1"}))
        self.assertEqual(read["applicableSkills"][0]["id"], skill_id)
        tools.respond({"kind": "monitor", "orderId": "O-1"})
        self.assertEqual(tools.output["proposals"][0]["skillId"], skill_id)
        self.assertIn("approved workflow skill v2", tools.output["reply"])
        snapshot["feeds"]["LIS"]["connected"] = False
        stale = order_response(snapshot, "Monitor specimen receipt.", "monitor")
        self.assertNotIn("skillId", stale["proposals"][0])


if __name__ == "__main__":
    unittest.main()
