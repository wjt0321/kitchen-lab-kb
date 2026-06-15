"""Checks that the frontend no longer depends on a remote icon webfont."""
import os
import re

from playwright.sync_api import sync_playwright

from helpers import run_server


ROOT = os.path.dirname(os.path.dirname(__file__))


def extract_js_method_block(js, method_name, next_method_name):
    start_marker = f"  {method_name}"
    end_marker = f"\n  {next_method_name}"
    start = js.find(start_marker)
    assert start != -1, f"missing {method_name} block"
    end = js.find(end_marker, start)
    assert end != -1, f"missing {method_name} end boundary"
    return js[start:end]


def check_static_contract():
    with open(os.path.join(ROOT, "templates", "base.html"), encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(ROOT, "static", "app.js"), encoding="utf-8") as f:
        js = f.read()

    assert "@tabler/icons-webfont" not in html, "base shell should not depend on remote icon webfont"
    assert "renderIcon(name, className = '')" in js, "frontend should expose a direct renderIcon helper"
    assert "renderLocalIcons(root = document)" in js, "frontend should keep a local icon hydration helper"
    assert "iconSvg(name" in js, "frontend should keep icon SVGs in the local bundle"
    assert "sidebar-brand-logo" in js, "brand area should render a local ico logo"
    assert "brand-fallback" in js, "brand area should keep a text fallback"
    assert "/兴达logo.ico" in js or "/兴达logo.ico" in html, "brand area should point to the local ico asset"
    render_products_body = extract_js_method_block(js, "async renderProducts(el, params)", "toggleProductSelection(")
    assert "renderIcon('refresh'" in render_products_body, "products hero reset should use renderIcon"
    assert "renderIcon('plus'" in render_products_body, "products create action should use renderIcon"
    assert "renderIcon('file-import'" in render_products_body, "products import action should use renderIcon"
    assert "renderIcon('archive'" in render_products_body, "products batch archive action should use renderIcon"
    assert "renderIcon('file-export'" in render_products_body, "products export action should use renderIcon"
    assert "renderIcon('chevron-left'" in render_products_body, "products pager previous should use renderIcon"
    assert "renderIcon('chevron-right'" in render_products_body, "products pager next should use renderIcon"
    assert '<i class="ti ti-' not in render_products_body, "products high-frequency UI should not keep legacy .ti icons"


def check_login_page_icons(base_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{base_url}/login", wait_until="networkidle")

        assert page.locator("link[href*='icons-webfont']").count() == 0
        assert page.locator(".login-form .app-icon svg").count() >= 1
        assert page.locator(".login-form button .app-icon svg").count() == 1

        browser.close()


def check_workspace_high_frequency_icons(base_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{base_url}/login", wait_until="networkidle")
        page.locator("#login-user").fill("planner")
        page.get_by_role("button", name="进入工作台").click()
        page.wait_for_url(re.compile(r".+#/products$"))
        page.wait_for_load_state("networkidle")

        assert page.locator(".sidebar-brand-logo").count() == 1
        assert page.locator(".sidebar-brand .brand-fallback").count() == 1
        assert page.locator(".sidebar-nav .app-icon svg").count() >= 1
        assert page.locator(".topbar-actions .app-icon svg").count() >= 3
        assert page.locator(".products-hero-actions .app-icon svg").count() >= 1
        assert page.locator(".action-bar .app-icon svg").count() >= 3
        assert page.locator(".sidebar-nav .ti").count() == 0
        assert page.locator(".topbar-actions .ti").count() == 0
        assert page.locator(".products-hero-actions .ti").count() == 0
        assert page.locator(".action-bar .ti").count() == 0

        browser.close()


def main():
    check_static_contract()
    with run_server(8024) as base_url:
        check_login_page_icons(base_url)
        check_workspace_high_frequency_icons(base_url)


if __name__ == "__main__":
    main()
