"""Smoke check that a non-ASCII username can enter the products page."""
from playwright.sync_api import sync_playwright

from helpers import run_server


def main():
    with run_server(8024) as base_url:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.goto(f"{base_url}/login", wait_until="networkidle")
            page.fill("#login-user", "测试用户")
            page.click('button:has-text("进入工作台")')
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(500)
            products_title_visible = page.locator(".card-title", has_text="产品列表").is_visible()
            login_input_count = page.locator("#login-user").count()
            browser.close()

        assert not errors, f"browser errors: {errors}"
        assert products_title_visible, "products page should render after login"
        assert login_input_count == 0, "login form should not remain after login"


if __name__ == "__main__":
    main()
