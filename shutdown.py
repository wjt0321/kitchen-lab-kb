"""Application shutdown helper."""
import os
import threading


def request_shutdown(delay_seconds: float = 0.6) -> None:
    """Stop the Python process after the HTTP response has time to flush."""
    timer = threading.Timer(delay_seconds, lambda: os._exit(0))
    timer.daemon = True
    timer.start()
