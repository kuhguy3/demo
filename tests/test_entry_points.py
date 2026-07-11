from playground.webtest import entry_points


def test_discover_forms_finds_login_form(local_server):
    forms = entry_points.discover_forms(local_server + "/login")
    assert len(forms) == 1
    form = forms[0]
    assert form.method == "POST"
    assert form.action == local_server + "/do-login"
    assert set(form.inputs) == {"username", "password"}


def test_hidden_content_parses_robots_and_sitemap(local_server):
    paths = entry_points.hidden_content(local_server)
    assert "/admin" in paths
    assert "/backup" in paths
    assert "http://example.com/page1" in paths
