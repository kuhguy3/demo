from playground.scope import Scope


def test_unenforced_scope_authorizes_everything(tmp_path):
    scope = Scope.load(tmp_path / "scope.yaml")
    assert scope.enforced is False
    assert scope.is_authorized("anything.example.com") is True
    assert scope.is_authorized("10.0.0.1") is True


def test_enforced_empty_scope_authorizes_nothing(tmp_path):
    path = tmp_path / "scope.yaml"
    Scope(entries=[]).save(path)
    scope = Scope.load(path)
    assert scope.enforced is True
    assert scope.is_authorized("example.com") is False


def test_domain_and_subdomain_match(tmp_path):
    path = tmp_path / "scope.yaml"
    Scope(entries=["example.com"]).save(path)
    scope = Scope.load(path)
    assert scope.is_authorized("example.com") is True
    assert scope.is_authorized("www.example.com") is True
    assert scope.is_authorized("https://api.example.com/path") is True
    assert scope.is_authorized("evil.com") is False


def test_ip_and_cidr_match(tmp_path):
    path = tmp_path / "scope.yaml"
    Scope(entries=["10.0.0.0/24", "192.168.1.1"]).save(path)
    scope = Scope.load(path)
    assert scope.is_authorized("10.0.0.5") is True
    assert scope.is_authorized("10.0.1.5") is False
    assert scope.is_authorized("192.168.1.1") is True
    assert scope.is_authorized("192.168.1.2") is False


def test_add_is_idempotent(tmp_path):
    scope = Scope()
    scope.add("example.com")
    scope.add("example.com")
    assert scope.entries == ["example.com"]
