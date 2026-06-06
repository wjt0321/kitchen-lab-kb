"""Smoke check that the login screen renders on first load."""
import socket
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright


HOST = "127.0.0.1"
PORT = 8021


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
            page.goto(f"http://{HOST}:{PORT}/login", wait_until="networkidle")
            login_input_count = page.locator("#login-user").count()
            topbar_display = page.locator("#topbar").evaluate(
                "el => getComputedStyle(el).display"
            )
            browser.close()

        assert login_input_count == 1, "login input should render on first load"
        assert topbar_display == "none", "topbar should be hidden on login page"
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    main()
