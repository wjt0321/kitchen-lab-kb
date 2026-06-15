"""Smoke check that product detail uses workspace hero and in-app inventory modal."""
import time

from playwright.sync_api import sync_playwright

from helpers import post_json, run_server


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


def main():
    with run_server(8024) as base_url:
        code = f"MODAL-{int(time.time() * 1000)}"
        product = post_json(
            base_url,
            "/api/products",
            {"品号": code, "品名": "库存弹层产品", "规格": "100g", "当前数量": 5},
        )
        product_id = product["data"]["id"]
        storage_state = build_storage_state(base_url, "tester")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(storage_state=storage_state)
            page = context.new_page()
            console_messages = []
            page.on("console", lambda msg: console_messages.append((msg.type, msg.text)))
            page.goto(f"{base_url}/#/products/{product_id}", wait_until="networkidle")

            page.locator(".detail-workspace").first.wait_for()
            assert page.locator(".page-hero-title").first.text_content().strip() == f"{code} 库存弹层产品"
            assert page.locator(".detail-workspace").count() == 1
            assert page.locator(".detail-primary").count() == 1
            assert page.locator(".detail-secondary").count() == 1
            assert page.get_by_role("button", name="调整库存").count() >= 1

            page.get_by_role("button", name="调整库存").first.click()
            assert page.locator(".inventory-modal").count() == 1
            assert page.locator("#inventory-delta").count() == 1
            assert page.locator("#inventory-reason").count() == 1
            page.locator("#modal-confirm").click()
            assert (
                page.locator("#inventory-error").text_content().strip()
                == "库存变动数量必须是非零数字"
            )
            assert not [msg for msg in console_messages if msg[0] == "warning"]

            page.locator("#inventory-delta").fill("-2")
            page.locator("#inventory-reason").fill("试验消耗")
            with page.expect_response(
                lambda response: response.request.method == "POST"
                and response.url.endswith(f"/api/products/{product_id}/inventory-adjust")
                and response.status == 200
            ):
                page.locator("#modal-confirm").click()
            page.locator(".inventory-modal").wait_for(state="hidden")
            page.locator(".page-hero-subtitle").filter(has_text="当前数量 3").first.wait_for()
            assert page.locator("text=试验消耗").count() >= 1

            context.close()
            browser.close()


if __name__ == "__main__":
    main()
