"""Path resolution helpers for both development and PyInstaller bundles."""
import os
import sys


def is_frozen() -> bool:
    """Return True when running inside a PyInstaller-built executable."""
    return getattr(sys, "frozen", False)


def get_root_dir() -> str:
    """
    Directory that holds user data and runtime-writable folders.

    - Development: project root (directory containing this file).
    - PyInstaller bundle: directory containing the .exe.
    """
    if is_frozen():
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def get_resource_dir() -> str:
    """
    Directory that holds bundled read-only resources.

    - Development: project root.
    - PyInstaller bundle: the temporary extraction folder (sys._MEIPASS).
    """
    if is_frozen():
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))
