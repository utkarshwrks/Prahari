"""On-chain anchoring: Sepolia by default, local Anvil as a visible fallback.

The fallback is the part that matters ethically. When the network is down the
demo still works -- but it must be IMPOSSIBLE to mistake a local-chain seal for
a public one. A Sepolia explorer link for an Anvil transaction would be a
fabricated evidence trail, which is the exact opposite of what this layer is
for.

So `is_public_chain` is derived from the chain id the provider actually
connected to, never from configuration or intent, and `explorer_url` returns
None on any non-public chain. D3.3 objective 5 attacks precisely this.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass

from ..settings import get_settings

log = logging.getLogger(__name__)

# Public chains that may carry an explorer link.
EXPLORERS = {
    11155111: "https://sepolia.etherscan.io",
    1: "https://etherscan.io",
}

# Anvil / Hardhat local chain ids. Never public, whatever the config says.
LOCAL_CHAIN_IDS = {31337, 1337}


@dataclass
class AnchorResult:
    ok: bool
    root: str
    chain_id: int | None = None
    tx_hash: str | None = None
    block: int | None = None
    gas_used: int | None = None
    is_public_chain: bool = False
    chain_label: str = "UNKNOWN"
    explorer_url: str | None = None
    detail: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def chain_label(chain_id: int | None) -> str:
    if chain_id is None:
        return "UNAVAILABLE"
    if chain_id in LOCAL_CHAIN_IDS:
        return "LOCAL CHAIN"
    if chain_id == 11155111:
        return "SEPOLIA"
    if chain_id == 1:
        return "ETHEREUM MAINNET"
    return f"CHAIN {chain_id}"


def explorer_url(chain_id: int | None, tx_hash: str | None) -> str | None:
    """A link only for a genuinely public chain.

    Derived from the connected chain id, not from settings. If this ever
    returns a URL for an Anvil transaction, the audit trail is fabricated.
    """
    if chain_id is None or tx_hash is None:
        return None
    if chain_id in LOCAL_CHAIN_IDS:
        return None
    base = EXPLORERS.get(chain_id)
    return f"{base}/tx/{tx_hash}" if base else None


class IAnchorProvider:
    """Interface. Phase 8 ships the EVM provider; a null provider covers
    'anchoring not configured', which must be honest rather than silent."""

    def anchor(self, root: str, case_ref: str, leaf_count: int) -> AnchorResult:
        raise NotImplementedError

    def verify(self, root: str) -> AnchorResult:
        raise NotImplementedError


class NullAnchorProvider(IAnchorProvider):
    """No keys configured. Says so; never pretends to seal."""

    def anchor(self, root: str, case_ref: str, leaf_count: int) -> AnchorResult:
        return AnchorResult(
            ok=False, root=root, chain_label="NOT CONFIGURED",
            detail=("Anchoring is disabled: CONTRACT_ADDR and ANCHORER_KEY are not set. "
                    "The hash chain and Merkle root are still computed and verifiable offline."),
        )

    def verify(self, root: str) -> AnchorResult:
        return self.anchor(root, "", 0)


ABI = [
    {"type": "function", "name": "anchor", "stateMutability": "nonpayable",
     "inputs": [{"name": "root", "type": "bytes32"},
                {"name": "caseRef", "type": "bytes32"},
                {"name": "leafCount", "type": "uint32"}], "outputs": []},
    {"type": "function", "name": "verify", "stateMutability": "view",
     "inputs": [{"name": "root", "type": "bytes32"}],
     "outputs": [{"name": "timestamp", "type": "uint64"},
                 {"name": "leafCount", "type": "uint32"},
                 {"name": "caseRef", "type": "bytes32"},
                 {"name": "anchorer", "type": "address"}]},
    {"type": "function", "name": "isAnchored", "stateMutability": "view",
     "inputs": [{"name": "root", "type": "bytes32"}],
     "outputs": [{"name": "", "type": "bool"}]},
]


class EvmAnchorProvider(IAnchorProvider):
    """web3.py provider. Reads RPC_URL / CONTRACT_ADDR / ANCHORER_KEY."""

    def __init__(self, rpc_url: str | None = None, contract_addr: str | None = None,
                 private_key: str | None = None):
        s = get_settings()
        self.rpc_url = rpc_url or s.rpc_url
        self.contract_addr = contract_addr or s.contract_addr
        self.private_key = private_key or s.anchorer_key

    def _w3(self):
        from web3 import Web3

        w3 = Web3(Web3.HTTPProvider(self.rpc_url, request_kwargs={"timeout": 20}))
        if not w3.is_connected():
            raise ConnectionError(f"RPC unreachable: {self.rpc_url}")
        return w3

    def anchor(self, root: str, case_ref: str, leaf_count: int) -> AnchorResult:
        if not (self.contract_addr and self.private_key):
            return NullAnchorProvider().anchor(root, case_ref, leaf_count)
        try:
            from web3 import Web3

            w3 = self._w3()
            # The chain id comes from the node, never from settings.
            chain_id = w3.eth.chain_id
            acct = w3.eth.account.from_key(self.private_key)
            c = w3.eth.contract(address=Web3.to_checksum_address(self.contract_addr), abi=ABI)

            tx = c.functions.anchor(
                bytes.fromhex(root[2:]), bytes.fromhex(case_ref[2:]), int(leaf_count)
            ).build_transaction({
                "from": acct.address,
                "nonce": w3.eth.get_transaction_count(acct.address),
                "chainId": chain_id,
            })
            signed = acct.sign_transaction(tx)
            h = w3.eth.send_raw_transaction(signed.raw_transaction)
            rcpt = w3.eth.wait_for_transaction_receipt(h, timeout=180)

            tx_hash = h.hex() if isinstance(h, bytes) else str(h)
            if not tx_hash.startswith("0x"):
                tx_hash = "0x" + tx_hash
            is_public = chain_id not in LOCAL_CHAIN_IDS

            return AnchorResult(
                ok=rcpt["status"] == 1, root=root, chain_id=chain_id, tx_hash=tx_hash,
                block=rcpt["blockNumber"], gas_used=rcpt["gasUsed"],
                is_public_chain=is_public,
                chain_label=chain_label(chain_id),
                explorer_url=explorer_url(chain_id, tx_hash),
                detail=None if is_public else
                       "Sealed to a LOCAL chain. This is not a public anchor.",
            )
        except Exception as exc:  # noqa: BLE001
            return AnchorResult(
                ok=False, root=root, chain_label="UNAVAILABLE",
                detail=f"Anchoring failed: {type(exc).__name__}: {str(exc)[:160]}",
            )

    def verify(self, root: str) -> AnchorResult:
        if not self.contract_addr:
            return NullAnchorProvider().verify(root)
        try:
            from web3 import Web3

            w3 = self._w3()
            chain_id = w3.eth.chain_id
            c = w3.eth.contract(address=Web3.to_checksum_address(self.contract_addr), abi=ABI)
            ts, leaf_count, case_ref, anchorer = c.functions.verify(
                bytes.fromhex(root[2:])).call()
            found = ts != 0
            return AnchorResult(
                ok=found, root=root, chain_id=chain_id,
                is_public_chain=chain_id not in LOCAL_CHAIN_IDS,
                chain_label=chain_label(chain_id),
                detail=(f"Anchored at {ts} with {leaf_count} leaves by {anchorer}."
                        if found else "This root has never been anchored on this chain."),
            )
        except Exception as exc:  # noqa: BLE001
            return AnchorResult(ok=False, root=root, chain_label="UNAVAILABLE",
                                detail=f"{type(exc).__name__}: {str(exc)[:160]}")


def get_provider() -> IAnchorProvider:
    s = get_settings()
    if s.contract_addr and s.anchorer_key:
        return EvmAnchorProvider()
    return NullAnchorProvider()
