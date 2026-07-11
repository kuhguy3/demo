from playground.recon import subdomains


def test_enumerate_returns_only_resolvable_hosts(monkeypatch):
    def fake_gethostbyname(host):
        if host == "www.example.com":
            return "93.184.216.34"
        raise __import__("socket").gaierror("not found")

    monkeypatch.setattr(subdomains.socket, "gethostbyname", fake_gethostbyname)

    results = subdomains.enumerate("example.com", wordlist=["www", "doesnotexist"], max_workers=2)
    assert results == [("www.example.com", "93.184.216.34")]


def test_format_results_reports_none_found():
    text = subdomains.format_results("example.com", [])
    assert "none found" in text
