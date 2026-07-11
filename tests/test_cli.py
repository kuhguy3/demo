import json

from playground import cli
from playground.engagement import Engagement


def test_headers_command_records_finding_and_prints_json(tmp_path, local_server, capsys):
    engagement_dir = tmp_path / "eng"
    exit_code = cli.main(
        ["headers", local_server + "/", "--engagement", str(engagement_dir), "--json", "--no-interactive"]
    )
    assert exit_code == 0

    out = capsys.readouterr().out
    payload = json.loads(out)
    assert payload["status_code"] == 200

    findings = json.loads((engagement_dir / "findings.json").read_text())
    assert findings[0]["tool"] == "headers"
    assert (engagement_dir / "report.md").exists()
    assert (engagement_dir / "audit.log").exists()


def test_out_of_scope_target_is_blocked(tmp_path, local_server, capsys):
    engagement_dir = tmp_path / "eng"
    engagement = Engagement(engagement_dir)
    engagement.scope.add("only-this-domain.example")
    engagement.scope.save(engagement.scope_path)

    exit_code = cli.main(
        ["headers", local_server + "/", "--engagement", str(engagement_dir), "--json", "--no-interactive"]
    )
    assert exit_code == 1
    err = capsys.readouterr().err
    assert "not authorized" in err


def test_scope_add_and_list(tmp_path, capsys):
    engagement_dir = tmp_path / "eng"
    assert cli.main(["scope", "init", "--engagement", str(engagement_dir)]) == 0
    assert cli.main(["scope", "add", "example.com", "--engagement", str(engagement_dir)]) == 0
    capsys.readouterr()

    assert cli.main(["scope", "list", "--engagement", str(engagement_dir)]) == 0
    out = capsys.readouterr().out
    assert "example.com" in out
