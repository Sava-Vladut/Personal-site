"""FastAPI backend for the /services console.

Wraps the existing CLI converters in src/services so the browser can POST a
link and stream back the finished file:

    POST /api/tiktok   {"url": "...", "format": "mp4"} -> video/mp4 or audio/mpeg

The HEIC converter stays client-side and is not handled here.
"""

from __future__ import annotations

import importlib.util
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

import auth

BASE_DIR = Path(__file__).resolve().parent
SERVICES_DIR = BASE_DIR.parent / "src" / "services"


def _load_module(name: str, relative_path: str):
    """Import a converter script by file path so we reuse its real logic."""
    path = SERVICES_DIR / relative_path
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load module from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


tiktok_service = _load_module("tiktok_service", "tiktok/tiktok_convert.py")

app = FastAPI(title="grim services api")


@app.on_event("startup")
def _startup() -> None:
    auth.init_db()


# Same-origin via the Vite/nginx /api proxy, so credentialed cookies work
# without a permissive CORS policy. allow_credentials with a wildcard origin is
# invalid, so we don't echo arbitrary origins here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Set COOKIE_SECURE=true in production (behind HTTPS via Caddy). Left false by
# default so the cookie still works over plain http during local dev.
_COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        auth.COOKIE_NAME,
        token,
        max_age=auth.SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=_COOKIE_SECURE,
        path="/",
    )


def current_account(grim_session: str | None = Cookie(default=None)) -> dict:
    """Resolve the session cookie to an account or reject with 401."""
    account = auth.account_for_token(grim_session)
    if account is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return account


def require_admin(account: dict = Depends(current_account)) -> dict:
    if not account["isAdmin"]:
        raise HTTPException(status_code=403, detail="Admin privileges required.")
    return account


class TikTokRequest(BaseModel):
    url: str
    format: str = "mp4"


def _ensure_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise HTTPException(
            status_code=503,
            detail="ffmpeg is not installed or not on PATH on the server.",
        )


def _file_response(path: Path, media_type: str, workdir: Path) -> FileResponse:
    """Return the file and delete its temp directory once the response is sent."""
    return FileResponse(
        path,
        media_type=media_type,
        filename=path.name,
        background=BackgroundTask(shutil.rmtree, workdir, ignore_errors=True),
    )


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "ffmpeg": shutil.which("ffmpeg") is not None}


# ── auth ───────────────────────────────────────────────────────────────
class Credentials(BaseModel):
    username: str
    password: str


class NewUser(BaseModel):
    username: str
    password: str
    isAdmin: bool = False


class AdminFlag(BaseModel):
    isAdmin: bool


class NewPassword(BaseModel):
    password: str


def _auth_call(fn, *args):
    """Run an auth.py operation, mapping its AuthError to an HTTP error."""
    try:
        return fn(*args)
    except auth.AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@app.post("/api/auth/register")
def auth_register(body: Credentials, response: Response) -> dict:
    account = _auth_call(auth.register, body.username, body.password)
    _set_session_cookie(response, auth.open_session(account["username"]))
    return account


@app.post("/api/auth/login")
def auth_login(body: Credentials, response: Response) -> dict:
    account = _auth_call(auth.verify, body.username, body.password)
    _set_session_cookie(response, auth.open_session(account["username"]))
    return account


@app.post("/api/auth/logout")
def auth_logout(
    response: Response, grim_session: str | None = Cookie(default=None)
) -> dict:
    auth.close_session(grim_session)
    response.delete_cookie(auth.COOKIE_NAME, path="/")
    return {"ok": True}


@app.get("/api/auth/me")
def auth_me(account: dict = Depends(current_account)) -> dict:
    return account


# ── admin registry ─────────────────────────────────────────────────────
@app.get("/api/users")
def users_list(_: dict = Depends(require_admin)) -> list[dict]:
    return auth.list_users()


@app.post("/api/users")
def users_create(body: NewUser, _: dict = Depends(require_admin)) -> dict:
    return _auth_call(auth.create_user, body.username, body.password, body.isAdmin)


def _guard_not_self(user_id: int, admin: dict, action: str) -> None:
    """Block an admin from deleting/demoting their own account (avoids lockout)."""
    target = next((u for u in auth.list_users() if u["id"] == user_id), None)
    if target and target["username"].lower() == admin["username"].lower():
        raise HTTPException(status_code=400, detail=f"You cannot {action} your own account.")


@app.delete("/api/users/{user_id}")
def users_delete(user_id: int, admin: dict = Depends(require_admin)) -> dict:
    _guard_not_self(user_id, admin, "delete")
    auth.delete_user(user_id)
    return {"ok": True}


@app.patch("/api/users/{user_id}/admin")
def users_set_admin(
    user_id: int, body: AdminFlag, admin: dict = Depends(require_admin)
) -> dict:
    if not body.isAdmin:
        _guard_not_self(user_id, admin, "demote")
    auth.set_admin(user_id, body.isAdmin)
    return {"ok": True}


@app.post("/api/users/{user_id}/password")
def users_reset_password(
    user_id: int, body: NewPassword, _: dict = Depends(require_admin)
) -> dict:
    _auth_call(auth.reset_password, user_id, body.password)
    return {"ok": True}


@app.post("/api/tiktok")
def tiktok_download(request: TikTokRequest) -> FileResponse:
    url = request.url.strip()
    requested_format = request.format.lower()

    if requested_format not in {"mp3", "mp4"}:
        raise HTTPException(status_code=422, detail="format must be 'mp4' or 'mp3'.")
    if not tiktok_service.validate_tiktok_url(url):
        raise HTTPException(
            status_code=422,
            detail="Invalid TikTok URL. Use a full link like "
            "https://www.tiktok.com/@user/video/1234567890.",
        )

    if requested_format == "mp3":
        _ensure_ffmpeg()

    workdir = Path(tempfile.mkdtemp(prefix="tiktok_"))

    try:
        saved_path = tiktok_service.run_download(url, requested_format, workdir, None)
    except SystemExit as exc:
        # run_download raises SystemExit(message) on extraction/download errors.
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=_clean_error(exc)) from exc

    media_type = "audio/mpeg" if requested_format == "mp3" else "video/mp4"
    return _file_response(Path(saved_path), media_type, workdir)


def _clean_error(exc: Exception) -> str:
    message = str(exc).strip() or exc.__class__.__name__
    return message.split("\n")[0][:300]
