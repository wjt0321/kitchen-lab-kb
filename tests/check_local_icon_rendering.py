"""Checks that the frontend no longer depends on a remote icon webfont."""
import os

from playwright.sync_api import sync_playwright

from helpers import run_server


ROOT = os.path.dirname(os.path.dirname(__file__))


def check_static_contract():
    with open(os.path.join(ROOT, "templates", "base.html"), encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(ROOT, "static", "app.js"), encoding="utf-8") as f:
        js = f.read()

    assert "@tabler/icons-webfont" not in html, "base shell should not depend on remote icon webfont"
    assert "renderLocalIcons(root = document)" in js, "frontend should expose a local icon hydration helper"
    assert "iconSvg(name" in js, "frontend should keep icon SVGs in the local bundle"


def check_login_page_icons(base_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{base_url}/login", wait_until="networkidle")

        assert page.locator("link[href*='icons-webfont']").count() == 0
        assert page.locator(".login-form .ti svg").count() >= 1
        assert page.locator(".login-form button .ti svg").count() == 1

        browser.close()


def main():
    check_static_contract()
    with run_server(8024) as base_url:
        check_login_page_icons(base_url)


if __name__ == "__main__":
    main()
