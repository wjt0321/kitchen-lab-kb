"""Backend hardening checks for security and data integrity."""
import os
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app as app_module
import db as db_module
from fastapi.testclient import TestClient


def use_temp_db():
    tmpdir = tempfile.TemporaryDirectory()
    db_path = os.path.join(tmpdir.name, "kitchen.db")
    db_module.DB_PATH = db_path
    app_module.DB_PATH = db_path
    db_module.init_db()
    return tmpdir


def create_product(client, code="P-HARDEN"):
    response = client.post(
        "/api/products",
        json={"品号": code, "规格": "100g", "品名": "后端测试产品", "当前数量": 1},
        headers={"X-Username": "tester"},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]["id"]


def create_recipe(client, product_id):
    response = client.post(
        "/api/recipes",
        json={
            "产品id": product_id,
            "试验日期": "2026-06-06",
            "配方名称": "后端测试配方",
            "状态": "success",
            "用了多少": 1,
            "原料辅料": [{"类型": "原料", "名称": "水", "用量": 1, "单位": "g"}],
        },
        headers={"X-Username": "tester"},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]["id"]


def check_legacy_recipe_fk_migration():
    tmpdir = tempfile.TemporaryDirectory()
    db_path = os.path.join(tmpdir.name, "legacy.db")
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(
            """
            CREATE TABLE products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                品号 TEXT NOT NULL UNIQUE,
                规格 TEXT NOT NULL,
                品名 TEXT NOT NULL,
                当前数量 INTEGER DEFAULT 0,
                备注 TEXT,
                状态 TEXT DEFAULT 'active',
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE recipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                产品id INTEGER NOT NULL,
                试验日期 DATE NOT NULL,
                配方名称 TEXT,
                配方hash TEXT NOT NULL,
                状态 TEXT NOT NULL,
                用了多少 INTEGER,
                备注 TEXT,
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (产品id) REFERENCES products(id)
            );
            CREATE TABLE recipe_materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                配方id INTEGER NOT NULL,
                类型 TEXT NOT NULL,
                名称 TEXT NOT NULL,
                用量 REAL NOT NULL,
                单位 TEXT,
                排序 INTEGER DEFAULT 0,
                FOREIGN KEY (配方id) REFERENCES recipes(id) ON DELETE CASCADE
            );
            CREATE VIEW v_recipe_success_rate AS
            SELECT 产品id, 配方hash, COUNT(*) AS 试验次数, 0 AS 成功次数, 0 AS 成功率
            FROM recipes
            GROUP BY 产品id, 配方hash;
            """
        )
        conn.close()

        db_module.DB_PATH = db_path
        app_module.DB_PATH = db_path
        db_module.init_db()

        conn = sqlite3.connect(db_path)
        fk_rows = conn.execute("PRAGMA foreign_key_list(recipes)").fetchall()
        product_fk = next(row for row in fk_rows if row[2] == "products")
        view_sql = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='view' AND name='v_recipe_success_rate'"
        ).fetchone()[0]
        conn.execute("SELECT * FROM v_recipe_success_rate").fetchall()
    finally:
        conn.close()
        tmpdir.cleanup()

    assert product_fk[6] == "CASCADE", "legacy recipe product FK should migrate to cascade"
    assert "recipes_old" not in view_sql, "success-rate view should point at recipes"


def main():
    check_legacy_recipe_fk_migration()

    tmpdir = use_temp_db()
    try:
        client = TestClient(app_module.app)

        traversal = client.get("/static/..%2Fapp.py")
        assert traversal.status_code == 404, "static route should reject path traversal"

        bad_page = client.get("/api/products?page=0")
        assert bad_page.status_code == 422, "page must be constrained to >= 1"
        bad_page_size = client.get("/api/products?page_size=10000")
        assert bad_page_size.status_code == 422, "page_size must be capped"

        missing_archive = client.post("/api/products/999999/archive")
        assert missing_archive.status_code == 404, "archive should 404 for missing product"
        missing_restore = client.post("/api/products/999999/restore")
        assert missing_restore.status_code == 404, "restore should 404 for missing product"

        product_id = create_product(client)
        recipe_id = create_recipe(client, product_id)
        archive = client.post(f"/api/products/{product_id}/archive")
        assert archive.status_code == 200, archive.text
        delete = client.delete(f"/api/products/{product_id}")
        assert delete.status_code == 200, delete.text

        conn = sqlite3.connect(db_module.DB_PATH)
        try:
            product_count = conn.execute(
                "SELECT COUNT(*) FROM products WHERE id = ?", (product_id,)
            ).fetchone()[0]
            recipe_count = conn.execute(
                "SELECT COUNT(*) FROM recipes WHERE id = ?", (recipe_id,)
            ).fetchone()[0]
            material_count = conn.execute(
                "SELECT COUNT(*) FROM recipe_materials WHERE 配方id = ?", (recipe_id,)
            ).fetchone()[0]
        finally:
            conn.close()
        assert product_count == 0, "product should be deleted"
        assert recipe_count == 0, "recipes should be cascade-deleted"
        assert material_count == 0, "materials should be cascade-deleted"
    finally:
        tmpdir.cleanup()


if __name__ == "__main__":
    main()
