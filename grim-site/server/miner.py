"""Read-only proxy for the Twitch Channel-Points miner dashboard.

The miner node (Twitch-Channel-Points-Miner-v2) exposes an unauthenticated
JSON feed at http://<host>/streamers listing each watched channel's current
channel-point balance and last activity. That node is HTTP-only and lives on a
different origin, so the browser can't read it directly once this site is served
over HTTPS (mixed-content) and without CORS headers. This module fetches it
server-side with a short cache and hands the browser a clean, normalized list.

Override the node location with MINER_URL (defaults to the grimnetwork box).
"""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.request

MINER_BASE = os.environ.get("MINER_URL", "http://grimnetwork.srvp.ro:5000").rstrip("/")

# The dashboard refreshes on the order of minutes; a short server cache keeps the
# inline readout snappy without hammering the node on every page view.
_TTL = 30  # seconds
_HTTP_TIMEOUT = 8

_lock = threading.Lock()
_cache: tuple[float, list] | None = None  # (fetched_at, streamers)


def _fetch() -> list:
    """Pull /streamers from the node and normalize it for the browser."""
    req = urllib.request.Request(
        f"{MINER_BASE}/streamers", headers={"Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
        raw = json.loads(resp.read().decode())

    out: list[dict] = []
    for item in raw if isinstance(raw, list) else []:
        # Names arrive as "<channel>.json" — strip the extension for display.
        name = str(item.get("name", "")).removesuffix(".json").strip()
        if not name:
            continue
        out.append(
            {
                "name": name,
                "points": int(item.get("points", 0) or 0),
                "lastActivity": item.get("last_activity"),  # unix ms, may be null
            }
        )
    out.sort(key=lambda s: s["points"], reverse=True)
    return out


def streamers() -> dict:
    """Cached, normalized channel list.

    `online` reports whether the node answered: on a fetch failure we serve the
    last good snapshot (if any) so the readout degrades gracefully instead of
    going blank when the miner box hiccups.
    """
    global _cache
    now = time.time()

    with _lock:
        fresh = _cache is not None and now - _cache[0] < _TTL
        cached = _cache[1] if _cache is not None else None

    if fresh:
        return {"streamers": cached, "online": True}

    try:
        data = _fetch()
    except Exception:  # noqa: BLE001 — a node hiccup shouldn't break the readout.
        if cached is not None:
            return {"streamers": cached, "online": False}
        raise

    with _lock:
        _cache = (time.time(), data)
    return {"streamers": data, "online": True}
