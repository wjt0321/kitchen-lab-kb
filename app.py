"""FastAPI application — APIs + page routes."""
import os
from datetime import date
from typing import List, Optional

from fastapi import FastAPI, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError, field_validator
from string import Template

from db import (
    init_db, get_db, db_query, db_query_one,
    recipe_hash, get_recipe_materials, insert_materials,
)
from auth import login_user, logout_user, get_current_user
from backup import do_backup
from export import export_excel, export_import_template, export_json
from import_data import import_base64
from shutdown import request_shutdown

app = FastAPI(title="样品库知识库")
SHUTDOWN_HANDLER = request_shutdown
LOCAL_ORIGINS = [
    "http://127.0.0.1:7777",
    "http://localhost:7777",
]
RECIPE_STATUSES = {"success", "failed", "pending"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_ORIGINS,
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


class ProductInput(BaseModel):
    品号: str = ""
    规格: str = ""
    品名: str = ""
    当前数量: int = Field(default=0, ge=0)
    备注: str = ""

    @field_validator("品号", "规格", "品名", "备注", mode="before")
    @classmethod
    def _strip_text(cls, value):
        return str(value or "").strip()

    @field_validator("品号", "规格", "品名")
    @classmethod
    def _required_text(cls, value):
        if not value:
            raise ValueError("必填")
        return value


class RecipeInput(BaseModel):
    产品id: Optional[int] = None
    试验日期: str = ""
    配方名称: str = ""
    状态: str = "pending"
    用了多少: float = Field(default=0, ge=0)
    备注: str = ""
    原料辅料: List[dict] = Field(default_factory=list)

    @field_validator("试验日期", "配方名称", "状态", "备注", mode="before")
    @classmethod
    def _strip_text(cls, value):
        return str(value or "").strip()

    @field_validator("状态")
    @classmethod
    def _valid_status(cls, value):
        if value not in RECIPE_STATUSES:
            raise ValueError("状态必须是 success、failed 或 pending")
        return value


def _product_input(body: dict):
    try:
        return ProductInput.model_validate(body)
    except ValidationError as exc:
        fields = {str(err["loc"][0]) for err in exc.errors() if err.get("loc")}
        if "当前数量" in fields:
            return "当前数量不能小于 0"
        return "品号、规格、品名为必填项"


def _recipe_input(body: dict):
    try:
        data = RecipeInput.model_validate(body)
    except ValidationError as exc:
        fields = {str(err["loc"][0]) for err in exc.errors() if err.get("loc")}
        if "状态" in fields:
            return "状态必须是 success、failed 或 pending"
        if "用了多少" in fields:
            return "用了多少不能小于 0"
        return "配方数据格式错误"
    if not data.产品id or not data.试验日期:
        return "产品和试验日期为必填项"
    return data


class InventoryAdjustmentInput(BaseModel):
    变动数量: float
    原因: str = ""

    @field_validator("变动数量")
    @classmethod
    def _non_zero_delta(cls, value):
        if value == 0:
            raise ValueError("变动数量不能为 0")
        return value

    @field_validator("原因", mode="before")
    @classmethod
    def _strip_reason(cls, value):
        return str(value or "").strip()


def _inventory_adjustment_input(body: dict):
    try:
        return InventoryAdjustmentInput.model_validate(body)
    except ValidationError:
        return "库存变动数量必须是非零数字"


def _record_inventory_movement(conn, product_id: int, before, after, reason: str, user: str) -> None:
    delta = float(after) - float(before)
    if delta == 0:
        return
    conn.execute(
        """
        INSERT INTO inventory_movements (产品id, 变动数量, 变动前, 变动后, 原因, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (product_id, delta, before, after, reason, user),
    )


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
    data = _product_input(body)
    if isinstance(data, str):
        return fail(data)
    user = get_current_user(request) or ""

    # duplicate check
    dup = db_query_one("SELECT id FROM products WHERE 品号 = ?", (data.品号,))
    if dup:
        return fail(f"品号 {data.品号} 已存在")

    conn = get_db()
    cur = conn.execute(
        """
        INSERT INTO products (品号, 规格, 品名, 当前数量, 备注, created_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
        (data.品号, data.规格, data.品名, data.当前数量, data.备注, user),
    )
    new_id = cur.lastrowid
    conn.commit()
    conn.close()
    return ok({"id": new_id, "品号": data.品号})


@app.get("/api/products/{product_id}")
async def api_product_detail(product_id: int):
    row = db_query_one("SELECT * FROM products WHERE id = ?", (product_id,))
    if not row:
        return fail("产品不存在", 404)
    return ok(dict(row))


@app.put("/api/products/{product_id}")
async def api_product_update(product_id: int, request: Request):
    body = await request.json()
    data = _product_input(body)
    if isinstance(data, str):
        return fail(data)

    dup = db_query_one("SELECT id FROM products WHERE 品号 = ? AND id != ?", (data.品号, product_id))
    if dup:
        return fail(f"品号 {data.品号} 已存在")
    existing = db_query_one("SELECT 当前数量 FROM products WHERE id = ?", (product_id,))
    if not existing:
        return fail("产品不存在", 404)

    user = get_current_user(request) or ""
    conn = get_db()
    cur = conn.execute(
        """
        UPDATE products
        SET 品号=?, 规格=?, 品名=?, 当前数量=?, 备注=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
        """,
        (data.品号, data.规格, data.品名, data.当前数量, data.备注, product_id),
    )
    _record_inventory_movement(
        conn,
        product_id,
        existing["当前数量"] or 0,
        data.当前数量,
        "手动修改库存",
        user,
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


@app.post("/api/products/{product_id}/inventory-adjust")
async def api_product_inventory_adjust(product_id: int, request: Request):
    body = await request.json()
    data = _inventory_adjustment_input(body)
    if isinstance(data, str):
        return fail(data)

    row = db_query_one("SELECT 当前数量 FROM products WHERE id = ?", (product_id,))
    if not row:
        return fail("产品不存在", 404)

    before = row["当前数量"] or 0
    after = before + data.变动数量
    if after < 0:
        return fail("库存不能小于 0")

    user = get_current_user(request) or ""
    conn = get_db()
    conn.execute(
        "UPDATE products SET 当前数量=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (after, product_id),
    )
    _record_inventory_movement(conn, product_id, before, after, data.原因, user)
    conn.commit()
    conn.close()
    return ok({"产品id": product_id, "变动数量": data.变动数量, "变动前": before, "变动后": after})


@app.get("/api/products/{product_id}/inventory-movements")
async def api_product_inventory_movements(product_id: int):
    product = db_query_one("SELECT id FROM products WHERE id = ?", (product_id,))
    if not product:
        return fail("产品不存在", 404)
    rows = db_query(
        """
        SELECT *
        FROM inventory_movements
        WHERE 产品id=?
        ORDER BY created_at DESC, id DESC
        """,
        (product_id,),
    )
    return ok([dict(r) for r in rows])


# ---------------------------------------------------------------------------
# Recipe APIs
# ---------------------------------------------------------------------------

@app.get("/api/recipes")
async def api_recipes(
    product_id: Optional[int] = None,
    status: str = "",
    material: str = "",
    date_from: str = "",
    date_to: str = "",
    min_rate: Optional[float] = Query(None, ge=0, le=1),
    max_rate: Optional[float] = Query(None, ge=0, le=1),
    sort: str = "",
    order: str = "desc",
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
    if material:
        where_parts.append(
            "EXISTS (SELECT 1 FROM recipe_materials m WHERE m.配方id = r.id AND m.名称 LIKE ?)"
        )
        params.append(f"%{material}%")
    if date_from:
        where_parts.append("r.试验日期 >= ?")
        params.append(date_from)
    if date_to:
        where_parts.append("r.试验日期 <= ?")
        params.append(date_to)
    if min_rate is not None:
        where_parts.append("v.成功率 >= ?")
        params.append(min_rate)
    if max_rate is not None:
        where_parts.append("v.成功率 <= ?")
        params.append(max_rate)

    where_sql = " AND ".join(where_parts)
    order_sql = _recipe_order_sql(sort, order)

    count_row = db_query_one(
        f"""
        SELECT COUNT(*) AS cnt
        FROM recipes r
        JOIN products p ON r.产品id = p.id
        LEFT JOIN v_recipe_success_rate v
          ON v.产品id = r.产品id AND v.配方hash = r.配方hash
        WHERE {where_sql}
        """,
        tuple(params),
    )
    total = count_row["cnt"] if count_row else 0

    rows = db_query(
        f"""
        SELECT r.*, p.品号, p.品名, v.试验次数, v.成功次数, v.成功率
        FROM recipes r
        JOIN products p ON r.产品id = p.id
        LEFT JOIN v_recipe_success_rate v
          ON v.产品id = r.产品id AND v.配方hash = r.配方hash
        WHERE {where_sql}
        ORDER BY {order_sql}
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
    data = _recipe_input(body)
    if isinstance(data, str):
        return fail(data)
    user = get_current_user(request) or ""

    # validate materials
    cleaned = _clean_materials(data.原料辅料)
    if isinstance(cleaned, str):
        return fail(cleaned)

    # get 品号 for hash
    prod = db_query_one("SELECT 品号 FROM products WHERE id = ?", (data.产品id,))
    if not prod:
        return fail("产品不存在")

    h = recipe_hash(prod["品号"], cleaned)

    conn = get_db()
    cur = conn.execute(
        """
        INSERT INTO recipes (产品id, 试验日期, 配方名称, 配方hash, 状态, 用了多少, 备注, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (data.产品id, data.试验日期, data.配方名称, h, data.状态, data.用了多少, data.备注, user),
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


@app.get("/api/recipes/{recipe_id}/same-hash")
async def api_recipe_same_hash(recipe_id: int):
    row = db_query_one("SELECT 产品id, 配方hash FROM recipes WHERE id = ?", (recipe_id,))
    if not row:
        return fail("配方记录不存在", 404)
    rows = db_query(
        """
        SELECT r.*, p.品号, p.品名
        FROM recipes r
        JOIN products p ON r.产品id = p.id
        WHERE r.产品id = ? AND r.配方hash = ?
        ORDER BY r.试验日期 DESC, r.id DESC
        """,
        (row["产品id"], row["配方hash"]),
    )
    return ok([dict(r) for r in rows])


@app.post("/api/recipes/{recipe_id}/duplicate")
async def api_recipe_duplicate(recipe_id: int, request: Request):
    source = db_query_one("SELECT * FROM recipes WHERE id = ?", (recipe_id,))
    if not source:
        return fail("配方记录不存在", 404)

    try:
        body = await request.json()
    except Exception:
        body = {}

    materials = get_recipe_materials(recipe_id)
    cleaned = _clean_materials(materials)
    if isinstance(cleaned, str):
        return fail(cleaned)

    trial_date = str(body.get("试验日期") or date.today().isoformat()).strip()
    recipe_name = str(body.get("配方名称") or f"{source['配方名称'] or '未命名配方'} 复测").strip()
    used_amount = body.get("用了多少", source["用了多少"] or 0)
    note = str(body.get("备注") or source["备注"] or "").strip()
    user = get_current_user(request) or ""

    conn = get_db()
    cur = conn.execute(
        """
        INSERT INTO recipes (产品id, 试验日期, 配方名称, 配方hash, 状态, 用了多少, 备注, created_by)
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
        """,
        (source["产品id"], trial_date, recipe_name, source["配方hash"], used_amount, note, user),
    )
    new_id = cur.lastrowid
    insert_materials(conn, new_id, cleaned)
    conn.commit()
    conn.close()
    return ok({"id": new_id})


@app.put("/api/recipes/{recipe_id}")
async def api_recipe_update(recipe_id: int, request: Request):
    body = await request.json()
    data = _recipe_input(body)
    if isinstance(data, str):
        return fail(data)

    cleaned = _clean_materials(data.原料辅料)
    if isinstance(cleaned, str):
        return fail(cleaned)

    prod = db_query_one("SELECT 品号 FROM products WHERE id = ?", (data.产品id,))
    if not prod:
        return fail("产品不存在")
    existing = db_query_one("SELECT id FROM recipes WHERE id = ?", (recipe_id,))
    if not existing:
        return fail("配方记录不存在", 404)

    h = recipe_hash(prod["品号"], cleaned)

    conn = get_db()
    conn.execute(
        """
        UPDATE recipes
        SET 产品id=?, 试验日期=?, 配方名称=?, 配方hash=?, 状态=?, 用了多少=?, 备注=?
        WHERE id=?
        """,
        (data.产品id, data.试验日期, data.配方名称, h, data.状态, data.用了多少, data.备注, recipe_id),
    )
    conn.execute("DELETE FROM recipe_materials WHERE 配方id = ?", (recipe_id,))
    insert_materials(conn, recipe_id, cleaned)
    conn.commit()
    conn.close()
    return ok({"id": recipe_id})


@app.delete("/api/recipes/{recipe_id}")
async def api_recipe_delete(recipe_id: int):
    conn = get_db()
    cur = conn.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        return fail("配方记录不存在", 404)
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
async def api_product_success_rate(
    product_id: int,
    date_from: str = "",
    date_to: str = "",
    status: str = "",
    min_rate: Optional[float] = Query(None, ge=0, le=1),
    max_rate: Optional[float] = Query(None, ge=0, le=1),
    min_trials: int = Query(1, ge=1),
    sort: str = "成功率",
    order: str = "desc",
):
    rows = _success_rate_rows(
        product_id=product_id,
        date_from=date_from,
        date_to=date_to,
        status=status,
        min_rate=min_rate,
        max_rate=max_rate,
        min_trials=min_trials,
        sort=sort,
        order=order,
    )
    return ok([dict(r) for r in rows])


@app.get("/api/products/{product_id}/recipes-by-hash/{recipe_hash_value}")
async def api_product_recipes_by_hash(product_id: int, recipe_hash_value: str):
    rows = db_query(
        """
        SELECT r.*, p.品号, p.品名
        FROM recipes r
        JOIN products p ON r.产品id = p.id
        WHERE r.产品id = ? AND r.配方hash = ?
        ORDER BY r.试验日期 DESC, r.id DESC
        """,
        (product_id, recipe_hash_value),
    )
    return ok([dict(r) for r in rows])


@app.get("/api/success-rate")
async def api_global_success_rate(
    product_id: Optional[int] = None,
    date_from: str = "",
    date_to: str = "",
    status: str = "",
    min_rate: Optional[float] = Query(None, ge=0, le=1),
    max_rate: Optional[float] = Query(None, ge=0, le=1),
    min_trials: int = Query(1, ge=1),
    sort: str = "成功率",
    order: str = "desc",
):
    rows = _success_rate_rows(
        product_id=product_id,
        date_from=date_from,
        date_to=date_to,
        status=status,
        min_rate=min_rate,
        max_rate=max_rate,
        min_trials=min_trials,
        sort=sort,
        order=order,
    )
    return ok([dict(r) for r in rows])


def _recipe_order_sql(sort: str, order: str) -> str:
    direction = "ASC" if order.lower() == "asc" else "DESC"
    sort_map = {
        "品号": "p.品号",
        "创建时间": "r.created_at",
        "created_at": "r.created_at",
        "成功率": "v.成功率",
        "试验日期": "r.试验日期",
    }
    column = sort_map.get(sort, "r.试验日期")
    if column == "v.成功率":
        return f"v.成功率 {direction}, r.试验日期 DESC, r.id DESC"
    return f"{column} {direction}, r.id DESC"


def _success_rate_order_sql(sort: str, order: str) -> str:
    direction = "ASC" if order.lower() == "asc" else "DESC"
    sort_map = {
        "品号": "p.品号",
        "成功率": "s.成功率",
        "试验次数": "s.试验次数",
        "成功次数": "s.成功次数",
        "创建时间": "s.最近创建时间",
        "created_at": "s.最近创建时间",
    }
    column = sort_map.get(sort, "s.成功率")
    if column == "p.品号":
        return f"{column} {direction}, s.成功率 DESC, s.试验次数 DESC"
    return f"{column} {direction}, s.试验次数 DESC, p.品号 ASC"


def _success_rate_rows(
    product_id: Optional[int] = None,
    date_from: str = "",
    date_to: str = "",
    status: str = "",
    min_rate: Optional[float] = None,
    max_rate: Optional[float] = None,
    min_trials: int = 1,
    sort: str = "成功率",
    order: str = "desc",
):
    params: List = []
    where_parts = ["r.状态 IN ('success', 'failed')"]
    if product_id:
        where_parts.append("r.产品id = ?")
        params.append(product_id)
    if date_from:
        where_parts.append("r.试验日期 >= ?")
        params.append(date_from)
    if date_to:
        where_parts.append("r.试验日期 <= ?")
        params.append(date_to)
    status_values = [s.strip() for s in status.split(",") if s.strip()]
    if status_values and "全部" not in status_values:
        valid_values = [s for s in status_values if s in ("success", "failed")]
        if valid_values:
            placeholders = ",".join("?" for _ in valid_values)
            where_parts.append(f"r.状态 IN ({placeholders})")
            params.extend(valid_values)

    having_parts = []
    if min_trials > 1:
        having_parts.append("COUNT(*) >= ?")
        params.append(min_trials)
    if min_rate is not None:
        having_parts.append("成功率 >= ?")
        params.append(min_rate)
    if max_rate is not None:
        having_parts.append("成功率 <= ?")
        params.append(max_rate)

    having_sql = f"HAVING {' AND '.join(having_parts)}" if having_parts else ""
    where_sql = " AND ".join(where_parts)
    order_sql = _success_rate_order_sql(sort, order)

    return db_query(
        f"""
        SELECT s.*, p.品号, p.品名
        FROM (
            SELECT
                r.产品id,
                r.配方hash,
                COUNT(*) AS 试验次数,
                SUM(CASE WHEN r.状态='success' THEN 1 ELSE 0 END) AS 成功次数,
                ROUND(SUM(CASE WHEN r.状态='success' THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 2) AS 成功率,
                MAX(r.created_at) AS 最近创建时间
            FROM recipes r
            WHERE {where_sql}
            GROUP BY r.产品id, r.配方hash
            {having_sql}
        ) s
        JOIN products p ON p.id = s.产品id
        ORDER BY {order_sql}
        """,
        tuple(params),
    )


@app.get("/api/materials/suggestions")
async def api_material_suggestions(
    q: str = "",
    limit: int = Query(50, ge=1, le=200),
):
    params: List = []
    where = ""
    if q:
        where = "WHERE 名称 LIKE ?"
        params.append(f"%{q}%")
    rows = db_query(
        f"""
        SELECT 类型, 名称, COALESCE(单位, '') AS 单位, COUNT(*) AS 使用次数
        FROM recipe_materials
        {where}
        GROUP BY 类型, 名称, COALESCE(单位, '')
        ORDER BY 使用次数 DESC, 名称 ASC
        LIMIT ?
        """,
        tuple(params + [limit]),
    )
    return ok([dict(r) for r in rows])


# ---------------------------------------------------------------------------
# Backup / Export / Import / Shutdown APIs
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


@app.get("/api/export/template")
async def api_export_template(type: str = "products"):
    try:
        path = export_import_template(type)
        return FileResponse(path, filename=os.path.basename(path))
    except Exception as e:
        return fail(f"导出模板失败: {e}")


@app.get("/api/export/json")
async def api_export_json():
    try:
        path = export_json()
        return FileResponse(path, filename=os.path.basename(path))
    except Exception as e:
        return fail(f"导出失败: {e}")


@app.post("/api/import")
async def api_import(request: Request):
    try:
        body = await request.json()
        filename = body.get("filename", "")
        content_base64 = body.get("content_base64", "")
        result = import_base64(filename, content_base64)
        return ok(result)
    except Exception as e:
        return fail(f"导入失败: {e}")


@app.post("/api/shutdown")
async def api_shutdown():
    backup_name = None
    backup_error = None
    try:
        backup_path = do_backup()
        backup_name = os.path.basename(backup_path)
    except Exception as e:
        backup_error = str(e)

    try:
        SHUTDOWN_HANDLER()
    except Exception as e:
        return fail(f"退出调度失败: {e}")

    return ok({"backup": backup_name, "backup_error": backup_error})


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
