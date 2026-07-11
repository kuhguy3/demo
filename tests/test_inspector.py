from playground.webtest import inspector


def test_inspect_reports_status_and_headers(local_server):
    result = inspector.inspect(local_server + "/")
    assert result.status_code == 200
    assert result.cookies.get("session") == "abc123"
    assert "Content-Type" in result.headers


def test_inspect_reports_404(local_server):
    result = inspector.inspect(local_server + "/missing")
    assert result.status_code == 404
