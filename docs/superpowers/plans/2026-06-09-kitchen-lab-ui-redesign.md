# Kitchen Lab UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变后端接口、数据库结构和核心路由语义的前提下，把 `kitchen-lab-kb` 的前端改造成参考图风格的桌面业务工作台。

**Architecture:** 先建立新的全局工作台外壳与设计 token，再按页面优先级逐步迁移登录页、产品列表、产品详情、配方相关页面和成功率页。保留现有 hash 路由和 API 调用模式，但把 `static/app.js` 重组为更清晰的渲染辅助函数与共享 UI 组件，并用现有 Python/Playwright 烟雾测试守住核心交互。

**Tech Stack:** FastAPI, Jinja2 模板, 原生 JavaScript, CSS, Playwright for Python, pytest-style smoke scripts

---

## 文件结构

### 现有核心文件

- `templates/base.html`
  - 负责全局 HTML 壳、顶层容器、系统区与脚本挂载。
- `static/style.css`
  - 负责主题变量、工作台布局、共享组件、表格、表单、弹层和响应式规则。
- `static/app.js`
  - 负责 hash 路由、页面渲染、共享 UI 逻辑、API 调用和交互行为。
- `tests/check_login_render.py`
  - 负责登录页首屏和隐藏顶栏的 Playwright 烟雾检查。
- `tests/check_design_v2_completion.py`
  - 负责静态前端契约与后端接口能力检查。

### 计划新增文件

- `tests/check_workspace_shell.py`
  - 检查新的工作台外壳、左侧栏、主任务区和系统操作区是否渲染。
- `tests/check_inventory_modal.py`
  - 检查库存调整从 `prompt` 切换为站内弹层，且包含数量与原因字段。

### 渲染职责拆分

不新增前端框架，也不硬拆多个 JS 文件；在 `static/app.js` 内部用具名方法分层：

- 壳层方法：`renderAppShell()`、`renderTopbarActions()`、`renderSidebarNav()`
- 页面头部方法：`renderPageHero()`、`renderPageHeaderMeta()`
- 共享反馈方法：`modal()`、`toast()`、`renderEmptyState()`
- 页面渲染方法：`renderLogin()`、`renderProducts()`、`renderProductDetail()`、`renderRecipeForm()`、`renderRecipeDetail()`、`renderSuccessRate()`

---

### Task 1: 建立工作台外壳与主题基础

**Files:**
- Modify: `d:\kitchen-lab-kb\templates\base.html`
- Modify: `d:\kitchen-lab-kb\static\style.css`
- Modify: `d:\kitchen-lab-kb\tests\check_login_render.py`
- Create: `d:\kitchen-lab-kb\tests\check_workspace_shell.py`

- [ ] **Step 1: 写壳层和登录页的失败检查**

```python
"""Smoke check that the desktop workspace shell renders for logged-in users."""
from playwright.sync_api import sync_playwright

from helpers import post_json, run_server


def main():
    with run_server(8023) as base_url:
        post_json(base_url, "/api/login", {"用户名": "planner"})
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(f"{base_url}/#/products", wait_until="networkidle")
            assert page.locator(".workspace-shell").count() == 1
            assert page.locator(".workspace-sidebar").count() == 1
            assert page.locator(".workspace-main").count() == 1
            assert page.locator(".page-hero").count() >= 1
            assert page.locator(".system-actions").count() == 1
            browser.close()


if __name__ == "__main__":
    main()
```

同时把 `tests/check_login_render.py` 的断言扩充到新的登录结构：

```python
assert page.locator(".login-shell").count() == 1
assert page.locator(".login-card").count() == 1
assert page.locator(".login-card .page-hero-title, .login-card h2").count() == 1
```

- [ ] **Step 2: 运行测试确认当前实现失败**

Run:

```bash
python tests/check_login_render.py
python tests/check_workspace_shell.py
```

Expected:

- `check_login_render.py` 可能部分通过，但新的结构断言失败
- `check_workspace_shell.py` 失败并提示 `.workspace-shell` 或 `.workspace-sidebar` 不存在

- [ ] **Step 3: 重写全局 HTML 壳和基础 CSS**

在 `templates/base.html` 中把当前扁平结构换成新的工作台骨架：

```html
<body>
  <div id="app-shell" class="workspace-shell">
    <aside id="sidebar" class="workspace-sidebar"></aside>
    <div class="workspace-main">
      <header id="topbar" class="workspace-topbar"></header>
      <div id="toast-container"></div>
      <div id="modal-container"></div>
      <main id="app" class="workspace-content"></main>
    </div>
  </div>
  <script src="/static/app.js"></script>
</body>
```

在 `static/style.css` 中新增统一布局和视觉 token，保留现有变量兼容层：

```css
:root {
  --shell-bg: linear-gradient(180deg, #fbfbf8 0%, #f2f2ec 100%);
  --panel-bg: rgba(255, 255, 252, 0.78);
  --panel-border: rgba(205, 205, 196, 0.92);
  --sidebar-width: 248px;
  --hero-radius: 28px;
  --surface-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
}

body {
  min-height: 100vh;
  background: var(--shell-bg);
}

.workspace-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
}

.workspace-sidebar,
.workspace-topbar,
.page-hero,
.card,
.table-wrap,
.modal {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  backdrop-filter: blur(20px);
}
```

- [ ] **Step 4: 用最小 JS 接入新壳层并让测试通过**

在 `static/app.js` 增加壳层更新入口，先保证登录页和产品页都能把壳层渲染出来：

```javascript
updateShell() {
  const route = this.routeFromLocation();
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');
  const loggedIn = Boolean(this.user);

  if (sidebar) {
    sidebar.innerHTML = loggedIn ? this.renderSidebarNav(route.path) : '';
    sidebar.classList.toggle('hide', !loggedIn);
  }
  if (topbar) {
    topbar.innerHTML = loggedIn ? this.renderTopbarActions() : '';
    topbar.classList.toggle('hide', route.path === '/login');
  }
},

renderSidebarNav(path) {
  return `
    <div class="sidebar-brand">样品库知识库</div>
    <nav class="sidebar-nav">
      <a class="${path.startsWith('/products') ? 'active' : ''}" href="#/products">产品</a>
      <a class="${path.startsWith('/success-rate') ? 'active' : ''}" href="#/success-rate">成功率</a>
    </nav>
  `;
},

renderTopbarActions() {
  return `
    <div class="topbar-spacer"></div>
    <div class="system-actions">
      <span class="current-user">${this.escapeHtml(this.user)}</span>
      <button class="btn btn-secondary" onclick="app.backup()">备份</button>
      <button class="btn btn-secondary" onclick="app.importData()">导入</button>
      <div class="menu-wrap">...</div>
      <button class="btn btn-exit" onclick="app.confirmExit()">退出</button>
    </div>
  `;
}
```

并在 `init()` 与 `route()` 中调用 `this.updateShell()`。

- [ ] **Step 5: 运行测试并提交**

Run:

```bash
python tests/check_login_render.py
python tests/check_workspace_shell.py
```

Expected:

- 两个脚本均无异常退出

Commit:

```bash
git add templates/base.html static/style.css static/app.js tests/check_login_render.py tests/check_workspace_shell.py
git commit -m "feat: add workspace shell foundation"
```

---

### Task 2: 重做登录页和产品列表主任务区

**Files:**
- Modify: `d:\kitchen-lab-kb\static\app.js`
- Modify: `d:\kitchen-lab-kb\static\style.css`
- Modify: `d:\kitchen-lab-kb\tests\check_login_render.py`
- Modify: `d:\kitchen-lab-kb\tests\check_design_v2_completion.py`
- Modify: `d:\kitchen-lab-kb\tests\check_workspace_shell.py`

- [ ] **Step 1: 写产品列表主任务区的失败检查**

在 `tests/check_workspace_shell.py` 里加入产品列表关键区域断言：

```python
assert page.locator(".page-hero-title").count() >= 1
assert page.locator(".products-hero-search #prod-q").count() == 1
assert page.locator(".products-hero-actions .btn-primary").count() == 1
assert page.locator(".products-panel .table-wrap").count() == 1
```

在 `tests/check_design_v2_completion.py` 增加新的前端契约片段：

```python
required_snippets.extend([
    "renderPageHero",
    "products-hero-search",
    "products-panel",
    "workspace-shell",
    "system-actions",
])
```

- [ ] **Step 2: 运行测试确认产品页结构尚未完成**

Run:

```bash
python tests/check_workspace_shell.py
python tests/check_design_v2_completion.py
```

Expected:

- 产品列表相关类名和方法断言失败

- [ ] **Step 3: 实现登录页和产品列表的新头部结构**

在 `static/app.js` 中新增通用主任务区渲染器：

```javascript
renderPageHero({ kicker = '', title, subtitle = '', content = '', actions = '' }) {
  return `
    <section class="page-hero">
      ${kicker ? `<div class="page-hero-kicker">${this.escapeHtml(kicker)}</div>` : ''}
      <div class="page-hero-copy">
        <h1 class="page-hero-title">${this.escapeHtml(title)}</h1>
        ${subtitle ? `<p class="page-hero-subtitle">${this.escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${content ? `<div class="page-hero-content">${content}</div>` : ''}
      ${actions ? `<div class="page-hero-actions">${actions}</div>` : ''}
    </section>
  `;
}
```

把 `renderLogin()` 改成更聚焦的中心页：

```javascript
renderLogin(el) {
  const last = localStorage.getItem('username') || '';
  el.innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        ${this.renderPageHero({
          kicker: 'Kitchen Lab',
          title: '样品库知识库',
          subtitle: '研发样品、配方记录与成功率追踪工作台',
        })}
        <div class="login-form">
          <input id="login-user" class="input" placeholder="请输入用户名" value="${this.escapeHtml(last)}" onkeydown="if(event.key==='Enter')app.login()">
          <button class="btn btn-primary" onclick="app.login()">进入工作台</button>
          ${last ? `<div class="login-last">上次登录: ${this.escapeHtml(last)}</div>` : ''}
        </div>
      </div>
    </div>
  `;
  document.getElementById('login-user')?.focus();
}
```

把 `renderProducts()` 顶部改成主任务区 + 列表面板：

```javascript
const hero = this.renderPageHero({
  kicker: '产品工作台',
  title: '查找、管理并追踪样品产品',
  subtitle: '优先处理最常用的搜索、筛选和新建动作',
  content: `
    <div class="products-hero-search">
      <input class="input" id="prod-q" placeholder="输入品号或品名" value="${safeQ}" onkeydown="if(event.key==='Enter')app.searchProducts()">
      <select class="input" id="prod-status" onchange="app.searchProducts()">...</select>
    </div>
  `,
  actions: `
    <div class="products-hero-actions">
      <button class="btn btn-secondary" onclick="app.navProducts()">重置</button>
      <button class="btn btn-primary" onclick="location.hash='#/products/new'">新建产品</button>
    </div>
  `
});
```

- [ ] **Step 4: 为新头部补齐样式和空状态层级**

在 `static/style.css` 中加入产品页和登录页主任务区样式：

```css
.page-hero {
  padding: 28px;
  border-radius: var(--hero-radius);
  box-shadow: var(--surface-shadow);
}

.page-hero-title {
  margin: 0;
  font-size: 34px;
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.products-hero-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 12px;
}

.products-panel {
  margin-top: 18px;
}

.login-form {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}
```

并让空状态统一复用：

```javascript
renderEmptyState({ title, body, action = '' }) {
  return `
    <div class="empty-state">
      <h3>${this.escapeHtml(title)}</h3>
      <p>${this.escapeHtml(body)}</p>
      ${action}
    </div>
  `;
}
```

- [ ] **Step 5: 运行测试并提交**

Run:

```bash
python tests/check_login_render.py
python tests/check_workspace_shell.py
python tests/check_design_v2_completion.py
```

Expected:

- 三个脚本均通过

Commit:

```bash
git add static/app.js static/style.css tests/check_login_render.py tests/check_workspace_shell.py tests/check_design_v2_completion.py
git commit -m "feat: redesign login and product workspace hero"
```

---

### Task 3: 重做产品详情并用站内弹层替换库存 prompt

**Files:**
- Modify: `d:\kitchen-lab-kb\static\app.js`
- Modify: `d:\kitchen-lab-kb\static\style.css`
- Create: `d:\kitchen-lab-kb\tests\check_inventory_modal.py`
- Modify: `d:\kitchen-lab-kb\tests\check_design_v2_completion.py`

- [ ] **Step 1: 写库存弹层的失败测试**

新增 `tests/check_inventory_modal.py`：

```python
"""Smoke check that inventory adjustment uses in-app modal instead of prompt."""
from playwright.sync_api import sync_playwright

from helpers import post_json, run_server


def main():
    with run_server(8024) as base_url:
        login = post_json(base_url, "/api/login", {"用户名": "tester"})
        assert login["ok"] is True
        product = post_json(
            base_url,
            "/api/products",
            {"品号": "MODAL-1", "品名": "库存弹层产品", "规格": "100g", "当前数量": 5},
        )
        product_id = product["data"]["id"]
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(f"{base_url}/#/products/{product_id}", wait_until="networkidle")
            page.get_by_role("button", name="调整库存").click()
            assert page.locator(".inventory-modal").count() == 1
            assert page.locator("#inventory-delta").count() == 1
            assert page.locator("#inventory-reason").count() == 1
            browser.close()


if __name__ == "__main__":
    main()
```

在 `tests/check_design_v2_completion.py` 扩充：

```python
required_snippets.extend([
    "openInventoryModal",
    "inventory-modal",
    "inventory-delta",
    "inventory-reason",
])
```

- [ ] **Step 2: 运行测试确认当前仍在使用 `prompt`**

Run:

```bash
python tests/check_inventory_modal.py
python tests/check_design_v2_completion.py
```

Expected:

- 断言失败，且 `check_design_v2_completion.py` 报缺少新契约

- [ ] **Step 3: 把产品详情重组为工作区头部和双层内容区**

在 `renderProductDetail()` 内引入新的头部和信息区结构：

```javascript
const hero = this.renderPageHero({
  kicker: '产品详情',
  title: `${p.品号} ${p.品名}`,
  subtitle: `规格 ${p.规格} · 当前数量 ${p.当前数量}`,
  actions: `
    <div class="inline-actions">
      <button class="btn btn-primary" onclick="location.hash='#/recipes/new?product_id=${p.id}'">新建配方</button>
      <button class="btn btn-secondary" onclick="app.openInventoryModal(${p.id})">调整库存</button>
      <button class="btn btn-secondary" onclick="location.hash='#/products/${p.id}/edit'">编辑</button>
    </div>
  `
});
```

把库存流水和 tab 内容容器包进新的工作区面板：

```javascript
el.innerHTML = `
  ${hero}
  <section class="detail-workspace">
    <div class="detail-primary">...</div>
    <div class="detail-secondary">...</div>
  </section>
`;
```

- [ ] **Step 4: 实现库存站内弹层和提交逻辑**

把 `adjustInventory()` 替换为 `openInventoryModal()` + `submitInventoryModal()`：

```javascript
openInventoryModal(id) {
  const body = `
    <div class="inventory-modal">
      <label class="field-label" for="inventory-delta">变动数量</label>
      <input id="inventory-delta" class="input" type="number" step="any" placeholder="消耗请填负数">
      <label class="field-label" for="inventory-reason">变动原因</label>
      <textarea id="inventory-reason" class="input" placeholder="请输入原因"></textarea>
      <div id="inventory-error" class="field-error hide"></div>
    </div>
  `;
  this.modal('调整库存', body, () => this.submitInventoryModal(id), '确认调整');
},

async submitInventoryModal(id) {
  const delta = parseFloat(document.getElementById('inventory-delta').value || '0');
  const reason = document.getElementById('inventory-reason').value.trim();
  const errEl = document.getElementById('inventory-error');
  if (!delta) {
    errEl.textContent = '库存变动数量必须是非零数字';
    errEl.classList.remove('hide');
    throw new Error('inventory modal validation');
  }
  const r = await this.post(`/api/products/${id}/inventory-adjust`, { 变动数量: delta, 原因: reason });
  if (!r.ok) {
    errEl.textContent = r.error || '库存调整失败';
    errEl.classList.remove('hide');
    throw new Error('inventory modal submit failed');
  }
  this.toast(`库存已更新: ${r.data.变动后}`);
  this.closeModal();
  this.route();
}
```

同时把 `modal()` 改成支持 HTML body：

```javascript
modal(title, body, onConfirm, confirmText = '确认', isDanger = false, options = {}) {
  const isHtml = options.allowHtml === true;
  ...
  <div class="modal-body">${isHtml ? body : this.escapeHtml(body)}</div>
}
```

调用库存弹层时传 `{ allowHtml: true }`。

- [ ] **Step 5: 运行测试并提交**

Run:

```bash
python tests/check_inventory_modal.py
python tests/check_design_v2_completion.py
```

Expected:

- 两个脚本均通过

Commit:

```bash
git add static/app.js static/style.css tests/check_inventory_modal.py tests/check_design_v2_completion.py
git commit -m "feat: redesign product detail and inventory modal"
```

---

### Task 4: 重做配方录入、配方详情和成功率页面

**Files:**
- Modify: `d:\kitchen-lab-kb\static\app.js`
- Modify: `d:\kitchen-lab-kb\static\style.css`
- Modify: `d:\kitchen-lab-kb\tests\check_design_v2_completion.py`

- [ ] **Step 1: 先写新的静态契约失败检查**

在 `tests/check_design_v2_completion.py` 追加必须出现的片段：

```python
required_snippets.extend([
    "recipe-editor-shell",
    "recipe-section",
    "recipe-status-panel",
    "success-rate-hero",
    "success-rate-panel",
    "renderEmptyState",
])
```

- [ ] **Step 2: 运行测试确认这些结构还不存在**

Run:

```bash
python tests/check_design_v2_completion.py
```

Expected:

- 报告缺少新增片段

- [ ] **Step 3: 重做配方录入与详情结构**

在 `renderRecipeForm()` 中把三段式结构显式化：

```javascript
el.innerHTML = `
  <div class="recipe-editor-shell">
    <section class="card recipe-section">...</section>
    <section class="card recipe-section">...</section>
    <section class="card recipe-section recipe-status-panel">...</section>
  </div>
`;
```

原料表格上方增加更明确的控制区：

```javascript
<div class="panel-heading">
  <div>
    <h3>原料 / 辅料</h3>
    <p class="page-subtitle">按试验录入组合，保留常用名称与单位建议</p>
  </div>
  <button class="btn btn-secondary" onclick="app.addMatRow()">添加行</button>
</div>
```

在 `renderRecipeDetail()` 中把头部信息与同组合历史改成工作区层级：

```javascript
const hero = this.renderPageHero({
  kicker: '配方详情',
  title: d.配方名称 || '未命名配方',
  subtitle: `状态 ${this.statusText(d.状态)} · 日期 ${d.试验日期}`,
  actions: `
    <div class="inline-actions">
      <button class="btn btn-primary" onclick="app.duplicateRecipe(${d.id})">复制配方</button>
      <button class="btn btn-secondary" onclick="location.hash='#/recipes/${d.id}/edit'">编辑</button>
      <button class="btn btn-danger" onclick="app.deleteRecipe(${d.id})">删除</button>
    </div>
  `
});
```

- [ ] **Step 4: 重做成功率页头部、筛选层级和历史展开视觉**

在 `renderSuccessRate()` 中把筛选和结果包成工作台式主任务区与数据面板：

```javascript
const hero = this.renderPageHero({
  kicker: '成功率工作台',
  title: '按配方组合查看试验成功率',
  subtitle: '优先定位试验次数足够、成功率更稳定的组合',
  content: `
    <div class="success-rate-hero">
      <select class="input" id="sr-product" onchange="app.searchSuccessRate()">${options}</select>
      <input class="input" id="sr-min-trials" type="number" min="1" step="1" placeholder="最少试验次数" value="${this.escapeHtml(minTrials)}">
      <button class="btn btn-secondary" onclick="location.hash='#/success-rate'">重置</button>
      <button class="btn btn-primary" onclick="app.searchSuccessRate()">查询</button>
    </div>
  `
});

el.innerHTML = `
  ${hero}
  ${this.successRateHelp()}
  <section class="card success-rate-panel">...</section>
`;
```

补 CSS 以维持桌面端双层视觉：

```css
.recipe-editor-shell,
.success-rate-hero {
  display: grid;
  gap: 16px;
}

.recipe-section,
.success-rate-panel {
  border-radius: 24px;
}

.recipe-status-panel .radio-row {
  gap: 12px;
}
```

- [ ] **Step 5: 运行测试并提交**

Run:

```bash
python tests/check_design_v2_completion.py
python tests/check_login_render.py
python tests/check_workspace_shell.py
python tests/check_inventory_modal.py
```

Expected:

- 四个脚本均通过

Commit:

```bash
git add static/app.js static/style.css tests/check_design_v2_completion.py
git commit -m "feat: redesign recipe and success-rate workspaces"
```

---

### Task 5: 统一反馈组件、菜单和最终回归

**Files:**
- Modify: `d:\kitchen-lab-kb\static\app.js`
- Modify: `d:\kitchen-lab-kb\static\style.css`
- Modify: `d:\kitchen-lab-kb\tests\check_design_v2_completion.py`
- Modify: `d:\kitchen-lab-kb\README.md`

- [ ] **Step 1: 先写最终共享 UI 契约**

在 `tests/check_design_v2_completion.py` 继续补充：

```python
required_snippets.extend([
    "renderEmptyState",
    "modal-body",
    "toast-success",
    "toast-error",
    "export-menu",
    "workspace-topbar",
])
```

在 README 的界面预览段准备更新说明位，确保文档也会同步：

```markdown
### 桌面工作台

界面已升级为桌面工作台布局，核心页面包括登录页、产品工作台、产品详情、配方录入和成功率查询。
```

- [ ] **Step 2: 运行契约测试确认还有收尾工作**

Run:

```bash
python tests/check_design_v2_completion.py
```

Expected:

- 如果共享 UI 方法或结构未统一到位，则这里失败

- [ ] **Step 3: 统一 toast、modal、空状态、菜单的视觉和调用方式**

在 `static/app.js` 中确保所有页面都只用共享 UI 方法：

```javascript
toast(msg, type = 'success') {
  const box = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = `toast toast-${type}`;
  div.innerHTML = `
    <div class="toast-title">${type === 'error' ? '操作失败' : '操作完成'}</div>
    <div class="toast-message">${this.escapeHtml(msg)}</div>
  `;
  box.appendChild(div);
  setTimeout(() => div.remove(), 2600);
}
```

在 `static/style.css` 中统一共享组件：

```css
.toast,
.modal,
.export-menu {
  border-radius: 22px;
  box-shadow: var(--surface-shadow);
}

.toast-title {
  font-weight: 700;
  margin-bottom: 4px;
}

.system-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
```

README 只做简短同步，不新增与实现不符的截图描述。

- [ ] **Step 4: 运行完整回归**

Run:

```bash
python tests/check_login_render.py
python tests/check_workspace_shell.py
python tests/check_inventory_modal.py
python tests/check_design_v2_completion.py
python -m py_compile startup.py app.py export.py import_data.py shutdown.py auth.py backup.py db.py
```

Expected:

- 所有脚本通过
- `py_compile` 无报错

- [ ] **Step 5: 提交最终改造结果**

```bash
git add static/app.js static/style.css templates/base.html tests/check_login_render.py tests/check_workspace_shell.py tests/check_inventory_modal.py tests/check_design_v2_completion.py README.md
git commit -m "feat: finish kitchen lab workspace redesign"
```

---

## 自检

### Spec coverage

- 全局框架、左侧栏、顶部系统区：Task 1
- 登录页与产品列表主任务区：Task 2
- 产品详情与库存弹层：Task 3
- 配方录入、配方详情、成功率页：Task 4
- 共享反馈组件与最终回归：Task 5

### Placeholder scan

- 无 `TODO` / `TBD`
- 每个任务均包含明确文件、测试命令、实现代码片段和提交命令

### Type consistency

- 壳层命名统一使用 `workspace-*`
- 主任务区统一使用 `renderPageHero()` 与 `page-hero*`
- 库存弹层统一使用 `openInventoryModal()`、`inventory-delta`、`inventory-reason`

