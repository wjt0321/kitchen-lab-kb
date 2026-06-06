"""Smoke check that a non-ASCII username can enter the products page."""
import socket
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright


HOST = "127.0.0.1"
PORT = 8024


def wait_for_port(timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex((HOST, PORT)) == 0:
                return
        time.sleep(0.1)
    raise RuntimeError("server did not start")


def main():
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app:app",
            "--host",
            HOST,
            "--port",
            str(PORT),
            "--log-level",
            "warning",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        wait_for_port()
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.goto(f"http://{HOST}:{PORT}/login", wait_until="networkidle")
            page.fill("#login-user", "测试用户")
            page.click('button:has-text("登录")')
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(500)
            products_title_visible = page.locator(".page-title", has_text="产品列表").is_visible()
            login_input_count = page.locator("#login-user").count()
            browser.close()

        assert not errors, f"browser errors: {errors}"
        assert products_title_visible, "products page should render after login"
        assert login_input_count == 0, "login form should not remain after login"
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    main()
