from playground.webtest import fingerprint


def test_fingerprint_flags_missing_security_headers(local_server):
    result = fingerprint.fingerprint(local_server + "/")
    assert result.missing_security_headers == fingerprint.SECURITY_HEADERS
    assert "session" in result.cookies_seen


def test_format_result_reports_no_missing_headers():
    result = fingerprint.FingerprintResult(url="http://x", missing_security_headers=[])
    text = fingerprint.format_result(result)
    assert "none — all checked headers present" in text
