import re

"""Smoke check that the desktop workspace shell renders for logged-in users."""
from playwright.sync_api import sync_playwright

from helpers import run_server


def main():
    with run_server(8023) as base_url:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(f"{base_url}/login", wait_until="networkidle")
            page.locator("#login-user").fill("planner")
            page.get_by_role("button", name="登录").click()
            page.wait_for_url(re.compile(r".+#/products$"))
            page.wait_for_load_state("networkidle")
            assert page.locator(".workspace-shell").count() == 1
            assert page.locator(".workspace-sidebar").count() == 1
            assert page.locator(".workspace-main").count() == 1
            assert page.locator(".page-hero").count() >= 1
            assert page.locator(".system-actions").count() == 1
            browser.close()


if __name__ == "__main__":
    main()
