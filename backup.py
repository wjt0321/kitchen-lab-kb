"""One-click backup — zip the SQLite DB."""
import os
import zipfile
import glob
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "kitchen.db")
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "backups")
KEEP_COUNT = 10


def do_backup() -> str:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"数据库不存在: {DB_PATH}")
    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"kitchen_{now}.zip"
    filepath = os.path.join(BACKUP_DIR, filename)

    with zipfile.ZipFile(filepath, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(DB_PATH, arcname="kitchen.db")

    _cleanup_old_backups()
    return filepath


def _cleanup_old_backups() -> None:
    files = sorted(
        glob.glob(os.path.join(BACKUP_DIR, "kitchen_*.zip")),
        key=os.path.getmtime,
    )
    while len(files) > KEEP_COUNT:
        oldest = files.pop(0)
        try:
            os.remove(oldest)
        except OSError:
            pass
