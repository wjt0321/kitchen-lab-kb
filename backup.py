"""One-click backup — zip the SQLite DB."""
import glob
import os
import shutil
import zipfile
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "kitchen.db")
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "backups")
DATABASE_BACKUP_DIR = os.path.join(BACKUP_DIR, "database")
LEGACY_DIR_NAME = "_历史散文件"
KEEP_COUNT = 5
BACKUP_PATTERN = "kitchen_*.zip"


def do_backup() -> str:
    _ensure_dir()
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"数据库不存在: {DB_PATH}")
    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"kitchen_{now}.zip"
    filepath = os.path.join(DATABASE_BACKUP_DIR, filename)

    with zipfile.ZipFile(filepath, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(DB_PATH, arcname="kitchen.db")

    _cleanup_old_backups()
    return filepath


def _ensure_dir() -> None:
    os.makedirs(DATABASE_BACKUP_DIR, exist_ok=True)
    _move_legacy_flat_backups()


def _move_legacy_flat_backups() -> None:
    legacy_dir = os.path.join(BACKUP_DIR, LEGACY_DIR_NAME)
    for path in glob.glob(os.path.join(BACKUP_DIR, BACKUP_PATTERN)):
        if not os.path.isfile(path):
            continue
        os.makedirs(legacy_dir, exist_ok=True)
        target = os.path.join(legacy_dir, os.path.basename(path))
        if os.path.exists(target):
            base, ext = os.path.splitext(target)
            target = f"{base}_{datetime.now().strftime('%H%M%S')}{ext}"
        shutil.move(path, target)


def _backup_files() -> list[str]:
    files = []
    files.extend(glob.glob(os.path.join(DATABASE_BACKUP_DIR, BACKUP_PATTERN)))
    files.extend(glob.glob(os.path.join(BACKUP_DIR, LEGACY_DIR_NAME, BACKUP_PATTERN)))
    return sorted(files, key=os.path.getmtime)


def _cleanup_old_backups() -> None:
    files = _backup_files()
    while len(files) > KEEP_COUNT:
        oldest = files.pop(0)
        try:
            os.remove(oldest)
        except OSError:
            pass
