import importlib

import pytest


def test_config_env_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    import config as config_module

    overrides = {
        "GITHUB_CLIENT_ID": "abc123",
        "MAX_ITEMS_PER_SECTION": "7",
        "FRONTEND_URL": "http://example.com",
        "DB_POOL_SIZE": "15",
        "DB_MAX_OVERFLOW": "5",
    }

    for key, value in overrides.items():
        monkeypatch.setenv(key, value)

    config = importlib.reload(config_module)

    assert config.GITHUB_CLIENT_ID == "abc123"
    assert config.MAX_ITEMS_PER_SECTION == 7
    assert config.FRONTEND_URL == "http://example.com"
    assert config.DB_POOL_SIZE == 15
    assert config.DB_MAX_OVERFLOW == 5

    # Reset module state after environment cleanup
    for key in overrides:
        monkeypatch.delenv(key, raising=False)
    importlib.reload(config_module)
