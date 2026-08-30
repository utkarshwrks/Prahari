"""Settings degradation: the engine boots with nothing configured.

This is the engine-wide extension of v1's GROQ_API_KEY guarantee. A missing key
disables a capability and says so; it never raises, and it never silently
pretends the capability is present.
"""

from __future__ import annotations

import pytest

from engine.settings import Settings


def test_boots_with_no_env_at_all():
    s = Settings(_env_file=None)
    assert s.app_name == "prahari-engine"
    assert s.version


def test_every_optional_key_defaults_to_none():
    s = Settings(_env_file=None)
    assert s.groq_api_key is None
    assert s.etherscan_api_key is None
    assert s.shodan_api_key is None
    assert s.contract_addr is None
    assert s.anchorer_key is None


def test_capabilities_all_disabled_without_keys():
    caps = Settings(_env_file=None).capabilities()
    assert all(c["enabled"] is False for c in caps.values())


def test_disabled_capability_always_explains_itself():
    for name, cap in Settings(_env_file=None).capabilities().items():
        assert cap["detail"], f"{name} disabled with no reason given"
        assert len(str(cap["detail"])) > 10


def test_capability_enables_when_key_present():
    s = Settings(_env_file=None, groq_api_key="test-key")
    caps = s.capabilities()
    assert caps["llm_extraction"]["enabled"] is True
    assert s.groq_model in str(caps["llm_extraction"]["detail"])


def test_anchoring_needs_both_contract_and_key():
    only_addr = Settings(_env_file=None, contract_addr="0xabc")
    only_key = Settings(_env_file=None, anchorer_key="0xdef")
    both = Settings(_env_file=None, contract_addr="0xabc", anchorer_key="0xdef")
    assert only_addr.capabilities()["anchoring"]["enabled"] is False
    assert only_key.capabilities()["anchoring"]["enabled"] is False
    assert both.capabilities()["anchoring"]["enabled"] is True


def test_sepolia_is_the_default_chain():
    """DEC-004: Sepolia is locked as the public chain."""
    assert Settings(_env_file=None).chain_id == 11155111


def test_groq_model_default_is_not_the_retired_llama():
    """DEC-013: llama-3.3-70b-versatile is decommissioned and 404s."""
    assert Settings(_env_file=None).groq_model != "llama-3.3-70b-versatile"


def test_cors_origins_parse_to_a_list():
    s = Settings(_env_file=None, cors_origins="http://a.test, http://b.test")
    assert s.cors_origin_list == ["http://a.test", "http://b.test"]


@pytest.mark.parametrize("env,expected", [("production", True), ("prod", True), ("development", False)])
def test_is_production_detection(env, expected):
    assert Settings(_env_file=None, environment=env).is_production is expected
