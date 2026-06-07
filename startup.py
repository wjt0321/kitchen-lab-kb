"""PyWebView desktop wrapper with startup diagnostics."""
import ctypes
import logging
import os
import socket
import threading
import time
import webbrowser

import uvicorn

HOST = "127.0.0.1"
PORT = 7777
ROOT_DIR = os.path.dirname(__file__)
LOG_DIR = os.path.join(ROOT_DIR, "logs")
LOG_PATH = os.path.join(LOG_DIR, "startup.log")


def setup_logging():
    os.makedirs(LOG_DIR, exist_ok=True)
    logging.basicConfig(
        filename=LOG_PATH,
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        encoding="utf-8",
    )


def find_available_port(preferred_port=PORT):
    if _can_bind(preferred_port):
        return preferred_port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((HOST, 0))
        return sock.getsockname()[1]


def _can_bind(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind((HOST, port))
        except OSError:
            return False
    return True


def wait_for_server(port, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex((HOST, port)) == 0:
                return True
        time.sleep(0.1)
    return False


def run_server(port):
    try:
        uvicorn.run("app:app", host=HOST, port=port, log_level="warning", log_config=None)
    except Exception:
        logging.exception("FastAPI server failed")
        raise


def show_error(message):
    full_message = f"{message}\n\n日志: {LOG_PATH}"
    try:
        ctypes.windll.user32.MessageBoxW(None, full_message, "样品库知识库启动失败", 0x10)
    except Exception:
        print(full_message)


def open_window(url):
    try:
        import webview

        webview.create_window(
            "样品库知识库",
            url,
            width=1100,
            height=760,
            min_size=(900, 640),
            resizable=True,
        )
        webview.start()
        return
    except Exception:
        logging.exception("PyWebView failed; falling back to browser")

    webbrowser.open(url)
    while True:
        time.sleep(1)


if __name__ == "__main__":
    setup_logging()
    port = find_available_port()
    logging.info("Starting app on %s:%s", HOST, port)
    t = threading.Thread(target=run_server, args=(port,), daemon=True)
    t.start()

    if not wait_for_server(port):
        logging.error("Server did not start within the timeout")
        show_error("后台服务启动超时，可能是依赖缺失或程序异常。")
        raise SystemExit(1)

    open_window(f"http://{HOST}:{port}/login")
