"""Smoke check that the desktop workspace shell renders for logged-in users."""
from playwright.sync_api import sync_playwright

from helpers import post_json, run_server


def main():
    with run_server(8023) as base_url:
        login = post_json(base_url, "/api/login", {"用户名": "planner"})
        assert login["ok"] is True

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.add_init_script(
                """
                localStorage.setItem('username', 'planner');
                """
            )
            page.goto(f"{base_url}/#/products", wait_until="networkidle")
            assert page.locator(".workspace-shell").count() == 1
            assert page.locator(".workspace-sidebar").count() == 1
            assert page.locator(".workspace-main").count() == 1
            assert page.locator(".page-hero").count() >= 1
            assert page.locator(".system-actions").count() == 1
            browser.close()


if __name__ == "__main__":
    main()
