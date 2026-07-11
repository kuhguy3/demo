"""Engagement workspace: scope enforcement, audit logging, and findings/report tracking."""

from __future__ import annotations

import dataclasses
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playground.report import render_markdown
from playground.scope import Scope


class ScopeViolation(Exception):
    pass


class Engagement:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.scope_path = root / "scope.yaml"
        self.audit_path = root / "audit.log"
        self.findings_path = root / "findings.json"
        self.report_path = root / "report.md"
        self.scope = Scope.load(self.scope_path)

    def require_authorized(self, target: str) -> None:
        if not self.scope.is_authorized(target):
            raise ScopeViolation(
                f"'{target}' is not authorized in this engagement's scope ({self.scope_path}). "
                f"Run `playground scope add {target}` to authorize it first."
            )

    def audit(self, command: str, args: dict[str, Any]) -> None:
        entry = {
            "timestamp": _now(),
            "command": command,
            "args": args,
        }
        with self.audit_path.open("a") as f:
            f.write(json.dumps(entry) + "\n")

    def record_finding(self, tool: str, target: str, data: Any, summary: str) -> None:
        findings = self._load_findings()
        findings.append(
            {
                "timestamp": _now(),
                "tool": tool,
                "target": target,
                "data": _to_jsonable(data),
                "summary": summary,
            }
        )
        self.findings_path.write_text(json.dumps(findings, indent=2))
        self.report_path.write_text(render_markdown(findings))

    def _load_findings(self) -> list[dict]:
        if self.findings_path.exists():
            return json.loads(self.findings_path.read_text())
        return []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_jsonable(value: Any) -> Any:
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {f.name: _to_jsonable(getattr(value, f.name)) for f in dataclasses.fields(value)}
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_jsonable(v) for v in value]
    if isinstance(value, set):
        return sorted(_to_jsonable(v) for v in value)
    return value
