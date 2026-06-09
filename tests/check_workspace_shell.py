import re

"""Smoke check that the desktop workspace shell renders for logged-in users."""
from playwright.sync_api import sync_playwright

from helpers import run_server


def assert_workspace_shell(page):
    page.locator(".page-hero").first.wait_for()
    assert page.locator(".workspace-shell").count() == 1
    assert page.locator(".workspace-sidebar").count() == 1
    assert page.locator(".workspace-main").count() == 1
    assert page.locator(".login-shell").count() == 0
    assert page.locator(".page-hero").count() >= 1
    assert page.locator(".page-hero-title").count() >= 1
    assert page.locator(".products-hero-search #prod-q").count() == 1
    assert page.locator(".products-hero-actions .btn-primary").count() == 1
    assert page.locator(".products-panel .table-wrap").count() == 1
    assert page.locator(".system-actions").count() == 1
    assert page.locator(".sidebar-nav a.active").count() == 1
    assert page.locator(".sidebar-nav a.active").first.text_content().strip() == "产品"
    assert page.locator(".current-user").first.text_content().strip() == "planner"


def build_storage_state(base_url, username):
    return {
        "cookies": [],
        "origins": [
            {
                "origin": base_url,
                "localStorage": [{"name": "username", "value": username}],
            }
        ],
    }


def login_and_capture_state(browser, base_url):
    context = browser.new_context()
    page = context.new_page()
    page.goto(f"{base_url}/login", wait_until="networkidle")
    page.locator("#login-user").fill("planner")
    page.get_by_role("button", name="进入工作台").click()
    page.wait_for_url(re.compile(r".+#/products$"))
    page.wait_for_load_state("networkidle")
    assert_workspace_shell(page)
    persisted_user = page.evaluate("window.localStorage.getItem('username')")
    context.close()
    return build_storage_state(base_url, persisted_user)


def assert_cold_start_with_saved_login(browser, base_url, storage_state):
    context = browser.new_context(storage_state=storage_state)
    page = context.new_page()
    page.goto(base_url, wait_until="networkidle")
    page.wait_for_load_state("networkidle")
    assert_workspace_shell(page)
    assert page.url.rstrip("/") == base_url.rstrip("/")
    context.close()


def assert_login_redirect_with_saved_login(browser, base_url, storage_state):
    context = browser.new_context(storage_state=storage_state)
    page = context.new_page()
    page.goto(f"{base_url}/login", wait_until="networkidle")
    page.wait_for_url(re.compile(r".+#/products$"))
    page.wait_for_load_state("networkidle")
    assert_workspace_shell(page)
    context.close()


def main():
    with run_server(8023) as base_url:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            storage_state = login_and_capture_state(browser, base_url)
            assert_cold_start_with_saved_login(browser, base_url, storage_state)
            assert_login_redirect_with_saved_login(browser, base_url, storage_state)
            browser.close()


if __name__ == "__main__":
    main()
