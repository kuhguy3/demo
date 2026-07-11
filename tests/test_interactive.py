from playground import interactive
from playground.engagement import Engagement


def test_prompt_menu_returns_selected_index(monkeypatch):
    monkeypatch.setattr("builtins.input", lambda _: "2")
    assert interactive.prompt_menu("pick one", ["a", "b", "c"]) == 1


def test_prompt_menu_done_returns_none(monkeypatch):
    monkeypatch.setattr("builtins.input", lambda _: "0")
    assert interactive.prompt_menu("pick one", ["a", "b"]) is None


def test_prompt_menu_blank_input_returns_none(monkeypatch):
    monkeypatch.setattr("builtins.input", lambda _: "")
    assert interactive.prompt_menu("pick one", ["a", "b"]) is None


def test_prompt_menu_out_of_range_returns_none(monkeypatch):
    monkeypatch.setattr("builtins.input", lambda _: "99")
    assert interactive.prompt_menu("pick one", ["a", "b"]) is None


def test_is_interactive_respects_no_interactive_flag():
    assert interactive.is_interactive(no_interactive=True, as_json=False) is False


def test_is_interactive_respects_json_flag():
    assert interactive.is_interactive(no_interactive=False, as_json=True) is False


def test_drill_down_url_dispatches_to_fingerprint(tmp_path, local_server, monkeypatch):
    engagement = Engagement(tmp_path / "eng")
    responses = iter(["1", "0"])  # pick "fingerprint", then quit
    monkeypatch.setattr("builtins.input", lambda _: next(responses))

    interactive.drill_down_url(engagement, local_server + "/", as_json=True)

    findings = __import__("json").loads(engagement.findings_path.read_text())
    assert any(f["tool"] == "fingerprint" for f in findings)
