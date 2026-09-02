"""INDEPENDENT AUTHORISATION FOR THE ADMIN SCOPE (DEC-060).

"The web proxy already checked" is not an authorisation model. On a Render
deployment this service has its own public URL, so anything that can reach the
network can reach ``/admin/*`` directly. Every admin request is therefore
verified here, against the same role table the web layer uses, with no
assumption that the proxy is the only caller.

The token is an HMAC-SHA256 over a compact payload, minted by
``web/lib/serviceToken.ts``. Both halves are code we own, and
``test_admin_auth.py`` pins the wire format so the two cannot drift.

It is BOUND TO THE REQUEST: path and method are inside the signature, so a
token minted for ``GET /admin/users`` cannot be replayed against
``POST /admin/retention/purge``. Without that binding, a token captured from
any admin read would be a general-purpose admin credential for its lifetime.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass

from fastapi import Header, HTTPException, Request

# Mirrors web/lib/rbac.ts. Duplicated ON PURPOSE rather than fetched: an engine
# that asked the web layer what a role may do would be trusting the thing it is
# meant to be checking. test_admin_auth.py asserts the two tables agree.
PERMISSIONS: dict[str, tuple[str, ...]] = {
    "viewer": ("read",),
    "analyst": ("read", "investigate", "verify"),
    "officer": ("read", "investigate", "assign", "seal", "verify", "export"),
    "supervisor": (
        "read", "investigate", "assign", "seal", "verify", "export",
        "manage:cases", "manage:sources", "approve", "reassign",
    ),
    "admin": (
        "read", "investigate", "assign", "seal", "verify", "export",
        "manage:cases", "manage:sources", "approve", "reassign",
        "manage:users", "manage:roles", "manage:retention",
    ),
}

# Mirrors ADMIN_ROUTES. (path_prefix, method) -> permission.
ROUTE_PERMISSIONS: dict[tuple[str, str], str] = {
    ("personas", "GET"): "read",
    ("posts", "GET"): "read",
    ("entities", "GET"): "read",
    ("actors", "GET"): "read",
    ("cases", "GET"): "read",
    ("sources", "GET"): "manage:sources",
    ("users", "GET"): "manage:users",
    ("analytics", "GET"): "read",
    ("audit", "GET"): "manage:cases",
    ("personas", "POST"): "manage:cases",
    ("personas", "PATCH"): "manage:cases",
    ("personas", "DELETE"): "manage:cases",
    ("posts", "PATCH"): "manage:cases",
    ("posts", "DELETE"): "manage:cases",
    ("entities", "POST"): "manage:cases",
    ("entities", "PATCH"): "manage:cases",
    ("actors", "PATCH"): "approve",
    ("cases", "POST"): "manage:cases",
    ("cases", "PATCH"): "manage:cases",
    ("sources", "PATCH"): "manage:sources",
    ("users", "POST"): "manage:users",
    ("users", "PATCH"): "manage:roles",
    ("bulk", "POST"): "manage:cases",
    ("retention", "POST"): "manage:retention",
}

DEV_SECRET = "prahari-local-development-service-secret-not-for-production"


def service_secret() -> str:
    """The shared signing key.

    Absent in production is a REFUSAL, not a fallback: a known key means anyone
    can mint an admin token, which would turn this whole module into a
    formality. Same reasoning as DEC-045's NEXTAUTH_SECRET.
    """
    configured = (os.getenv("ENGINE_SERVICE_SECRET") or "").strip()
    if configured:
        return configured
    if os.getenv("ENGINE_ENV", "").lower() == "production":
        raise RuntimeError(
            "PRAHARI engine refuses to serve /admin in production without "
            "ENGINE_SERVICE_SECRET. Set the same value on both services."
        )
    return DEV_SECRET


def _b64u_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _b64u_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def sign(body: str, secret: str) -> str:
    return _b64u_encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())


@dataclass(frozen=True)
class Principal:
    """Who is acting, as the ENGINE determined it -- not as it was told."""

    sub: str
    email: str
    role: str
    path: str
    method: str

    def may(self, permission: str) -> bool:
        return permission in PERMISSIONS.get(self.role, ())


def verify_token(token: str, path: str, method: str, now: float | None = None) -> Principal:
    """Verify signature, expiry and request binding. Raises 401/403 on failure."""
    now = time.time() if now is None else now
    parts = token.split(".")
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="Malformed service token.")
    body, mac = parts

    if not hmac.compare_digest(sign(body, service_secret()), mac):
        raise HTTPException(status_code=401, detail="Bad service token signature.")

    try:
        claims = json.loads(_b64u_decode(body))
    except Exception:  # noqa: BLE001 - any decode failure is the same refusal
        raise HTTPException(status_code=401, detail="Malformed service token.") from None

    if float(claims.get("exp", 0)) < now:
        raise HTTPException(status_code=401, detail="Service token expired.")

    want_path = path.strip("/")
    if claims.get("path") != want_path or claims.get("method") != method.upper():
        # The binding check. A token for one request must not work for another.
        raise HTTPException(status_code=401, detail="Service token is not for this request.")

    return Principal(
        sub=str(claims.get("sub", "")),
        email=str(claims.get("email", "")),
        role=str(claims.get("role", "")),
        path=want_path,
        method=method.upper(),
    )


def permission_for(path: str, method: str) -> str | None:
    return ROUTE_PERMISSIONS.get((path.strip("/").split("/")[0], method.upper()))


def require(request: Request, authorization: str = Header(default="")) -> Principal:
    """FastAPI dependency: the per-handler assertion.

    Every admin handler depends on this. The web guard is the first layer and
    this is the second; neither is allowed to be the only one.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin scope requires a service token.")

    path = request.url.path.split("/admin/", 1)[-1]
    principal = verify_token(authorization[7:], path, request.method)

    permission = permission_for(path, request.method)
    if permission is None:
        # Denied by absence: an admin path with no rule is not a path.
        raise HTTPException(status_code=404, detail="Unknown admin route.")
    if not principal.may(permission):
        raise HTTPException(
            status_code=403,
            detail=f"Role {principal.role or 'none'} does not hold {permission}.",
        )
    return principal
