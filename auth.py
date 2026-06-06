"""Simple auth — no password, just username tracking."""
from urllib.parse import unquote

from fastapi import Request
from db import get_db


def login_user(username: str) -> None:
    conn = get_db()
    conn.execute(
        "INSERT INTO user_logins (用户名) VALUES (?)",
        (username,),
    )
    conn.commit()
    conn.close()


def logout_user(username: str) -> None:
    conn = get_db()
    conn.execute(
        "UPDATE user_logins SET 登出时间 = CURRENT_TIMESTAMP WHERE 用户名 = ? AND 登出时间 IS NULL",
        (username,),
    )
    conn.commit()
    conn.close()


def get_current_user(request: Request) -> str:
    """Read username from header or query param (simplified session)."""
    user = request.headers.get("X-Username", "")
    if not user:
        user = request.query_params.get("username", "")
    return unquote(user).strip()
