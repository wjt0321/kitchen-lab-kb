"""SQLite database layer — schema, connection, helpers."""
import sqlite3
import hashlib
import json
import os
from datetime import datetime
from typing import List, Tuple, Any, Optional

import paths

DB_PATH = os.path.join(paths.get_root_dir(), "data", "kitchen.db")

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    品号            TEXT NOT NULL UNIQUE,
    规格            TEXT NOT NULL,
    品名            TEXT NOT NULL,
    当前数量        INTEGER DEFAULT 0 CHECK (当前数量 >= 0),
    备注            TEXT,
    状态            TEXT DEFAULT 'active' CHECK (状态 IN ('active', 'archived')),
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
    状态            TEXT NOT NULL CHECK (状态 IN ('success', 'failed', 'pending')),
    用了多少        REAL DEFAULT 0 CHECK (用了多少 IS NULL OR 用了多少 >= 0),
    备注            TEXT,
    created_by      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (产品id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipe_materials (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    配方id          INTEGER NOT NULL,
    类型            TEXT NOT NULL CHECK (类型 IN ('原料', '辅料')),
    名称            TEXT NOT NULL,
    用量            REAL NOT NULL CHECK (用量 >= 0),
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

CREATE TABLE IF NOT EXISTS inventory_movements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    产品id          INTEGER NOT NULL,
    变动数量        REAL NOT NULL CHECK (变动数量 != 0),
    变动前          REAL NOT NULL CHECK (变动前 >= 0),
    变动后          REAL NOT NULL CHECK (变动后 >= 0),
    原因            TEXT,
    created_by      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (产品id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_品号 ON products(品号);
CREATE INDEX IF NOT EXISTS idx_products_状态 ON products(状态);
CREATE INDEX IF NOT EXISTS idx_recipes_产品id ON recipes(产品id);
CREATE INDEX IF NOT EXISTS idx_recipes_配方hash ON recipes(配方hash);
CREATE INDEX IF NOT EXISTS idx_recipes_状态 ON recipes(状态);
CREATE INDEX IF NOT EXISTS idx_recipes_试验日期 ON recipes(试验日期);
CREATE INDEX IF NOT EXISTS idx_materials_配方id ON recipe_materials(配方id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_产品id ON inventory_movements(产品id);
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
    _ensure_recipe_product_cascade(conn)
    _ensure_material_recipe_fk(conn)
    _ensure_schema_constraints(conn)
    _ensure_success_rate_view(conn)
    conn.executescript(VIEW_SQL)
    conn.commit()
    conn.close()


def _ensure_recipe_product_cascade(conn: sqlite3.Connection) -> None:
    """Rebuild recipes once if its product FK was created without cascade."""
    fk_rows = conn.execute("PRAGMA foreign_key_list(recipes)").fetchall()
    product_fk = next((row for row in fk_rows if row["table"] == "products"), None)
    if not product_fk or product_fk["on_delete"].upper() == "CASCADE":
        return

    conn.execute("DROP VIEW IF EXISTS v_recipe_success_rate")
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.executescript(
        """
        ALTER TABLE recipes RENAME TO recipes_old;

        CREATE TABLE recipes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            产品id          INTEGER NOT NULL,
            试验日期        DATE NOT NULL,
            配方名称        TEXT,
            配方hash        TEXT NOT NULL,
            状态            TEXT NOT NULL CHECK (状态 IN ('success', 'failed', 'pending')),
            用了多少        REAL DEFAULT 0 CHECK (用了多少 IS NULL OR 用了多少 >= 0),
            备注            TEXT,
            created_by      TEXT,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (产品id) REFERENCES products(id) ON DELETE CASCADE
        );

        INSERT INTO recipes (
            id, 产品id, 试验日期, 配方名称, 配方hash, 状态, 用了多少, 备注, created_by, created_at
        )
        SELECT
            id, 产品id, 试验日期, 配方名称, 配方hash, 状态, 用了多少, 备注, created_by, created_at
        FROM recipes_old;

        DROP TABLE recipes_old;
        """
    )
    conn.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_recipes_产品id ON recipes(产品id);
        CREATE INDEX IF NOT EXISTS idx_recipes_配方hash ON recipes(配方hash);
        CREATE INDEX IF NOT EXISTS idx_recipes_状态 ON recipes(状态);
        CREATE INDEX IF NOT EXISTS idx_recipes_试验日期 ON recipes(试验日期);
        """
    )
    conn.execute("PRAGMA foreign_keys = ON")


def _ensure_material_recipe_fk(conn: sqlite3.Connection) -> None:
    """Rebuild materials if a legacy rename left its FK pointing at recipes_old."""
    fk_rows = conn.execute("PRAGMA foreign_key_list(recipe_materials)").fetchall()
    recipe_fk = next((row for row in fk_rows if row["from"] == "配方id"), None)
    if recipe_fk and recipe_fk["table"] == "recipes" and recipe_fk["on_delete"].upper() == "CASCADE":
        return

    conn.execute("PRAGMA foreign_keys = OFF")
    conn.executescript(
        """
        CREATE TABLE recipe_materials_new (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            配方id          INTEGER NOT NULL,
            类型            TEXT NOT NULL CHECK (类型 IN ('原料', '辅料')),
            名称            TEXT NOT NULL,
            用量            REAL NOT NULL CHECK (用量 >= 0),
            单位            TEXT,
            排序            INTEGER DEFAULT 0,
            FOREIGN KEY (配方id) REFERENCES recipes(id) ON DELETE CASCADE
        );

        INSERT INTO recipe_materials_new (id, 配方id, 类型, 名称, 用量, 单位, 排序)
        SELECT id, 配方id, 类型, 名称, 用量, 单位, 排序
        FROM recipe_materials;

        DROP TABLE recipe_materials;
        ALTER TABLE recipe_materials_new RENAME TO recipe_materials;
        CREATE INDEX IF NOT EXISTS idx_materials_配方id ON recipe_materials(配方id);
        """
    )
    conn.execute("PRAGMA foreign_keys = ON")


def _table_sql(conn: sqlite3.Connection, table: str) -> str:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    return (row["sql"] or "") if row else ""


def _ensure_schema_constraints(conn: sqlite3.Connection) -> None:
    """Rebuild legacy tables so existing databases get the same CHECK constraints."""
    _ensure_success_rate_view(conn)
    products_rebuilt = False
    if "状态 IN ('active', 'archived')" not in _table_sql(conn, "products"):
        _rebuild_products_with_constraints(conn)
        products_rebuilt = True

    recipe_sql = _table_sql(conn, "recipes")
    recipe_fk_rows = conn.execute("PRAGMA foreign_key_list(recipes)").fetchall()
    product_fk = next((row for row in recipe_fk_rows if row["table"] == "products"), None)
    recipe_fk_bad = not product_fk or product_fk["on_delete"].upper() != "CASCADE"
    if (
        products_rebuilt
        or recipe_fk_bad
        or "状态 IN ('success', 'failed', 'pending')" not in recipe_sql
        or "用了多少 >= 0" not in recipe_sql
    ):
        _rebuild_recipes_with_constraints(conn)

    material_sql = _table_sql(conn, "recipe_materials")
    material_fk_rows = conn.execute("PRAGMA foreign_key_list(recipe_materials)").fetchall()
    material_fk = next((row for row in material_fk_rows if row["from"] == "配方id"), None)
    material_fk_bad = (
        not material_fk
        or material_fk["table"] != "recipes"
        or material_fk["on_delete"].upper() != "CASCADE"
    )
    if (
        material_fk_bad
        or "类型 IN ('原料', '辅料')" not in material_sql
        or "用量 >= 0" not in material_sql
    ):
        _rebuild_materials_with_constraints(conn)


def _rebuild_products_with_constraints(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.executescript(
        """
        ALTER TABLE products RENAME TO products_old;

        CREATE TABLE products (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            品号            TEXT NOT NULL UNIQUE,
            规格            TEXT NOT NULL,
            品名            TEXT NOT NULL,
            当前数量        INTEGER DEFAULT 0 CHECK (当前数量 >= 0),
            备注            TEXT,
            状态            TEXT DEFAULT 'active' CHECK (状态 IN ('active', 'archived')),
            created_by      TEXT,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO products (
            id, 品号, 规格, 品名, 当前数量, 备注, 状态, created_by, created_at, updated_at
        )
        SELECT
            id,
            品号,
            规格,
            品名,
            CASE WHEN 当前数量 >= 0 THEN 当前数量 ELSE 0 END,
            备注,
            CASE WHEN 状态 IN ('active', 'archived') THEN 状态 ELSE 'active' END,
            created_by,
            created_at,
            updated_at
        FROM products_old;

        DROP TABLE products_old;
        CREATE INDEX IF NOT EXISTS idx_products_品号 ON products(品号);
        CREATE INDEX IF NOT EXISTS idx_products_状态 ON products(状态);
        """
    )
    conn.execute("PRAGMA foreign_keys = ON")


def _rebuild_recipes_with_constraints(conn: sqlite3.Connection) -> None:
    conn.execute("DROP VIEW IF EXISTS v_recipe_success_rate")
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.executescript(
        """
        ALTER TABLE recipes RENAME TO recipes_old;

        CREATE TABLE recipes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            产品id          INTEGER NOT NULL,
            试验日期        DATE NOT NULL,
            配方名称        TEXT,
            配方hash        TEXT NOT NULL,
            状态            TEXT NOT NULL CHECK (状态 IN ('success', 'failed', 'pending')),
            用了多少        REAL DEFAULT 0 CHECK (用了多少 IS NULL OR 用了多少 >= 0),
            备注            TEXT,
            created_by      TEXT,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (产品id) REFERENCES products(id) ON DELETE CASCADE
        );

        INSERT INTO recipes (
            id, 产品id, 试验日期, 配方名称, 配方hash, 状态, 用了多少, 备注, created_by, created_at
        )
        SELECT
            id,
            产品id,
            试验日期,
            配方名称,
            配方hash,
            CASE WHEN 状态 IN ('success', 'failed', 'pending') THEN 状态 ELSE 'pending' END,
            CASE WHEN 用了多少 IS NULL OR 用了多少 >= 0 THEN 用了多少 ELSE 0 END,
            备注,
            created_by,
            created_at
        FROM recipes_old;

        DROP TABLE recipes_old;
        CREATE INDEX IF NOT EXISTS idx_recipes_产品id ON recipes(产品id);
        CREATE INDEX IF NOT EXISTS idx_recipes_配方hash ON recipes(配方hash);
        CREATE INDEX IF NOT EXISTS idx_recipes_状态 ON recipes(状态);
        CREATE INDEX IF NOT EXISTS idx_recipes_试验日期 ON recipes(试验日期);
        """
    )
    conn.execute("PRAGMA foreign_keys = ON")


def _rebuild_materials_with_constraints(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.executescript(
        """
        CREATE TABLE recipe_materials_new (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            配方id          INTEGER NOT NULL,
            类型            TEXT NOT NULL CHECK (类型 IN ('原料', '辅料')),
            名称            TEXT NOT NULL,
            用量            REAL NOT NULL CHECK (用量 >= 0),
            单位            TEXT,
            排序            INTEGER DEFAULT 0,
            FOREIGN KEY (配方id) REFERENCES recipes(id) ON DELETE CASCADE
        );

        INSERT INTO recipe_materials_new (id, 配方id, 类型, 名称, 用量, 单位, 排序)
        SELECT
            id,
            配方id,
            CASE WHEN 类型 IN ('原料', '辅料') THEN 类型 ELSE '原料' END,
            名称,
            CASE WHEN 用量 >= 0 THEN 用量 ELSE 0 END,
            单位,
            排序
        FROM recipe_materials;

        DROP TABLE recipe_materials;
        ALTER TABLE recipe_materials_new RENAME TO recipe_materials;
        CREATE INDEX IF NOT EXISTS idx_materials_配方id ON recipe_materials(配方id);
        """
    )
    conn.execute("PRAGMA foreign_keys = ON")


def _ensure_success_rate_view(conn: sqlite3.Connection) -> None:
    """Drop stale/broken success-rate view so VIEW_SQL can recreate it."""
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='view' AND name='v_recipe_success_rate'"
    ).fetchone()
    if not row:
        return

    view_sql = row["sql"] or ""
    should_rebuild = "recipes_old" in view_sql
    if not should_rebuild:
        try:
            conn.execute("SELECT * FROM v_recipe_success_rate LIMIT 1").fetchall()
        except sqlite3.DatabaseError:
            should_rebuild = True

    if should_rebuild:
        conn.execute("DROP VIEW IF EXISTS v_recipe_success_rate")


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
