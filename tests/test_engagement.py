import json

import pytest

from playground.engagement import Engagement, ScopeViolation


def test_require_authorized_passes_when_unenforced(tmp_path):
    engagement = Engagement(tmp_path / "engagement")
    engagement.require_authorized("example.com")  # should not raise


def test_require_authorized_blocks_out_of_scope_target(tmp_path):
    engagement = Engagement(tmp_path / "engagement")
    engagement.scope.save(engagement.scope_path)  # enforced, empty
    with pytest.raises(ScopeViolation):
        engagement.require_authorized("example.com")


def test_audit_appends_jsonl_entries(tmp_path):
    engagement = Engagement(tmp_path / "engagement")
    engagement.audit("scan", {"host": "example.com"})
    engagement.audit("headers", {"url": "https://example.com"})

    lines = engagement.audit_path.read_text().splitlines()
    assert len(lines) == 2
    first = json.loads(lines[0])
    assert first["command"] == "scan"
    assert first["args"] == {"host": "example.com"}
    assert "timestamp" in first


def test_record_finding_writes_findings_and_report(tmp_path):
    engagement = Engagement(tmp_path / "engagement")
    engagement.record_finding("scan", "example.com", [{"port": 80, "open": True}], "80/tcp open")

    findings = json.loads(engagement.findings_path.read_text())
    assert len(findings) == 1
    assert findings[0]["tool"] == "scan"
    assert findings[0]["target"] == "example.com"
    assert findings[0]["data"] == [{"port": 80, "open": True}]

    report = engagement.report_path.read_text()
    assert "example.com" in report
    assert "80/tcp open" in report


def test_record_finding_serializes_dataclasses_and_sets(tmp_path):
    from dataclasses import dataclass

    @dataclass
    class Thing:
        name: str
        tags: set

    engagement = Engagement(tmp_path / "engagement")
    engagement.record_finding("fingerprint", "example.com", Thing(name="x", tags={"b", "a"}), "summary")

    findings = json.loads(engagement.findings_path.read_text())
    assert findings[0]["data"] == {"name": "x", "tags": ["a", "b"]}
