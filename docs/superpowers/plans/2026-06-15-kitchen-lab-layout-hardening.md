# Kitchen Lab Layout Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改后端接口和数据库结构的前提下，修复当前工作台的布局、图标、滚动、高亮、分页和登录页位置问题。

**Architecture:** 保持现有 `FastAPI + templates/base.html + static/app.js + static/style.css` 架构不变，只在现有壳层上做结构收口。核心做法是：去掉外链图标字体依赖，建立本地图标渲染辅助；把桌面端页面固定为“侧栏 + 顶栏 + 主内容 + 状态栏”；窄屏改成抽屉导航；同时压缩无效留白并增强导航与分页的可读性。

**Tech Stack:** FastAPI, 原生 JavaScript, CSS, Playwright smoke scripts, pytest-style Python checks

---

## 文件结构

### 需要修改的现有文件

- `d:\kitchen-lab-kb\templates\base.html`
  - 负责全局 HTML 壳、外链资源、顶层布局挂载点。
- `d:\kitchen-lab-kb\static\app.js`
  - 负责侧栏、顶栏、状态栏、登录页、产品页、导出菜单、分页等前端渲染与交互。
- `d:\kitchen-lab-kb\static\style.css`
  - 负责工作台布局、响应式、侧栏高亮、登录页、分页、滚动和视觉密度。
- `d:\kitchen-lab-kb\tests\check_login_render.py`
  - 负责登录页首屏结构与隐藏顶栏检查。
- `d:\kitchen-lab-kb\tests\check_design_v2_completion.py`
  - 负责关键前端契约和静态结构片段检查。

### 计划新增文件

- `d:\kitchen-lab-kb\tests\check_workspace_shell.py`
  - 负责工作台壳层、窄屏菜单按钮、状态栏、侧栏去重和产品页分页增强的烟雾检查。

### 责任边界

- 不新增前端框架。
- 不拆分 `static/app.js` 为多个文件。
- 图标通过 `app.js` 中的统一方法输出，样式由 `style.css` 兜底。
- 登录页位置调整只通过 CSS 布局完成，不改登录 API。

---

### Task 1: 去掉外链图标字体并建立本地图标渲染

**Files:**
- Modify: `d:\kitchen-lab-kb\templates\base.html`
- Modify: `d:\kitchen-lab-kb\static\app.js`
- Modify: `d:\kitchen-lab-kb\static\style.css`
- Modify: `d:\kitchen-lab-kb\tests\check_design_v2_completion.py`

- [ ] **Step 1: 先写静态契约，让当前实现失败**

在 `tests/check_design_v2_completion.py` 的 `required_snippets` 中加入本地图标和新壳层片段：

```python
required_snippets.extend([
    "renderIcon(",
    "icon icon-box",
    "sidebar-drawer-toggle",
    "workspace-shell",
    "workspace-main",
    "workspace-topbar",
    "statusbar",
])
assert "@tabler/icons-webfont" not in base_html, "external tabler icon font should be removed"
```

- [ ] **Step 2: 运行测试确认当前实现失败**

Run:

```bash
python tests/check_design_v2_completion.py
```

Expected:

- 报缺少 `renderIcon(`、`sidebar-drawer-toggle` 等片段
- 报 `external tabler icon font should be removed`

- [ ] **Step 3: 在模板和脚本里切换到本地图标方案**

把 `templates/base.html` 中的外链图标字体去掉，只保留 Tabler CSS 与本地样式：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta21/dist/css/tabler.min.css">
<link rel="stylesheet" href="/static/style.css?v=layout-hardening-20260615">
```

在 `static/app.js` 顶部新增统一图标方法，并逐步替换导航、顶栏、状态栏、分页等高频 `<i class="ti ...">`：

```javascript
renderIcon(name, label = "") {
  const safe = this.escapeHtml(name || "circle");
  const safeLabel = this.escapeHtml(label || "");
  return `<span class="icon icon-${safe}" aria-hidden="true"></span>${safeLabel ? `<span class="visually-hidden">${safeLabel}</span>` : ""}`;
}
```

把状态栏渲染从：

```javascript
<span><i class="ti ti-checklist"></i> 选中 <strong id="sb-selected">0</strong> 条</span>
```

改成：

```javascript
<span class="statusbar-item">${this.renderIcon("checklist", "选中")} 选中 <strong id="sb-selected">0</strong> 条</span>
```

并对侧栏、顶部栏、分页按钮、登录按钮等高频区域做同类替换。

- [ ] **Step 4: 在样式里补齐图标占位与品牌图标表现**

在 `static/style.css` 中新增图标基础样式，并让品牌区支持 `ico`：

```css
.icon {
  display: inline-flex;
  width: 1rem;
  height: 1rem;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-mark {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, var(--tblr-primary), var(--tblr-secondary));
}

.brand-mark::before {
  content: "";
  width: 20px;
  height: 20px;
  background: url("/兴达logo.ico") center / contain no-repeat;
}

.brand-mark.has-fallback::before {
  display: none;
}
```

并为高频图标类提供伪元素或 mask 映射，例如：

```css
.icon-box::before,
.icon-plus::before,
.icon-archive::before,
.icon-database::before,
.icon-export::before,
.icon-user::before,
.icon-logout::before,
.icon-chevron-left::before,
.icon-chevron-right::before {
  content: "";
  width: 100%;
  height: 100%;
  background: currentColor;
  -webkit-mask: var(--icon-mask) center / contain no-repeat;
  mask: var(--icon-mask) center / contain no-repeat;
}
```

- [ ] **Step 5: 运行测试并提交**

Run:

```bash
python tests/check_design_v2_completion.py
```

Expected:

- 静态契约通过
- `base.html` 中不再包含 `@tabler/icons-webfont`

Commit:

```bash
git add templates/base.html static/app.js static/style.css tests/check_design_v2_completion.py
git commit -m "fix: replace external icon font with local icons"
```

---

### Task 2: 固定桌面工作台壳层并把窄屏侧栏改为抽屉

**Files:**
- Modify: `d:\kitchen-lab-kb\templates\base.html`
- Modify: `d:\kitchen-lab-kb\static\app.js`
- Modify: `d:\kitchen-lab-kb\static\style.css`
- Create: `d:\kitchen-lab-kb\tests\check_workspace_shell.py`

- [ ] **Step 1: 写壳层与抽屉行为的失败烟雾测试**

新增 `tests/check_workspace_shell.py`：

```python
"""Smoke check for the workspace shell and responsive drawer."""
from playwright.sync_api import sync_playwright

from helpers import post_json, run_server


def main():
    with run_server(8026) as base_url:
        post_json(base_url, "/api/login", {"用户名": "planner"})
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(f"{base_url}/#/products", wait_until="networkidle")
            assert page.locator("#app-shell.workspace-shell").count() == 1
            assert page.locator("#sidebar").count() == 1
            assert page.locator("#topbar").count() == 1
            assert page.locator("#statusbar").count() == 1
            assert page.locator(".sidebar-group-title", has_text="工具").count() == 0

            mobile = browser.new_page(viewport={"width": 820, "height": 900})
            mobile.goto(f"{base_url}/#/products", wait_until="networkidle")
            assert mobile.locator(".sidebar-drawer-toggle").count() == 1
            mobile.locator(".sidebar-drawer-toggle").click()
            assert mobile.locator("#sidebar.sidebar-open").count() == 1
            browser.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 运行测试确认当前结构失败**

Run:

```bash
python tests/check_workspace_shell.py
```

Expected:

- 缺少 `.sidebar-drawer-toggle`
- 侧栏仍存在“工具”分组
- 小屏下没有 `sidebar-open`

- [ ] **Step 3: 在脚本中加抽屉状态和新顶栏结构**

在 `static/app.js` 中新增壳层状态：

```javascript
drawerOpen: false,

toggleSidebarDrawer(force) {
  this.drawerOpen = typeof force === "boolean" ? force : !this.drawerOpen;
  document.getElementById("sidebar")?.classList.toggle("sidebar-open", this.drawerOpen);
  document.getElementById("sidebar-backdrop")?.classList.toggle("hide", !this.drawerOpen);
},
```

把顶部区改成包含抽屉按钮：

```javascript
renderTopbarActions() {
  return `
    <div class="topbar-content">
      <div class="topbar-leading">
        <button class="btn btn-outline-secondary sidebar-drawer-toggle" onclick="app.toggleSidebarDrawer()">
          ${this.renderIcon("menu", "打开导航")}
        </button>
      </div>
      <div class="topbar-actions">
        <span class="topbar-user">${this.renderIcon("user", "当前用户")}${this.escapeHtml(this.user)}</span>
        <button class="btn btn-outline-secondary" onclick="app.backup()">${this.renderIcon("database")}备份</button>
        <button class="btn btn-outline-secondary" onclick="app.importData()">${this.renderIcon("import")}导入</button>
        <div class="dropdown">
          <button class="btn btn-outline-secondary" onclick="app.toggleExportMenu()">${this.renderIcon("export")}导出</button>
          ${this.renderExportMenu()}
        </div>
        <button class="btn btn-outline-danger" onclick="app.confirmExit()">${this.renderIcon("logout")}退出</button>
      </div>
    </div>
  `;
}
```

同时把 `renderSidebarNav()` 中的“工具”分组整个删除。

- [ ] **Step 4: 在样式里固定桌面壳层并实现抽屉**

在 `static/style.css` 中把桌面端壳层收紧成固定结构：

```css
#app-shell {
  display: grid;
  grid-template-columns: 252px minmax(0, 1fr);
  height: 100vh;
}

#sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.page-wrapper,
.workspace-main {
  min-width: 0;
  height: 100vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

#workbench,
.page-body {
  min-height: 0;
  overflow: hidden;
}

#workbench-body {
  min-height: 0;
  overflow-y: auto;
}
```

为窄屏增加抽屉规则：

```css
@media (max-width: 991px) {
  #app-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  #sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: min(320px, 86vw);
    transform: translateX(-100%);
    transition: transform .2s ease;
    z-index: 40;
  }

  #sidebar.sidebar-open {
    transform: translateX(0);
  }

  .sidebar-drawer-toggle {
    display: inline-flex;
  }
}
```

- [ ] **Step 5: 运行测试并提交**

Run:

```bash
python tests/check_workspace_shell.py
```

Expected:

- 桌面端壳层存在
- 小屏点击按钮后出现 `sidebar-open`
- 侧栏中不再有“工具”分组

Commit:

```bash
git add static/app.js static/style.css templates/base.html tests/check_workspace_shell.py
git commit -m "feat: add fixed workspace shell and drawer sidebar"
```

---

### Task 3: 提升产品页信息密度并增强高亮、分页和滚动

**Files:**
- Modify: `d:\kitchen-lab-kb\static\app.js`
- Modify: `d:\kitchen-lab-kb\static\style.css`
- Modify: `d:\kitchen-lab-kb\tests\check_workspace_shell.py`
- Modify: `d:\kitchen-lab-kb\tests\check_design_v2_completion.py`

- [ ] **Step 1: 先补产品页结构契约**

在 `tests/check_design_v2_completion.py` 中新增：

```python
required_snippets.extend([
    "products-hero-search",
    "products-hero-actions",
    "pagination-bar",
    "pagination-label",
    "pagination-next",
    "pagination-prev",
    "sidebar-search",
    "sidebar-subnav",
])
```

把 `tests/check_workspace_shell.py` 中的产品页断言补成：

```python
assert page.locator(".products-hero-search").count() == 1
assert page.locator(".page-hero").count() >= 1
assert page.locator(".pagination-bar").count() == 1
assert page.locator(".pagination-prev").count() == 1
assert page.locator(".pagination-next").count() == 1
```

- [ ] **Step 2: 运行测试确认当前产品页结构不完整**

Run:

```bash
python tests/check_workspace_shell.py
python tests/check_design_v2_completion.py
```

Expected:

- 分页增强类名不存在
- 静态契约缺少 `pagination-label` 等片段

- [ ] **Step 3: 调整产品页模板与分页按钮文案**

在 `static/app.js` 的 `renderProducts()` 中保留现有筛选逻辑，但把分页区改成可见度更高的结构：

```javascript
${total > page_size ? `
  <div class="pagination-bar">
    <span class="pagination-total">共 ${total} 条</span>
    <button class="btn btn-outline-secondary pagination-prev" ${page <= 1 ? "disabled" : ""} onclick="app.navProducts({page:${page - 1}})">
      ${this.renderIcon("chevron-left")}上一页
    </button>
    <span class="pagination-label">第 ${page} / ${totalPages} 页</span>
    <button class="btn btn-outline-secondary pagination-next" ${page >= totalPages ? "disabled" : ""} onclick="app.navProducts({page:${page + 1}})">
      下一页${this.renderIcon("chevron-right")}
    </button>
  </div>
` : ""}
```

同时让产品页操作区保留“新增产品 / 批量导入 / 批量归档 / 导出选中”，不再和侧栏重复。

- [ ] **Step 4: 在样式中压缩留白并增强当前态**

在 `static/style.css` 中调整内容最大宽度和选中态：

```css
#app.container-xl,
#app {
  width: min(100%, 1480px);
  max-width: 1480px;
}

.page-body {
  padding: 1rem 1.125rem 1.25rem;
}

.page-hero {
  padding: 1rem 1.125rem;
  margin-bottom: 1rem;
}

.sidebar-nav a,
.sidebar-subnav a {
  border-radius: 12px;
}

.sidebar-nav a.active,
.sidebar-subnav a.active {
  background: rgba(201, 100, 66, 0.14);
  box-shadow: inset 0 0 0 1px rgba(201, 100, 66, 0.18);
  color: #9f4a31;
}

.pagination-prev,
.pagination-next {
  min-width: 108px;
  min-height: 38px;
  font-weight: 600;
}

.pagination-label {
  min-width: 92px;
  text-align: center;
  font-weight: 600;
}
```

- [ ] **Step 5: 运行测试并提交**

Run:

```bash
python tests/check_workspace_shell.py
python tests/check_design_v2_completion.py
```

Expected:

- 产品页存在增强分页结构
- 静态契约通过

Commit:

```bash
git add static/app.js static/style.css tests/check_workspace_shell.py tests/check_design_v2_completion.py
git commit -m "feat: tighten product workspace layout"
```

---

### Task 4: 登录页上移并完成最终回归

**Files:**
- Modify: `d:\kitchen-lab-kb\static\style.css`
- Modify: `d:\kitchen-lab-kb\static\app.js`
- Modify: `d:\kitchen-lab-kb\tests\check_login_render.py`
- Modify: `d:\kitchen-lab-kb\tests\check_workspace_shell.py`

- [ ] **Step 1: 先为登录框上移写失败检查**

在 `tests/check_login_render.py` 中补充登录卡片垂直位置断言：

```python
login_card_box = page.locator(".login-card").bounding_box()
viewport_height = page.viewport_size["height"]
assert login_card_box is not None, "login card box should be measurable"
assert login_card_box["y"] < viewport_height * 0.24, "login card should sit higher on the page"
```

在 `tests/check_workspace_shell.py` 中补充登录页隐藏侧栏和状态栏的验证：

```python
login_page = browser.new_page(viewport={"width": 1280, "height": 900})
login_page.goto(f"{base_url}/login", wait_until="networkidle")
assert login_page.locator(".login-shell").count() == 1
assert login_page.locator("#sidebar").evaluate("el => getComputedStyle(el).display") == "none"
```

- [ ] **Step 2: 运行测试确认当前登录卡片位置过低**

Run:

```bash
python tests/check_login_render.py
```

Expected:

- `login card should sit higher on the page` 失败

- [ ] **Step 3: 通过布局把登录卡片整体上移**

在 `static/style.css` 中把登录页从完全居中改成偏上布局：

```css
.login-shell {
  min-height: 100vh;
  display: grid;
  align-items: start;
  justify-items: center;
  padding: clamp(3.25rem, 8vh, 5.5rem) 2rem 2rem;
}

.login-card {
  margin-top: 0;
}

.login-card .page-hero {
  margin-bottom: 1.125rem;
}
```

如需进一步微调，在 `renderLogin()` 外层保留当前结构，不新增额外容器，只让 CSS 控制位置。

- [ ] **Step 4: 运行完整回归**

Run:

```bash
python tests/check_login_render.py
python tests/check_workspace_shell.py
python tests/check_design_v2_completion.py
python -m py_compile startup.py app.py export.py import_data.py shutdown.py auth.py backup.py db.py
```

Expected:

- 所有脚本通过
- `py_compile` 无错误

- [ ] **Step 5: 提交最终结果**

```bash
git add static/app.js static/style.css tests/check_login_render.py tests/check_workspace_shell.py tests/check_design_v2_completion.py templates/base.html
git commit -m "fix: harden kitchen lab workspace layout"
```

---

## 自检

### Spec coverage

- 本地图标替代与 `ORB` 报错清理：Task 1
- 桌面固定壳层与窄屏抽屉侧栏：Task 2
- 去重、留白压缩、高亮增强、分页放大：Task 3
- 登录页整体上移：Task 4

### Placeholder scan

- 无 `TODO` / `TBD`
- 每个任务均包含文件路径、具体代码片段、命令和预期结果

### Type consistency

- 图标统一使用 `renderIcon()`
- 抽屉按钮统一使用 `sidebar-drawer-toggle`
- 分页增强统一使用 `pagination-prev`、`pagination-next`、`pagination-label`
- 登录页位置只通过 `.login-shell` 与 `.login-card` 调整
