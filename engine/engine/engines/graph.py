"""Neo4j identity graph - nodes, typed weighted edges, and GDS actor resolution.

Edge weights are the playbook's, and they are not arbitrary: they encode how
much each relationship is worth as evidence of shared control. Only the two
HARD identifiers (a signing key and a paid-to wallet) are allowed to form an
actor, because those are the only edges a person cannot casually share.

    SIGNED_WITH  0.95   same PGP key                 HARD
    PAID_TO      0.80   same wallet address          HARD
    CONTACT      0.70   same email / telegram        soft
    VOUCHES_FOR  0.30   trust / rating link          soft
    MENTIONS     0.20   co-mentioned entity          soft
    LOCATED      ----   persona -> city              soft

Everything is MERGE, so loading twice yields the same graph. Idempotence is
tested, not assumed: the Phase 4 reload job runs on a schedule.

The engine degrades honestly when Neo4j is down -- it reports unavailable
rather than raising, exactly like every other capability.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from ..settings import get_settings

log = logging.getLogger(__name__)

# Relationship type -> weight. Hard identifiers are the two that form actors.
EDGE_WEIGHTS: dict[str, float] = {
    "SIGNED_WITH": 0.95,
    "PAID_TO": 0.80,
    "CONTACT": 0.70,
    "VOUCHES_FOR": 0.30,
    "MENTIONS": 0.20,
}

# WCC runs over these only. Adding CONTACT here would merge every persona that
# shared a throwaway inbox, which is exactly the false-merge we publish a rate
# for -- see the decoy case.
HARD_EDGES = ("SIGNED_WITH", "PAID_TO")

GRAPH_NAME = "prahari_actors"


@dataclass
class GraphStats:
    personas: int = 0
    entities: int = 0
    edges: int = 0
    actors: int = 0
    communities: int = 0
    embedded: int = 0
    available: bool = True
    detail: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


def _driver():
    from neo4j import GraphDatabase

    s = get_settings()
    return GraphDatabase.driver(s.neo4j_uri, auth=(s.neo4j_user, s.neo4j_password))


def ping() -> tuple[bool, str | None]:
    """Is Neo4j answering queries? Never raises."""
    try:
        with _driver() as d, d.session() as ses:
            ses.run("RETURN 1").consume()
        return True, None
    except Exception as exc:  # noqa: BLE001
        return False, f"{type(exc).__name__}"


# --------------------------------------------------------------------------
# Schema
# --------------------------------------------------------------------------

CONSTRAINTS = [
    "CREATE CONSTRAINT persona_id IF NOT EXISTS FOR (p:Persona) REQUIRE p.id IS UNIQUE",
    "CREATE CONSTRAINT pgp_v IF NOT EXISTS FOR (n:PGPKey) REQUIRE n.value IS UNIQUE",
    "CREATE CONSTRAINT wallet_v IF NOT EXISTS FOR (n:Wallet) REQUIRE n.value IS UNIQUE",
    "CREATE CONSTRAINT email_v IF NOT EXISTS FOR (n:Email) REQUIRE n.value IS UNIQUE",
    "CREATE CONSTRAINT tg_v IF NOT EXISTS FOR (n:Telegram) REQUIRE n.value IS UNIQUE",
    "CREATE CONSTRAINT onion_v IF NOT EXISTS FOR (n:Onion) REQUIRE n.value IS UNIQUE",
    "CREATE CONSTRAINT domain_v IF NOT EXISTS FOR (n:Domain) REQUIRE n.value IS UNIQUE",
    "CREATE CONSTRAINT city_v IF NOT EXISTS FOR (n:City) REQUIRE n.value IS UNIQUE",
]

# Which entity kind hangs off which label and edge.
ENTITY_MAP: dict[str, tuple[str, str]] = {
    "pgp": ("PGPKey", "SIGNED_WITH"),
    "wallet": ("Wallet", "PAID_TO"),
    "email": ("Email", "CONTACT"),
    "telegram": ("Telegram", "CONTACT"),
    "onion": ("Onion", "MENTIONS"),
    "domain": ("Domain", "MENTIONS"),
    "city": ("City", "LOCATED"),
}


def ensure_schema() -> None:
    with _driver() as d, d.session() as ses:
        for c in CONSTRAINTS:
            ses.run(c).consume()


def clear() -> None:
    """Wipe the graph. Used by tests and by a full reload."""
    with _driver() as d, d.session() as ses:
        ses.run("MATCH (n) DETACH DELETE n").consume()


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------


def load_personas(personas: list[dict]) -> int:
    """Idempotent upsert. Loading twice must not duplicate a node."""
    q = """
    UNWIND $rows AS r
    MERGE (p:Persona {id: r.id})
    SET p.market = r.market,
        p.handle = r.handle,
        p.first_seen = r.first_seen,
        p.last_seen = r.last_seen,
        p.bio = r.bio,
        p.role = r.role
    """
    with _driver() as d, d.session() as ses:
        ses.run(q, rows=personas).consume()
    return len(personas)


def load_entity_links(links: list[dict]) -> int:
    """links: [{persona_id, kind, value}]  ->  (:Persona)-[:REL {weight}]->(:Label)

    One Cypher statement per kind so the label can be literal (Neo4j does not
    parameterise labels or relationship types).
    """
    written = 0
    with _driver() as d, d.session() as ses:
        for kind, (label, rel) in ENTITY_MAP.items():
            rows = [x for x in links if x["kind"] == kind and x.get("value")]
            if not rows:
                continue
            weight = EDGE_WEIGHTS.get(rel, 0.1)
            q = f"""
            UNWIND $rows AS r
            MATCH (p:Persona {{id: r.persona_id}})
            MERGE (e:{label} {{value: r.value}})
            MERGE (p)-[k:{rel}]->(e)
            SET k.weight = $weight
            """
            ses.run(q, rows=rows, weight=weight).consume()
            written += len(rows)
    return written


def load_lineage(edges: list[dict]) -> int:
    """Wallet-to-wallet transfer edges.

    Deliberately NOT a hard identifier. Lineage means funds moved between two
    distinct addresses, which is evidence of a relationship, not proof of one
    controller. The rebrand case depends on this staying soft: if lineage
    merged actors, that pair would resolve for free and prove nothing about
    style or timing.
    """
    if not edges:
        return 0
    q = """
    UNWIND $rows AS r
    MERGE (a:Wallet {value: r.from})
    MERGE (b:Wallet {value: r.to})
    MERGE (a)-[k:FUNDS_FLOW_TO]->(b)
    SET k.weight = 0.5
    """
    with _driver() as d, d.session() as ses:
        ses.run(q, rows=edges).consume()
    return len(edges)


# --------------------------------------------------------------------------
# GDS resolution
# --------------------------------------------------------------------------


def _drop_projection(ses) -> None:
    ses.run(
        "CALL gds.graph.list($n) YIELD graphName "
        "WITH graphName CALL gds.graph.drop(graphName) YIELD graphName AS g RETURN g",
        n=GRAPH_NAME,
    ).consume()


def resolve_actors() -> dict[str, int]:
    """WCC over HARD identifier edges only -> Actor ids.

    Personas connected through a shared PGP key or wallet become one actor.
    Soft edges are excluded on purpose: a shared inbox or a co-mention is not
    control.
    """
    rel_filter = "|".join(HARD_EDGES)
    with _driver() as d, d.session() as ses:
        _drop_projection(ses)
        ses.run(
            f"""
            MATCH (src)-[r:{rel_filter}]->(tgt)
            WITH gds.graph.project($name, src, tgt,
              {{ sourceNodeLabels: labels(src),
                 targetNodeLabels: labels(tgt),
                 relationshipType: type(r) }},
              {{ undirectedRelationshipTypes: ['*'] }}) AS g
            RETURN g.graphName AS name
            """,
            name=GRAPH_NAME,
        ).consume()

        ses.run(
            "CALL gds.wcc.write($name, {writeProperty: 'wccId'}) "
            "YIELD componentCount RETURN componentCount",
            name=GRAPH_NAME,
        ).consume()

        # An actor is a component that actually contains personas.
        n_actors = ses.run(
            """
            MATCH (p:Persona) WHERE p.wccId IS NOT NULL
            WITH p.wccId AS c, collect(p) AS ps
            FOREACH (x IN ps | SET x.actor_id = 'actor-wcc-' + toString(c))
            RETURN count(DISTINCT c) AS n
            """
        ).single()["n"]

        # Personas with no hard identifier are their own actor - never merged
        # into someone else's by default.
        singles = ses.run(
            """
            MATCH (p:Persona) WHERE p.actor_id IS NULL
            SET p.actor_id = 'actor-solo-' + p.id
            RETURN count(p) AS n
            """
        ).single()["n"]

        communities = 0
        try:
            communities = ses.run(
                "CALL gds.louvain.write($name, {writeProperty: 'communityId'}) "
                "YIELD communityCount RETURN communityCount",
                name=GRAPH_NAME,
            ).single()["communityCount"]
        except Exception:  # noqa: BLE001 - Louvain is additive, not load-bearing
            log.debug("louvain skipped")

    return {"actors": n_actors, "solo": singles, "communities": communities}


def embeddings(dim: int = 128) -> int:
    """FastRP embeddings for 'personas like this one'. Additive, never fatal."""
    try:
        with _driver() as d, d.session() as ses:
            ses.run(
                "CALL gds.fastRP.write($name, {embeddingDimension: $dim, "
                "writeProperty: 'embedding', randomSeed: 42}) "
                "YIELD nodePropertiesWritten RETURN nodePropertiesWritten",
                name=GRAPH_NAME, dim=dim,
            ).consume()
            return ses.run(
                "MATCH (p:Persona) WHERE p.embedding IS NOT NULL RETURN count(p) AS n"
            ).single()["n"]
    except Exception as exc:  # noqa: BLE001
        log.warning("fastRP skipped: %s", type(exc).__name__)
        return 0


# --------------------------------------------------------------------------
# Queries
# --------------------------------------------------------------------------


def actor_subgraph(actor_id: str) -> dict:
    """Nodes + edges for the 3D graph panel."""
    q = """
    MATCH (p:Persona {actor_id: $actor})
    OPTIONAL MATCH (p)-[r]->(e)
    RETURN p, r, e
    """
    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    with _driver() as d, d.session() as ses:
        for rec in ses.run(q, actor=actor_id):
            p = rec["p"]
            nodes[p["id"]] = {"id": p["id"], "label": "Persona",
                              "handle": p.get("handle"), "market": p.get("market")}
            e, r = rec["e"], rec["r"]
            if e is not None and r is not None:
                key = e.get("value")
                nodes.setdefault(key, {"id": key, "label": list(e.labels)[0], "value": key})
                edges.append({"source": p["id"], "target": key,
                              "type": r.type, "weight": r.get("weight")})
    return {"actor_id": actor_id, "nodes": list(nodes.values()), "edges": edges}


def persona_actor(persona_id: str) -> str | None:
    with _driver() as d, d.session() as ses:
        rec = ses.run("MATCH (p:Persona {id: $i}) RETURN p.actor_id AS a", i=persona_id).single()
        return rec["a"] if rec else None


def search(q: str, limit: int = 20) -> list[dict]:
    """Handle / contact search. Must answer in under a second."""
    cy = """
    MATCH (p:Persona)
    WHERE toLower(p.handle) CONTAINS toLower($q) OR toLower(p.id) CONTAINS toLower($q)
    RETURN p.id AS id, p.handle AS handle, p.market AS market, p.actor_id AS actor_id
    LIMIT $limit
    UNION
    MATCH (p:Persona)-[]->(e)
    WHERE toLower(coalesce(e.value,'')) CONTAINS toLower($q)
    RETURN p.id AS id, p.handle AS handle, p.market AS market, p.actor_id AS actor_id
    LIMIT $limit
    """
    with _driver() as d, d.session() as ses:
        return [dict(r) for r in ses.run(cy, q=q, limit=limit)]


def stats() -> GraphStats:
    ok, err = ping()
    if not ok:
        return GraphStats(available=False, detail=f"Neo4j unreachable ({err})")
    with _driver() as d, d.session() as ses:
        s = GraphStats()
        s.personas = ses.run("MATCH (p:Persona) RETURN count(p) AS n").single()["n"]
        s.entities = ses.run(
            "MATCH (n) WHERE NOT n:Persona RETURN count(n) AS n").single()["n"]
        s.edges = ses.run("MATCH ()-[r]->() RETURN count(r) AS n").single()["n"]
        s.actors = ses.run(
            "MATCH (p:Persona) WHERE p.actor_id IS NOT NULL "
            "RETURN count(DISTINCT p.actor_id) AS n").single()["n"]
        s.embedded = ses.run(
            "MATCH (p:Persona) WHERE p.embedding IS NOT NULL RETURN count(p) AS n").single()["n"]
        return s
