import re
from pathlib import Path

"""Smoke check that the desktop workspace shell renders for logged-in users."""
from playwright.sync_api import sync_playwright

from helpers import run_server


def assert_shell_style_contract():
    css = Path(__file__).resolve().parents[1].joinpath("static", "style.css").read_text(
        encoding="utf-8"
    )
    assert ".workspace-main .card" in css
    assert ".workspace-main .table-wrap" in css
    assert ".workspace-main .modal" in css
    assert ".workspace-topbar .current-user" in css
    assert not re.search(
        r"\.workspace-sidebar,\s*\.workspace-topbar,\s*\.page-hero,\s*\.card,\s*\.table-wrap,\s*\.modal,\s*\.login-card",
        css,
        re.S,
    )
    assert re.search(
        r"@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{[\s\S]*--shell-bg:[\s\S]*--panel-bg:[\s\S]*--panel-border:",
        css,
    )


def assert_workspace_shell(page):
    page.locator(".page-hero").first.wait_for()
    assert page.locator(".workspace-shell").count() == 1
    assert page.locator(".workspace-sidebar").count() == 1
    assert page.locator(".workspace-main").count() == 1
    assert page.locator(".page-hero").count() >= 1
    assert page.locator(".page-hero-title").count() >= 1
    assert page.locator(".products-hero-search #prod-q").count() == 1
    assert page.locator(".products-hero-actions .btn-primary").count() == 1
    assert page.locator(".products-panel .table-wrap").count() == 1
    assert page.locator(".system-actions").count() == 1


def main():
    assert_shell_style_contract()

    with run_server(8023) as base_url:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()
            page.goto(f"{base_url}/login", wait_until="networkidle")
            page.locator("#login-user").fill("planner")
            page.get_by_role("button", name="进入工作台").click()
            page.wait_for_url(re.compile(r".+#/products$"))
            page.wait_for_load_state("networkidle")
            assert_workspace_shell(page)

            cold_start_page = context.new_page()
            cold_start_page.goto(base_url, wait_until="networkidle")
            cold_start_page.wait_for_load_state("networkidle")
            assert_workspace_shell(cold_start_page)
            cold_start_page.close()

            relogin_page = context.new_page()
            relogin_page.goto(f"{base_url}/login", wait_until="networkidle")
            relogin_page.wait_for_url(re.compile(r".+#/products$"))
            relogin_page.wait_for_load_state("networkidle")
            assert_workspace_shell(relogin_page)
            relogin_page.close()

            context.close()
            browser.close()


if __name__ == "__main__":
    main()
