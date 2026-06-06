"""SQLite database layer — schema, connection, helpers."""
import sqlite3
import hashlib
import json
import os
from datetime import datetime
from typing import List, Tuple, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "kitchen.db")

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    品号            TEXT NOT NULL UNIQUE,
    规格            TEXT NOT NULL,
    品名            TEXT NOT NULL,
    当前数量        INTEGER DEFAULT 0,
    备注            TEXT,
    状态            TEXT DEFAULT 'active',
    created_by      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    产品id          INTEGER NOT NULL,
    试验日期        DATE NOT NULL,
    配方名称        TEXT,
    配方hash        TEXT NOT NULL,
    状态            TEXT NOT NULL,
    用了多少        INTEGER,
    备注            TEXT,
    created_by      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (产品id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS recipe_materials (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    配方id          INTEGER NOT NULL,
    类型            TEXT NOT NULL,
    名称            TEXT NOT NULL,
    用量            REAL NOT NULL,
    单位            TEXT,
    排序            INTEGER DEFAULT 0,
    FOREIGN KEY (配方id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_logins (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    用户名          TEXT NOT NULL,
    登录时间        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    登出时间        TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_品号 ON products(品号);
CREATE INDEX IF NOT EXISTS idx_products_状态 ON products(状态);
CREATE INDEX IF NOT EXISTS idx_recipes_产品id ON recipes(产品id);
CREATE INDEX IF NOT EXISTS idx_recipes_配方hash ON recipes(配方hash);
CREATE INDEX IF NOT EXISTS idx_recipes_状态 ON recipes(状态);
CREATE INDEX IF NOT EXISTS idx_recipes_试验日期 ON recipes(试验日期);
CREATE INDEX IF NOT EXISTS idx_materials_配方id ON recipe_materials(配方id);
"""

VIEW_SQL = """
CREATE VIEW IF NOT EXISTS v_recipe_success_rate AS
SELECT
    产品id,
    配方hash,
    COUNT(*) AS 试验次数,
    SUM(CASE WHEN 状态='success' THEN 1 ELSE 0 END) AS 成功次数,
    ROUND(SUM(CASE WHEN 状态='success' THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 2) AS 成功率
FROM recipes
WHERE 状态 IN ('success', 'failed')
GROUP BY 产品id, 配方hash;
"""

# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def get_db() -> sqlite3.Connection:
    """Return a connection with row factory."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """Create tables, indexes and views if they don't exist."""
    conn = get_db()
    conn.executescript(SCHEMA_SQL)
    conn.executescript(VIEW_SQL)
    conn.commit()
    conn.close()


def db_execute(sql: str, params: tuple = ()) -> sqlite3.Cursor:
    conn = get_db()
    cur = conn.execute(sql, params)
    conn.commit()
    return cur, conn


def db_query(sql: str, params: tuple = ()) -> List[sqlite3.Row]:
    conn = get_db()
    cur = conn.execute(sql, params)
    rows = cur.fetchall()
    conn.close()
    return rows


def db_query_one(sql: str, params: tuple = ()) -> Optional[sqlite3.Row]:
    conn = get_db()
    cur = conn.execute(sql, params)
    row = cur.fetchone()
    conn.close()
    return row


# ---------------------------------------------------------------------------
# Recipe hash
# ---------------------------------------------------------------------------

def recipe_hash(品号: str, materials: List[dict]) -> str:
    """
    materials: list of dicts with keys 类型, 名称, 用量, 单位
    Returns first 16 chars of SHA256 hex digest.
    """
    原料 = sorted(
        [(m["名称"], m["用量"], m.get("单位", "")) for m in materials if m["类型"] == "原料"],
        key=lambda x: x[0],
    )
    辅料 = sorted(
        [(m["名称"], m["用量"], m.get("单位", "")) for m in materials if m["类型"] == "辅料"],
        key=lambda x: x[0],
    )
    payload = {
        "品号": 品号,
        "原料": [{"名称": n, "用量": q, "单位": u} for n, q, u in 原料],
        "辅料": [{"名称": n, "用量": q, "单位": u} for n, q, u in 辅料],
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Material helpers for a recipe
# ---------------------------------------------------------------------------

def get_recipe_materials(recipe_id: int) -> List[dict]:
    rows = db_query(
        "SELECT * FROM recipe_materials WHERE 配方id = ? ORDER BY 排序, id",
        (recipe_id,),
    )
    return [dict(r) for r in rows]


def insert_materials(conn: sqlite3.Connection, recipe_id: int, materials: List[dict]) -> None:
    for idx, m in enumerate(materials):
        conn.execute(
            """
            INSERT INTO recipe_materials (配方id, 类型, 名称, 用量, 单位, 排序)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (recipe_id, m["类型"], m["名称"], m["用量"], m.get("单位", ""), idx),
        )
