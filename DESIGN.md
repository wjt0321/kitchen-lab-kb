# 样品库知识库管理系统 — 设计文档 v1

> **状态**: v1(功能/数据/流程层定稿,UI/UX 视觉层待小黑补充)
> **作者**: 旺财 🦅
> **日期**: 2026-06-05
> **后续**: 交付小黑做 UI/UX 设计,反馈后出 v2 定稿

---

## 1. 项目概述

### 1.1 目标
为研发人员提供一个**轻量、易迁移**的样品库知识库管理系统,记录:
- 产品主数据(品号/规格/品名/数量)
- 每次研发试验(原料/辅料/配方/成功或失败)
- 配方组合的成功率(支持迭代优化查询)

### 1.2 范围(MVP)
- 产品主数据 CRUD
- 配方试验记录 CRUD(每次试验一条)
- 原料/辅料录入
- 配方组合 hash 自动识别同一配方
- 配方成功率查询
- Excel 导出(产品/配方/成功率)
- 一键备份(.db 打包)
- JSON 全量导出
- 简单登录(只记用户名,不做密码)
- 归档(软删除)

### 1.3 用户
- **MVP 阶段**:1 个主要研发人员
- **后续扩展**:多人协作(数据模型先留 `user_id` 字段)

### 1.4 核心约束
| 约束 | 体现 |
|---|---|
| Windows 环境 | PyWebView 桌面窗,内嵌 FastAPI |
| 避免过多依赖 | 4 个 pip 包(fastapi/uvicorn/pywebview/openpyxl)+ stdlib |
| 多电脑易迁移 | 整个文件夹 + `pip install -r requirements.txt` + `python startup.py` |
| 简单记录/查询/修改/删除/归档 | 不引前端框架,原生 HTML/CSS/JS |

---

## 2. 技术选型

| 组件 | 选择 | 理由 |
|---|---|---|
| 后端 | **FastAPI** | 异步、自动文档、轻量 |
| 数据库 | **SQLite** (stdlib `sqlite3`) | 单文件、零依赖、易迁移 |
| ORM | **不用** | 表少(4 张),直接 SQL 更易读 |
| 前端 | **原生 HTML/CSS/JS** | 不引框架,保持轻 |
| 模板 | **stdlib `string.Template`** | 不引 Jinja2(又少一依赖) |
| 桌面壳 | **PyWebView** | 把 FastAPI 嵌进 Win 窗口 |
| Excel | **openpyxl** | 唯一 Excel 库,格式丰富 |
| 备份 | **stdlib `zipfile`** | 零依赖 |
| HTTP 启动 | **uvicorn** | FastAPI 标准搭档 |

**最终依赖只有 4 个**:`fastapi / uvicorn / pywebview / openpyxl`

---

## 3. 数据模型

### 3.1 表结构

```sql
-- 产品主表
CREATE TABLE products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    品号            TEXT NOT NULL UNIQUE,       -- 产品编号(主键索引)
    规格            TEXT NOT NULL,              -- 规格
    品名            TEXT NOT NULL,              -- 品名
    当前数量        INTEGER DEFAULT 0,         -- 当前数量(可手动调整/自动累计用量)
    备注            TEXT,                       -- 备注
    状态            TEXT DEFAULT 'active',      -- active / archived
    created_by      TEXT,                       -- 登录用户名(留扩展位)
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 配方/试验记录(每一次试验一条)
CREATE TABLE recipes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    产品id          INTEGER NOT NULL,           -- FK → products.id
    试验日期        DATE NOT NULL,
    配方名称        TEXT,                       -- 可选(如"配方A"/"实验-001")
    配方hash        TEXT NOT NULL,              -- 配方组合 hash(见 §4)
    状态            TEXT NOT NULL,              -- success / failed / pending
    用了多少        INTEGER,                    -- 本次试验用了多少
    备注            TEXT,
    created_by      TEXT,                       -- 登录用户名
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (产品id) REFERENCES products(id)
);

-- 原料/辅料(一条配方可多条)
CREATE TABLE recipe_materials (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    配方id          INTEGER NOT NULL,           -- FK → recipes.id
    类型            TEXT NOT NULL,              -- 原料 / 辅料
    名称            TEXT NOT NULL,
    用量            REAL NOT NULL,
    单位            TEXT,                       -- g / kg / ml / 颗 ...
    排序            INTEGER DEFAULT 0,          -- 录入顺序
    FOREIGN KEY (配方id) REFERENCES recipes(id)
);

-- 登录记录(简单登录用,不做密码校验)
CREATE TABLE user_logins (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    用户名          TEXT NOT NULL,
    登录时间        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    登出时间        TIMESTAMP
);
```

### 3.2 索引
```sql
CREATE INDEX idx_products_品号 ON products(品号);
CREATE INDEX idx_products_状态 ON products(状态);
CREATE INDEX idx_recipes_产品id ON recipes(产品id);
CREATE INDEX idx_recipes_配方hash ON recipes(配方hash);
CREATE INDEX idx_recipes_状态 ON recipes(状态);
CREATE INDEX idx_recipes_试验日期 ON recipes(试验日期);
CREATE INDEX idx_materials_配方id ON recipe_materials(配方id);
```

### 3.3 关键决策
- **`配方hash` 是计算字段,新建配方时自动算出来写入** — 查询时不用每次重算
- **`created_by` 字段**:MVP 阶段只填值(当前登录用户名),不做权限校验;后续要做审计直接查
- **软删除**:归档 = `状态='archived'`,查询时默认 filter 掉
- **数量字段**:只记"用了多少",存在 `recipes.用了多少`;产品主表的 `当前数量` 是**冗余字段**,可手动改/后续自动累计(留扩展位)

---

## 4. 核心算法

### 4.1 配方组合 Hash

**目的**:识别"同一配方"的不同试验记录,计算该配方的成功率

**算法**:
```python
import hashlib
import json

def recipe_hash(品号, 原料列表, 辅料列表):
    """
    原料/辅料列表: [(名称, 用量, 单位), ...]
    """
    # 1. 排序(确保相同组合 → 相同 hash)
    原料_sorted = sorted(原料列表, key=lambda x: x[0])
    辅料_sorted = sorted(辅料列表, key=lambda x: x[0])
    
    # 2. 标准化为字符串
    payload = {
        "品号": 品号,
        "原料": [{"名称": n, "用量": q, "单位": u} for n, q, u in 原料_sorted],
        "辅料": [{"名称": n, "用量": q, "单位": u} for n, q, u in 辅料_sorted],
    }
    
    # 3. 序列化 + sha256
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]  # 取前 16 位
```

**示例**:
- 配方 A: 品号 P001 + 原料[水 100ml, 糖 50g] + 辅料[香精 1ml] → hash = `a1b2c3d4e5f6g7h8`
- 同配方 A 重做:hash 不变,关联到同一组合
- 配方 B(改了一个用量):hash 变 → 新配方

### 4.2 成功率计算

**公式**:
```
配方组合成功率 = 该 hash 下 status='success' 的记录数 / 该 hash 下总记录数
```

**查询示例**:
```sql
-- 按"产品"看所有去重配方 + 成功率
SELECT 配方hash,
       COUNT(*) as 试验次数,
       SUM(CASE WHEN 状态='success' THEN 1 ELSE 0 END) as 成功次数,
       ROUND(SUM(CASE WHEN 状态='success' THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 2) as 成功率
FROM recipes
WHERE 产品id = ? AND 状态 IN ('success', 'failed')
GROUP BY 配方hash
ORDER BY 成功率 DESC;
```

**视图(预定义,UI 调用方便)**:
```sql
CREATE VIEW v_recipe_success_rate AS
SELECT 产品id, 配方hash,
       COUNT(*) as 试验次数,
       SUM(CASE WHEN 状态='success' THEN 1 ELSE 0 END) as 成功次数,
       ROUND(SUM(CASE WHEN 状态='success' THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 2) as 成功率
FROM recipes
WHERE 状态 IN ('success', 'failed')
GROUP BY 产品id, 配方hash;
```

---

## 5. 功能模块

### 5.1 登录
- **输入**:用户名(纯文本,无密码)
- **行为**:
  - 写入 `user_logins` 表(用户名 + 登录时间)
  - 存到前端 localStorage + 后端 session cookie(简单实现)
- **MVP 约束**:不做密码,不做权限,只记录"谁在线"
- **登出**:更新 `登出时间`

### 5.2 产品 CRUD
- **新增**:品号(必填/唯一)+ 规格 + 品名 + 数量(可空) + 备注
- **查询**:列表(支持分页,默认按创建时间倒序)
- **编辑**:所有字段可改
- **删除/归档**:`状态='archived'`,列表默认隐藏,有"显示已归档"开关
- **详情**:产品基本信息 + 该产品下的所有配方记录 + 配方组合成功率

### 5.3 配方 CRUD
- **新增**:产品(下拉选) + 试验日期 + 配方名称(可空) + 原料/辅料(动态行) + 用了多少 + 状态(success/failed/pending) + 备注
- **系统自动算**:`配方hash`(提交时算)
- **查询**:列表(支持按产品/状态/日期范围筛选)
- **编辑**:所有字段可改(改原料 → hash 重算)
- **删除**:真删(配方是试验记录,删了正常)

### 5.4 原料/辅料录入
- **交互**:动态表格(可加行/删行)
- **字段**:类型(原料/辅料)+ 名称 + 用量 + 单位
- **常用项**:暂不做下拉(后续可加)

### 5.5 搜索与筛选
- **产品搜索**:品号/品名 模糊匹配(`LIKE '%xxx%'`)
- **配方搜索**:按产品 + 状态 + 日期范围 + 成功率范围
- **结果排序**:可按字段排序(品号/创建时间/成功率)

### 5.6 归档
- **产品归档**:`状态='archived'`
- **查看归档**:列表上方"显示已归档"开关
- **恢复归档**:`状态='active'`

### 5.7 Excel 导出
- **导出产品列表**:`品号 / 规格 / 品名 / 当前数量 / 状态 / 创建时间`
- **导出配方列表**:`产品id / 品号 / 试验日期 / 配方名称 / 状态 / 用了多少 / 备注`
- **导出配方组合成功率**:`产品 / 配方hash / 试验次数 / 成功次数 / 成功率`
- **格式**:xlsx(可指定文件名,带时间戳)
- **路径**:用户选保存路径(用 stdlib `tkinter.filedialog` 或前端 `<a download>`)

### 5.8 一键备份
- **行为**:把 `data/kitchen.db` 打包成 `backups/kitchen_YYYYMMDD_HHMMSS.zip`
- **保留策略**:默认保留最近 10 个备份,超出自动删最老的(后续加)
- **触发**:UI 顶部一个"备份"按钮

### 5.9 JSON 导出
- **行为**:导出全部数据为 JSON(产品/配方/原料辅料),便于跨系统迁移
- **格式**:
  ```json
  {
    "exported_at": "2026-06-05T18:30:00",
    "products": [...],
    "recipes": [...],
    "materials": [...]
  }
  ```

---

## 6. 页面流程

### 6.1 登录页
- **路径**:`/login`
- **元素**:
  - 系统标题("样品库" 或 "Kitchen Lab")
  - 用户名输入框
  - "登录"按钮
  - (可选)上次登录用户名显示
- **跳转**:登录成功 → `/products`(产品列表)

### 6.2 产品列表(首页)
- **路径**:`/products`
- **元素**(由上到下):
  - 顶栏:系统名 + 当前用户名 + "退出" + "备份" + "导出"
  - 搜索框:品号/品名模糊搜索
  - 筛选:状态(active/archived/全部)
  - "新建产品"按钮(右上)
  - 产品列表表格:品号 / 规格 / 品名 / 当前数量 / 状态 / 配方数 / 创建时间 / 操作
  - 操作列:查看 / 编辑 / 归档
  - 分页(底部)

### 6.3 产品详情页
- **路径**:`/products/{id}`
- **元素**:
  - 面包屑:产品列表 > [品号]
  - 产品基本信息(品号/规格/品名/数量/备注)
  - 操作按钮:编辑 / 归档 / 新建配方
  - 配方列表(该产品下):试验日期 / 配方名称 / 状态 / 用了多少 / 创建人 / 操作
  - **配方组合成功率汇总表**(可折叠/可单独 tab):配方 hash / 试验次数 / 成功次数 / 成功率

### 6.4 新建/编辑产品
- **路径**:`/products/new` / `/products/{id}/edit`
- **元素**:
  - 表单:品号 / 规格 / 品名 / 当前数量 / 备注
  - "保存" + "取消"

### 6.5 新建/编辑配方
- **路径**:`/recipes/new?product_id=xxx` / `/recipes/{id}/edit`
- **元素**:
  - 产品(下拉选,新建时 prefill)
  - 试验日期(日期选择器)
  - 配方名称(可空)
  - 原料/辅料动态表格(可加行/删行)
  - 用了多少(数字)
  - 状态(单选:success / failed / pending)
  - 备注
  - "保存" + "取消"
  - **保存时**:自动算 hash,写入 `recipes.配方hash`

### 6.6 配方详情页
- **路径**:`/recipes/{id}`
- **元素**:
  - 试验信息(产品/日期/配方名/状态/用了多少/备注/创建人/创建时间)
  - 原料/辅料表格
  - 关联配方组合:同 hash 的其他试验记录(成功率信息)
  - 操作:编辑 / 删除

### 6.7 成功率查询页(可作为产品详情的一个 tab,也可独立)
- **路径**:`/products/{id}/success-rate`
- **元素**:
  - 筛选:日期范围 / 状态
  - 成功率汇总表(按 hash 分组)
  - 点击 hash → 展开该组合的所有试验

### 6.8 备份/导出
- **入口**:顶栏"备份" + "导出"
- **备份**:`/backup` POST → 返回下载链接或存到 backups/
- **导出**:`/export?type=products|recipes|success_rate` GET → 触发 xlsx 下载

---

## 7. API 设计(FastAPI 路由)

```
POST   /api/login                       # 登录(用户名)
POST   /api/logout                      # 登出

GET    /api/products                    # 列表(支持 ?q=&status=&page=)
POST   /api/products                    # 新建
GET    /api/products/{id}               # 详情
PUT    /api/products/{id}               # 编辑
POST   /api/products/{id}/archive       # 归档
POST   /api/products/{id}/restore       # 恢复归档

GET    /api/recipes                     # 列表(支持 ?product_id=&status=&date_from=&date_to=)
POST   /api/recipes                     # 新建(自动算 hash)
GET    /api/recipes/{id}                # 详情(含原料/辅料)
PUT    /api/recipes/{id}                # 编辑
DELETE /api/recipes/{id}                # 真删

GET    /api/products/{id}/success-rate  # 配方组合成功率汇总

POST   /api/backup                      # 一键备份(返回下载链接)
GET    /api/export/excel?type=...       # Excel 导出
GET    /api/export/json                 # JSON 全量导出
```

**返回格式**:统一 `{"ok": true/false, "data": ..., "error": "..."}`

---

## 8. 非功能性需求

### 8.1 备份策略
- 用户手动触发(`backups/kitchen_YYYYMMDD_HHMMSS.zip`)
- 保留最近 10 个,超出删最老的
- (后续)可加每日自动备份

### 8.2 迁移方案
- **A 电脑 → B 电脑**:复制整个 `kitchen-lab-kb/` 文件夹
- B 电脑执行:
  ```bash
  pip install -r requirements.txt
  python startup.py
  ```
- 数据库:`data/kitchen.db` 跟着文件夹走

### 8.3 性能考虑
- 配方表预计 1k-10k 条(每年试验量),SQLite 完全够用
- 关键查询都建了索引(见 §3.2)
- Excel 导出:同步,数据量大时可能 1-2s(可接受)

### 8.4 安全
- MVP 不连公网,本地数据库
- 用户名只做记录,不做密码
- .env / .db / backups/ 都在 .gitignore(虽然不上 git)

---

## 9. 后续扩展位(数据模型先留好)

| 扩展点 | 当前预留 | 后续要做 |
|---|---|---|
| 多人协作 | `products.created_by` / `recipes.created_by` / `user_logins` 表 | 多人同步/中央 db/冲突合并 |
| 审计日志 | `user_logins` 表(谁在什么时候登录) | 完整 CRUD 审计表(谁/什么时候/改了什么) |
| 权限分级 | 无 | 用户表 + 角色字段 + 权限矩阵 |
| 配方附件 | 无 | `attachments` 表(图片/PDF 存路径) |
| 库存自动累计 | `products.当前数量` 冗余 | 触发器/事务:配方成功 → 自动扣减 |
| 常用原料辅料 | 无 | `materials_dict` 表 + 下拉选择 |
| 数据加密 | 无 | db 加密(sqlcipher) |

---

## 10. 待小黑补充(UI/UX 视觉层)

> 以下是**功能层定稿,等小黑出 UI/UX 视觉层反馈**后整合到 v2:
>
> 1. **页面布局**:每页的视觉层级、留白、卡片/表格的比例
> 2. **视觉风格**:色彩(主色/辅色/警告色)、字体、图标风格
> 3. **交互细节**:
>    - 顶栏/侧栏/面包屑/分页/筛选器的具体位置
>    - 按钮位置(主操作放哪?)
>    - 表单校验的提示风格(弹窗/行内/颜色)
>    - 表格行操作(点哪进入详情?悬浮菜单?)
> 4. **视觉一致性**:
>    - 标签/徽章的风格(成功/失败/待定)
>    - 进度条/百分比的视觉
> 5. **空状态/加载状态/错误状态**:
>    - 无数据时显示什么
>    - 加载中用什么占位
>    - 报错时怎么提示
> 6. **响应式/桌面窗适配**:PyWebView 固定尺寸,要不要适配窗口缩放?

---

## 附录 A:文件结构(实施时)

```
D:\Qwenclaw\wangcai\projects\kitchen-lab-kb\
├── DESIGN.md              # 本设计文档
├── DESIGN-v2.md           # v2 定稿(待小黑反馈后)
├── app.py                 # FastAPI 入口
├── db.py                  # SQLite 操作
├── backup.py              # 一键备份
├── export.py              # Excel / JSON 导出
├── auth.py                # 简单登录
├── startup.py             # 启动 PyWebView 壳
├── requirements.txt       # 4 个依赖
├── README.md              # 部署/迁移/启动
├── .gitignore
├── data/
│   └── kitchen.db         # SQLite(运行自动建)
├── templates/             # HTML 模板
└── static/                # CSS / JS
```

---

**v1 结束。等小黑反馈后出 v2。** 🦅
