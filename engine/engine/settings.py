"""Engine configuration.

Every key is optional. The engine must boot with no .env at all -- exactly the
guarantee PRAHARI v1 gives for GROQ_API_KEY, extended to the whole engine.

A feature whose key is missing degrades honestly and says so through
`capabilities()`. It never raises at import time, and it never silently
pretends the feature ran. See docs/ARCHITECTURE.md section 7.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- identity -------------------------------------------------------
    app_name: str = "prahari-engine"
    version: str = "2.0.0"
    environment: str = "development"
    log_level: str = "INFO"

    # ---- datastores -----------------------------------------------------
    # Defaults match docker-compose.yml so a fresh clone works with no .env.
    database_url: str = "postgresql+psycopg://prahari:prahari@localhost:5432/prahari"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "prahari123"

    # ---- optional third-party keys --------------------------------------
    # All genuinely optional. Absence degrades a feature; it never breaks boot.
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-120b"
    etherscan_api_key: str | None = None
    shodan_api_key: str | None = None

    # ---- chain (Phase 8) -------------------------------------------------
    rpc_url: str = "https://ethereum-sepolia-rpc.publicnode.com"
    chain_id: int = 11155111  # Sepolia
    contract_addr: str | None = None
    anchorer_key: str | None = None

    # ---- web origin for CORS --------------------------------------------
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    def capabilities(self) -> dict[str, dict[str, object]]:
        """What this engine can actually do right now, and why not if it cannot.

        The workbench renders this directly. Every 'enabled: false' must carry a
        reason a human can act on -- an honest badge, never a silent no-op.
        """
        return {
            "llm_extraction": {
                "enabled": bool(self.groq_api_key),
                "detail": f"Groq {self.groq_model}"
                if self.groq_api_key
                else "GROQ_API_KEY not set - local regex extractor only",
            },
            "chain_eth": {
                "enabled": bool(self.etherscan_api_key),
                "detail": "Etherscan free tier"
                if self.etherscan_api_key
                else "ETHERSCAN_API_KEY not set - ETH history unavailable",
            },
            "infra_shodan": {
                "enabled": bool(self.shodan_api_key),
                "detail": "Shodan free tier"
                if self.shodan_api_key
                else "SHODAN_API_KEY not set - infra pivots run cache-only via crt.sh",
            },
            "anchoring": {
                "enabled": bool(self.contract_addr and self.anchorer_key),
                "detail": f"chain {self.chain_id}"
                if (self.contract_addr and self.anchorer_key)
                else "CONTRACT_ADDR / ANCHORER_KEY not set - sealing disabled",
            },
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
