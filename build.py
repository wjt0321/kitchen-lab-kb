"""PyInstaller build script for kitchen-lab-kb Windows desktop app."""
import os
import shutil
import sys

import PyInstaller.__main__

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(ROOT, "dist")
BUILD_DIR = os.path.join(ROOT, "build")


def collect_data_args():
    """Build --add-data arguments for resources bundled into the exe."""
    items = [
        ("templates", "templates"),
        ("static", "static"),
        ("dependencies", "dependencies"),
        ("requirements.txt", "."),
        ("兴达logo.ico", "."),
        ("兴达logo.jpg", "."),
    ]
    args = []
    for src, dst in items:
        src_path = os.path.join(ROOT, src)
        if not os.path.exists(src_path):
            raise FileNotFoundError(f"Required resource not found: {src_path}")
        args.extend(["--add-data", f"{src_path}{os.pathsep}{dst}"])
    return args


def main():
    # Clean previous build outputs
    for directory in (DIST_DIR, BUILD_DIR):
        if os.path.exists(directory):
            shutil.rmtree(directory)
            print(f"Cleaned {directory}")

    args = [
        os.path.join(ROOT, "startup.py"),
        "--name", "kitchen-lab-kb",
        "--onefile",
        "--windowed",
        "--icon", os.path.join(ROOT, "兴达logo.ico"),
        "--distpath", DIST_DIR,
        "--workpath", BUILD_DIR,
        "--specpath", ROOT,
        "--clean",
    ]

    args.extend(collect_data_args())

    # Hidden imports for dynamically loaded modules
    hidden_imports = [
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "fastapi",
        "pydantic",
        "pydantic_core",
        "openpyxl",
        "webview",
        "clr_loader",
        "cffi",
        "pycparser",
        "proxy_tools",
        "bottle",
        "typing_extensions",
        "typing_inspection",
        "annotated_types",
        "annotated_doc",
        "idna",
        "anyio",
        "starlette",
        "click",
        "h11",
        "httptools",
        "python_dotenv",
        "pyyaml",
        "watchfiles",
        "websockets",
        "colorama",
        "et_xmlfile",
        "pythonnet",
    ]
    for mod in hidden_imports:
        args.extend(["--hidden-import", mod])

    print("Running PyInstaller with args:")
    for arg in args:
        print(f"  {arg}")

    PyInstaller.__main__.run(args)
    print(f"\nBuild complete. Output: {os.path.join(DIST_DIR, 'kitchen-lab-kb.exe')}")


if __name__ == "__main__":
    main()
