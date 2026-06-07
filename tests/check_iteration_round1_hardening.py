"""Checks for first-round stability and data-safety improvements."""
import os
import sqlite3
import sys
import tempfile

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app as app_module
import backup as backup_module
import db as db_module


def use_temp_paths():
    tmpdir = tempfile.TemporaryDirectory()
    db_path = os.path.join(tmpdir.name, "kitchen.db")
    backup_dir = os.path.join(tmpdir.name, "backups")
    db_module.DB_PATH = db_path
    backup_module.DB_PATH = db_path
    backup_module.BACKUP_DIR = backup_dir
    db_module.init_db()
    return tmpdir, db_path, backup_dir


def create_product(client, code="P-HARDEN-ROUND1"):
    response = client.post(
        "/api/products",
        json={"品号": code, "规格": "100g", "品名": "硬化产品", "当前数量": 1},
        headers={"X-Username": "tester"},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]["id"]


def check_cors_rejects_non_local_origins(client):
    response = client.options(
        "/api/products",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") != "http://evil.example"


def check_api_rejects_invalid_values(client):
    negative_quantity = client.post(
        "/api/products",
        json={"品号": "P-NEG", "规格": "100g", "品名": "负库存", "当前数量": -1},
        headers={"X-Username": "tester"},
    )
    assert negative_quantity.status_code == 400, negative_quantity.text

    product_id = create_product(client)
    bad_status = client.post(
        "/api/recipes",
        json={
            "产品id": product_id,
            "试验日期": "2026-06-07",
            "配方名称": "非法状态",
            "状态": "done",
            "用了多少": 1,
            "原料辅料": [{"类型": "原料", "名称": "水", "用量": 1, "单位": "g"}],
        },
        headers={"X-Username": "tester"},
    )
    assert bad_status.status_code == 400, bad_status.text


def check_missing_records_return_404(client):
    missing_product = client.put(
        "/api/products/999999",
        json={"品号": "P-MISS", "规格": "100g", "品名": "不存在", "当前数量": 1},
    )
    assert missing_product.status_code == 404, missing_product.text

    missing_recipe = client.put(
        "/api/recipes/999999",
        json={
            "产品id": create_product(client, "P-MISS-REC"),
            "试验日期": "2026-06-07",
            "配方名称": "不存在配方",
            "状态": "success",
            "用了多少": 1,
            "原料辅料": [{"类型": "原料", "名称": "水", "用量": 1, "单位": "g"}],
        },
    )
    assert missing_recipe.status_code == 404, missing_recipe.text

    delete_missing = client.delete("/api/recipes/999999")
    assert delete_missing.status_code == 404, delete_missing.text


def check_schema_constraints_reject_invalid_statuses(db_path):
    conn = sqlite3.connect(db_path)
    try:
        try:
            conn.execute(
                "INSERT INTO products (品号, 规格, 品名, 当前数量, 状态) VALUES (?, ?, ?, ?, ?)",
                ("P-BAD-SCHEMA", "100g", "坏状态", 1, "deleted"),
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("products.状态 should be constrained")
    finally:
        conn.close()


def check_backup_refuses_missing_database(backup_dir):
    missing_path = os.path.join(backup_dir, "missing.db")
    backup_module.DB_PATH = missing_path
    try:
        backup_module.do_backup()
    except FileNotFoundError:
        return
    raise AssertionError("backup should fail when the database file is missing")


def main():
    tmpdir, db_path, backup_dir = use_temp_paths()
    try:
        client = TestClient(app_module.app)
        check_cors_rejects_non_local_origins(client)
        check_api_rejects_invalid_values(client)
        check_missing_records_return_404(client)
        check_schema_constraints_reject_invalid_statuses(db_path)
        check_backup_refuses_missing_database(backup_dir)
    finally:
        tmpdir.cleanup()


if __name__ == "__main__":
    main()
