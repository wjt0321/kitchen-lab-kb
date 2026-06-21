"""Verify that renaming a product code recomputes its recipe hashes and keeps success-rate grouping correct."""
import os
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient

import app as app_module
import backup as backup_module
import db as db_module


def use_temp_paths():
    tmpdir = tempfile.TemporaryDirectory()
    data_dir = os.path.join(tmpdir.name, "data")
    backup_dir = os.path.join(tmpdir.name, "backups")
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, "kitchen.db")

    db_module.DB_PATH = db_path
    backup_module.DB_PATH = db_path
    db_module.init_db()
    return tmpdir, db_path


def create_product(client, code):
    response = client.post(
        "/api/products",
        json={"品号": code, "规格": "100g", "品名": "重哈希测试产品", "当前数量": 1},
        headers={"X-Username": "tester"},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]["id"]


def create_recipe(client, product_id, code, status="success"):
    response = client.post(
        "/api/recipes",
        json={
            "产品id": product_id,
            "试验日期": "2026-06-21",
            "配方名称": "测试配方",
            "状态": status,
            "用了多少": 1,
            "备注": "",
            "原料辅料": [
                {"类型": "原料", "名称": "水", "用量": 50, "单位": "g"},
                {"类型": "辅料", "名称": "盐", "用量": 1, "单位": "g"},
            ],
        },
        headers={"X-Username": "tester"},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]["id"]


def get_recipe_hash(db_path, recipe_id):
    conn = sqlite3.connect(db_path)
    try:
        row = conn.execute("SELECT 配方hash FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def check_rename_recomputes_recipe_hash_and_keeps_success_rate():
    tmpdir, db_path = use_temp_paths()
    try:
        client = TestClient(app_module.app)
        product_id = create_product(client, "OLD-CODE")
        recipe_id = create_recipe(client, product_id, "OLD-CODE", status="success")
        original_hash = get_recipe_hash(db_path, recipe_id)
        assert original_hash, "recipe should have a hash after creation"

        response = client.put(
            f"/api/products/{product_id}",
            json={"品号": "NEW-CODE", "规格": "100g", "品名": "重哈希测试产品", "当前数量": 1, "备注": ""},
            headers={"X-Username": "tester"},
        )
        assert response.status_code == 200, response.text

        new_hash = get_recipe_hash(db_path, recipe_id)
        assert new_hash != original_hash, "recipe hash must change after product code rename"
        assert new_hash, "recipe should still have a hash after rename"

        # Same-hash endpoint should find the renamed recipe by its new hash
        response = client.get(f"/api/recipes/{recipe_id}/same-hash")
        assert response.status_code == 200, response.text
        same_hash_items = response.json()["data"]
        assert any(item["id"] == recipe_id for item in same_hash_items), "same-hash lookup must still work"

        # Product success-rate endpoint should still group the recipe correctly
        response = client.get(f"/api/products/{product_id}/success-rate")
        assert response.status_code == 200, response.text
        groups = response.json()["data"]
        assert len(groups) == 1, "success rate should have exactly one group for this recipe"
        group = groups[0]
        assert group["试验次数"] == 1, "trial count should be 1"
        assert group["成功次数"] == 1, "success count should be 1"
        assert group["成功率"] == 1.0, "success rate should be 100%"
        assert group["配方hash"] == new_hash, "success-rate grouping should use the updated hash"
    finally:
        tmpdir.cleanup()


def main():
    check_rename_recomputes_recipe_hash_and_keeps_success_rate()


if __name__ == "__main__":
    main()
