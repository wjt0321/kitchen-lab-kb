"""Checks for import, shutdown, launcher, and portable dependency features."""
import base64
import os
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient

import app as app_module
import backup as backup_module
import db as db_module
import export as export_module


ROOT = os.path.dirname(os.path.dirname(__file__))


def use_temp_paths():
    tmpdir = tempfile.TemporaryDirectory()
    data_dir = os.path.join(tmpdir.name, "data")
    backup_dir = os.path.join(tmpdir.name, "backups")
    export_dir = os.path.join(tmpdir.name, "exports")
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, "kitchen.db")

    db_module.DB_PATH = db_path
    backup_module.DB_PATH = db_path
    backup_module.BACKUP_DIR = backup_dir
    export_module.EXPORT_DIR = export_dir
    app_module.DB_PATH = db_path
    app_module.BACKUP_DIR = backup_dir
    db_module.init_db()
    return tmpdir, db_path, backup_dir, export_dir


def create_product(client, code):
    response = client.post(
        "/api/products",
        json={"品号": code, "规格": "100g", "品名": "导入测试产品", "当前数量": 1},
        headers={"X-Username": "tester"},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]["id"]


def count_products(db_path):
    conn = sqlite3.connect(db_path)
    try:
        return conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    finally:
        conn.close()


def count_inventory_movements(db_path):
    conn = sqlite3.connect(db_path)
    try:
        return conn.execute("SELECT COUNT(*) FROM inventory_movements").fetchone()[0]
    finally:
        conn.close()


def check_dedicated_export_directory():
    client = TestClient(app_module.app)
    response = client.get("/api/export/json")
    assert response.status_code == 200, response.text
    assert os.path.isdir(export_module.EXPORT_DIR), "exports directory should exist"
    assert os.path.basename(export_module.EXPORT_DIR) == "exports", "exports should use a dedicated folder"


def check_json_import_replaces_database_and_keeps_backup():
    tmpdir, db_path, backup_dir, _ = use_temp_paths()
    try:
        client = TestClient(app_module.app)
        create_product(client, "OLD-IMPORT")
        assert count_products(db_path) == 1

        payload = {
            "exported_at": "2026-06-06T00:00:00",
            "products": [
                {
                    "id": 88,
                    "品号": "NEW-IMPORT",
                    "规格": "200g",
                    "品名": "导入后的产品",
                    "当前数量": 5,
                    "备注": "ok",
                    "状态": "active",
                    "created_by": "tester",
                    "created_at": "2026-06-06 00:00:00",
                    "updated_at": "2026-06-06 00:00:00",
                }
            ],
            "recipes": [],
            "materials": [],
        }
        encoded = base64.b64encode(
            __import__("json").dumps(payload, ensure_ascii=False).encode("utf-8")
        ).decode("ascii")

        response = client.post("/api/import", json={"filename": "restore.json", "content_base64": encoded})
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["products"] == 1
        assert count_products(db_path) == 1
        conn = sqlite3.connect(db_path)
        try:
            row = conn.execute("SELECT 品号 FROM products").fetchone()
            assert row[0] == "NEW-IMPORT", "import should replace existing product data"
        finally:
            conn.close()
        assert os.listdir(backup_dir), "import should create a safety backup first"
    finally:
        tmpdir.cleanup()


def check_backup_zip_import_restores_database():
    tmpdir, db_path, _, _ = use_temp_paths()
    try:
        client = TestClient(app_module.app)
        create_product(client, "ZIP-OLD")
        backup_path = backup_module.do_backup()
        create_product(client, "ZIP-NEW")
        assert count_products(db_path) == 2

        with open(backup_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("ascii")

        response = client.post("/api/import", json={"filename": "kitchen.zip", "content_base64": encoded})
        assert response.status_code == 200, response.text
        assert count_products(db_path) == 1
        conn = sqlite3.connect(db_path)
        try:
            row = conn.execute("SELECT 品号 FROM products").fetchone()
            assert row[0] == "ZIP-OLD", "ZIP import should restore the backed-up database"
        finally:
            conn.close()
    finally:
        tmpdir.cleanup()


def check_json_import_restores_inventory_movements():
    tmpdir, db_path, backup_dir, _ = use_temp_paths()
    try:
        client = TestClient(app_module.app)
        product_id = create_product(client, "INV-OLD")

        response = client.post(
            f"/api/products/{product_id}/inventory-adjust",
            json={"变动数量": 10, "原因": "盘点入库"},
            headers={"X-Username": "tester"},
        )
        assert response.status_code == 200, response.text
        assert count_inventory_movements(db_path) == 1

        response = client.get("/api/export/json")
        assert response.status_code == 200, response.text
        payload = __import__("json").loads(response.text)
        assert len(payload.get("inventory_movements", [])) == 1, "export should include inventory movement"

        # Simulate re-import into a fresh database
        tmpdir2, db_path2, _, _ = use_temp_paths()
        try:
            client2 = TestClient(app_module.app)
            encoded = base64.b64encode(
                __import__("json").dumps(payload, ensure_ascii=False).encode("utf-8")
            ).decode("ascii")
            response = client2.post(
                "/api/import", json={"filename": "restore.json", "content_base64": encoded}
            )
            assert response.status_code == 200, response.text
            data = response.json()["data"]
            assert data["inventory_movements"] == 1
            assert count_inventory_movements(db_path2) == 1, "import should restore inventory movement"

            conn = sqlite3.connect(db_path2)
            try:
                row = conn.execute("SELECT 变动数量, 原因 FROM inventory_movements").fetchone()
                assert row[0] == 10.0, "movement delta should round-trip"
                assert row[1] == "盘点入库", "movement reason should round-trip"
            finally:
                conn.close()
        finally:
            tmpdir2.cleanup()
    finally:
        tmpdir.cleanup()


def check_shutdown_endpoint_backs_up_and_invokes_handler():
    tmpdir, _, backup_dir, _ = use_temp_paths()
    called = []
    old_handler = app_module.SHUTDOWN_HANDLER
    app_module.SHUTDOWN_HANDLER = lambda: called.append("shutdown")
    try:
        client = TestClient(app_module.app)
        response = client.post("/api/shutdown")
        assert response.status_code == 200, response.text
        assert called == ["shutdown"], "shutdown endpoint should invoke configured shutdown handler"
        assert os.listdir(backup_dir), "shutdown should back up current data before stopping"
    finally:
        app_module.SHUTDOWN_HANDLER = old_handler
        tmpdir.cleanup()


def check_frontend_import_and_danger_exit_controls():
    with open(os.path.join(ROOT, "templates", "base.html"), encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(ROOT, "static", "app.js"), encoding="utf-8") as f:
        js = f.read()
    with open(os.path.join(ROOT, "static", "style.css"), encoding="utf-8") as f:
        css = f.read()

    assert "app.importData" in js, "topbar should expose import"
    assert "app.confirmExit" in js, "topbar should expose app-level exit"
    assert "btn-outline-danger" in js, "exit button should use danger styling"
    assert "/api/import" in js, "frontend should call import API"
    assert "/api/shutdown" in js, "frontend should call shutdown API"
    assert "确认退出" in js and "取消" in js, "exit should confirm before stopping"


def check_launcher_icon_and_dependency_folder():
    assert os.path.exists(os.path.join(ROOT, "兴达logo.ico")), "Windows icon file should be generated"
    assert os.path.exists(os.path.join(ROOT, "启动样品库知识库.bat")), "double-click launcher should exist"
    assert os.path.exists(os.path.join(ROOT, "兴达样品库知识库.lnk")), "Windows shortcut should use the icon and launcher"
    assert os.path.isdir(os.path.join(ROOT, "dependencies")), "dependencies folder should exist"
    assert os.path.exists(os.path.join(ROOT, "dependencies", "README.md")), "dependencies folder should explain offline use"


def main():
    check_dedicated_export_directory()
    check_json_import_replaces_database_and_keeps_backup()
    check_backup_zip_import_restores_database()
    check_json_import_restores_inventory_movements()
    check_shutdown_endpoint_backs_up_and_invokes_handler()
    check_frontend_import_and_danger_exit_controls()
    check_launcher_icon_and_dependency_folder()


if __name__ == "__main__":
    main()
