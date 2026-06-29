"""Server-side account store for the /services console.

Replaces the old in-browser sql.js blob with a real SQLite file on the server,
so accounts are shared across every browser and device instead of living in one
device's localStorage. Sessions are tracked server-side and handed to the
browser as an httpOnly cookie, so the token is never readable by page scripts.

Security notes:
  * Passwords are PBKDF2-HMAC-SHA256 (salted, 200k iterations) — never stored
    or returned in plaintext, and the hash never leaves the server.
  * The client cannot self-grant admin: the first account ever created becomes
    the admin (bootstrap), and everyone else is a plain operator until an admin
    promotes them through the registry.
"""

from __future__ import annotations

import hashlib
import os
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path

# The DB lives on a mounted volume in production (see docker-compose.yml) so it
# survives container rebuilds. Override with AUTH_DB_PATH for local runs.
DB_PATH = Path(os.environ.get("AUTH_DB_PATH", "/data/users.db"))

COOKIE_NAME = "grim_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days
_PBKDF2_ITERATIONS = 200_000


class AuthError(Exception):
    """Raised for expected, user-facing auth failures (bad input, conflicts)."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


# ── connection / schema ────────────────────────────────────────────────
_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""

_initialized = False


@contextmanager
def _connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if missing. Idempotent; safe to call repeatedly."""
    global _initialized
    with _connect() as conn:
        conn.executescript(_SCHEMA)
    _initialized = True


def _ensure_db() -> None:
    """Lazy guard so operations work even if startup init hasn't run yet."""
    if not _initialized:
        init_db()


# ── password hashing ───────────────────────────────────────────────────
def _make_salt() -> str:
    return secrets.token_hex(16)


def _hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), _PBKDF2_ITERATIONS
    )
    return digest.hex()


def _verify_password(password: str, salt: str, expected_hash: str) -> bool:
    return secrets.compare_digest(_hash_password(password, salt), expected_hash)


# ── row shaping ────────────────────────────────────────────────────────
def _account(row: sqlite3.Row) -> dict:
    """Minimal shape returned to the signed-in client."""
    return {"username": row["username"], "isAdmin": bool(row["is_admin"])}


def _user(row: sqlite3.Row) -> dict:
    """Full row for the admin registry (never includes the password hash)."""
    return {
        "id": row["id"],
        "username": row["username"],
        "isAdmin": bool(row["is_admin"]),
        "createdAt": row["created_at"],
    }


# ── validation ─────────────────────────────────────────────────────────
def _validate_credentials(username: str, password: str) -> str:
    name = username.strip()
    if len(name) < 3:
        raise AuthError("Username must be at least 3 characters.", 422)
    if len(password) < 6:
        raise AuthError("Password must be at least 6 characters.", 422)
    return name


# ── account operations ─────────────────────────────────────────────────
def register(username: str, password: str) -> dict:
    """Public self-registration. The very first account becomes the admin."""
    _ensure_db()
    name = _validate_credentials(username, password)
    with _connect() as conn:
        if conn.execute(
            "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE", (name,)
        ).fetchone():
            raise AuthError("That username is already taken.", 409)
        # Bootstrap: an empty registry means this first operator is the admin.
        is_first = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0
        salt = _make_salt()
        conn.execute(
            "INSERT INTO users (username, password_hash, salt, is_admin) VALUES (?, ?, ?, ?)",
            (name, _hash_password(password, salt), salt, 1 if is_first else 0),
        )
    return {"username": name, "isAdmin": is_first}


def create_user(username: str, password: str, is_admin: bool = False) -> dict:
    """Admin-only creation: an admin may set the role directly."""
    _ensure_db()
    name = _validate_credentials(username, password)
    with _connect() as conn:
        if conn.execute(
            "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE", (name,)
        ).fetchone():
            raise AuthError("That username is already taken.", 409)
        salt = _make_salt()
        conn.execute(
            "INSERT INTO users (username, password_hash, salt, is_admin) VALUES (?, ?, ?, ?)",
            (name, _hash_password(password, salt), salt, 1 if is_admin else 0),
        )
    return {"username": name, "isAdmin": bool(is_admin)}


def verify(username: str, password: str) -> dict:
    _ensure_db()
    name = username.strip()
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (name,)
        ).fetchone()
    if not row or not _verify_password(password, row["salt"], row["password_hash"]):
        # Same message either way so we don't reveal which usernames exist.
        raise AuthError("Invalid username or password.", 401)
    return _account(row)


def list_users() -> list[dict]:
    _ensure_db()
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, username, is_admin, created_at FROM users ORDER BY id"
        ).fetchall()
    return [_user(row) for row in rows]


def delete_user(user_id: int) -> None:
    _ensure_db()
    with _connect() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


def set_admin(user_id: int, is_admin: bool) -> None:
    _ensure_db()
    with _connect() as conn:
        conn.execute(
            "UPDATE users SET is_admin = ? WHERE id = ?", (1 if is_admin else 0, user_id)
        )


def reset_password(user_id: int, password: str) -> None:
    _ensure_db()
    if len(password) < 6:
        raise AuthError("New password must be at least 6 characters.", 422)
    salt = _make_salt()
    with _connect() as conn:
        conn.execute(
            "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
            (_hash_password(password, salt), salt, user_id),
        )


# ── settings (generic key/value store) ─────────────────────────────────
def get_setting(key: str, default: str | None = None) -> str | None:
    _ensure_db()
    with _connect() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    _ensure_db()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


# ── sessions ───────────────────────────────────────────────────────────
def open_session(username: str) -> str:
    """Mint a session token for an already-verified username."""
    _ensure_db()
    token = secrets.token_urlsafe(32)
    with _connect() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE username = ? COLLATE NOCASE", (username,)
        ).fetchone()
        if not row:
            raise AuthError("Account no longer exists.", 401)
        conn.execute(
            "INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, row["id"])
        )
    return token


def close_session(token: str | None) -> None:
    _ensure_db()
    if not token:
        return
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def account_for_token(token: str | None) -> dict | None:
    """Resolve a session cookie to its account, or None if it's invalid."""
    _ensure_db()
    if not token:
        return None
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT u.* FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()
    return _account(row) if row else None
