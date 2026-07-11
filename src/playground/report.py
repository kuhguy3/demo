"""Render an engagement's accumulated findings into a Markdown report."""

from __future__ import annotations

from collections import defaultdict


def render_markdown(findings: list[dict]) -> str:
    lines = ["# Engagement Report", "", f"Total findings recorded: {len(findings)}", ""]

    by_target: dict[str, list[dict]] = defaultdict(list)
    for finding in findings:
        by_target[finding["target"]].append(finding)

    for target in sorted(by_target):
        lines.append(f"## {target}")
        lines.append("")
        for finding in by_target[target]:
            lines.append(f"### {finding['tool']} — {finding['timestamp']}")
            lines.append("")
            lines.append("```")
            lines.append(finding["summary"])
            lines.append("```")
            lines.append("")

    return "\n".join(lines)
