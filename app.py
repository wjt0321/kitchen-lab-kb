"""FastAPI application — APIs + page routes."""
import os
import json
import shutil
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from string import Template

from db import (
    init_db, get_db, db_query, db_query_one, db_execute,
    recipe_hash, get_recipe_materials, insert_materials,
)
from auth import login_user, logout_user, get_current_user
from backup import do_backup
from export import export_excel, export_json

app = FastAPI(title="样品库知识库")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure DB is ready
init_db()

# ---------------------------------------------------------------------------
# Template helpers
# ---------------------------------------------------------------------------
TPL_DIR = os.path.join(os.path.dirname(__file__), "templates")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


def render(name: str, **kwargs) -> str:
    path = os.path.join(TPL_DIR, name)
    if not os.path.exists(path):
        return f"<!-- missing template: {name} -->"
    with open(path, "r", encoding="utf-8") as f:
        tpl = Template(f.read())
    return tpl.safe_substitute(**kwargs)


# ---------------------------------------------------------------------------
# Unified response helper
# ---------------------------------------------------------------------------

def ok(data=None):
    return {"ok": True, "data": data, "error": None}


def fail(error: str, status_code: int = 400):
    return JSONResponse(status_code=status_code, content={"ok": False, "data": None, "error": error})


# ---------------------------------------------------------------------------
# Auth APIs
# ---------------------------------------------------------------------------

@app.post("/api/login")
async def api_login(request: Request):
    body = await request.json()
    username = body.get("用户名", "").strip()
    if not username:
        return fail("用户名不能为空")
    login_user(username)
    return ok({"用户名": username})


@app.post("/api/logout")
async def api_logout(request: Request):
    username = get_current_user(request)
    if username:
        logout_user(username)
    return ok()


@app.get("/api/me")
async def api_me(request: Request):
    user = get_current_user(request)
    return ok({"用户名": user})


# ---------------------------------------------------------------------------
# Product APIs
# ---------------------------------------------------------------------------

@app.get("/api/products")
async def api_products(
    q: str = "",
    status: str = "active",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
):
    offset = (page - 1) * page_size
    params: List = []
    where_parts = ["1=1"]

    if status and status != "全部":
        where_parts.append("状态 = ?")
        params.append(status)

    if q:
        where_parts.append("(品号 LIKE ? OR 品名 LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])

    where_sql = " AND ".join(where_parts)

    count_row = db_query_one(f"SELECT COUNT(*) AS cnt FROM products WHERE {where_sql}", tuple(params))
    total = count_row["cnt"] if count_row else 0

    rows = db_query(
        f"""
        SELECT p.*,
               (SELECT COUNT(*) FROM recipes WHERE 产品id = p.id) AS 配方数
        FROM products p
        WHERE {where_sql}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
        """,
        tuple(params + [page_size, offset]),
    )

    return ok({
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    })


@app.post("/api/products")
async def api_product_create(request: Request):
    body = await request.json()
    品号 = body.get("品号", "").strip()
    规格 = body.get("规格", "").strip()
    品名 = body.get("品名", "").strip()
    当前数量 = body.get("当前数量", 0)
    备注 = body.get("备注", "")
    user = get_current_user(request) or ""

    if not 品号 or not 规格 or not 品名:
        return fail("品号、规格、品名为必填项")

    # duplicate check
    dup = db_query_one("SELECT id FROM products WHERE 品号 = ?", (品号,))
    if dup:
        return fail(f"品号 {品号} 已存在")

    conn = get_db()
    cur = conn.execute(
        """
        INSERT INTO products (品号, 规格, 品名, 当前数量, 备注, created_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
        (品号, 规格, 品名, 当前数量, 备注, user),
    )
    new_id = cur.lastrowid
    conn.commit()
    conn.close()
    return ok({"id": new_id, "品号": 品号})


@app.get("/api/products/{product_id}")
async def api_product_detail(product_id: int):
    row = db_query_one("SELECT * FROM products WHERE id = ?", (product_id,))
    if not row:
        return fail("产品不存在", 404)
    return ok(dict(row))


@app.put("/api/products/{product_id}")
async def api_product_update(product_id: int, request: Request):
    body = await request.json()
    品号 = body.get("品号", "").strip()
    规格 = body.get("规格", "").strip()
    品名 = body.get("品名", "").strip()
    当前数量 = body.get("当前数量", 0)
    备注 = body.get("备注", "")

    if not 品号 or not 规格 or not 品名:
        return fail("品号、规格、品名为必填项")

    dup = db_query_one("SELECT id FROM products WHERE 品号 = ? AND id != ?", (品号, product_id))
    if dup:
        return fail(f"品号 {品号} 已存在")

    conn = get_db()
    conn.execute(
        """
        UPDATE products
        SET 品号=?, 规格=?, 品名=?, 当前数量=?, 备注=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
        """,
        (品号, 规格, 品名, 当前数量, 备注, product_id),
    )
    conn.commit()
    conn.close()
    return ok({"id": product_id})


@app.post("/api/products/{product_id}/archive")
async def api_product_archive(product_id: int):
    conn = get_db()
    cur = conn.execute("UPDATE products SET 状态='archived', updated_at=CURRENT_TIMESTAMP WHERE id=?", (product_id,))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        return fail("产品不存在", 404)
    return ok()


@app.post("/api/products/{product_id}/restore")
async def api_product_restore(product_id: int):
    conn = get_db()
    cur = conn.execute("UPDATE products SET 状态='active', updated_at=CURRENT_TIMESTAMP WHERE id=?", (product_id,))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        return fail("产品不存在", 404)
    return ok()


@app.delete("/api/products/{product_id}")
async def api_product_delete(product_id: int):
    row = db_query_one("SELECT 状态 FROM products WHERE id = ?", (product_id,))
    if not row:
        return fail("产品不存在", 404)
    if row["状态"] != "archived":
        return fail("只能删除已归档产品")

    conn = get_db()
    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return ok()


# ---------------------------------------------------------------------------
# Recipe APIs
# ---------------------------------------------------------------------------

@app.get("/api/recipes")
async def api_recipes(
    product_id: Optional[int] = None,
    status: str = "",
    date_from: str = "",
    date_to: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
):
    offset = (page - 1) * page_size
    params: List = []
    where_parts = ["1=1"]

    if product_id:
        where_parts.append("r.产品id = ?")
        params.append(product_id)
    if status:
        where_parts.append("r.状态 = ?")
        params.append(status)
    if date_from:
        where_parts.append("r.试验日期 >= ?")
        params.append(date_from)
    if date_to:
        where_parts.append("r.试验日期 <= ?")
        params.append(date_to)

    where_sql = " AND ".join(where_parts)

    count_row = db_query_one(
        f"SELECT COUNT(*) AS cnt FROM recipes r WHERE {where_sql}", tuple(params)
    )
    total = count_row["cnt"] if count_row else 0

    rows = db_query(
        f"""
        SELECT r.*, p.品号, p.品名
        FROM recipes r
        JOIN products p ON r.产品id = p.id
        WHERE {where_sql}
        ORDER BY r.试验日期 DESC, r.id DESC
        LIMIT ? OFFSET ?
        """,
        tuple(params + [page_size, offset]),
    )

    return ok({
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    })


@app.post("/api/recipes")
async def api_recipe_create(request: Request):
    body = await request.json()
    产品id = body.get("产品id")
    试验日期 = body.get("试验日期", "")
    配方名称 = body.get("配方名称", "")
    状态 = body.get("状态", "pending")
    用了多少 = body.get("用了多少", 0)
    备注 = body.get("备注", "")
    materials = body.get("原料辅料", [])
    user = get_current_user(request) or ""

    if not 产品id or not 试验日期:
        return fail("产品和试验日期为必填项")

    # validate materials
    cleaned = _clean_materials(materials)
    if isinstance(cleaned, str):
        return fail(cleaned)

    # get 品号 for hash
    prod = db_query_one("SELECT 品号 FROM products WHERE id = ?", (产品id,))
    if not prod:
        return fail("产品不存在")

    h = recipe_hash(prod["品号"], cleaned)

    conn = get_db()
    cur = conn.execute(
        """
        INSERT INTO recipes (产品id, 试验日期, 配方名称, 配方hash, 状态, 用了多少, 备注, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (产品id, 试验日期, 配方名称, h, 状态, 用了多少, 备注, user),
    )
    recipe_id = cur.lastrowid
    insert_materials(conn, recipe_id, cleaned)
    conn.commit()
    conn.close()
    return ok({"id": recipe_id})


@app.get("/api/recipes/{recipe_id}")
async def api_recipe_detail(recipe_id: int):
    row = db_query_one(
        """
        SELECT r.*, p.品号, p.品名
        FROM recipes r
        JOIN products p ON r.产品id = p.id
        WHERE r.id = ?
        """,
        (recipe_id,),
    )
    if not row:
        return fail("配方记录不存在", 404)
    data = dict(row)
    data["原料辅料"] = get_recipe_materials(recipe_id)
    return ok(data)


@app.put("/api/recipes/{recipe_id}")
async def api_recipe_update(recipe_id: int, request: Request):
    body = await request.json()
    产品id = body.get("产品id")
    试验日期 = body.get("试验日期", "")
    配方名称 = body.get("配方名称", "")
    状态 = body.get("状态", "pending")
    用了多少 = body.get("用了多少", 0)
    备注 = body.get("备注", "")
    materials = body.get("原料辅料", [])

    if not 产品id or not 试验日期:
        return fail("产品和试验日期为必填项")

    cleaned = _clean_materials(materials)
    if isinstance(cleaned, str):
        return fail(cleaned)

    prod = db_query_one("SELECT 品号 FROM products WHERE id = ?", (产品id,))
    if not prod:
        return fail("产品不存在")

    h = recipe_hash(prod["品号"], cleaned)

    conn = get_db()
    conn.execute(
        """
        UPDATE recipes
        SET 产品id=?, 试验日期=?, 配方名称=?, 配方hash=?, 状态=?, 用了多少=?, 备注=?
        WHERE id=?
        """,
        (产品id, 试验日期, 配方名称, h, 状态, 用了多少, 备注, recipe_id),
    )
    conn.execute("DELETE FROM recipe_materials WHERE 配方id = ?", (recipe_id,))
    insert_materials(conn, recipe_id, cleaned)
    conn.commit()
    conn.close()
    return ok({"id": recipe_id})


@app.delete("/api/recipes/{recipe_id}")
async def api_recipe_delete(recipe_id: int):
    conn = get_db()
    conn.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
    conn.commit()
    conn.close()
    return ok()


def _clean_materials(materials: List[dict]):
    """Return cleaned list or error string."""
    cleaned = []
    for idx, m in enumerate(materials):
        名称 = str(m.get("名称", "")).strip()
        用量_raw = m.get("用量", "")
        类型 = m.get("类型", "").strip()
        单位 = str(m.get("单位", "")).strip()

        if not 名称 and not 用量_raw and not 类型:
            continue  # skip fully empty rows

        if not 类型 or 类型 not in ("原料", "辅料"):
            return f"第 {idx+1} 行类型错误"
        if not 名称:
            return f"第 {idx+1} 行缺少名称"
        try:
            用量 = float(用量_raw)
        except (TypeError, ValueError):
            return f"第 {idx+1} 行用量不是有效数字"

        cleaned.append({"类型": 类型, "名称": 名称, "用量": 用量, "单位": 单位})

    if not cleaned:
        return "至少需要填写一行原料或辅料"
    return cleaned


# ---------------------------------------------------------------------------
# Success rate APIs
# ---------------------------------------------------------------------------

@app.get("/api/products/{product_id}/success-rate")
async def api_product_success_rate(product_id: int):
    rows = db_query(
        """
        SELECT 配方hash, 试验次数, 成功次数, 成功率
        FROM v_recipe_success_rate
        WHERE 产品id = ?
        ORDER BY 成功率 DESC, 试验次数 DESC
        """,
        (product_id,),
    )
    return ok([dict(r) for r in rows])


@app.get("/api/success-rate")
async def api_global_success_rate(
    product_id: Optional[int] = None,
):
    params: List = []
    where_parts = ["1=1"]
    if product_id:
        where_parts.append("v.产品id = ?")
        params.append(product_id)

    where_sql = " AND ".join(where_parts)
    rows = db_query(
        f"""
        SELECT v.*, p.品号, p.品名
        FROM v_recipe_success_rate v
        JOIN products p ON v.产品id = p.id
        WHERE {where_sql}
        ORDER BY v.成功率 DESC, v.试验次数 DESC
        """,
        tuple(params),
    )
    return ok([dict(r) for r in rows])


# ---------------------------------------------------------------------------
# Backup / Export APIs
# ---------------------------------------------------------------------------

@app.post("/api/backup")
async def api_backup():
    try:
        path = do_backup()
        return ok({"filename": os.path.basename(path), "path": path})
    except Exception as e:
        return fail(f"备份失败: {e}")


@app.get("/api/export/excel")
async def api_export_excel(type: str = "products"):
    try:
        path = export_excel(type)
        return FileResponse(path, filename=os.path.basename(path))
    except Exception as e:
        return fail(f"导出失败: {e}")


@app.get("/api/export/json")
async def api_export_json():
    try:
        path = export_json()
        return FileResponse(path, filename=os.path.basename(path))
    except Exception as e:
        return fail(f"导出失败: {e}")


# ---------------------------------------------------------------------------
# Page routes (SPA — all return base.html)
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def page_index():
    return render("base.html")


@app.get("/login", response_class=HTMLResponse)
async def page_login():
    return render("base.html")


@app.get("/products", response_class=HTMLResponse)
async def page_products():
    return render("base.html")


@app.get("/products/new", response_class=HTMLResponse)
async def page_product_new():
    return render("base.html")


@app.get("/products/{product_id}", response_class=HTMLResponse)
async def page_product_detail(product_id: int):
    return render("base.html")


@app.get("/products/{product_id}/edit", response_class=HTMLResponse)
async def page_product_edit(product_id: int):
    return render("base.html")


@app.get("/recipes/new", response_class=HTMLResponse)
async def page_recipe_new():
    return render("base.html")


@app.get("/recipes/{recipe_id}", response_class=HTMLResponse)
async def page_recipe_detail(recipe_id: int):
    return render("base.html")


@app.get("/recipes/{recipe_id}/edit", response_class=HTMLResponse)
async def page_recipe_edit(recipe_id: int):
    return render("base.html")


@app.get("/success-rate", response_class=HTMLResponse)
async def page_success_rate():
    return render("base.html")


# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------

def _mime_type(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    return {
        ".css": "text/css",
        ".js": "application/javascript",
        ".html": "text/html",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
    }.get(ext, "application/octet-stream")


@app.get("/static/{path:path}")
async def static_files(path: str):
    static_root = os.path.abspath(STATIC_DIR)
    file_path = os.path.abspath(os.path.join(STATIC_DIR, path))
    if file_path != static_root and not file_path.startswith(static_root + os.sep):
        return fail("Not found", 404)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        with open(file_path, "rb") as f:
            content = f.read()
        return Response(content=content, media_type=_mime_type(path))
    return fail("Not found", 404)
