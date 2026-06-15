import re

"""Smoke check that the desktop workspace shell renders for logged-in users."""
from playwright.sync_api import sync_playwright

from helpers import run_server


def assert_workspace_shell(page):
    page.locator(".page-hero").first.wait_for()
    sidebar_box = page.locator(".workspace-sidebar").bounding_box()
    viewport_height = page.evaluate("window.innerHeight")
    scroll_before = page.evaluate(
        """() => {
            const tabs = document.getElementById('workbench-tabs').getBoundingClientRect();
            const stack = document.querySelector('.products-fixed-stack').getBoundingClientRect();
            const hero = document.querySelector('.page-hero').getBoundingClientRect();
            const bar = document.querySelector('.action-bar').getBoundingClientRect();
            return { tabsY: tabs.y, tabsBottom: tabs.bottom, stackY: stack.y, heroY: hero.y, barY: bar.y };
        }"""
    )
    assert page.locator(".workspace-shell").count() == 1
    assert page.locator(".workspace-sidebar").count() == 1
    assert page.locator(".workspace-main").count() == 1
    assert page.locator(".workspace-topbar").count() == 1
    assert page.locator(".statusbar").count() == 1
    assert page.locator(".login-shell").count() == 0
    assert page.locator(".page-hero").count() >= 1
    assert page.locator(".page-hero-title").count() >= 1
    assert page.locator(".products-hero-search #prod-q").count() == 1
    assert page.locator(".products-panel .table-wrap").count() == 1
    assert page.locator(".table-scrollbar").count() == 1
    assert page.locator(".system-actions").count() == 1
    assert page.locator(".current-user").count() == 1
    assert page.locator(".sidebar-nav a.active").count() == 1
    assert page.locator(".sidebar-nav a.active").first.text_content().strip() == "产品"
    assert page.locator(".current-user").first.text_content().strip() == "planner"
    assert page.locator(".sidebar-group-title", has_text="工具").count() == 0
    assert page.locator(".sidebar-subnav a.active", has_text="按产品查看").count() == 1
    assert sidebar_box is not None
    assert abs((sidebar_box["y"] + sidebar_box["height"]) - viewport_height) < 4, "sidebar should reach the viewport bottom"
    page.evaluate(
        """() => {
            const workbench = document.getElementById('workbench');
            workbench.scrollTo({ top: 600, behavior: 'instant' });
        }"""
    )
    page.wait_for_timeout(80)
    scroll_after = page.evaluate(
        """() => {
            const tabs = document.getElementById('workbench-tabs').getBoundingClientRect();
            const stack = document.querySelector('.products-fixed-stack').getBoundingClientRect();
            const hero = document.querySelector('.page-hero').getBoundingClientRect();
            const bar = document.querySelector('.action-bar').getBoundingClientRect();
            return { tabsY: tabs.y, tabsBottom: tabs.bottom, stackY: stack.y, heroY: hero.y, barY: bar.y };
        }"""
    )
    assert scroll_after["tabsY"] < scroll_before["tabsY"] - 20, "tabs should scroll away with the product list"
    assert scroll_after["stackY"] < scroll_before["stackY"] - 20, "product controls should scroll with the content"
    assert scroll_after["heroY"] < scroll_before["heroY"] - 20, "hero should scroll with the product list"
    assert scroll_after["barY"] < scroll_before["barY"] - 20, "action bar should scroll with the product list"
    scroll_sync = page.evaluate(
        """() => {
            const scrollbar = document.querySelector('.table-scrollbar');
            const wrap = document.querySelector('.table-wrap');
            scrollbar.scrollLeft = 120;
            scrollbar.dispatchEvent(new Event('scroll', { bubbles: true }));
            return { barLeft: scrollbar.scrollLeft, wrapLeft: wrap.scrollLeft };
        }"""
    )
    assert scroll_sync["barLeft"] > 0, "sticky horizontal scrollbar should be scrollable"
    assert abs(scroll_sync["wrapLeft"] - scroll_sync["barLeft"]) < 2, "sticky scrollbar should stay in sync with table body"
    if page.locator(".pagination-bar").count() == 1:
        assert page.locator(".pagination-prev").count() == 1
        assert page.locator(".pagination-next").count() == 1
    assert page.locator(".sidebar-drawer-toggle").count() == 1


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


def assert_mobile_drawer(browser, base_url, storage_state):
    context = browser.new_context(
        storage_state=storage_state,
        viewport={"width": 820, "height": 900},
    )
    page = context.new_page()
    page.goto(base_url, wait_until="networkidle")
    page.wait_for_load_state("networkidle")
    assert page.locator("#sidebar").evaluate(
        "el => getComputedStyle(el).transform !== 'none'"
    ), "mobile sidebar should start off-canvas"
    page.get_by_role("button", name="菜单").click()
    page.locator("#sidebar.sidebar-open").wait_for()
    assert page.locator("#sidebar-backdrop.hide").count() == 0
    page.locator("#sidebar-backdrop").click()
    page.wait_for_function(
        "() => !document.getElementById('sidebar').classList.contains('sidebar-open')"
    )
    context.close()


def main():
    with run_server(8023) as base_url:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            storage_state = login_and_capture_state(browser, base_url)
            assert_cold_start_with_saved_login(browser, base_url, storage_state)
            assert_login_redirect_with_saved_login(browser, base_url, storage_state)
            assert_mobile_drawer(browser, base_url, storage_state)
            browser.close()


if __name__ == "__main__":
    main()
