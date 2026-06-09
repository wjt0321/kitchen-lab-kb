"""Smoke check that the login screen renders on first load."""
from playwright.sync_api import sync_playwright

from helpers import run_server


def main():
    with run_server(8021) as base_url:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(f"{base_url}/login", wait_until="networkidle")
            login_input_count = page.locator("#login-user").count()
            login_shell_count = page.locator(".login-shell").count()
            login_card_count = page.locator(".login-card").count()
            login_title_count = page.locator(
                ".login-card .page-hero-title, .login-card h2"
            ).count()
            topbar_display = page.locator("#topbar").evaluate(
                "el => getComputedStyle(el).display"
            )
            browser.close()

        assert login_input_count == 1, "login input should render on first load"
        assert login_shell_count == 1, "login shell should render on first load"
        assert login_card_count == 1, "login card should render on first load"
        assert login_title_count == 1, "login title should render on first load"
        assert topbar_display == "none", "topbar should be hidden on login page"


if __name__ == "__main__":
    main()
