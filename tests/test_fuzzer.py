from playground.webtest import fuzzer


def test_fuzz_finds_known_path(local_server):
    results = fuzzer.fuzz(local_server, wordlist=["secret", "nope"], delay=0, max_workers=2)
    by_path = {r.path: r for r in results}
    assert by_path["secret"].status_code == 200
    assert by_path["nope"].status_code == 404


def test_format_results_hides_404s():
    results = [
        fuzzer.FuzzResult(path="secret", url="x", status_code=200, length=10),
        fuzzer.FuzzResult(path="nope", url="x", status_code=404, length=9),
    ]
    text = fuzzer.format_results(results)
    assert "secret" in text
    assert "nope" not in text
