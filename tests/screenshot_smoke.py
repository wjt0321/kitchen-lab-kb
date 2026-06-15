"""Reproduce and capture visual issues at init and maximized sizes."""
import contextlib
import os
import sys
import time

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(__file__))
from helpers import post_json, run_server

PORT = 8768
BASE = f"http://127.0.0.1:{PORT}"
SCREEN_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "screenshots", "debug")


def main():
    os.makedirs(SCREEN_DIR, exist_ok=True)
    with run_server(PORT):
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                executable_path="C:/Program Files/Google/Chrome/Application/chrome.exe",
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
            context = browser.new_context(viewport={"width": 1100, "height": 760})
            page = context.new_page()
            page.goto(f"{BASE}/#/login")
            time.sleep(0.3)
            page.screenshot(path=os.path.join(SCREEN_DIR, "init-login.png"), full_page=False)
            page.fill("#login-user", "admin")
            page.click(".login-form button")
            page.wait_for_url(f"{BASE}/#/products", timeout=10000)
            page.wait_for_selector(".products-table tbody tr", timeout=10000)
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREEN_DIR, "init-products.png"), full_page=False)
            page.screenshot(path=os.path.join(SCREEN_DIR, "init-products-full.png"), full_page=True)

            # maximized-ish width
            page.set_viewport_size({"width": 1920, "height": 1080})
            page.goto(f"{BASE}/#/products")
            page.wait_for_selector(".products-table tbody tr", timeout=10000)
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREEN_DIR, "max-products.png"), full_page=False)

            # open a product detail
            page.set_viewport_size({"width": 1100, "height": 760})
            page.click(".products-table tbody tr:first-child td a[href^='#/products/']")
            page.wait_for_selector(".detail-grid", timeout=10000)
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREEN_DIR, "init-detail.png"), full_page=False)
            page.screenshot(path=os.path.join(SCREEN_DIR, "init-detail-full.png"), full_page=True)

            # product form
            page.goto(f"{BASE}/#/products/new")
            page.wait_for_selector("#pf-品号", timeout=10000)
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREEN_DIR, "init-product-form.png"), full_page=False)

            # recipe form from product
            page.goto(f"{BASE}/#/recipes/new?product_id=1")
            page.wait_for_selector("#rf-产品id", timeout=10000)
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREEN_DIR, "init-recipe-form.png"), full_page=False)

            # success rate
            page.goto(f"{BASE}/#/success-rate")
            page.wait_for_selector(".success-rate-hero", timeout=10000)
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREEN_DIR, "init-success-rate.png"), full_page=False)

            context.close()
            browser.close()
    print("Saved debug screenshots to", SCREEN_DIR)


if __name__ == "__main__":
    main()
