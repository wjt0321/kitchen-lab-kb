"""Excel / JSON export utilities."""
import os
import json
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill

from db import db_query

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "exports")


def _ensure_dir():
    os.makedirs(EXPORT_DIR, exist_ok=True)


def _now_str() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _set_header(ws, headers):
    thin = Side(style="thin", color="D8DEE4")
    header_fill = PatternFill(start_color="F6F8FA", end_color="F6F8FA", fill_type="solid")
    for col, val in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=val)
        cell.font = Font(bold=True)
        cell.fill = header_fill
        cell.border = Border(bottom=thin)
        cell.alignment = Alignment(horizontal="left", vertical="center")


def export_excel(export_type: str) -> str:
    _ensure_dir()
    wb = Workbook()
    ws = wb.active
    now = _now_str()

    if export_type == "products":
        ws.title = "产品列表"
        _set_header(ws, ["品号", "规格", "品名", "当前数量", "状态", "创建时间"])
        rows = db_query("SELECT 品号, 规格, 品名, 当前数量, 状态, created_at FROM products ORDER BY created_at DESC")
        for ridx, row in enumerate(rows, 2):
            for cidx, key in enumerate(["品号", "规格", "品名", "当前数量", "状态", "created_at"], 1):
                ws.cell(row=ridx, column=cidx, value=row[key])
        filename = f"products_{now}.xlsx"

    elif export_type == "recipes":
        ws.title = "配方记录"
        _set_header(ws, ["产品品号", "产品品名", "试验日期", "配方名称", "状态", "用了多少", "备注", "创建时间"])
        rows = db_query("""
            SELECT p.品号, p.品名, r.试验日期, r.配方名称, r.状态, r.用了多少, r.备注, r.created_at
            FROM recipes r
            JOIN products p ON r.产品id = p.id
            ORDER BY r.试验日期 DESC
        """)
        for ridx, row in enumerate(rows, 2):
            for cidx, key in enumerate(["品号", "品名", "试验日期", "配方名称", "状态", "用了多少", "备注", "created_at"], 1):
                ws.cell(row=ridx, column=cidx, value=row[key])
        filename = f"recipes_{now}.xlsx"

    elif export_type == "success_rate":
        ws.title = "成功率汇总"
        _set_header(ws, ["产品品号", "产品品名", "配方hash", "试验次数", "成功次数", "成功率"])
        rows = db_query("""
            SELECT v.*, p.品号, p.品名
            FROM v_recipe_success_rate v
            JOIN products p ON v.产品id = p.id
            ORDER BY v.成功率 DESC, v.试验次数 DESC
        """)
        for ridx, row in enumerate(rows, 2):
            for cidx, key in enumerate(["品号", "品名", "配方hash", "试验次数", "成功次数", "成功率"], 1):
                ws.cell(row=ridx, column=cidx, value=row[key])
        filename = f"success_rate_{now}.xlsx"
    else:
        raise ValueError(f"Unknown export type: {export_type}")

    path = os.path.join(EXPORT_DIR, filename)
    wb.save(path)
    return path


def export_json() -> str:
    _ensure_dir()
    now = _now_str()
    data = {
        "exported_at": datetime.now().isoformat(),
        "products": [dict(r) for r in db_query("SELECT * FROM products ORDER BY id")],
        "recipes": [dict(r) for r in db_query("SELECT * FROM recipes ORDER BY id")],
        "materials": [dict(r) for r in db_query("SELECT * FROM recipe_materials ORDER BY id")],
    }
    filename = f"export_{now}.json"
    path = os.path.join(EXPORT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path
