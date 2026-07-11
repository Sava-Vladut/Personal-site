"""Cached Minecraft status lookup for the public Grim Network server."""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.parse
import urllib.request

MINECRAFT_HOST = os.environ.get("MINECRAFT_HOST", "grimnetwork.srvp.ro").strip()
STATUS_BASE = os.environ.get(
    "MINECRAFT_STATUS_URL", "https://api.mcstatus.io/v2/status/java"
).rstrip("/")

_TTL = 30
_HTTP_TIMEOUT = 8
_lock = threading.Lock()
_cache: tuple[float, dict] | None = None


def _fetch() -> dict:
    target = urllib.parse.quote(MINECRAFT_HOST, safe=".:[]")
    request = urllib.request.Request(
        f"{STATUS_BASE}/{target}",
        headers={"Accept": "application/json", "User-Agent": "grim-site/1.0"},
    )
    with urllib.request.urlopen(request, timeout=_HTTP_TIMEOUT) as response:
        raw = json.loads(response.read().decode())

    players = raw.get("players") if isinstance(raw.get("players"), dict) else {}
    version = raw.get("version") if isinstance(raw.get("version"), dict) else {}
    player_list = players.get("list") if isinstance(players.get("list"), list) else []

    return {
        "host": MINECRAFT_HOST,
        "online": bool(raw.get("online")),
        "playersOnline": int(players.get("online", 0) or 0),
        "playersMax": int(players.get("max", 0) or 0),
        "players": [
            str(player.get("name_clean") or player.get("name_raw") or "").strip()
            for player in player_list
            if isinstance(player, dict)
            and str(player.get("name_clean") or player.get("name_raw") or "").strip()
        ],
        "version": str(version.get("name_clean") or version.get("name_raw") or "Unknown"),
        "software": str(raw.get("software") or "Minecraft Java"),
        "motd": str((raw.get("motd") or {}).get("clean") or "Minecraft Server"),
    }


def status() -> dict:
    """Return a fresh status or the last good snapshot when upstream hiccups."""
    global _cache
    now = time.time()

    with _lock:
        fresh = _cache is not None and now - _cache[0] < _TTL
        cached = _cache[1] if _cache is not None else None

    if fresh:
        return {**cached, "stale": False}

    try:
        data = _fetch()
    except Exception:
        if cached is not None:
            return {**cached, "stale": True}
        raise

    with _lock:
        _cache = (time.time(), data)
    return {**data, "stale": False}
