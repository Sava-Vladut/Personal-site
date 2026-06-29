"""Twitch Helix proxy for channel-specific chat badges.

Global badges are baked into the frontend (src/data/twitchBadges.js), but a
channel's *custom* subscriber tiers and bit badges only come from Helix, which
requires an app access token — a server-only secret. This module mints and
caches that token (client-credentials flow) and serves a channel's badge map to
the browser through /api/twitch/channel-badges.

Credentials come from the settings store (set via the Admin dashboard), so they
live in the DB rather than env files; TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET
are still honoured as a fallback if present. Without credentials the endpoint
returns an empty map and the log view falls back to global badges + text labels.
"""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

import auth

TOKEN_URL = "https://id.twitch.tv/oauth2/token"
HELIX_CHANNEL_BADGES = "https://api.twitch.tv/helix/chat/badges"

# Channel badges almost never change, so cache each channel's map for a while to
# stay well clear of Helix rate limits.
_BADGE_TTL = 60 * 60  # 1 hour
_HTTP_TIMEOUT = 10

_lock = threading.Lock()
_token: str | None = None
_token_expiry = 0.0  # unix seconds; refresh a minute early
_badge_cache: dict[str, tuple[float, dict]] = {}  # broadcaster_id -> (fetched_at, map)


def _creds() -> tuple[str, str]:
    """Current (client_id, client_secret): DB settings first, then env fallback."""
    cid = auth.get_setting("twitch_client_id") or os.environ.get("TWITCH_CLIENT_ID", "")
    secret = auth.get_setting("twitch_client_secret") or os.environ.get(
        "TWITCH_CLIENT_SECRET", ""
    )
    return cid, secret


def is_configured() -> bool:
    cid, secret = _creds()
    return bool(cid and secret)


def invalidate() -> None:
    """Drop the cached token + per-channel badge maps (call when creds change)."""
    global _token, _token_expiry
    with _lock:
        _token = None
        _token_expiry = 0.0
        _badge_cache.clear()


# ── HTTP helpers (stdlib only — no extra dependency) ───────────────────
def _post_form(url: str, fields: dict) -> dict:
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode())


def _get_json(url: str, headers: dict) -> dict:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode())


# ── app access token (client-credentials) ─────────────────────────────
def _fetch_token() -> str:
    cid, secret = _creds()
    payload = _post_form(
        TOKEN_URL,
        {
            "client_id": cid,
            "client_secret": secret,
            "grant_type": "client_credentials",
        },
    )
    global _token, _token_expiry
    _token = payload["access_token"]
    # Refresh a minute before the real expiry to avoid edge-of-expiry 401s.
    _token_expiry = time.time() + max(60, int(payload.get("expires_in", 3600)) - 60)
    return _token


def _get_token(force: bool = False) -> str:
    with _lock:
        if force or not _token or time.time() >= _token_expiry:
            return _fetch_token()
        return _token


# ── channel badges ─────────────────────────────────────────────────────
def _shape(data: list) -> dict:
    """Flatten Helix badge sets into "set_id/version" -> { url1x, url2x, title }."""
    out: dict[str, dict] = {}
    for badge_set in data or []:
        set_id = badge_set.get("set_id")
        for version in badge_set.get("versions", []):
            vid = version.get("id")
            if set_id is None or vid is None:
                continue
            out[f"{set_id}/{vid}"] = {
                "url1x": version.get("image_url_1x"),
                "url2x": version.get("image_url_2x"),
                "title": version.get("title") or set_id,
            }
    return out


def _fetch_channel_badges(broadcaster_id: str) -> dict:
    url = f"{HELIX_CHANNEL_BADGES}?broadcaster_id={urllib.parse.quote(broadcaster_id)}"

    def call(token: str) -> dict:
        cid, _ = _creds()
        return _get_json(url, {"Client-Id": cid, "Authorization": f"Bearer {token}"})

    try:
        payload = call(_get_token())
    except urllib.error.HTTPError as exc:
        # A stale/expired token reads as 401 — mint a fresh one and retry once.
        if exc.code == 401:
            payload = call(_get_token(force=True))
        else:
            raise
    return _shape(payload.get("data", []))


def channel_badges(broadcaster_id: str) -> dict:
    """Return a channel's badge map, served from a short-lived per-channel cache."""
    if not is_configured() or not broadcaster_id.isdigit():
        return {}

    now = time.time()
    cached = _badge_cache.get(broadcaster_id)
    if cached and now - cached[0] < _BADGE_TTL:
        return cached[1]

    badges = _fetch_channel_badges(broadcaster_id)
    _badge_cache[broadcaster_id] = (now, badges)
    return badges
