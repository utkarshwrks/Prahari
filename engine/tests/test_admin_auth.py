"""The engine's INDEPENDENT admin authorisation (DEC-060).

The web guard is the first layer; this is the second. The whole point is that
neither is allowed to be the only one, so these tests never go through the
proxy -- they call the engine exactly as an attacker who found its public URL
would.
"""

from __future__ import annotations

import base64
import json
import time

import pytest
from fastapi.testclient import TestClient

from engine.admin.auth import (DEV_SECRET, PERMISSIONS, ROUTE_PERMISSIONS, Principal,
                               permission_for, service_secret, sign, verify_token)
from engine.admin.store import STORE, Conflict, NotFound, Store
from engine.audit.ledger import ACTIONS, ADMIN_ACTIONS
from engine.main import app

ROLES = ("viewer", "analyst", "officer", "supervisor", "admin")


def token_for(role: str, path: str, method: str, *, email: str = "a@prahari.local",
              exp_offset: int = 60, secret: str = DEV_SECRET) -> str:
    now = int(time.time())
    payload = {
        "sub": "usr_1", "email": email, "role": role,
        "path": path.strip("/"), "method": method.upper(),
        "iat": now, "exp": now + exp_offset,
    }
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"{body}.{sign(body, secret)}"


@pytest.fixture
def client():
    STORE.reset()
    return TestClient(app)


# ---------------------------------------------------------------------------
# The token itself
# ---------------------------------------------------------------------------

class TestServiceToken:
    def test_accepts_a_well_formed_token(self):
        p = verify_token(token_for("admin", "users", "GET"), "users", "GET")
        assert p.role == "admin"
        assert p.email == "a@prahari.local"

    def test_refuses_a_bad_signature(self):
        t = token_for("admin", "users", "GET")
        body, _ = t.split(".")
        with pytest.raises(Exception) as e:
            verify_token(f"{body}.{sign(body, 'wrong-secret')}", "users", "GET")
        assert e.value.status_code == 401

    def test_refuses_an_expired_token(self):
        with pytest.raises(Exception) as e:
            verify_token(token_for("admin", "users", "GET", exp_offset=-1), "users", "GET")
        assert "expired" in str(e.value.detail).lower()

    def test_refuses_a_malformed_token(self):
        for bad in ("", "no-dot", "a.b.c", "!!!.???"):
            with pytest.raises(Exception) as e:
                verify_token(bad, "users", "GET")
            assert e.value.status_code == 401

    def test_token_is_bound_to_its_path(self):
        """A token for one request must not work for another.

        Without this, a token captured from any admin read would be a general
        purpose admin credential for its whole lifetime.
        """
        t = token_for("admin", "users", "GET")
        with pytest.raises(Exception) as e:
            verify_token(t, "retention/purge", "GET")
        assert "not for this request" in str(e.value.detail)

    def test_token_is_bound_to_its_method(self):
        t = token_for("admin", "users", "GET")
        with pytest.raises(Exception) as e:
            verify_token(t, "users", "DELETE")
        assert "not for this request" in str(e.value.detail)

    def test_an_unsigned_payload_is_refused(self):
        payload = {"sub": "x", "email": "x", "role": "admin", "path": "users",
                   "method": "GET", "iat": 0, "exp": time.time() + 60}
        body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        with pytest.raises(Exception):
            verify_token(f"{body}.", "users", "GET")


# ---------------------------------------------------------------------------
# The matrix, from the engine side
# ---------------------------------------------------------------------------

class TestAuthzMatrix:
    @staticmethod
    def url_for(prefix: str, method: str) -> str:
        """The REAL URL shape a caller uses.

        PATCH and DELETE address a record, so their paths carry an id. Calling
        `PATCH /admin/users` instead returns 405 from the router before the
        dependency runs -- which would mean the authorisation check never
        executed and the cell was never actually tested. A matrix that passes
        because the request never reached the guard is worse than no matrix.
        """
        if prefix in ("bulk", "retention", "audit", "analytics"):
            tail = {"bulk": "import", "retention": "purge",
                    "audit": "activity", "analytics": "overview"}[prefix]
            return f"{prefix}/{tail}"
        if method in ("PATCH", "DELETE"):
            return f"{prefix}/rec-1"
        if method == "POST":
            return prefix
        return prefix

    @pytest.mark.parametrize("role", ROLES)
    @pytest.mark.parametrize("path,method", sorted(ROUTE_PERMISSIONS))
    def test_every_role_against_every_route(self, client, role, path, method):
        """Every cell. A role holding the permission passes; one that does not
        gets 403 -- never a 200, never a 405 and never a 500."""
        target = self.url_for(path, method)
        needed = ROUTE_PERMISSIONS[(path, method)]
        allowed = needed in PERMISSIONS[role]

        res = client.request(
            method,
            f"/admin/{target}" + ("?id=new-1" if method == "POST" and path not in
                                  ("bulk", "retention") else ""),
            headers={"Authorization": f"Bearer {token_for(role, target, method)}"},
            json={"patch": {}, "kind": "personas", "before": "2000-01-01"}
            if method in ("POST", "PATCH") else None,
        )
        assert res.status_code != 405, (
            f"{method} /admin/{target} is not routed -- the guard never ran, "
            "so this cell was not tested"
        )
        if allowed:
            assert res.status_code != 403, f"{role} should hold {needed} (got {res.text})"
        else:
            assert res.status_code == 403, f"{role} must NOT reach {method} {path}"
            assert needed in res.json()["detail"]

    def test_no_token_is_401(self, client):
        assert client.get("/admin/personas").status_code == 401

    def test_a_non_bearer_header_is_401(self, client):
        res = client.get("/admin/personas", headers={"Authorization": "Basic abc"})
        assert res.status_code == 401

    def test_unknown_kind_is_404(self, client):
        res = client.get("/admin/nonsense",
                         headers={"Authorization": f"Bearer {token_for('admin', 'nonsense', 'GET')}"})
        assert res.status_code == 404

    def test_engine_and_web_role_tables_agree(self):
        """The engine duplicates the role table on purpose -- an engine that
        asked the web layer what a role may do would be trusting the thing it is
        meant to be checking. This asserts the duplicate has not drifted."""
        import pathlib
        import re

        src = pathlib.Path(__file__).resolve().parents[2] / "web" / "lib" / "rbac.ts"
        text = src.read_text()

        # viewer and the three management permissions are the load-bearing ends.
        assert 'viewer: VIEWER' in text
        assert PERMISSIONS["viewer"] == ("read",)
        for perm in ("manage:users", "manage:roles", "manage:retention"):
            assert perm in text
            assert perm in PERMISSIONS["admin"]
            assert perm not in PERMISSIONS["supervisor"]

        # Every route the web layer declares must have an engine rule too.
        web_routes = re.findall(r'\{ path: "([^"]+)", method: "([A-Z]+)"', text)
        assert web_routes, "could not read ADMIN_ROUTES from rbac.ts"
        for path, method in web_routes:
            prefix = path.split("/")[0]
            assert (prefix, method) in ROUTE_PERMISSIONS, f"engine has no rule for {method} {path}"


# ---------------------------------------------------------------------------
# Soft delete, concurrency, ledger
# ---------------------------------------------------------------------------

class TestStore:
    def setup_method(self):
        # A fresh Store still seeds from the fixture dataset on first read, so
        # these assertions name the record under test rather than assuming the
        # collection is empty.
        self.s = Store()
        self.s.create("personas", "p1", {"handle": "nightowl1"}, "a@x")

    def ids(self, **kw):
        return [r["id"] for r in self.s.list("personas", limit=500, **kw)["items"]]

    def test_nothing_is_ever_hard_deleted(self):
        assert "p1" in self.ids()
        self.s.soft_delete("personas", "p1", "a@x", None)
        # Gone from reads...
        assert "p1" not in self.ids()
        # ...and still in the export. A record a defence expert cannot find is
        # a record the prosecution looks like it hid.
        assert "p1" in [r["id"] for r in self.s.export("personas")]

    def test_a_soft_delete_records_who_and_when(self):
        out = self.s.soft_delete("personas", "p1", "officer@x", None)
        assert out["record"]["deleted_by"] == "officer@x"
        assert out["record"]["deleted_at"]

    def test_deleted_rows_are_visible_when_asked_for(self):
        self.s.soft_delete("personas", "p1", "a@x", None)
        assert "p1" in self.ids(include_deleted=True)
        assert self.s.list("personas", include_deleted=True)["includes_deleted"] is True

    def test_restore_undoes_a_delete(self):
        self.s.soft_delete("personas", "p1", "a@x", None)
        assert "p1" not in self.ids()
        self.s.restore("personas", "p1", "a@x")
        assert "p1" in self.ids()

    def test_second_writer_gets_a_conflict_not_a_lost_update(self):
        rec = self.s.get("personas", "p1")
        stale = rec.updated_at
        self.s.update("personas", "p1", {"handle": "first"}, "a@x", stale)
        with pytest.raises(Conflict) as e:
            self.s.update("personas", "p1", {"handle": "second"}, "b@x", stale)
        # Both sides are named, so the UI can show what changed under them.
        assert e.value.expected == stale
        assert e.value.actual != stale
        assert self.s.get("personas", "p1").data["handle"] == "first"

    def test_a_no_op_update_does_not_bump_the_version(self):
        rec = self.s.get("personas", "p1")
        before = rec.updated_at
        out = self.s.update("personas", "p1", {"handle": "nightowl1"}, "a@x", before)
        assert out["diff"] == {}
        assert self.s.get("personas", "p1").updated_at == before

    def test_every_mutation_returns_its_diff(self):
        rec = self.s.get("personas", "p1")
        out = self.s.update("personas", "p1", {"handle": "renamed"}, "a@x", rec.updated_at)
        assert out["diff"] == {"handle": {"before": "nightowl1", "after": "renamed"}}

    def test_missing_record_raises_not_found(self):
        with pytest.raises(NotFound):
            self.s.get("personas", "nope")


class TestLedgerCoverage:
    def test_admin_actions_are_in_the_closed_set(self):
        assert ADMIN_ACTIONS
        for a in ADMIN_ACTIONS:
            assert a in ACTIONS
            assert a.startswith("admin.")

    def test_an_unknown_action_still_cannot_be_written(self):
        """The set stays closed. Extending it was deliberate; bypassing it is
        still impossible."""
        from engine.audit.ledger import Ledger
        lg = Ledger("CASE-X")
        with pytest.raises(ValueError):
            lg.append("a@x", "admin.whatever", {}, None, None)

    def test_a_mutation_appends_a_signed_chained_record(self, client):
        h = {"Authorization": f"Bearer {token_for('admin', 'personas', 'POST')}"}
        before = client.get(
            "/admin/audit/activity",
            headers={"Authorization": f"Bearer {token_for('admin', 'audit/activity', 'GET')}"},
        ).json()["count"]

        res = client.post("/admin/personas?id=p-new", headers=h,
                          json={"patch": {"handle": "test"}, "reason": "unit test"})
        assert res.status_code == 200, res.text
        entry = res.json()["ledger"]
        assert entry["hash"].startswith("0x")
        assert entry["prev_hash"].startswith("0x")

        after = client.get(
            "/admin/audit/activity",
            headers={"Authorization": f"Bearer {token_for('admin', 'audit/activity', 'GET')}"},
        ).json()
        assert after["count"] == before + 1
        assert after["records"][-1]["action"] == "admin.create"
        assert after["records"][-1]["signed"] is True
        # The chain records the HUMAN, not the service account.
        assert after["records"][-1]["actor"] == "a@prahari.local"

    def test_the_diff_is_in_the_ledger_payload(self, client):
        h = {"Authorization": f"Bearer {token_for('admin', 'personas', 'POST')}"}
        client.post("/admin/personas?id=p-diff", headers=h,
                    json={"patch": {"handle": "before"}})
        res = client.patch(
            "/admin/personas/p-diff",
            # The token is bound to the EXACT path, record id included -- that
            # binding is the property test_token_is_bound_to_its_path pins.
            headers={"Authorization": f"Bearer {token_for('admin', 'personas/p-diff', 'PATCH')}"},
            json={"patch": {"handle": "after"}},
        )
        assert res.status_code == 200, res.text
        # "updated" without saying what changed is not evidence of anything.
        assert res.json()["diff"]["handle"] == {"before": "before", "after": "after"}


class TestOverridesAndPurge:
    def test_an_attribution_override_demands_a_written_justification(self, client):
        res = client.patch(
            "/admin/actors/actor-088",
            headers={"Authorization": f"Bearer {token_for('admin', 'actors/actor-088', 'PATCH')}"},
            json={"patch": {"attribution_confidence": 0.99}},
        )
        assert res.status_code == 400
        assert "justification" in res.json()["detail"].lower()

    def test_an_override_is_flagged_so_it_never_looks_like_a_model_output(self, client):
        res = client.patch(
            "/admin/actors/actor-088",
            headers={"Authorization": f"Bearer {token_for('admin', 'actors/actor-088', 'PATCH')}"},
            json={"patch": {"attribution_confidence": 0.99}, "reason": "field confirmation"},
        )
        assert res.status_code == 200, res.text
        rec = res.json()["record"]
        assert rec["override"] is True
        assert rec["override_reason"] == "field confirmation"
        assert rec["override_by"] == "a@prahari.local"

    def test_purge_is_a_dry_run_by_default(self, client):
        res = client.post(
            "/admin/retention/purge",
            headers={"Authorization": f"Bearer {token_for('admin', 'retention/purge', 'POST')}"},
            json={"kind": "personas", "before": "2099-01-01"},
        )
        assert res.status_code == 200, res.text
        assert res.json()["dry_run"] is True
        assert "Nothing was changed" in res.json()["detail"]

    def test_a_live_purge_needs_a_second_approver(self, client):
        res = client.post(
            "/admin/retention/purge",
            headers={"Authorization": f"Bearer {token_for('admin', 'retention/purge', 'POST')}"},
            json={"kind": "personas", "before": "2099-01-01", "dry_run": False,
                  "reason": "policy"},
        )
        assert res.status_code == 400
        assert "second approver" in res.json()["detail"].lower()

    def test_the_second_approver_cannot_be_the_caller(self, client):
        res = client.post(
            "/admin/retention/purge",
            headers={"Authorization": f"Bearer {token_for('admin', 'retention/purge', 'POST')}"},
            json={"kind": "personas", "before": "2099-01-01", "dry_run": False,
                  "reason": "policy", "second_approver": "a@prahari.local"},
        )
        assert res.status_code == 400

    def test_even_a_live_purge_does_not_hard_delete(self, client):
        h = {"Authorization": f"Bearer {token_for('admin', 'retention/purge', 'POST')}"}
        client.post("/admin/retention/purge", headers=h,
                    json={"kind": "personas", "before": "2099-01-01", "dry_run": False,
                          "reason": "retention policy", "second_approver": "b@prahari.local"})
        # The playbook's rule is absolute: never a hard DELETE on evidence.
        assert len(STORE.export("personas")) > 0


class TestAnalytics:
    def test_overview_counts_bands_from_real_data(self, client):
        res = client.get(
            "/admin/analytics/overview",
            headers={"Authorization": f"Bearer {token_for('analyst', 'analytics/overview', 'GET')}"},
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["actors"] > 0
        assert sum(body["bands"].values()) == body["actors"]

    def test_signal_contribution_reports_survived_versus_discarded(self, client):
        res = client.get(
            "/admin/analytics/signals",
            headers={"Authorization": f"Bearer {token_for('analyst', 'analytics/signals', 'GET')}"},
        )
        assert res.status_code == 200, res.text
        roots = res.json()["roots"]
        assert roots
        assert all({"root", "survived", "discarded"} <= set(r) for r in roots)

    def test_an_uncomputed_scope_says_so_rather_than_returning_zeroes(self, client):
        res = client.get(
            "/admin/analytics/made-up",
            headers={"Authorization": f"Bearer {token_for('analyst', 'analytics/made-up', 'GET')}"},
        )
        body = res.json()
        assert body["ok"] is False
        assert body["available"] is False
        assert "No analytics are computed" in body["detail"]


class TestSecretHandling:
    def test_dev_secret_outside_production(self, monkeypatch):
        monkeypatch.delenv("ENGINE_SERVICE_SECRET", raising=False)
        monkeypatch.setenv("ENGINE_ENV", "development")
        assert service_secret() == DEV_SECRET

    def test_production_refuses_to_serve_admin_without_a_secret(self, monkeypatch):
        monkeypatch.delenv("ENGINE_SERVICE_SECRET", raising=False)
        monkeypatch.setenv("ENGINE_ENV", "production")
        with pytest.raises(RuntimeError, match="ENGINE_SERVICE_SECRET"):
            service_secret()

    def test_permission_lookup_is_denied_by_absence(self):
        assert permission_for("nonsense", "GET") is None
        assert permission_for("users", "PUT") is None


class TestBulkImport:
    """A bulk operation that commits before anyone has seen its consequences is
    the one that rewrites a hundred records nobody meant to touch."""

    HEADERS = {"Authorization": f"Bearer {token_for('admin', 'bulk/import', 'POST')}"}

    def test_dry_run_is_the_default(self, client):
        res = client.post("/admin/bulk/import", headers=self.HEADERS,
                          json={"kind": "personas", "csv": "id,handle\np-x,newhandle"})
        assert res.status_code == 200, res.text
        assert res.json()["dry_run"] is True
        assert "Nothing was changed" in res.json()["detail"]

    def test_dry_run_returns_a_field_level_diff_preview(self, client):
        res = client.post("/admin/bulk/import", headers=self.HEADERS,
                          json={"kind": "personas", "csv": "id,handle\np-new-1,alpha"})
        body = res.json()
        assert body["would_create"][0]["id"] == "p-new-1"
        assert body["would_create"][0]["diff"]["handle"] == {"before": None, "after": "alpha"}

    def test_a_malformed_row_is_reported_not_dropped(self, client):
        res = client.post("/admin/bulk/import", headers=self.HEADERS,
                          json={"kind": "personas", "csv": "id,handle\np-a,one,extra\np-b,two"})
        body = res.json()
        assert any("Row 2" in p for p in body["problems"])
        # The good row is still previewed -- reporting must not hide the rest.
        assert [c["id"] for c in body["would_create"]] == ["p-b"]

    def test_a_header_without_id_is_refused(self, client):
        res = client.post("/admin/bulk/import", headers=self.HEADERS,
                          json={"kind": "personas", "csv": "handle\nalpha"})
        assert "must contain an 'id' column" in res.json()["problems"][0]

    def test_a_live_import_refuses_a_partial_file(self, client):
        res = client.post("/admin/bulk/import", headers=self.HEADERS,
                          json={"kind": "personas", "csv": "id,handle\np-a,one,extra",
                                "dry_run": False, "reason": "x"})
        # Half a file applied is a dataset nobody can reason about afterwards.
        assert res.status_code == 400
        assert "Fix these rows" in res.json()["detail"]["message"]

    def test_a_live_import_requires_a_written_reason(self, client):
        res = client.post("/admin/bulk/import", headers=self.HEADERS,
                          json={"kind": "personas", "csv": "id,handle\np-ok,one",
                                "dry_run": False})
        assert res.status_code == 400
        assert "written reason" in res.json()["detail"]

    def test_a_live_import_applies_and_is_recorded(self, client):
        res = client.post("/admin/bulk/import", headers=self.HEADERS,
                          json={"kind": "personas", "csv": "id,handle\np-live,alpha",
                                "dry_run": False, "reason": "seed import"})
        assert res.status_code == 200, res.text
        assert res.json()["created"] == 1
        assert res.json()["ledger"]["hash"].startswith("0x")
        assert STORE.get("personas", "p-live").data["handle"] == "alpha"
