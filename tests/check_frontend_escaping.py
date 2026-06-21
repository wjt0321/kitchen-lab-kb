"""Smoke check that product fields are rendered as text, not executable HTML."""
import sqlite3
import time

from playwright.sync_api import sync_playwright

from helpers import post_json, run_server


def cleanup_product(code):
    conn = sqlite3.connect("data/kitchen.db")
    try:
        conn.execute("DELETE FROM products WHERE 品号 = ?", (code,))
        conn.commit()
    finally:
        conn.close()


def main():
    code = f"XSS{int(time.time())}"
    malicious_name = '<img src=x onerror="window.__xss=1">恶意产品'
    cleanup_product(code)
    try:
        with run_server(8028) as base_url:
            created = post_json(
                base_url,
                "/api/products",
                {"品号": code, "规格": "100g", "品名": malicious_name, "当前数量": 1},
            )
            assert created["ok"], created

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.goto(f"{base_url}/login", wait_until="networkidle")
                page.fill("#login-user", "测试用户")
                page.click('button:has-text("进入工作台")')
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(800)
                assert page.locator(f"text={code}").count() == 1
                assert page.evaluate("window.__xss === 1") is False, (
                    "rendered product fields must not execute injected HTML"
                )
                assert page.locator("td img").count() == 0, (
                    "injected HTML tags should be escaped in table cells"
                )
                browser.close()
    finally:
        cleanup_product(code)


if __name__ == "__main__":
    main()
