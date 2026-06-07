"""Regression checks for reported exit, startup, and export usability bugs."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient

import app as app_module
import db as db_module
import export as export_module


ROOT = os.path.dirname(os.path.dirname(__file__))


def use_temp_db():
    tmpdir = tempfile.TemporaryDirectory()
    db_path = os.path.join(tmpdir.name, "kitchen.db")
    db_module.DB_PATH = db_path
    db_module.init_db()
    return tmpdir


def check_exit_still_returns_ok_when_backup_fails():
    client = TestClient(app_module.app)
    called = []
    old_backup = app_module.do_backup
    old_handler = app_module.SHUTDOWN_HANDLER
    app_module.do_backup = lambda: (_ for _ in ()).throw(OSError("backup locked"))
    app_module.SHUTDOWN_HANDLER = lambda: called.append("shutdown")
    try:
        response = client.post("/api/shutdown")
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["ok"] is True, payload
        assert called == ["shutdown"], "exit should still stop the app after a backup warning"
        assert "backup locked" in payload["data"].get("backup_error", "")
    finally:
        app_module.do_backup = old_backup
        app_module.SHUTDOWN_HANDLER = old_handler


def check_startup_is_not_silent_flash_exit():
    with open(os.path.join(ROOT, "startup.py"), encoding="utf-8") as f:
        source = f.read()
    with open(os.path.join(ROOT, "启动样品库知识库.bat"), "rb") as f:
        launcher_bytes = f.read()

    assert "find_available_port" in source, "startup should avoid crashing when port 7777 is occupied"
    assert "wait_for_server" in source, "startup should wait for FastAPI before opening the window"
    assert "startup.log" in source, "startup errors should be written to a log instead of disappearing"
    assert "webbrowser" in source, "startup should fall back to the default browser if pywebview fails"
    assert "log_config=None" in source, "uvicorn must not use stdout-based logging under pythonw"
    launcher_bytes.decode("ascii")
    assert b"\r\n" in launcher_bytes, "batch launcher should use Windows CRLF line endings"
    assert b"\n" not in launcher_bytes.replace(b"\r\n", b""), "batch launcher should not contain lone LF line endings"
    assert b"launcher.log" in launcher_bytes, "batch launcher should leave a diagnostic log"


def check_exports_are_grouped_and_have_latest_copy():
    tmpdir = tempfile.TemporaryDirectory()
    old_export_dir = export_module.EXPORT_DIR
    export_module.EXPORT_DIR = os.path.join(tmpdir.name, "exports")
    db_tmp = use_temp_db()
    try:
        path = export_module.export_excel("products")
        assert os.path.basename(os.path.dirname(path)) == "产品列表", path
        latest = os.path.join(export_module.EXPORT_DIR, "_latest", "产品列表_最新.xlsx")
        assert os.path.exists(latest), "latest product export should be easy to find"

        json_path = export_module.export_json()
        assert os.path.basename(os.path.dirname(json_path)) == "JSON数据", json_path
        latest_json = os.path.join(export_module.EXPORT_DIR, "_latest", "JSON数据_最新.json")
        assert os.path.exists(latest_json), "latest JSON export should be easy to find"
    finally:
        export_module.EXPORT_DIR = old_export_dir
        db_tmp.cleanup()
        tmpdir.cleanup()


def main():
    check_exit_still_returns_ok_when_backup_fails()
    check_startup_is_not_silent_flash_exit()
    check_exports_are_grouped_and_have_latest_copy()


if __name__ == "__main__":
    main()
