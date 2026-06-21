"""Import utilities for JSON exports and database backup ZIP files."""
import base64
import json
import os
import shutil
import sqlite3
import tempfile
import zipfile
from typing import Dict, Iterable, List

import backup
import db


PRODUCT_COLUMNS = [
    "id", "品号", "规格", "品名", "当前数量", "备注", "状态",
    "created_by", "created_at", "updated_at",
]
RECIPE_COLUMNS = [
    "id", "产品id", "试验日期", "配方名称", "配方hash", "状态",
    "用了多少", "备注", "created_by", "created_at",
]
MATERIAL_COLUMNS = ["id", "配方id", "类型", "名称", "用量", "单位", "排序"]
INVENTORY_MOVEMENT_COLUMNS = [
    "id", "产品id", "变动数量", "变动前", "变动后", "原因", "created_by", "created_at",
]
REQUIRED_TABLES = ("products", "recipes", "recipe_materials", "inventory_movements")


def import_base64(filename: str, content_base64: str) -> Dict[str, int]:
    if not filename:
        raise ValueError("缺少文件名")
    if not content_base64:
        raise ValueError("缺少导入内容")

    try:
        raw = base64.b64decode(content_base64, validate=True)
    except Exception as exc:
        raise ValueError("导入内容不是有效文件") from exc

    lower = filename.lower()
    if lower.endswith(".json"):
        payload = json.loads(raw.decode("utf-8-sig"))
        return import_json_payload(payload)
    if lower.endswith(".zip"):
        return import_backup_zip(raw)
    raise ValueError("只支持导入 JSON 导出文件或备份 ZIP 文件")


def import_json_payload(payload: dict) -> Dict[str, int]:
    _validate_json_payload(payload)
    _safety_backup()
    db.init_db()

    conn = db.get_db()
    try:
        conn.execute("BEGIN")
        conn.execute("DELETE FROM recipe_materials")
        conn.execute("DELETE FROM recipes")
        conn.execute("DELETE FROM inventory_movements")
        conn.execute("DELETE FROM products")
        _insert_rows(conn, "products", PRODUCT_COLUMNS, payload.get("products", []))
        _insert_rows(conn, "inventory_movements", INVENTORY_MOVEMENT_COLUMNS, payload.get("inventory_movements", []))
        _insert_rows(conn, "recipes", RECIPE_COLUMNS, payload.get("recipes", []))
        _insert_rows(conn, "recipe_materials", MATERIAL_COLUMNS, payload.get("materials", []))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "products": len(payload.get("products", [])),
        "recipes": len(payload.get("recipes", [])),
        "materials": len(payload.get("materials", [])),
        "inventory_movements": len(payload.get("inventory_movements", [])),
    }


def import_backup_zip(raw: bytes) -> Dict[str, int]:
    _safety_backup()
    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = os.path.join(tmpdir, "import.zip")
        with open(zip_path, "wb") as f:
            f.write(raw)

        with zipfile.ZipFile(zip_path) as zf:
            names = [name for name in zf.namelist() if os.path.basename(name) == "kitchen.db"]
            if not names:
                raise ValueError("备份 ZIP 中没有 kitchen.db")
            imported_db = os.path.join(tmpdir, "kitchen.db")
            with zf.open(names[0]) as src, open(imported_db, "wb") as dst:
                shutil.copyfileobj(src, dst)

        counts = _validate_sqlite_database(imported_db)
        os.makedirs(os.path.dirname(db.DB_PATH), exist_ok=True)
        shutil.copy2(imported_db, db.DB_PATH)

    db.init_db()
    return counts


def _validate_json_payload(payload: dict) -> None:
    if not isinstance(payload, dict):
        raise ValueError("JSON 格式错误")
    for key in ("products", "recipes", "materials"):
        if key not in payload or not isinstance(payload[key], list):
            raise ValueError(f"JSON 缺少 {key} 列表")
    for key in ("inventory_movements",):
        if key in payload and not isinstance(payload[key], list):
            raise ValueError(f"JSON 中 {key} 必须是列表")


def _insert_rows(conn: sqlite3.Connection, table: str, columns: List[str], rows: Iterable[dict]) -> None:
    placeholders = ",".join("?" for _ in columns)
    quoted_columns = ",".join(f'"{col}"' for col in columns)
    sql = f'INSERT INTO {table} ({quoted_columns}) VALUES ({placeholders})'
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError(f"{table} 中存在无效行")
        conn.execute(sql, tuple(row.get(col) for col in columns))


def _validate_sqlite_database(path: str) -> Dict[str, int]:
    conn = sqlite3.connect(path)
    try:
        tables = {
            row[0]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        missing = [table for table in REQUIRED_TABLES if table not in tables]
        if missing:
            raise ValueError("备份数据库缺少表: " + ", ".join(missing))
        return {
            "products": conn.execute("SELECT COUNT(*) FROM products").fetchone()[0],
            "recipes": conn.execute("SELECT COUNT(*) FROM recipes").fetchone()[0],
            "materials": conn.execute("SELECT COUNT(*) FROM recipe_materials").fetchone()[0],
            "inventory_movements": conn.execute("SELECT COUNT(*) FROM inventory_movements").fetchone()[0],
        }
    finally:
        conn.close()


def _safety_backup() -> None:
    backup.DB_PATH = db.DB_PATH
    try:
        backup.do_backup()
    except Exception as exc:
        raise ValueError(f"导入前安全备份失败，已取消导入：{exc}") from exc
