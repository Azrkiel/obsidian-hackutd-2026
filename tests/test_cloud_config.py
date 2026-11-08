import json

import pytest

from coach.cloud_config import CloudConfig, CloudConfigError, load_config, save_profile, validate_url
from coach.cloud_credentials import CloudCredentialError, CredentialStore


IDENTITY = "ab" * 32


class MemoryCredentials:
    def __init__(self):
        self.values = {}

    def get_token(self, url, database, identity):
        return self.values.get((url, database, identity))

    def set_token(self, url, database, identity, token):
        self.values[url, database, identity] = token

    def delete_token(self, url, database, identity):
        self.values.pop((url, database, identity), None)


def profile(tmp_path, store, **overrides):
    cfg = CloudConfig("https://maincloud.spacetimedb.com", "pitpal-history", "private-token", IDENTITY,
                      "device-1", "game-pc", **overrides)
    store.set_token(cfg.url, cfg.database, cfg.identity, cfg.token)
    save_profile(tmp_path, cfg)
    return cfg


def test_unconfigured_is_disabled_and_does_not_access_store(tmp_path):
    assert load_config(tmp_path, environ={}, store=object()) is None


def test_profile_keeps_token_only_in_credential_store(tmp_path):
    store = MemoryCredentials()
    cfg = profile(tmp_path, store)
    assert load_config(tmp_path, environ={}, store=store) == cfg
    text = (tmp_path / "cloud" / "config.json").read_text()
    assert "private-token" not in text and '"token"' not in text
    assert cfg.token not in repr(cfg)
    assert cfg.binding == {"url": cfg.url, "database": cfg.database, "identity": cfg.identity}


def test_disabled_profile_does_not_need_secret(tmp_path):
    store = MemoryCredentials()
    profile(tmp_path, store, enabled=False)
    assert load_config(tmp_path, environ={}, store=object()) is None


def test_profile_missing_credential_is_safe_error(tmp_path):
    store = MemoryCredentials()
    profile(tmp_path, store)
    with pytest.raises(CloudConfigError, match="credential"):
        load_config(tmp_path, environ={}, store=MemoryCredentials())


def test_environment_override_is_complete_and_can_defer_public_identity(tmp_path):
    cfg = load_config(tmp_path, environ={"SPACETIMEDB_URL": "http://127.0.0.1:3000/",
        "SPACETIMEDB_DATABASE": "test-db", "SPACETIMEDB_TOKEN": "secret"})
    assert cfg.url == "http://127.0.0.1:3000"
    assert cfg.identity == cfg.device_id == ""
    assert cfg.token == "secret" and "secret" not in repr(cfg)


def test_environment_override_uses_optional_public_ids(tmp_path):
    cfg = load_config(tmp_path, environ={"SPACETIMEDB_URL": "https://example.com",
        "SPACETIMEDB_DATABASE": "history", "SPACETIMEDB_TOKEN": "secret",
        "SPACETIMEDB_IDENTITY": IDENTITY, "SPACETIMEDB_DEVICE_ID": "device-1"})
    assert cfg.identity == IDENTITY and cfg.device_id == "device-1"


@pytest.mark.parametrize("env", [{"SPACETIMEDB_URL": "https://example.com"},
    {"SPACETIMEDB_TOKEN": "secret"}, {"SPACETIMEDB_DATABASE": "db", "SPACETIMEDB_TOKEN": ""}])
def test_partial_environment_configuration_is_rejected(tmp_path, env):
    with pytest.raises(CloudConfigError) as error:
        load_config(tmp_path, environ=env)
    assert "secret" not in str(error.value)


@pytest.mark.parametrize("url", ["http://example.com", "https://user:secret@example.com",
    "https://example.com/?token=secret", "https://example.com/#secret", "file:///tmp/x",
    "https://example.com/path", "http://127.0.0.1.example.com", "https://example.com:bad"])
def test_unsafe_server_urls_are_rejected_without_echoing_input(url):
    with pytest.raises(CloudConfigError) as error:
        validate_url(url)
    assert "secret" not in str(error.value)


@pytest.mark.parametrize("url", ["https://example.com/?", "https://example.com/#"])
def test_empty_query_or_fragment_delimiters_are_not_api_roots(url):
    with pytest.raises(CloudConfigError):
        validate_url(url)


@pytest.mark.parametrize("url", ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000",
    "https://maincloud.spacetimedb.com"])
def test_https_or_loopback_servers_allowed(url):
    assert validate_url(url) == url


def test_malformed_profile_and_plaintext_secret_are_rejected(tmp_path):
    path = tmp_path / "cloud" / "config.json"
    path.parent.mkdir()
    path.write_text('{"token":"never-print-this"}')
    with pytest.raises(CloudConfigError) as error:
        load_config(tmp_path, environ={})
    assert "never-print-this" not in str(error.value)
    path.write_text("{")
    with pytest.raises(CloudConfigError):
        load_config(tmp_path, environ={})


def test_invalid_database_cannot_become_an_api_path(tmp_path):
    with pytest.raises(CloudConfigError):
        load_config(tmp_path, environ={"SPACETIMEDB_URL": "https://example.com",
            "SPACETIMEDB_DATABASE": "../db?token=oops", "SPACETIMEDB_TOKEN": "secret"})


class Backend:
    def __init__(self):
        self.values = {}

    def get_password(self, service, account):
        return self.values.get((service, account))

    def set_password(self, service, account, password):
        self.values[service, account] = password

    def delete_password(self, service, account):
        self.values.pop((service, account), None)


def test_store_binds_credentials_to_cluster_database_and_identity():
    store = CredentialStore(backend=Backend())
    store.set_token("https://one.example", "db", IDENTITY, "secret")
    assert store.get_token("https://one.example", "db", IDENTITY) == "secret"
    assert store.get_token("https://two.example", "db", IDENTITY) is None
    assert store.get_token("https://one.example", "other", IDENTITY) is None
    store.delete_token("https://one.example", "db", IDENTITY)
    assert store.get_token("https://one.example", "db", IDENTITY) is None


def test_credential_errors_are_redacted():
    class Broken(Backend):
        def set_password(self, *args):
            raise RuntimeError("backend leaked secret")
    with pytest.raises(CloudCredentialError) as error:
        CredentialStore(backend=Broken()).set_token("https://example.com", "db", IDENTITY, "secret")
    assert "secret" not in str(error.value)
