"""Smoke check that archived products can be deleted from the UI."""
import time

from playwright.sync_api import sync_playwright

from helpers import run_server


def main():
    product_code = f"DEL{int(time.time())}"
    with run_server(8027) as base_url:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(f"{base_url}/login", wait_until="networkidle")
            page.fill("#login-user", "测试用户")
            page.click('button:has-text("登录")')
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(300)

            page.click('button:has-text("新建产品")')
            page.fill("#pf-品号", product_code)
            page.fill("#pf-品名", "待删除归档产品")
            page.fill("#pf-规格", "100g")
            page.fill("#pf-当前数量", "1")
            page.click("#pf-save")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(500)

            page.click('button:has-text("归档")')
            page.click("#modal-confirm")
            page.wait_for_timeout(500)
            page.goto(f"{base_url}/login#/products?status=archived", wait_until="networkidle")
            page.click(f'a:has-text("{product_code}")')
            page.wait_for_timeout(500)

            assert page.locator('button:has-text("删除")').is_visible(), (
                "archived product detail should show a delete button"
            )
            page.click('button:has-text("删除")')
            page.click("#modal-confirm")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(800)

            page.goto(f"{base_url}/login#/products?status=全部", wait_until="networkidle")
            page.wait_for_timeout(500)
            assert page.locator(f"text={product_code}").count() == 0, (
                "deleted archived product should not remain in products list"
            )
            browser.close()


if __name__ == "__main__":
    main()
