"""PyWebView desktop wrapper."""
import webview
import uvicorn
import threading
from app import app

HOST = "127.0.0.1"
PORT = 7777


def run_server():
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")


if __name__ == "__main__":
    t = threading.Thread(target=run_server, daemon=True)
    t.start()

    webview.create_window(
        "样品库知识库",
        f"http://{HOST}:{PORT}/login",
        width=1100,
        height=760,
        min_size=(900, 640),
        resizable=True,
    )
    webview.start()
