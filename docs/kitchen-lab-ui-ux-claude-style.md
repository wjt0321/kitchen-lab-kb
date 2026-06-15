# 样品库 UI-UX 升级方案 — 吸纳 agent-cowork 设计系统

> 日期：2026-06-15  
> 前提：保持 Tabler CSS 布局能力，不改 JS 逻辑，只换视觉层  
> 目标：把 agent-cowork 的 Claude-inspired 设计语言注入样品库  
> 基线文件：`D:\kitchen-lab-kb\static\style.css`

---

## 1. agent-cowork 设计系统提炼

从 `moonlit-uikit/src/gpui_ui.rs` 源码中提取了一套完整的 **Claude 风格设计令牌**，分为四层：

### 1.1 色彩系统

```
                    light                  dark
──────────────────────────────────────────────────
背景 (bg)          #faf9f5 (奶油白)        #1c1b18
沉入背景 (bg_sunk) #f3f1e9 (暖灰)          #181715
卡片/面板 (bg_panel) #ffffff               #232220
主文字 (text)      #2a2724 (深褐)          #ece8df
次要文字 (text_2)  #5a564f                 #b8b3a7
三级文字 (text_3)  #8a857c                 #8a857c
占位文字 (text_4)  #b3ad9f                 #5a564f
边框 (line)        rgba(42,39,36,0.09)     rgba(255,255,255,0.07)
强调边框 (line_strong) rgba(42,39,36,0.14) rgba(255,255,255,0.13)

主强调 (accent)    #c96442 (暖琥珀)         #e2886a
强调软 (accent_soft) #e2886a               #f0a586
强调背景 (accent_bg) rgba(201,100,66,0.08)  rgba(226,136,106,0.14)

第二强调 (sage)    #6a8f7a (鼠尾草绿)       #8eb39d
危险 (danger)      #b4503b                 #d97a63
警告 (warn)        #b28632                 #d4ab57
信息 (info)        #4e6b89                 #7da0c4
```

**核心色调**：不是 Bootstrap 蓝，不是灰色调，而是 **奶油暖底 + 琥珀强调 + 鼠尾草绿辅色**。这是 agent-cowork 看起来"高级"的最直接原因。

### 1.2 字体栈

```css
font-family-sans:  "HarmonyOS Sans SC", "Microsoft YaHei UI", sans-serif;
font-family-serif: "Noto Serif SC", serif;
font-family-mono:  "JetBrains Mono", "Consolas", monospace;
```

Windows 上实际走 `Microsoft YaHei UI`（比普通微软雅黑更紧凑），配合奶油底色，视觉上干净利落。

### 1.3 间距与圆角系统

从代码注释中提取的实际值：

| 元素 | 值 |
|---|---|
| 卡片圆角 | `14px` |
| 按钮/输入圆角 | `6px~8px` |
| 标准间距 | `6px`, `10px`, `16px` |
| 卡片阴影 | 极浅 (`shadow(sh1())`) |
| 面板内边距 | `10px 16px 14px` |
| 边框宽度 | `1px` |
| tab 高度 | `34px` |

### 1.4 状态标识

```css
● running  #c96442 (琥珀)     ● done     #6a8f7a (鼠尾草绿)
● idle     #b3ad9f (浅灰)     ● blocked  #b4503b (暗红)
● queued   #b28632 (暗金)
```

---

## 2. 样品库当前 Tabler CSS 的色板差距

Tabler CSS 默认是 Bootstrap 调色板：

| Tabler 默认 | agent-cowork |
|---|---|
| 蓝底 (`--tblr-primary`) | 琥珀强调 (`#c96442`) |
| 纯白 + 灰白 (`#f5f7fb`) | 奶油白 (`#faf9f5`) + 暖灰 (`#f3f1e9`) |
| 冷感灰色文字 | 暖褐文字 (`#2a2724 → #5a564f`) |
| 高对比边框 | 极低对比边框 (`rgba(42,39,36,0.09)`) |

**根本差别**：Tabler 是"标准后台蓝"，agent-cowork 是"纸质感暖调"。后者看起来更舒服，因为色温接近自然光下的纸张。

---

## 3. 升级方案：不换框架，只换视觉

### 策略

- **保留 Tabler CSS**：表格、网格、表单、响应式基础全部不动
- **新增 CSS 变量覆盖层**：用 `:root` 覆盖 Tabler 的色彩变量
- **新增自定义组件样式**：statusdot、kbd、tab-accent、toast 等
- **替换 CDN 字体**（可选）：去掉 Tabler Icons，用少量内联 SVG 替代
- **不改 JS**：`app.js` 零修改

### 3.1 落地方案：`style.css` 改版内容

当前 `style.css?v=tabler-20260609-2` 是目前唯一的自定义样式入口。建议升级为 `style.css?v=claude-20260615`，内容如下：

```css
/* ================================================================
   样品库 Claude 风格主题 — 基于 agent-cowork moonlit-uikit 令牌
   覆盖 Tabler CSS 色彩 & 新增组件
   ================================================================ */

/* ── 1. 核心色彩覆盖 ───────────────────────────────────────── */

:root {
  /* --- 表面 --- */
  --tblr-body-bg:          #faf9f5;      /* bg */
  --tblr-body-color:       #2a2724;      /* text */
  --tblr-bg-surface:       #ffffff;      /* bg_panel */
  --tblr-bg-surface-secondary: #f3f1e9;  /* bg_sunk */
  --tblr-border-color:     rgba(42,39,36,0.09); /* line */

  /* --- 主色调：从 Bootstrap 蓝 → 暖琥珀 --- */
  --tblr-primary:          #c96442;
  --tblr-primary-rgb:      201, 100, 66;
  --tblr-primary-darken:   #b05638;
  --tblr-primary-fg:       #ffffff;       /* 琥珀底上白字 */

  /* --- 语义色 --- */
  --tblr-secondary:        #6a8f7a;       /* sage */
  --tblr-danger:           #b4503b;
  --tblr-warning:          #b28632;
  --tblr-success:          #6a8f7a;
  --tblr-info:             #4e6b89;

  /* --- 文字层级 --- */
  --tblr-muted:            #8a857c;       /* text_3 */
  --tblr-body-color-rgb:   42, 39, 36;

  /* --- 卡片 --- */
  --tblr-card-bg:          #ffffff;
  --tblr-card-border-color: rgba(42,39,36,0.09);
  --tblr-card-border-radius: 14px;
  --tblr-card-box-shadow:  0 1px 3px rgba(0,0,0,0.04);

  /* --- 输入 --- */
  --tblr-input-bg:         #ffffff;
  --tblr-input-border-color: rgba(42,39,36,0.14);
  --tblr-input-border-radius: 8px;
  --tblr-input-focus-border-color: rgba(201,100,66,0.42);

  /* --- 按钮 --- */
  --tblr-btn-border-radius: 8px;

  /* --- 表格 --- */
  --tblr-table-bg:         transparent;
  --tblr-table-border-color: rgba(42,39,36,0.07);
  --tblr-table-striped-bg: rgba(42,39,36,0.02);
  --tblr-table-hover-bg:   rgba(42,39,36,0.04);

  /* --- 导航 --- */
  --tblr-navbar-bg:        #f3f1e9;
  --tblr-dark-mode-border-color: rgba(255,255,255,0.07);
}

/* ── 2. 字体优化 ────────────────────────────────────────────── */

body {
  font-family: "HarmonyOS Sans SC", "Microsoft YaHei UI", -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.56;
  -webkit-font-smoothing: antialiased;
}

code, pre, .text-mono {
  font-family: "JetBrains Mono", "Consolas", "Cascadia Code", monospace;
  font-size: 13px;
}

/* ── 3. 侧边栏 Claude 风格化 ─────────────────────────────────── */

#sidebar {
  background: #f3f1e9;           /* bg_sunk */
  border-right: 1px solid rgba(42,39,36,0.09);
  width: 240px;
}

#sidebar .nav-link {
  color: #5a564f;               /* text_2 */
  border-radius: 6px;
  padding: 6px 12px;
  margin: 2px 6px;
  font-size: 13px;
}

#sidebar .nav-link:hover {
  background: rgba(42,39,36,0.04);
  color: #2a2724;
}

#sidebar .nav-link.active {
  background: rgba(201,100,66,0.08);  /* accent_bg */
  color: #c96442;                    /* accent */
  font-weight: 600;
}

/* 侧边栏分隔线 */
#sidebar .nav-divider {
  border-top: 1px solid rgba(42,39,36,0.07);
  margin: 8px 12px;
}

/* ── 4. 按钮风格 ────────────────────────────────────────────── */

.btn-primary {
  background: #c96442;
  border-color: #c96442;
  color: #ffffff;
  font-weight: 500;
  border-radius: 8px;
}
.btn-primary:hover {
  background: #b05638;
  border-color: #b05638;
}

.btn-outline-secondary {
  color: #5a564f;
  border-color: rgba(42,39,36,0.14);
  border-radius: 8px;
}
.btn-outline-secondary:hover {
  background: rgba(42,39,36,0.04);
  color: #2a2724;
}

/* ── 5. 表格优化 ────────────────────────────────────────────── */

.table {
  font-size: 13px;
  color: #2a2724;
}
.table thead th {
  font-size: 12px;
  font-weight: 600;
  color: #8a857c;              /* text_3 */
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(42,39,36,0.09);
  padding: 10px 12px;
}
.table tbody td {
  padding: 8px 12px;
  border-color: rgba(42,39,36,0.07);
}
.table tbody tr:hover {
  background: rgba(42,39,36,0.04);
}

/* ── 6. 表单控件 ────────────────────────────────────────────── */

.form-control, .form-select {
  border-radius: 8px;
  border-color: rgba(42,39,36,0.14);
  font-size: 13px;
}
.form-control:focus, .form-select:focus {
  border-color: rgba(201,100,66,0.42);    /* accent_ring */
  box-shadow: 0 0 0 3px rgba(201,100,66,0.12);
}
.form-label {
  font-size: 12px;
  font-weight: 600;
  color: #5a564f;
  margin-bottom: 4px;
}

/* ── 7. 卡片/面板 ────────────────────────────────────────────── */

.card {
  border-radius: 14px;
  border: 1px solid rgba(42,39,36,0.09);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.card-header {
  background: transparent;
  border-bottom: 1px solid rgba(42,39,36,0.09);
  font-weight: 600;
  font-size: 14px;
  padding: 14px 16px;
}
.card-body {
  padding: 16px;
}

/* ── 8. 状态圆点组件 ─────────────────────────────────────────── */

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  flex-shrink: 0;
}
.status-dot--active   { background: #c96442; }  /* running */
.status-dot--success  { background: #6a8f7a; }  /* done / 成功 */
.status-dot--failed   { background: #b4503b; }  /* 失败 */
.status-dot--pending  { background: #b28632; }  /* pending / 待处理 */
.status-dot--idle     { background: #b3ad9f; }  /* 空闲 / 未知 */

/* ── 9. 键盘快捷键提示 ──────────────────────────────────────── */

kbd, .kbd {
  display: inline-block;
  padding: 1px 5px;
  font-size: 11px;
  font-family: "JetBrains Mono", "Consolas", monospace;
  color: #8a857c;
  background: rgba(42,39,36,0.06);
  border: 1px solid rgba(42,39,36,0.09);
  border-radius: 4px;
  line-height: 1.4;
}

/* ── 10. 页面标题 ────────────────────────────────────────────── */

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #2a2724;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #8a857c;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

/* ── 11. 徽章/标签 ───────────────────────────────────────────── */

.badge {
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  padding: 2px 8px;
}
.badge.bg-success    { background: rgba(106,143,122,0.12) !important; color: #6a8f7a; }
.badge.bg-danger     { background: rgba(180,80,59,0.10)  !important; color: #b4503b; }
.badge.bg-warning    { background: rgba(178,134,50,0.12)  !important; color: #b28632; }
.badge.bg-primary    { background: rgba(201,100,66,0.10)  !important; color: #c96442; }

/* ── 12. Toast 消息 ──────────────────────────────────────────── */

#toast-container .toast {
  border-radius: 10px;
  border: 1px solid rgba(42,39,36,0.09);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  font-size: 13px;
}

/* ── 13. 快捷操作条（列表页顶部）───────────────────────────────── */

.action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
}

.action-bar .btn {
  font-size: 13px;
  padding: 5px 12px;
}

/* ── 14. 轻量分割线 ──────────────────────────────────────────── */

.hr-light {
  border: none;
  border-top: 1px solid rgba(42,39,36,0.07);
  margin: 12px 0;
}

/* ── 15. Tabler 内置组件覆盖 ──────────────────────────────────── */

/* 导航栏顶条 */
.navbar {
  border-bottom: 1px solid rgba(42,39,36,0.09);
}

/* 分页 */
.page-link {
  border-radius: 6px;
  color: #5a564f;
  border-color: rgba(42,39,36,0.09);
  font-size: 13px;
}
.page-item.active .page-link {
  background: #c96442;
  border-color: #c96442;
}

/* 下拉菜单 */
.dropdown-menu {
  border-radius: 10px;
  border: 1px solid rgba(42,39,36,0.09);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  font-size: 13px;
  padding: 4px;
}
.dropdown-item {
  border-radius: 6px;
  padding: 6px 12px;
}
.dropdown-item:hover {
  background: rgba(42,39,36,0.04);
}

/* 模态框 */
.modal-content {
  border-radius: 14px;
  border: 1px solid rgba(42,39,36,0.09);
}
.modal-header {
  border-bottom: 1px solid rgba(42,39,36,0.09);
  padding: 14px 16px;
}

/* ── 16. 暗色模式（可选，后续开启）────────────────────────────── */

/* html[data-bs-theme="dark"] 或 .theme-dark 时切换 */
@media (prefers-color-scheme: dark) {
  /*
   * 暗色模式暂不启用，等教主明确需要时再补。
   * 令牌已备好（见上文 1.1），核心是 bg→#1c1b18, accent→#e2886a
   */
}
```

### 3.2 改完后 base.html 的变化

只改一行：

```html
<!-- 改前 -->
<link rel="stylesheet" href="/static/style.css?v=tabler-20260609-2">

<!-- 改后 -->
<link rel="stylesheet" href="/static/style.css?v=claude-20260615">
```

### 3.3 不改的部分

| 不改 | 原因 |
|---|---|
| `base.html` 引用的 Tabler CSS CDN | 继续要它的表格/表单/响应式基础 |
| `app.js` | 零行改动 |
| 所有 HTML 结构 | CSS 变量覆盖足够，不需要动 DOM |
| 后端 API | 不碰 |
| 现有路由 | 不动 |

---

## 4. 效果预期

改完后，样品库的视觉风格会发生这些变化：

| 区域 | 改前（Tabler 默认） | 改后（Claude 风格） |
|---|---|---|
| 整体底色 | 冷白/灰白 | 奶油白暖底 |
| 侧边栏 | 深色/蓝色调 | 暖灰沉入色 |
| 主按钮 | Bootstrap 蓝 | 暖琥珀 |
| 表格 | 高对比边框 | 极低对比线条 |
| 标题/文字 | 纯黑 | 深褐带暖 |
| 卡片 | 直角/小圆角 | 14px 大圆角 + 浅阴影 |
| 成功色 | Boostrap 绿 | 鼠尾草绿 |
| 危险色 | Bootstrap 红 | 暗陶土红 |
| 整体感受 | "这是一个后台管理系统" | "这是一个有温度的桌面工具" |

---

## 5. 实施顺序

不需要一次性全改，建议三步走：

### 第一步：色彩覆盖（15 分钟）

把 CSS 第 1 节「核心色彩覆盖」的变量放进 `style.css` 最顶部，刷新页面，立刻看到整体色调变化。这一步最赚。

### 第二步：组件微调（20 分钟）

依次加入侧边栏、按钮、表格、表单、卡片的覆盖样式。每加一块刷新一次，感受变化。

### 第三步：新增组件（15 分钟）

加入 status-dot、kbd、badge 覆盖、section-title 等。这些是锦上添花。

全部改完预计 **50 分钟**，不需要动 JS、不需要装任何新依赖。

---

## 6. 和 agent-cowork 的差异对照（视觉层）

| 维度 | agent-cowork | 样品库改版后 |
|---|---|---|
| UI 框架 | GPUI（原生渲染） | HTML + Tabler CSS |
| 色彩系统 | `Tokens` struct → Rgba | CSS 变量 1:1 映射 |
| 字体 | HarmonyOS Sans SC + YaHei UI | 同 |
| 圆角 | 6~14px | 同（CSS 覆盖） |
| 阴影 | `shadow(sh1())` | CSS box-shadow |
| 状态点 | `dot_for_status()` | `.status-dot--*` class |
| 快捷键提示 | `kbd()` 组件 | `<kbd>` 标签样式 |
| 主题切换 | Rust 逻辑 | CSS 媒体查询（预留） |
| 交付方式 | 编译 exe | 扔进 `style.css` |

---

## 7. 风险与边界

- **不改 JS**：这意味着 `app.js` 里的动态生成 HTML 不会自动获得新 class（如 `status-dot`）。如果后续要在配方列表里加状态圆点，需要 JS 侧配合加 class，但现阶段可以只在静态 HTML 上用。
- **Tabler 版本**：当前 CDN 引的 `@tabler/core@1.0.0-beta21`。如果未来升级 Tabler，需要检查变量名是否变化。
- **暗色模式**：暂不启用。如果以后需要，CSS 变量已经备好，加一个 `data-bs-theme="dark"` 切换 + 对应颜色覆盖即可。
- **字体依赖**：`HarmonyOS Sans SC` 在 Windows 上不可用时会 fallback 到 `Microsoft YaHei UI`，实际效果仍然是干净的。

---

## 8. 总结

> **一份 CSS 文件，零依赖，零 JS 改动，50 分钟把样品库从"后台蓝"变成"Claude 暖调工作台"。**

agent-cowork 的 UI-UX 精华，现在可以用纯 CSS 变量 + 少量自定义样式落地到你的样品库上了。
