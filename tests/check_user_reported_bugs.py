"""Regression checks for user-reported UX bugs."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient

import app as app_module


ROOT = os.path.dirname(os.path.dirname(__file__))


def check_export_endpoints_still_return_files():
    client = TestClient(app_module.app)
    for path in (
        "/api/export/excel?type=products",
        "/api/export/excel?type=recipes",
        "/api/export/excel?type=success_rate",
        "/api/export/json",
    ):
        response = client.get(path)
        assert response.status_code == 200, response.text
        assert response.headers.get("content-disposition", "").startswith("attachment;")
        assert len(response.content) > 100


def check_frontend_handles_single_trial_rates_and_blob_downloads():
    with open(os.path.join(ROOT, "static", "app.js"), encoding="utf-8") as f:
        js = f.read()

    assert "formatSuccessRate" in js, "success-rate display should be centralized"
    assert "样本不足" in js, "single-trial rate should not be shown as a meaningful 0%/100%"
    assert "成功率 = 同一配方组合" in js, "UI should explain where success rate comes from"
    assert "window.open('/api/export" not in js, "exports should not depend on popup/window.open"
    assert "downloadExport" in js, "exports should use fetch + blob download"
    assert "URL.createObjectURL" in js, "blob download should create a local object URL"


def main():
    check_export_endpoints_still_return_files()
    check_frontend_handles_single_trial_rates_and_blob_downloads()


if __name__ == "__main__":
    main()
