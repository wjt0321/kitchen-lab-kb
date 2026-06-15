// ===== App =====
const app = {
  user: localStorage.getItem('username') || '',
  currentPage: '',

  // Workbench tabs
  tabs: [],
  activeTabId: null,
  selectedProductIds: new Set(),
  statusClock: null,
  iconObserver: null,
  drawerOpen: false,

  init() {
    this.user = localStorage.getItem('username') || '';
    const route = this.routeFromLocation();
    if (this.user && route.path === '/login') {
      location.hash = '#/products';
    }
    if (!this.user && route.path !== '/login') {
      location.hash = '#/login';
    }
    this.setupLocalIconObserver();
    this.startStatusClock();
    this.updateShell();
    this.route();
    window.addEventListener('hashchange', () => this.route());
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('export-menu');
      if (menu && !menu.contains(e.target) && !e.target.closest('[onclick*="toggleExportMenu"]')) {
        menu.classList.add('hide');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      this.closeModal();
      this.closeExportMenu();
      this.toggleSidebarDrawer(false);
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 991) this.toggleSidebarDrawer(false);
    });
  },

  setupLocalIconObserver() {
    if (this.iconObserver || !document.body || typeof MutationObserver === 'undefined') return;
    this.iconObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          this.renderLocalIcons(node);
        });
      });
    });
    this.iconObserver.observe(document.body, { childList: true, subtree: true });
  },

  iconSvg(name) {
    const icons = {
      'alert-circle': '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><circle cx="12" cy="16.5" r="1"></circle>',
      archive: '<path d="M4 7h16v4H4z"></path><path d="M6 11v7h12v-7"></path><path d="M10 14h4"></path><path d="M5 7l1-3h12l1 3"></path>',
      box: '<path d="m4 7 8-4 8 4-8 4-8-4Z"></path><path d="M4 7v10l8 4 8-4V7"></path><path d="M12 11v10"></path>',
      'chart-bar': '<path d="M5 19V9"></path><path d="M12 19V5"></path><path d="M19 19v-8"></path><path d="M4 19h16"></path>',
      'checklist': '<path d="M9 6h10"></path><path d="M9 12h10"></path><path d="M9 18h10"></path><path d="m4.5 6 1.5 1.5 2.5-3"></path><path d="m4.5 12 1.5 1.5 2.5-3"></path><path d="m4.5 18 1.5 1.5 2.5-3"></path>',
      'chevron-down': '<path d="m6 9 6 6 6-6"></path>',
      'chevron-left': '<path d="m15 6-6 6 6 6"></path>',
      'chevron-right': '<path d="m9 6 6 6-6 6"></path>',
      clock: '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v5l3 2"></path>',
      copy: '<rect x="9" y="9" width="10" height="11" rx="2"></rect><rect x="5" y="4" width="10" height="11" rx="2"></rect>',
      database: '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"></ellipse><path d="M5 5.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"></path><path d="M5 11.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"></path>',
      'device-floppy': '<path d="M5 4h12l2 2v14H5z"></path><path d="M8 4v6h8V4"></path><path d="M9 19v-5h6v5"></path>',
      download: '<path d="M12 4v10"></path><path d="m8.5 11.5 3.5 3.5 3.5-3.5"></path><path d="M5 19h14"></path>',
      edit: '<path d="M4 20h4l10-10-4-4L4 16v4"></path><path d="m12 6 4 4"></path>',
      'file-export': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path><path d="M10 12h7"></path><path d="m14 9 3 3-3 3"></path>',
      'file-import': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path><path d="M14 12H7"></path><path d="m10 9-3 3 3 3"></path>',
      'file-spreadsheet': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path><path d="M8 12h8"></path><path d="M8 16h8"></path><path d="M10 10v8"></path><path d="M14 10v8"></path>',
      'filter-off': '<path d="M4 5h16l-6 7v5l-4 2v-7z"></path><path d="m5 19 14-14"></path>',
      flask: '<path d="M10 3v5l-5 8a4 4 0 0 0 3.4 6h7.2a4 4 0 0 0 3.4-6l-5-8V3"></path><path d="M9 8h6"></path><path d="M8 15h8"></path>',
      history: '<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v4h4"></path><path d="M12 7v5l3 2"></path>',
      home: '<path d="m3 11 9-7 9 7"></path><path d="M5 10.5V20h14v-9.5"></path><path d="M9 20v-5h6v5"></path>',
      'info-circle': '<circle cx="12" cy="12" r="9"></circle><path d="M12 10v5"></path><circle cx="12" cy="7.5" r="1"></circle>',
      json: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path><path d="m10 10-2 2 2 2"></path><path d="m14 10 2 2-2 2"></path><path d="M12 9.5 11 14.5"></path>',
      list: '<path d="M8 6h12"></path><path d="M8 12h12"></path><path d="M8 18h12"></path><circle cx="4.5" cy="6" r="1"></circle><circle cx="4.5" cy="12" r="1"></circle><circle cx="4.5" cy="18" r="1"></circle>',
      login: '<path d="M14 4h5v16h-5"></path><path d="M10 12h9"></path><path d="m13 9 3 3-3 3"></path><path d="M5 4h5"></path><path d="M5 20h5"></path>',
      logout: '<path d="M10 4H5v16h5"></path><path d="M9 12h10"></path><path d="m16 9 3 3-3 3"></path>',
      plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
      refresh: '<path d="M20 11a8 8 0 0 0-14-4"></path><path d="M4 7V3h4"></path><path d="M4 13a8 8 0 0 0 14 4"></path><path d="M20 17v4h-4"></path>',
      search: '<circle cx="11" cy="11" r="6"></circle><path d="m20 20-4.2-4.2"></path>',
      trash: '<path d="M5 7h14"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 12h10l1-12"></path><path d="M9 7V4h6v3"></path>',
      user: '<circle cx="12" cy="8" r="4"></circle><path d="M5 20a7 7 0 0 1 14 0"></path>',
      'circle-check': '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16 9"></path>',
      'circle-x': '<circle cx="12" cy="12" r="9"></circle><path d="m9 9 6 6"></path><path d="m15 9-6 6"></path>',
    };
    const body = icons[name] || icons['info-circle'];
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  },

  renderIcon(name, className = '') {
    const classes = ['app-icon', `app-icon-${name}`, className].filter(Boolean).join(' ');
    return `<span class="${classes}" data-icon="${name}" aria-hidden="true">${this.iconSvg(name)}</span>`;
  },

  renderLocalIcons(root = document) {
    if (!root) return;
    const icons = [];
    if (typeof Element !== 'undefined' && root instanceof Element && root.matches('.ti')) {
      icons.push(root);
    }
    if (root.querySelectorAll) {
      icons.push(...root.querySelectorAll('.ti'));
    }
    icons.forEach((iconEl) => {
      const iconClass = Array.from(iconEl.classList).find((cls) => cls.startsWith('ti-') && cls !== 'ti');
      if (!iconClass) return;
      const name = iconClass.slice(3);
      if (iconEl.dataset.iconReady === 'true' && iconEl.dataset.iconName === name) return;
      iconEl.dataset.iconReady = 'true';
      iconEl.dataset.iconName = name;
      iconEl.setAttribute('aria-hidden', 'true');
      iconEl.innerHTML = this.iconSvg(name);
    });
  },

  renderBrandMark() {
    return `
      <span class="brand-mark">
        <img
          class="sidebar-brand-logo"
          src="/兴达logo.ico"
          alt=""
          loading="eager"
          onerror="this.classList.add('hide');this.nextElementSibling.classList.remove('hide');"
        >
        <span class="brand-fallback hide" aria-hidden="true">KL</span>
      </span>
    `;
  },

  // ===== Status bar =====
  startStatusClock() {
    if (this.statusClock) clearInterval(this.statusClock);
    this.statusClock = setInterval(() => this.updateStatusBar(), 1000);
  },

  renderStatusBar() {
    const bar = document.getElementById('statusbar');
    if (!bar) return;
    if (!bar.querySelector('#sb-time')) {
      bar.innerHTML = `
        <span>${this.renderIcon('checklist')} 选中 <strong id="sb-selected">0</strong> 条</span>
        <span>${this.renderIcon('database')} 上次备份 <strong id="sb-backup">--</strong></span>
        <span>${this.renderIcon('box')} 产品总数 <strong id="sb-total">--</strong></span>
        <div class="statusbar-spacer"></div>
        <span>${this.renderIcon('clock')} <span id="sb-time">--</span></span>
      `;
      this.refreshStatusTotals();
    }
    this.updateStatusBar();
  },

  updateStatusBar() {
    const selectedEl = document.getElementById('sb-selected');
    const backupEl = document.getElementById('sb-backup');
    const timeEl = document.getElementById('sb-time');

    if (selectedEl) selectedEl.textContent = this.selectedProductIds.size;
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }
    if (backupEl) {
      const last = localStorage.getItem('lastBackupAt');
      backupEl.textContent = last ? this.formatDateTime(new Date(last)) : '--';
    }
  },

  async refreshStatusTotals() {
    const totalEl = document.getElementById('sb-total');
    if (!totalEl) return;
    try {
      const r = await this.get('/api/products?status=全部&page_size=1');
      totalEl.textContent = r.ok ? (r.data.total || 0) : '--';
    } catch (_) {
      totalEl.textContent = '--';
    }
  },

  formatDateTime(d) {
    if (!d) return '--';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '--';
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  // ===== Workbench tabs =====
  getTabId(path) {
    if (path === '/products') return 'products';
    if (path === '/products/new') return 'product-new';
    if (path.match(/^\/products\/\d+\/edit$/)) return `product-edit-${path.split('/')[2]}`;
    if (path.match(/^\/products\/\d+$/)) return `product-${path.split('/')[2]}`;
    if (path === '/recipes/new') return 'recipe-new';
    if (path.match(/^\/recipes\/\d+\/edit$/)) return `recipe-edit-${path.split('/')[2]}`;
    if (path.match(/^\/recipes\/\d+$/)) return `recipe-${path.split('/')[2]}`;
    if (path === '/success-rate') return 'success-rate';
    return null;
  },

  getTabMeta(path, params = new URLSearchParams()) {
    const p = new URLSearchParams(params);
    if (path === '/products') return { id: 'products', title: '产品列表', icon: 'box' };
    if (path === '/products/new') return { id: 'product-new', title: '新增产品', icon: 'plus' };
    if (path.match(/^\/products\/\d+\/edit$/)) {
      const id = path.split('/')[2];
      return { id: `product-edit-${id}`, title: `编辑产品 #${id}`, icon: 'edit' };
    }
    if (path.match(/^\/products\/\d+$/)) {
      const id = path.split('/')[2];
      const tab = p.get('tab') === 'success' ? '成功率' : '配方';
      return { id: `product-${id}`, title: `产品 #${id}`, icon: 'box' };
    }
    if (path === '/recipes/new') return { id: 'recipe-new', title: '新增配方', icon: 'flask' };
    if (path.match(/^\/recipes\/\d+\/edit$/)) {
      const id = path.split('/')[2];
      return { id: `recipe-edit-${id}`, title: `编辑配方 #${id}`, icon: 'edit' };
    }
    if (path.match(/^\/recipes\/\d+$/)) {
      const id = path.split('/')[2];
      return { id: `recipe-${id}`, title: `配方 #${id}`, icon: 'flask' };
    }
    if (path === '/success-rate') return { id: 'success-rate', title: '成功率', icon: 'chart-bar' };
    return null;
  },

  getWorkbenchBody() {
    return document.getElementById('workbench-body');
  },

  getWorkbenchTabs() {
    return document.getElementById('workbench-tabs');
  },

  getTabContentContainer(id) {
    return document.getElementById(`tab-content-${id}`);
  },

  ensureTabContentContainer(id) {
    let el = this.getTabContentContainer(id);
    if (!el) {
      el = document.createElement('div');
      el.id = `tab-content-${id}`;
      el.className = 'tab-content-pane';
      const body = this.getWorkbenchBody();
      if (body) body.appendChild(el);
    }
    return el;
  },

  async openTab(path, params = new URLSearchParams()) {
    const meta = this.getTabMeta(path, params);
    if (!meta) return null;

    const existing = this.tabs.find(t => t.id === meta.id);
    if (existing) {
      const becameActive = existing.id !== this.activeTabId;
      existing.path = path;
      existing.params = params;
      this.activateTab(existing.id);
      if (!becameActive) {
        await this.renderActiveTab();
      }
      return existing;
    }

    const tab = { id: meta.id, path, params, meta };
    this.tabs.push(tab);
    this.ensureTabContentContainer(meta.id);
    this.activateTab(meta.id);
    await this.renderActiveTab();
    return tab;
  },

  activateTab(id) {
    if (!this.tabs.find(t => t.id === id)) return;
    this.activeTabId = id;
    this.renderTabs();
    this.tabs.forEach(t => {
      const el = this.getTabContentContainer(t.id);
      if (el) el.classList.toggle('hide', t.id !== id);
    });
  },

  closeTab(id, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);

    const el = this.getTabContentContainer(id);
    if (el) el.remove();

    if (this.activeTabId === id) {
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)] || this.tabs[this.tabs.length - 1];
      if (next) {
        this.activateTab(next.id);
        location.hash = '#' + next.path + (next.params.toString() ? '?' + next.params.toString() : '');
      } else {
        this.activeTabId = null;
        this.renderTabs();
        location.hash = '#/products';
      }
    } else {
      this.renderTabs();
    }
  },

  renderTabs() {
    const bar = this.getWorkbenchTabs();
    if (!bar) return;
    if (this.tabs.length === 0) {
      bar.innerHTML = '';
      return;
    }
    bar.innerHTML = this.tabs.map(t => {
      const active = t.id === this.activeTabId ? 'active' : '';
      return `
        <div class="workbench-tab ${active}" onclick="app.activateTab('${t.id}'); app.syncHashToTab('${t.id}');">
          ${this.renderIcon(t.meta.icon)}
          <span>${this.escapeHtml(t.meta.title)}</span>
          <button type="button" class="workbench-tab-close" onclick="app.closeTab('${t.id}', event)" aria-label="关闭">&times;</button>
        </div>
      `;
    }).join('');
  },

  syncHashToTab(id) {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return;
    const hash = '#' + tab.path + (tab.params.toString() ? '?' + tab.params.toString() : '');
    if (location.hash !== hash) location.hash = hash;
  },

  async renderActiveTab() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;
    const el = this.getTabContentContainer(tab.id);
    if (!el) return;
    const { path, params } = tab;

    if (path === '/products') await this.renderProducts(el, params);
    else if (path === '/products/new') await this.renderProductForm(el, null);
    else if (path.match(/^\/products\/\d+\/edit$/)) await this.renderProductForm(el, parseInt(path.split('/')[2]));
    else if (path.match(/^\/products\/\d+$/)) await this.renderProductDetail(el, parseInt(path.split('/')[2]), params);
    else if (path === '/recipes/new') await this.renderRecipeForm(el, null, params.get('product_id'));
    else if (path.match(/^\/recipes\/\d+\/edit$/)) await this.renderRecipeForm(el, parseInt(path.split('/')[2]));
    else if (path.match(/^\/recipes\/\d+$/)) await this.renderRecipeDetail(el, parseInt(path.split('/')[2]));
    else if (path === '/success-rate') await this.renderSuccessRate(el, params);
  },

  updateShell() {
    const route = this.routeFromLocation();
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const topbar = document.getElementById('topbar');
    const shell = document.getElementById('app-shell');
    const statusbar = document.getElementById('statusbar');
    const loggedIn = Boolean(this.user);
    const isLogin = route.path === '/login';

    if (sidebar) {
      sidebar.innerHTML = loggedIn ? this.renderSidebarNav(route.path) : '';
      sidebar.classList.toggle('hide', !loggedIn);
    }

    if (backdrop) {
      backdrop.classList.toggle('hide', !loggedIn || !this.drawerOpen);
    }

    if (topbar) {
      topbar.innerHTML = loggedIn ? this.renderTopbarActions() : '';
      topbar.classList.toggle('hide', isLogin);
    }

    if (shell) {
      shell.classList.toggle('page-guest', !loggedIn);
    }

    if (statusbar) {
      statusbar.classList.toggle('hide', isLogin || !loggedIn);
    }

    const tabBar = this.getWorkbenchTabs();
    if (tabBar) tabBar.classList.toggle('hide', !loggedIn || isLogin);

    this.renderStatusBar();
  },

  toggleSidebarDrawer(force) {
    this.drawerOpen = typeof force === 'boolean' ? force : !this.drawerOpen;
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar?.classList.toggle('sidebar-open', this.drawerOpen);
    backdrop?.classList.toggle('hide', !this.drawerOpen);
  },

  routeFromLocation() {
    if (location.hash && location.hash.startsWith('#/')) {
      const [path, query] = location.hash.substring(1).split('?');
      return { path, params: new URLSearchParams(query || '') };
    }
    const path = location.pathname === '/' ? '/products' : location.pathname;
    return { path, params: new URLSearchParams(location.search || '') };
  },

  async route() {
    const { path, params } = this.routeFromLocation();
    this.currentPage = path;
    if (path === '/login' && this.user) {
      location.hash = '#/products';
      return;
    }
    this.updateShell();

    const body = this.getWorkbenchBody();
    const tabBar = this.getWorkbenchTabs();
    if (!body) return;

    if (path === '/login') {
      if (tabBar) tabBar.classList.add('hide');
      body.innerHTML = '';
      this.tabs = [];
      this.activeTabId = null;
      this.renderLogin(body);
      return;
    }

    if (!this.user) {
      location.hash = '#/login';
      return;
    }

    if (tabBar) tabBar.classList.remove('hide');

    // Clear any direct-rendered content (e.g., login shell) when switching to tabbed views
    Array.from(body.children).forEach(child => {
      if (!child.classList.contains('tab-content-pane')) child.remove();
    });

    const tabId = this.getTabId(path);
    if (!tabId) {
      body.innerHTML = this.renderEmptyState({
        title: '页面不存在',
        body: '请从左侧导航重新选择工作区页面。',
        action: `<a class="btn btn-primary" href="#/products">${this.renderIcon('home', 'me-1')}返回产品工作台</a>`,
      });
      return;
    }

    await this.openTab(path, params);
  },

  // ===== API =====
  async api(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'X-Username': encodeURIComponent(this.user || '') } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return res.json();
  },
  get(url) { return this.api('GET', url); },
  post(url, body) { return this.api('POST', url, body); },
  put(url, body) { return this.api('PUT', url, body); },
  del(url) { return this.api('DELETE', url); },

  // ===== UI helpers =====
  toast(msg, type='success') {
    const box = document.getElementById('toast-container');
    if (!box) return;
    const bg = type === 'error' ? 'bg-danger' : type === 'info' ? 'bg-info' : 'bg-success';
    const icon = type === 'error' ? 'alert-circle' : type === 'info' ? 'info-circle' : 'circle-check';
    const titles = { success: '操作完成', error: '操作失败', info: '系统提示' };
    const w = document.createElement('div');
    w.className = `toast align-items-center text-white ${bg} border-0`;
    w.setAttribute('role', 'status');
    w.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    w.innerHTML = `<div class="d-flex"><div class="toast-body d-flex align-items-center gap-2">${this.renderIcon(icon, 'fs-4')}<div><strong class="toast-title">${this.escapeHtml(titles[type]||titles.info)}</strong><div class="toast-message">${this.escapeHtml(msg)}</div></div></div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    box.appendChild(w);
    const t = new bootstrap.Toast(w, { delay: 2600 });
    t.show();
    w.addEventListener('hidden.bs.toast', () => w.remove());
  },

  async copyText(text, successMsg='已复制', errorMsg='复制失败') {
    try {
      await navigator.clipboard.writeText(text);
      this.toast(successMsg);
      return true;
    } catch (error) {
      this.toast(errorMsg, 'error');
      return false;
    }
  },

  modal(title, body, onConfirm, confirmText='确认', isDanger=false, options = {}) {
    const box = document.getElementById('modal-container');
    const isHtml = options.allowHtml === true;
    const closeOnConfirm = options.closeOnConfirm !== false;
    box.innerHTML = `<div class="modal modal-blur fade" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">${this.escapeHtml(title)}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">${isHtml ? body : this.escapeHtml(body)}</div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">取消</button><button type="button" class="btn ${isDanger?'btn-danger':'btn-primary'}" id="modal-confirm">${this.escapeHtml(confirmText)}</button></div></div></div></div>`;
    const el = box.querySelector('.modal');
    const m = new bootstrap.Modal(el);
    m.show();
    document.getElementById('modal-confirm').onclick = async () => {
      try {
        const result = await onConfirm();
        if (result === false) return;
        if (closeOnConfirm) m.hide();
      } catch (error) {
        if (!error || error.expected !== true) {
          console.warn(error);
        }
      }
    };
    el.addEventListener('hidden.bs.modal', () => { box.innerHTML = ''; });
  },

  closeModal() {
    const el = document.querySelector('#modal-container .modal');
    if (el) bootstrap.Modal.getInstance(el)?.hide();
  },

  closeExportMenu() {
    document.getElementById('export-menu')?.classList.add('hide');
  },

  toggleExportMenu() {
    document.getElementById('export-menu')?.classList.toggle('hide');
  },

  renderExportMenu() {
    return `
      <div id="export-menu" class="dropdown-menu dropdown-menu-end show hide">
        <span class="dropdown-header">导出与模板</span>
        <button type="button" class="dropdown-item" onclick="app.exportExcel('products')">${this.renderIcon('file-spreadsheet', 'me-2')}导出产品列表</button>
        <button type="button" class="dropdown-item" onclick="app.exportExcel('recipes')">${this.renderIcon('file-spreadsheet', 'me-2')}导出配方记录</button>
        <button type="button" class="dropdown-item" onclick="app.exportExcel('success_rate')">${this.renderIcon('file-spreadsheet', 'me-2')}导出成功率</button>
        <button type="button" class="dropdown-item" onclick="app.exportJson()">${this.renderIcon('json', 'me-2')}导出 JSON</button>
        <div class="dropdown-divider"></div>
        <button type="button" class="dropdown-item" onclick="app.exportTemplate('products')">${this.renderIcon('download', 'me-2')}产品导入模板</button>
        <button type="button" class="dropdown-item" onclick="app.exportTemplate('recipes')">${this.renderIcon('download', 'me-2')}配方导入模板</button>
      </div>
    `;
  },

  renderSidebarNav(path) {
    const productActive = path.startsWith('/products');
    const recipeActive = path.startsWith('/recipes');
    const successActive = path.startsWith('/success-rate');
    const q = this.routeFromLocation().params.get('q') || '';
    return `
      <div class="sidebar-brand">
        ${this.renderBrandMark()}
        <div>
          <div class="sidebar-brand-title">样品库知识库</div>
          <div class="sidebar-brand-subtitle">Kitchen Lab</div>
        </div>
      </div>
      <div class="sidebar-search">
        <input class="form-control" id="sidebar-search" placeholder="搜索产品…" value="${this.escapeHtml(q)}" onkeydown="if(event.key==='Enter')app.sidebarSearch()">
      </div>
      <nav class="sidebar-nav">
        <a class="${productActive ? 'active' : ''}" href="#/products" onclick="app.toggleSidebarDrawer(false)">${this.renderIcon('box')}产品</a>
      </nav>
      <div class="sidebar-group">
        <div class="sidebar-group-title">产品管理</div>
        <nav class="sidebar-subnav">
          <a class="${path === '/products' ? 'active' : ''}" href="#/products" onclick="app.toggleSidebarDrawer(false)">${this.renderIcon('list')}全部产品</a>
          <a class="${path === '/products/new' ? 'active' : ''}" href="#/products/new" onclick="app.toggleSidebarDrawer(false)">${this.renderIcon('plus')}新增产品</a>
          <a class="${(new URLSearchParams(location.hash.split('?')[1]||'')).get('status')==='archived' ? 'active' : ''}" href="#/products?status=archived" onclick="app.toggleSidebarDrawer(false)">${this.renderIcon('archive')}已归档</a>
        </nav>
      </div>
      <div class="sidebar-group">
        <div class="sidebar-group-title">配方记录</div>
        <nav class="sidebar-subnav">
          <a class="${recipeActive && !path.includes('/new') ? 'active' : ''}" href="#/products" onclick="app.toggleSidebarDrawer(false)">${this.renderIcon('flask')}按产品查看</a>
          <a class="${successActive ? 'active' : ''}" href="#/success-rate" onclick="app.toggleSidebarDrawer(false)">${this.renderIcon('chart-bar')}成功率</a>
        </nav>
      </div>
      <div class="sidebar-footer">
        <div class="d-flex align-items-center gap-2 mb-2">
          <span class="avatar avatar-sm" style="background:var(--tblr-primary);color:#fff;">${this.renderIcon('user')}</span>
          <div class="flex-grow-1 min-width-0">
            <div class="fw-semibold text-truncate">${this.escapeHtml(this.user)}</div>
            <div class="text-muted-sm">已登录</div>
          </div>
        </div>
        <button class="btn btn-outline-danger btn-sm w-100" onclick="app.confirmExit()">${this.renderIcon('logout', 'me-1')}退出</button>
      </div>
    `;
  },

  sidebarSearch() {
    const q = document.getElementById('sidebar-search')?.value.trim() || '';
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    location.hash = '#/products' + (p.toString() ? '?' + p.toString() : '');
  },

  renderTopbarActions() {
    return `
      <div class="topbar-content">
        <div class="topbar-leading">
          <button class="btn btn-outline-secondary sidebar-drawer-toggle" onclick="app.toggleSidebarDrawer()">${this.renderIcon('list')}菜单</button>
        </div>
        <div class="topbar-spacer"></div>
        <div class="topbar-actions system-actions">
          <span class="topbar-user current-user">${this.renderIcon('user')}${this.escapeHtml(this.user)}</span>
          <button class="btn btn-outline-secondary" onclick="app.backup()">${this.renderIcon('database', 'me-1')}备份</button>
          <input id="import-file" class="hide" type="file" accept=".json,.zip,application/json,application/zip" onchange="app.importSelectedFile(this)">
          <button class="btn btn-outline-secondary" onclick="app.importData()">${this.renderIcon('file-import', 'me-1')}导入</button>
          <div class="dropdown">
            <button class="btn btn-outline-secondary" onclick="app.toggleExportMenu()">${this.renderIcon('file-export', 'me-1')}导出</button>
            ${this.renderExportMenu()}
          </div>
          <button class="btn btn-outline-danger" onclick="app.confirmExit()">${this.renderIcon('logout', 'me-1')}退出</button>
        </div>
      </div>
    `;
  },

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
  },

  renderEmptyState({ title, body, action = '', className = '' }) {
    const classes = ['empty-state', className].filter(Boolean).join(' ');
    return `
      <div class="${classes}">
        <h3>${this.escapeHtml(title)}</h3>
        <p>${this.escapeHtml(body)}</p>
        ${action}
      </div>
    `;
  },

  statusBadge(s) {
    const map = { active: ['活跃','badge-outline-success'], archived: ['已归档','badge-outline-archived'], success: ['成功','badge-outline-success'], failed: ['失败','badge-outline-failed'], pending: ['待观察','badge-outline-pending'] };
    const [text, cls] = map[s] || [s,''];
    return `<span class="badge ${cls}">${this.escapeHtml(text)}</span>`;
  },

  statusText(s) {
    const map = { active: '活跃', archived: '已归档', success: '成功', failed: '失败', pending: '待观察' };
    return map[s] || s || '-';
  },

  successRateHelp() {
    return `<div class="help-note">${this.renderIcon('info-circle', 'me-1')}成功率 = 同一配方组合下成功次数 / 成功或失败试验次数。只有 2 次及以上同组合试验才显示百分比，单次试验标记为样本不足。</div>`;
  },

  formatSuccessRate(item) {
    if (!item || item.成功率 == null || !item.试验次数) return '-';
    const trials = Number(item.试验次数 || 0);
    if (trials < 2) {
      return `<span class="rate-metric-sample">样本不足</span><span class="rate-note">${trials} 次试验</span>`;
    }
    const pct = Math.round((item.成功率 || 0) * 100);
    const barColor = pct>=80?'bg-success':pct>=50?'bg-primary':pct>=1?'bg-warning':'bg-danger';
    return `<span class="rate-metric">${pct}%</span><div class="progress progress-thin flex-grow-1"><div class="progress-bar ${barColor}" style="width:${pct}%"></div></div>`;
  },

  formatDate(d) {
    if (!d) return '-';
    return d.substring(0, 10);
  },

  renderIngredientRows(items = []) {
    if (!items.length) {
      return this.renderEmptyState({
        title: '暂无记录',
        body: '当前配方还没有这一类原料数据。',
      });
    }
    return `
      <div class="ingredient-list">
        ${items.map(m => `
          <div class="ingredient-row">
            <span>${this.escapeHtml(m.名称)}</span>
            <strong>${m.用量} ${this.escapeHtml(m.单位 || '')}</strong>
          </div>
        `).join('')}
      </div>
    `;
  },

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  },

  // ===== Auth =====
  async login() {
    const input = document.getElementById('login-user');
    const user = input.value.trim();
    if (!user) { input.classList.add('is-invalid'); return; }
    const r = await this.post('/api/login', { 用户名: user });
    if (r.ok) {
      this.user = user;
      localStorage.setItem('username', user);
      this.refreshStatusTotals();
      location.hash = '#/products';
    } else {
      this.toast(r.error || '登录失败', 'error');
    }
  },

  async logout() {
    await this.post('/api/logout');
    this.user = '';
    localStorage.removeItem('username');
    location.hash = '#/login';
  },

  // ===== Pages =====
  renderLogin(el) {
    const last = localStorage.getItem('username') || '';
    const safeLast = this.escapeHtml(last);
    el.innerHTML = `
      <div class="login-shell">
        <div class="login-card">
          ${this.renderPageHero({
            kicker: 'Kitchen Lab',
            title: '样品库知识库',
            subtitle: '研发样品、配方记录与成功率追踪工作台',
          })}
          <div class="login-form">
            <input id="login-user" class="form-control" placeholder="请输入用户名" value="${safeLast}" onkeydown="if(event.key==='Enter')app.login()">
            <button class="btn btn-primary w-100" onclick="app.login()">${this.renderIcon('login', 'me-2')}进入工作台</button>
            ${last?`<div class="login-last">${this.renderIcon('clock', 'me-1')}上次登录: ${safeLast}</div>`:''}
          </div>
        </div>
      </div>`;
    document.getElementById('login-user')?.focus();
  },

  async renderProducts(el, params) {
    const q = params.get('q') || '';
    const status = params.get('status') || 'active';
    const page = parseInt(params.get('page') || '1');
    const safeQ = this.escapeHtml(q);
    const r = await this.get(`/api/products?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${page}`);
    if (!r.ok) {
      el.innerHTML = this.renderEmptyState({
        title: '加载失败',
        body: r.error || '产品列表暂时无法加载，请稍后重试。',
      });
      return;
    }
    const { items, total, page_size } = r.data;
    const totalPages = Math.max(1, Math.ceil(total / page_size));

    // Reset selection when list reloads (but keep if same query/page? simpler: reset)
    this.selectedProductIds.clear();
    this.currentProducts = items || [];
    this.updateStatusBar();
    const totalEl = document.getElementById('sb-total');
    if (totalEl) totalEl.textContent = total || 0;

    let rows = '';
    if (items.length === 0) {
      rows = `<tr><td colspan="9">${this.renderEmptyState({
        title: q ? '没有找到匹配的产品' : '暂无产品',
        body: q ? '请尝试更换关键词，或清空筛选条件。' : '还没有录入任何产品。先新建一个产品，再记录配方试验。',
        action: q
          ? `<a class="btn btn-primary" href="#/products">${this.renderIcon('filter-off')} 清空筛选</a>`
          : `<a class="btn btn-primary" href="#/products/new">${this.renderIcon('plus')} 新建产品</a>`,
      })}</td></tr>`;
    } else {
      rows = items.map(p => `
        <tr class="${p.状态==='archived'?'archived':''}" onclick="if(!event.target.closest('a,button,input'))location.hash='#/products/${p.id}'">
          <td><input type="checkbox" class="form-check-input" value="${p.id}" onchange="app.toggleProductSelection(${p.id}, this.checked)" onclick="event.stopPropagation()"></td>
          <td><a href="#/products/${p.id}" onclick="event.stopPropagation()">${this.escapeHtml(p.品号)}</a></td>
          <td>${this.escapeHtml(p.品名)}</td>
          <td>${this.escapeHtml(p.规格)}</td>
          <td>${p.当前数量}</td>
          <td>${this.statusBadge(p.状态)}</td>
          <td>${p.配方数}</td>
          <td>${this.formatDate(p.created_at)}</td>
          <td>
            <div class="td-actions">
              <a class="btn btn-outline-secondary btn-sm" href="#/products/${p.id}" onclick="event.stopPropagation()">查看</a>
              ${p.状态==='active'?`
                <a class="btn btn-outline-secondary btn-sm" href="#/products/${p.id}/edit" onclick="event.stopPropagation()">编辑</a>
                <button class="btn btn-outline-warning btn-sm" onclick="event.stopPropagation();app.archiveProduct(${p.id})">归档</button>
              `:`
                <button class="btn btn-outline-secondary btn-sm" onclick="event.stopPropagation();app.restoreProduct(${p.id})">恢复</button>
                <button class="btn btn-outline-danger btn-sm" onclick="event.stopPropagation();app.deleteProduct(${p.id})">删除</button>
              `}
            </div>
          </td>
        </tr>
      `).join('');
    }

    const hero = this.renderPageHero({
      kicker: '产品工作台',
      title: '查找、管理并追踪样品产品',
      subtitle: '优先处理最常用的搜索、筛选和新建动作',
      content: `
        <div class="products-hero-search">
          <input class="form-control" id="prod-q" placeholder="输入品号或品名" value="${safeQ}" onkeydown="if(event.key==='Enter')app.searchProducts()">
          <select class="form-select" id="prod-status" onchange="app.searchProducts()">
            <option value="active" ${status==='active'?'selected':''}>活跃</option>
            <option value="archived" ${status==='archived'?'selected':''}>已归档</option>
            <option value="全部" ${status==='全部'?'selected':''}>全部</option>
          </select>
        </div>
      `,
      actions: `
        <div class="products-hero-actions">
          <button class="btn btn-outline-secondary" title="重置" onclick="location.hash='#/products'">${this.renderIcon('refresh', 'me-1')}重置</button>
        </div>
      `,
    });

    el.innerHTML = `
      ${hero}
      <div class="action-bar">
        <a class="btn btn-primary" href="#/products/new">${this.renderIcon('plus', 'me-1')}新增产品</a>
        <input id="action-import-file" class="hide" type="file" accept=".json,.zip,application/json,application/zip" onchange="app.importSelectedFile(this)">
        <button class="btn btn-outline-secondary" onclick="app.importData()">${this.renderIcon('file-import', 'me-1')}批量导入</button>
        <button class="btn btn-outline-warning" onclick="app.batchArchiveProducts()">${this.renderIcon('archive', 'me-1')}批量归档</button>
        <button class="btn btn-outline-secondary" onclick="app.exportSelectedProducts()">${this.renderIcon('file-export', 'me-1')}导出选中</button>
      </div>
      <div class="card products-panel">
        <div class="card-header">
          <div>
            <h3 class="card-title">产品列表</h3>
            <div class="text-muted-sm">共 ${total} 条记录，默认显示最活跃的产品数据。</div>
          </div>
        </div>
        <div class="table-responsive table-wrap">
          <table class="table table-vcenter card-table products-table">
            <thead><tr><th class="th-check"><input type="checkbox" class="form-check-input" id="select-all-products" onclick="app.toggleAllProducts(this.checked)"></th><th class="th-code">品号</th><th class="th-name">品名</th><th class="th-spec">规格</th><th class="th-qty">当前数量</th><th class="th-status">状态</th><th class="th-recipes">配方数</th><th class="th-date">创建时间</th><th class="th-actions">操作</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
      ${total>page_size?`
      <div class="pagination-bar">
        <span class="pagination-total">共 ${total} 条</span>
        <button class="btn btn-outline-secondary pagination-prev" ${page<=1?'disabled':''} onclick="app.navProducts({page:${page-1}})">${this.renderIcon('chevron-left', 'me-1')}上一页</button>
        <span class="pagination-label">第 ${page} / ${totalPages} 页</span>
        <button class="btn btn-outline-secondary pagination-next" ${page>=totalPages?'disabled':''} onclick="app.navProducts({page:${page+1}})">下一页${this.renderIcon('chevron-right', 'ms-1')}</button>
      </div>`:''}`;
  },

  toggleProductSelection(id, checked) {
    if (checked) this.selectedProductIds.add(id);
    else this.selectedProductIds.delete(id);
    this.updateStatusBar();
  },

  toggleAllProducts(checked) {
    document.querySelectorAll('#workbench-body tbody input[type="checkbox"]').forEach(cb => {
      const id = parseInt(cb.value);
      if (!id) return;
      cb.checked = checked;
      if (checked) this.selectedProductIds.add(id);
      else this.selectedProductIds.delete(id);
    });
    this.updateStatusBar();
  },

  async batchArchiveProducts() {
    const ids = [...this.selectedProductIds];
    if (ids.length === 0) { this.toast('请先勾选要归档的产品', 'info'); return; }
    this.modal(`确认归档 ${ids.length} 个产品?`, '归档后默认不会在产品列表显示，但可以从"已归档"中恢复。', async () => {
      for (const id of ids) {
        const r = await this.post(`/api/products/${id}/archive`);
        if (!r.ok) this.toast(`归档 #${id} 失败: ${r.error || ''}`, 'error');
      }
      this.selectedProductIds.clear();
      this.updateStatusBar();
      this.refreshStatusTotals();
      this.toast('批量归档完成');
      this.route();
    }, '确认归档');
  },

  exportSelectedProducts() {
    const ids = [...this.selectedProductIds];
    if (ids.length === 0) { this.toast('请先勾选要导出的产品', 'info'); return; }
    const selected = (this.currentProducts || []).filter(p => ids.includes(p.id));
    if (selected.length === 0) { this.toast('未找到选中产品的数据', 'error'); return; }
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `selected-products-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast(`已导出 ${selected.length} 个产品`);
  },

  navProducts(extra={}) {
    const q = document.getElementById('prod-q')?.value || '';
    const status = document.getElementById('prod-status')?.value || 'active';
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status && status !== 'active') p.set('status', status);
    if (extra.page) p.set('page', extra.page);
    location.hash = '#/products?' + p.toString();
  },

  searchProducts() {
    this.navProducts();
  },

  async renderProductForm(el, id) {
    let data = { 品号:'', 品名:'', 规格:'', 当前数量:0, 备注:'' };
    if (id) {
      const r = await this.get(`/api/products/${id}`);
      if (!r.ok) { this.toast(r.error, 'error'); location.hash='#/products'; return; }
      data = r.data;
    }
    el.innerHTML = `
      <div class="app-breadcrumb"><a href="#/products">产品列表</a> / ${id?'编辑产品':'新建产品'}</div>
      <div class="card">
        <div class="card-header"><h3 class="card-title">基本信息</h3></div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">品号 <span class="text-danger">*</span></label>
              <input class="form-control" id="pf-品号" value="${this.escapeHtml(data.品号)}">
              <div class="invalid-feedback" id="err-品号"></div>
            </div>
            <div class="col-md-6">
              <label class="form-label">品名 <span class="text-danger">*</span></label>
              <input class="form-control" id="pf-品名" value="${this.escapeHtml(data.品名)}">
              <div class="invalid-feedback" id="err-品名"></div>
            </div>
            <div class="col-md-6">
              <label class="form-label">规格 <span class="text-danger">*</span></label>
              <input class="form-control" id="pf-规格" value="${this.escapeHtml(data.规格)}">
              <div class="invalid-feedback" id="err-规格"></div>
            </div>
            <div class="col-md-6">
              <label class="form-label">当前数量</label>
              <input class="form-control" id="pf-当前数量" type="number" value="${data.当前数量}">
            </div>
            <div class="col-12">
              <label class="form-label">备注</label>
              <textarea class="form-control" id="pf-备注" rows="2">${this.escapeHtml(data.备注||'')}</textarea>
            </div>
          </div>
        </div>
        <div class="card-footer d-flex gap-2">
          <a class="btn btn-outline-secondary" href="#/products">取消</a>
          <button class="btn btn-primary" id="pf-save" onclick="app.saveProduct(${id||0})">${this.renderIcon('device-floppy', 'me-1')}保存</button>
        </div>
      </div>`;
  },

  async saveProduct(id) {
    const payload = {
      品号: document.getElementById('pf-品号').value.trim(),
      品名: document.getElementById('pf-品名').value.trim(),
      规格: document.getElementById('pf-规格').value.trim(),
      当前数量: parseInt(document.getElementById('pf-当前数量').value || '0'),
      备注: document.getElementById('pf-备注').value.trim(),
    };
    let ok = true;
    ['品号','品名','规格'].forEach(k => {
      const el = document.getElementById('err-'+k);
      if (!payload[k]) { el.textContent = '必填'; el.classList.add('d-block'); ok=false; }
      else { el.classList.remove('d-block'); }
    });
    if (!ok) return;

    const btn = document.getElementById('pf-save');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>保存中……';
    const r = id ? await this.put(`/api/products/${id}`, payload) : await this.post('/api/products', payload);
    btn.disabled = false; btn.innerHTML = `${this.renderIcon('device-floppy', 'me-1')}保存`;
    if (r.ok) {
      this.toast(id?`已保存产品 ${payload.品号}`:`已创建产品 ${payload.品号}`);
      this.refreshStatusTotals();
      location.hash = `#/products/${id||r.data.id}`;
    } else {
      this.toast(r.error || '保存失败', 'error');
    }
  },

  async renderProductDetail(el, id, params = new URLSearchParams()) {
    const r = await this.get(`/api/products/${id}`);
    if (!r.ok) {
      el.innerHTML = this.renderEmptyState({ title: '产品不存在', body: '请返回产品列表重新选择。' });
      return;
    }
    const p = r.data;
    const showTab = params.get('tab') === 'success' ? 'success' : 'recipes';
    const movementRes = await this.get(`/api/products/${id}/inventory-movements`);
    const movements = movementRes.ok ? (movementRes.data || []) : [];
    const movementRows = movements.length ? movements.slice(0, 5).map(m => `
      <tr>
        <td>${this.formatDate(m.created_at)}</td>
        <td>${m.变动数量 > 0 ? '+' : ''}${m.变动数量}</td>
        <td>${m.变动前} → ${m.变动后}</td>
        <td>${this.escapeHtml(m.原因 || '-')}</td>
        <td>${this.escapeHtml(m.created_by || '-')}</td>
      </tr>
    `).join('') : `<tr><td colspan="5">${this.renderEmptyState({
      title: '暂无库存变动记录',
      body: '当前产品还没有库存调整历史。',
      className: 'empty-state-compact',
    })}</td></tr>`;

    const hero = this.renderPageHero({
      kicker: '产品详情',
      title: `${p.品号} ${p.品名}`,
      subtitle: `规格 ${p.规格} · 当前数量 ${p.当前数量}`,
      actions: `
        <div class="d-flex gap-2 flex-wrap">
          ${p.状态 === 'active' ? `
            <a class="btn btn-primary" href="#/recipes/new?product_id=${p.id}">${this.renderIcon('plus', 'me-1')}新建配方</a>
            <button class="btn btn-outline-secondary" onclick="app.openInventoryModal(${p.id})">${this.renderIcon('database', 'me-1')}调整库存</button>
            <a class="btn btn-outline-secondary" href="#/products/${p.id}/edit">${this.renderIcon('edit', 'me-1')}编辑</a>
            <button class="btn btn-outline-warning" onclick="app.archiveProduct(${p.id})">${this.renderIcon('archive', 'me-1')}归档</button>
          ` : `
            <button class="btn btn-outline-secondary" onclick="app.restoreProduct(${p.id})">${this.renderIcon('refresh', 'me-1')}恢复</button>
            <button class="btn btn-danger" onclick="app.deleteProduct(${p.id})">${this.renderIcon('trash', 'me-1')}删除</button>
          `}
        </div>
      `,
    });

    el.innerHTML = `
      ${hero}
      <div class="detail-grid detail-workspace">
        <div class="detail-col detail-primary">
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">产品概览</h3>
                <div class="text-muted-sm">围绕当前库存、状态和试验记录进行集中操作。</div>
              </div>
            </div>
            <div class="card-body">
              <div class="detail-meta-list">
                <div class="detail-meta-item">
                  <span class="detail-meta-label">产品状态</span>
                  <div class="detail-meta-value">${this.statusBadge(p.状态)}</div>
                </div>
                <div class="detail-meta-item">
                  <span class="detail-meta-label">规格</span>
                  <div class="detail-meta-value">${this.escapeHtml(p.规格)}</div>
                </div>
                <div class="detail-meta-item">
                  <span class="detail-meta-label">当前数量</span>
                  <div class="detail-meta-value">${p.当前数量}</div>
                </div>
              </div>
              ${p.备注 ? `<div class="text-muted-sm mt-3">备注：${this.escapeHtml(p.备注)}</div>` : ''}
            </div>
          </div>
          <div class="card">
            <ul class="nav nav-tabs" data-bs-toggle="tabs">
              <li class="nav-item">
                <a class="nav-link ${showTab==='recipes'?'active':''}" href="#/products/${p.id}?tab=recipes">配方记录</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${showTab==='success'?'active':''}" href="#/products/${p.id}?tab=success">成功率汇总</a>
              </li>
            </ul>
            <div class="card-body" id="product-tab-content"></div>
          </div>
        </div>
        <div class="detail-col detail-secondary">
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">库存流水</h3>
                <div class="text-muted-sm">最近 5 次库存变动，优先展示调整原因和操作人。</div>
              </div>
              <button class="btn btn-outline-secondary" onclick="app.openInventoryModal(${p.id})">${this.renderIcon('database', 'me-1')}调整库存</button>
            </div>
            <div class="table-responsive">
              <table class="table table-vcenter card-table">
                <thead><tr><th>时间</th><th>变动</th><th>库存</th><th>原因</th><th>操作人</th></tr></thead>
                <tbody>${movementRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    if (showTab === 'recipes') {
      await this.renderProductRecipes(id, params);
    } else {
      await this.renderProductSuccess(id, params);
    }
  },

  async renderProductRecipes(productId, params = new URLSearchParams()) {
    const status = params.get('status') || '';
    const material = params.get('material') || '';
    const dateFrom = params.get('date_from') || '';
    const dateTo = params.get('date_to') || '';
    const minRate = params.get('min_rate') || '';
    const maxRate = params.get('max_rate') || '';
    const sort = params.get('sort') || '试验日期';
    const order = params.get('order') || 'desc';
    const query = new URLSearchParams({ product_id: productId });
    if (status) query.set('status', status);
    if (material) query.set('material', material);
    if (dateFrom) query.set('date_from', dateFrom);
    if (dateTo) query.set('date_to', dateTo);
    if (minRate) query.set('min_rate', minRate);
    if (maxRate) query.set('max_rate', maxRate);
    if (sort) query.set('sort', sort);
    if (order) query.set('order', order);
    const r = await this.get(`/api/recipes?${query.toString()}`);
    const box = document.getElementById('product-tab-content');
    if (!r.ok || !box) return;
    const items = r.data.items || [];

    const filters = `
      <div class="filter-bar">
        <div class="filter-header">
          <div class="filter-title">筛选配方记录</div>
          <div class="filter-badge">${items.length} 条记录</div>
        </div>
        <div class="filter-row">
          <div class="filter-field">
            <span class="filter-label">结果状态</span>
            <select class="form-select" id="prod-rec-status">
              <option value="" ${status===''?'selected':''}>全部状态</option>
              <option value="success" ${status==='success'?'selected':''}>成功</option>
              <option value="failed" ${status==='failed'?'selected':''}>失败</option>
              <option value="pending" ${status==='pending'?'selected':''}>待观察</option>
            </select>
          </div>
          <div class="filter-field">
            <span class="filter-label">原料/辅料</span>
            <input class="form-control" id="prod-rec-material" list="material-list" placeholder="输入原料或辅料名称" value="${this.escapeHtml(material)}">
          </div>
          <div class="filter-field">
            <span class="filter-label">试验日期</span>
            <div class="filter-range">
              <input class="form-control" id="prod-rec-date-from" type="date" value="${this.escapeHtml(dateFrom)}">
              <span class="filter-range-sep">至</span>
              <input class="form-control" id="prod-rec-date-to" type="date" value="${this.escapeHtml(dateTo)}">
            </div>
          </div>
          <div class="filter-field">
            <span class="filter-label">成功率</span>
            <div class="filter-range">
              <input class="form-control form-control-sm" id="prod-rec-min-rate" type="number" min="0" max="100" step="1" placeholder="最低" value="${minRate?Math.round(parseFloat(minRate)*100):''}">
              <span class="filter-range-sep">%</span>
              <input class="form-control form-control-sm" id="prod-rec-max-rate" type="number" min="0" max="100" step="1" placeholder="最高" value="${maxRate?Math.round(parseFloat(maxRate)*100):''}">
              <span class="filter-range-sep">%</span>
            </div>
          </div>
          <div class="filter-field">
            <span class="filter-label">排序</span>
            <div class="filter-range">
              <select class="form-select" id="prod-rec-sort">
                <option value="试验日期" ${sort==='试验日期'?'selected':''}>试验日期</option>
                <option value="成功率" ${sort==='成功率'?'selected':''}>成功率</option>
                <option value="创建时间" ${sort==='创建时间'?'selected':''}>创建时间</option>
                <option value="品号" ${sort==='品号'?'selected':''}>品号</option>
              </select>
              <select class="form-select" id="prod-rec-order">
                <option value="desc" ${order==='desc'?'selected':''}>降序</option>
                <option value="asc" ${order==='asc'?'selected':''}>升序</option>
              </select>
            </div>
          </div>
          <div class="filter-actions">
            <button class="btn btn-primary" title="查询" onclick="app.searchProductRecipes(${productId})">${this.renderIcon('search', 'me-1')}查询</button>
            <a class="btn btn-outline-secondary" title="重置" href="#/products/${productId}?tab=recipes">${this.renderIcon('refresh', 'me-1')}重置</a>
          </div>
          <datalist id="material-list"></datalist>
        </div>
      </div>`;

    if (items.length === 0) {
      box.innerHTML = `${filters}${this.renderEmptyState({
        title: '暂无配方记录',
        body: '这个产品还没有试验记录。可以新建一条配方，记录原料、辅料和试验结果。',
        action: `<a class="btn btn-primary" href="#/recipes/new?product_id=${productId}">${this.renderIcon('plus')} 新建配方</a>`,
      })}`;
      this.loadMaterialSuggestions();
      return;
    }

    const grouped = this.groupRecipesByMonth(items);
    const groupKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    const timeline = groupKeys.map((key, idx) => {
      const groupItems = grouped[key];
      const success = groupItems.filter(i => i.状态 === 'success').length;
      const failed = groupItems.filter(i => i.状态 === 'failed').length;
      const rows = groupItems.map(item => `
        <tr onclick="location.hash='#/recipes/${item.id}'">
          <td>${this.escapeHtml(item.试验日期)}</td>
          <td>${this.escapeHtml(item.配方名称||'-')}</td>
          <td>${this.statusBadge(item.状态)}</td>
          <td>${item.用了多少||'-'}${item.用了多少?'g':''}</td>
          <td>${this.formatSuccessRate(item)}</td>
          <td>${this.escapeHtml(item.created_by||'-')}</td>
          <td><a class="btn btn-outline-secondary btn-sm" href="#/recipes/${item.id}" onclick="event.stopPropagation()">查看</a></td>
        </tr>
      `).join('');
      return `
        <div class="recipe-timeline-group ${idx > 0 ? 'collapsed' : ''}" id="recipe-group-${key}" data-group="${key}">
          <div class="recipe-timeline-header" onclick="app.toggleRecipeGroup('${key}')">
            <div class="recipe-timeline-title">
              ${this.renderIcon('chevron-down', 'recipe-timeline-toggle')}
              <span>${this.escapeHtml(key)}</span>
              <span class="recipe-timeline-meta">${groupItems.length} 次试验 · ${success} 成功 · ${failed} 失败</span>
            </div>
            <div class="recipe-timeline-meta">${groupItems[groupItems.length-1]?.试验日期 || ''} ~ ${groupItems[0]?.试验日期 || ''}</div>
          </div>
          <div class="recipe-timeline-body">
            <div class="table-responsive">
              <table class="table table-vcenter card-table">
                <thead><tr><th>日期</th><th>配方名称</th><th>状态</th><th>用量</th><th>成功率</th><th>创建人</th><th>操作</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }).join('');

    box.innerHTML = `
      ${filters}
      <div class="recipe-timeline">
        ${timeline}
      </div>`;
    this.loadMaterialSuggestions();
  },

  groupRecipesByMonth(items) {
    return items.reduce((acc, item) => {
      const date = item.试验日期 || item.created_at || '';
      const key = date.substring(0, 7) || '未知时间';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  },

  toggleRecipeGroup(key) {
    document.getElementById(`recipe-group-${key}`)?.classList.toggle('collapsed');
  },

  searchProductRecipes(productId) {
    const p = new URLSearchParams({ tab: 'recipes' });
    const status = document.getElementById('prod-rec-status')?.value || '';
    const material = document.getElementById('prod-rec-material')?.value || '';
    const dateFrom = document.getElementById('prod-rec-date-from')?.value || '';
    const dateTo = document.getElementById('prod-rec-date-to')?.value || '';
    const minRate = document.getElementById('prod-rec-min-rate')?.value || '';
    const maxRate = document.getElementById('prod-rec-max-rate')?.value || '';
    const sort = document.getElementById('prod-rec-sort')?.value || '';
    const order = document.getElementById('prod-rec-order')?.value || '';
    if (status) p.set('status', status);
    if (material) p.set('material', material);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    if (minRate) p.set('min_rate', (parseFloat(minRate) / 100).toString());
    if (maxRate) p.set('max_rate', (parseFloat(maxRate) / 100).toString());
    if (sort) p.set('sort', sort);
    if (order) p.set('order', order);
    location.hash = `#/products/${productId}?${p.toString()}`;
  },

  async renderProductSuccess(productId) {
    const r = await this.get(`/api/products/${productId}/success-rate`);
    const box = document.getElementById('product-tab-content');
    if (!r.ok || !box) return;
    const items = r.data || [];

    if (items.length === 0) {
      box.innerHTML = this.renderEmptyState({
        title: '暂无成功率数据',
        body: '至少需要一条成功或失败的配方记录，才能计算成功率。待观察状态不会参与成功率计算。',
      });
      return;
    }

    const rows = items.map((item, idx) => {
      const rowId = `hash-history-${idx}`;
      return `
        <tr>
          <td><span class="hash-badge">${item.配方hash.substring(0,8)}…${item.配方hash.slice(-4)}</span></td>
          <td>${item.试验次数}</td>
          <td>${item.成功次数}</td>
          <td>${this.formatSuccessRate(item)}</td>
          <td>
            <button class="btn btn-ghost-secondary btn-sm" onclick="event.stopPropagation();app.toggleHashHistory(${productId}, '${item.配方hash}', '${rowId}')">${this.renderIcon('history', 'me-1')}展开历史</button>
          </td>
        </tr>
        <tr id="${rowId}" class="hide"><td colspan="5">${this.renderEmptyState({
          title: '正在加载历史记录',
          body: '请稍候，正在整理同组合试验明细。',
        })}</td></tr>`;
    }).join('');

    box.innerHTML = `
      ${this.successRateHelp()}
      <div class="table-responsive">
        <table class="table table-vcenter card-table">
          <thead><tr><th>配方组合</th><th>试验次数</th><th>成功次数</th><th>成功率</th><th>操作</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  async toggleHashHistory(productId, hash, rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const colSpan = row.querySelector('td')?.colSpan || 5;
    row.classList.toggle('hide');
    if (row.classList.contains('hide') || row.dataset.loaded === '1') return;

    const r = await this.get(`/api/products/${productId}/recipes-by-hash/${hash}`);
    if (!r.ok) {
      row.innerHTML = `<td colspan="${colSpan}">${this.renderEmptyState({
        title: '历史记录加载失败',
        body: '请稍后重试，或返回成功率列表重新展开。',
      })}</td>`;
      return;
    }
    const items = r.data || [];
    const rows = items.map(item => `
      <tr onclick="location.hash='#/recipes/${item.id}'">
        <td>${this.escapeHtml(item.试验日期)}</td>
        <td>${this.statusBadge(item.状态)}</td>
        <td>${this.escapeHtml(item.配方名称||'-')}</td>
        <td>${item.用了多少||'-'}</td>
        <td><a class="btn btn-outline-secondary btn-sm" href="#/recipes/${item.id}" onclick="event.stopPropagation()">查看</a></td>
      </tr>
    `).join('');
    row.dataset.loaded = '1';
    row.innerHTML = `
      <td colspan="${colSpan}">
        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead><tr><th>日期</th><th>状态</th><th>配方名称</th><th>用量</th><th>操作</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </td>`;
  },

  archiveProduct(id) {
    this.modal('确认归档这个产品?', '归档后默认不会在产品列表显示，但可以从"已归档"中恢复。', () => {
      this.post(`/api/products/${id}/archive`).then(r => {
        if (r.ok) { this.toast('已归档'); this.refreshStatusTotals(); location.hash='#/products'; }
        else this.toast(r.error, 'error');
      });
    }, '确认归档');
  },

  restoreProduct(id) {
    this.post(`/api/products/${id}/restore`).then(r => {
      if (r.ok) { this.toast('已恢复'); this.refreshStatusTotals(); this.route(); }
      else this.toast(r.error, 'error');
    });
  },

  deleteProduct(id) {
    this.modal('确认删除这个产品?', '删除后会移除该产品及其配方记录，不可恢复。', () => {
      this.del(`/api/products/${id}`).then(r => {
        if (r.ok) { this.toast('已删除'); this.refreshStatusTotals(); location.hash='#/products?status=archived'; }
        else this.toast(r.error, 'error');
      });
    }, '确认删除', true);
  },

  openInventoryModal(id) {
    const body = `
      <div class="inventory-modal">
        <label class="field-label" for="inventory-delta">变动数量</label>
        <input id="inventory-delta" class="form-control" type="number" step="any" placeholder="消耗请填负数">
        <label class="field-label" for="inventory-reason">变动原因</label>
        <textarea id="inventory-reason" class="form-control" rows="2" placeholder="请输入原因"></textarea>
        <div id="inventory-error" class="invalid-feedback" role="alert"></div>
      </div>
    `;
    this.modal('调整库存', body, () => this.submitInventoryModal(id), '确认调整', false, {
      allowHtml: true,
      closeOnConfirm: false,
    });
    setTimeout(() => document.getElementById('inventory-delta')?.focus(), 200);
  },

  async submitInventoryModal(id) {
    const deltaInput = document.getElementById('inventory-delta');
    const reasonInput = document.getElementById('inventory-reason');
    const errEl = document.getElementById('inventory-error');
    if (!deltaInput || !reasonInput || !errEl) throw new Error('inventory modal missing');
    const delta = parseFloat(deltaInput.value || '0');
    const reason = reasonInput.value.trim();
    errEl.textContent = '';
    errEl.classList.remove('d-block');
    if (!delta) {
      errEl.textContent = '库存变动数量必须是非零数字';
      errEl.classList.add('d-block');
      return false;
    }
    const r = await this.post(`/api/products/${id}/inventory-adjust`, {
      变动数量: delta,
      原因: reason,
    });
    if (!r.ok) {
      errEl.textContent = r.error || '库存调整失败';
      errEl.classList.add('d-block');
      return false;
    }
    this.toast(`库存已更新: ${r.data.变动后}`);
    this.closeModal();
    return this.route();
  },

  // ===== Recipe form =====
  async renderRecipeForm(el, id, prefillProductId) {
    let data = { 产品id: prefillProductId||'', 试验日期: new Date().toISOString().slice(0,10), 配方名称:'', 用了多少:'', 状态:'pending', 备注:'', 原料辅料:[] };
    if (id) {
      const r = await this.get(`/api/recipes/${id}`);
      if (!r.ok) { this.toast(r.error, 'error'); history.back(); return; }
      data = r.data;
    }
    const prods = await this.get('/api/products?status=active&page_size=999');
    const productOptions = (prods.data?.items||[]).map(p => `<option value="${p.id}" ${p.id==data.产品id?'selected':''}>${this.escapeHtml(p.品号)} ${this.escapeHtml(p.品名)}</option>`).join('');

    const matRows = (data.原料辅料 && data.原料辅料.length) ? data.原料辅料.map((m,i) => this._matRow(i, m)).join('') : this._matRow(0, {类型:'原料'});
    const hero = this.renderPageHero({
      kicker: id ? '编辑配方' : '新建配方',
      title: id ? '更新当前试验配方' : '记录新的试验配方',
      subtitle: '按产品、原料组合和结果状态组织录入信息，方便后续成功率追踪。',
    });

    el.innerHTML = `
      ${hero}
      <div class="recipe-editor-shell">
        <div class="card recipe-section">
          <div class="card-header">
            <div>
              <h3 class="card-title">试验信息</h3>
              <div class="text-muted-sm">选择产品并记录本次试验日期、名称和总体用量。</div>
            </div>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">产品 <span class="text-danger">*</span></label>
                <select class="form-select" id="rf-产品id">${productOptions}</select>
              </div>
              <div class="col-md-6">
                <label class="form-label">试验日期 <span class="text-danger">*</span></label>
                <input class="form-control" id="rf-试验日期" type="date" value="${this.escapeHtml(data.试验日期)}">
              </div>
              <div class="col-md-6">
                <label class="form-label">配方名称</label>
                <input class="form-control" id="rf-配方名称" value="${this.escapeHtml(data.配方名称||'')}">
              </div>
              <div class="col-md-6">
                <label class="form-label">用了多少</label>
                <input class="form-control" id="rf-用了多少" type="number" value="${data.用了多少||''}">
              </div>
            </div>
          </div>
        </div>
        <div class="card recipe-section">
          <div class="card-header">
            <div>
              <h3 class="card-title">原料 / 辅料</h3>
              <div class="text-muted-sm">按试验录入组合，保留常用名称与单位建议。</div>
            </div>
            <button class="btn btn-outline-secondary" title="添加行" onclick="app.addMatRow()">${this.renderIcon('plus', 'me-1')}添加一行</button>
          </div>
          <div class="table-responsive">
            <table class="table table-vcenter card-table">
              <thead><tr><th>类型</th><th>名称</th><th>用量</th><th>单位</th><th>操作</th></tr></thead>
              <tbody id="mat-tbody">${matRows}</tbody>
            </table>
          </div>
          <datalist id="material-list"></datalist>
          <datalist id="unit-list"></datalist>
          <div class="invalid-feedback" id="mat-error"></div>
        </div>
        <div class="card recipe-section">
          <div class="card-header">
            <div>
              <h3 class="card-title">结果状态</h3>
              <div class="text-muted-sm">记录本次试验结果，便于后续成功率统计与复测。</div>
            </div>
          </div>
          <div class="card-body">
            <div class="radio-row mb-3">
              <label class="form-check"><input type="radio" class="form-check-input" name="rf-状态" value="success" ${data.状态==='success'?'checked':''}><span class="form-check-label">${this.renderIcon('circle-check', 'text-success me-1')}成功</span></label>
              <label class="form-check"><input type="radio" class="form-check-input" name="rf-状态" value="failed" ${data.状态==='failed'?'checked':''}><span class="form-check-label">${this.renderIcon('circle-x', 'text-danger me-1')}失败</span></label>
              <label class="form-check"><input type="radio" class="form-check-input" name="rf-状态" value="pending" ${data.状态==='pending'?'checked':''}><span class="form-check-label">${this.renderIcon('clock', 'text-warning me-1')}待观察</span></label>
            </div>
            <div class="mb-3">
              <label class="form-label">备注</label>
              <textarea class="form-control" id="rf-备注" rows="2">${this.escapeHtml(data.备注||'')}</textarea>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-outline-secondary" onclick="history.back()">取消</button>
              <button class="btn btn-primary" id="rf-save" onclick="app.saveRecipe(${id||0})">${this.renderIcon('device-floppy', 'me-1')}保存配方</button>
            </div>
          </div>
        </div>
      </div>`;
    this.loadMaterialSuggestions();
  },

  _matRow(idx, m={}) {
    return `<tr data-idx="${idx}">
      <td><select class="form-select" data-field="类型"><option value="原料" ${m.类型==='原料'?'selected':''}>原料</option><option value="辅料" ${m.类型==='辅料'?'selected':''}>辅料</option></select></td>
      <td><input class="form-control" data-field="名称" list="material-list" value="${this.escapeHtml(m.名称||'')}"></td>
      <td><input class="form-control" data-field="用量" type="number" step="any" value="${m.用量||''}"></td>
      <td><input class="form-control" data-field="单位" list="unit-list" value="${this.escapeHtml(m.单位||'')}"></td>
      <td><button class="btn btn-outline-danger btn-sm" onclick="this.closest('tr').remove()">删除</button></td>
    </tr>`;
  },

  addMatRow() {
    const tbody = document.getElementById('mat-tbody');
    const idx = tbody.children.length;
    const tr = document.createElement('tbody');
    tr.innerHTML = this._matRow(idx, {类型:'原料'});
    tbody.appendChild(tr.firstElementChild);
  },

  async loadMaterialSuggestions() {
    const materialList = document.getElementById('material-list');
    const unitList = document.getElementById('unit-list');
    if (!materialList && !unitList) return;
    const r = await this.get('/api/materials/suggestions?limit=100');
    if (!r.ok) return;
    const items = r.data || [];
    if (materialList) {
      const seen = new Set();
      materialList.innerHTML = items.filter(item => {
        if (seen.has(item.名称)) return false;
        seen.add(item.名称);
        return true;
      }).map(item => `<option value="${this.escapeHtml(item.名称)}" label="${this.escapeHtml(item.类型)} · ${item.使用次数} 次"></option>`).join('');
    }
    if (unitList) {
      const units = [...new Set(items.map(item => item.单位).filter(Boolean))];
      unitList.innerHTML = units.map(unit => `<option value="${this.escapeHtml(unit)}"></option>`).join('');
    }
  },

  async saveRecipe(id) {
    const tbody = document.getElementById('mat-tbody');
    const materials = [];
    let matError = '';
    tbody.querySelectorAll('tr').forEach((tr, idx) => {
      const 类型 = tr.querySelector('[data-field="类型"]').value;
      const 名称 = tr.querySelector('[data-field="名称"]').value.trim();
      const 用量 = tr.querySelector('[data-field="用量"]').value;
      const 单位 = tr.querySelector('[data-field="单位"]').value.trim();
      if (!名称 && !用量 && !单位) return;
      if (!名称) { matError = `第 ${idx+1} 行缺少名称`; }
      else if (!用量) { matError = `第 ${idx+1} 行缺少用量`; }
      else {
        const n = parseFloat(用量);
        if (isNaN(n)) matError = `第 ${idx+1} 行用量不是有效数字`;
        else materials.push({类型, 名称, 用量: n, 单位});
      }
    });

    const errEl = document.getElementById('mat-error');
    if (matError) { errEl.textContent = matError; errEl.classList.add('d-block'); return; }
    if (materials.length === 0) { errEl.textContent = '至少需要填写一行原料或辅料'; errEl.classList.add('d-block'); return; }
    errEl.classList.remove('d-block');

    const payload = {
      产品id: parseInt(document.getElementById('rf-产品id').value),
      试验日期: document.getElementById('rf-试验日期').value,
      配方名称: document.getElementById('rf-配方名称').value.trim(),
      用了多少: parseInt(document.getElementById('rf-用了多少').value || '0'),
      状态: document.querySelector('input[name="rf-状态"]:checked')?.value || 'pending',
      备注: document.getElementById('rf-备注').value.trim(),
      原料辅料: materials,
    };
    if (!payload.产品id || !payload.试验日期) {
      this.toast('产品和试验日期为必填项', 'error'); return;
    }

    const btn = document.getElementById('rf-save');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>保存中……';
    const r = id ? await this.put(`/api/recipes/${id}`, payload) : await this.post('/api/recipes', payload);
    btn.disabled = false; btn.innerHTML = `${this.renderIcon('device-floppy', 'me-1')}保存配方`;
    if (r.ok) {
      this.toast(id?'已保存配方':'已创建配方');
      location.hash = `#/recipes/${id||r.data.id}`;
    } else {
      this.toast(r.error || '保存失败', 'error');
    }
  },

  // ===== Recipe detail =====
  async renderRecipeDetail(el, id) {
    const r = await this.get(`/api/recipes/${id}`);
    if (!r.ok) {
      el.innerHTML = this.renderEmptyState({ title: '配方记录不存在', body: '请返回上一级重新选择记录。' });
      return;
    }
    const d = r.data;
    const 原料 = (d.原料辅料||[]).filter(m=>m.类型==='原料');
    const 辅料 = (d.原料辅料||[]).filter(m=>m.类型==='辅料');

    const sameHash = await this.get(`/api/products/${d.产品id}/success-rate`);
    const hashInfo = (sameHash.data||[]).find(x=>x.配方hash===d.配方hash);
    const historyRes = await this.get(`/api/recipes/${d.id}/same-hash`);
    const historyItems = historyRes.ok ? (historyRes.data || []) : [];
    const historyRows = historyItems.map(item => `
      <tr onclick="location.hash='#/recipes/${item.id}'">
        <td>${this.escapeHtml(item.试验日期)}</td>
        <td>${this.statusBadge(item.状态)}</td>
        <td>${this.escapeHtml(item.配方名称||'-')}</td>
        <td>${item.用了多少||'-'}</td>
        <td><a class="btn btn-outline-secondary btn-sm" href="#/recipes/${item.id}" onclick="event.stopPropagation()">查看</a></td>
      </tr>
    `).join('');

    const hero = this.renderPageHero({
      kicker: '配方详情',
      title: d.配方名称 || '未命名配方',
      subtitle: `状态 ${this.statusText(d.状态)} · 日期 ${d.试验日期}`,
      actions: `
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-primary" onclick="app.duplicateRecipe(${d.id})">${this.renderIcon('copy', 'me-1')}复制配方</button>
          <a class="btn btn-outline-secondary" href="#/recipes/${d.id}/edit" title="编辑">${this.renderIcon('edit', 'me-1')}编辑</a>
          <button class="btn btn-danger" onclick="app.deleteRecipe(${d.id})">${this.renderIcon('trash', 'me-1')}删除</button>
        </div>
      `,
    });

    el.innerHTML = `
      ${hero}
      <div class="recipe-editor-shell">
        <div class="card recipe-section">
          <div class="card-header">
            <div>
              <h3 class="card-title">试验概览</h3>
              <div class="text-muted-sm">快速查看配方状态、用量、归属产品与创建信息。</div>
            </div>
          </div>
          <div class="card-body">
            <div class="detail-meta-list">
              <div class="detail-meta-item">
                <span class="detail-meta-label">产品</span>
                <div class="detail-meta-value">${this.escapeHtml(d.品号)} ${this.escapeHtml(d.品名)}</div>
              </div>
              <div class="detail-meta-item">
                <span class="detail-meta-label">状态</span>
                <div class="detail-meta-value">${this.statusBadge(d.状态)}</div>
              </div>
              <div class="detail-meta-item">
                <span class="detail-meta-label">用了多少</span>
                <div class="detail-meta-value">${d.用了多少 || '-'}</div>
              </div>
              <div class="detail-meta-item">
                <span class="detail-meta-label">创建人</span>
                <div class="detail-meta-value">${this.escapeHtml(d.created_by || '-')}</div>
              </div>
            </div>
            <div class="hash-row mt-3">
              <span class="hash-badge">${d.配方hash}</span>
              <button class="btn btn-ghost-secondary btn-sm" onclick="app.copyText('${d.配方hash}', '配方哈希已复制', '复制配方哈希失败')">${this.renderIcon('copy', 'me-1')}复制哈希</button>
            </div>
          </div>
        </div>
        <div class="card recipe-section">
          <div class="card-header">
            <div>
              <h3 class="card-title">原料 / 辅料</h3>
              <div class="text-muted-sm">拆分展示当前配方组合，方便对比同组合历史。</div>
            </div>
          </div>
          <div class="card-body">
            <div class="recipe-material-grid">
              <div class="material-block">
                <h4>原料</h4>
                ${this.renderIngredientRows(原料)}
              </div>
              <div class="material-block">
                <h4>辅料</h4>
                ${this.renderIngredientRows(辅料)}
              </div>
            </div>
            ${d.备注 ? `<div class="text-muted-sm mt-3">备注：${this.escapeHtml(d.备注)}</div>` : ''}
          </div>
        </div>
        <div class="card recipe-section">
          <div class="card-header">
            <div>
              <h3 class="card-title">同组合历史</h3>
              <div class="text-muted-sm">追踪同一配方组合的试验次数、成功次数与历史记录。</div>
            </div>
          </div>
          <div class="card-body">
            ${hashInfo ? `
              <div class="detail-meta-list mb-3">
                <div class="detail-meta-item">
                  <span class="detail-meta-label">当前组合成功率</span>
                  <div class="detail-meta-value">${this.formatSuccessRate(hashInfo)}</div>
                </div>
                <div class="detail-meta-item">
                  <span class="detail-meta-label">试验次数</span>
                  <div class="detail-meta-value">${hashInfo.试验次数}</div>
                </div>
                <div class="detail-meta-item">
                  <span class="detail-meta-label">成功次数</span>
                  <div class="detail-meta-value">${hashInfo.成功次数}</div>
                </div>
              </div>
            ` : ''}
            ${historyItems.length ? `
              <div class="table-responsive">
                <table class="table table-vcenter card-table">
                  <thead><tr><th>日期</th><th>状态</th><th>配方名称</th><th>用量</th><th>操作</th></tr></thead>
                  <tbody>${historyRows}</tbody>
                </table>
              </div>
            ` : this.renderEmptyState({
              title: '暂无同组合历史',
              body: '当前配方还没有足够的成功/失败记录用于对比。',
            })}
          </div>
        </div>
      </div>`;
  },

  deleteRecipe(id) {
    this.modal('确认删除这条配方记录?', '删除后不可恢复。建议仅删除误录入数据。', () => {
      this.del(`/api/recipes/${id}`).then(r => {
        if (r.ok) { this.toast('已删除'); history.back(); }
        else this.toast(r.error, 'error');
      });
    }, '确认删除', true);
  },

  async duplicateRecipe(id) {
    const r = await this.post(`/api/recipes/${id}/duplicate`, {
      试验日期: new Date().toISOString().slice(0, 10),
    });
    if (r.ok) {
      this.toast('已复制配方，可继续编辑复测记录');
      location.hash = `#/recipes/${r.data.id}/edit`;
    } else {
      this.toast(r.error || '复制失败', 'error');
    }
  },

  // ===== Success rate page =====
  async renderSuccessRate(el, params) {
    const productId = params.get('product_id') || '';
    const dateFrom = params.get('date_from') || '';
    const dateTo = params.get('date_to') || '';
    const status = params.get('status') || '';
    const minRate = params.get('min_rate') || '';
    const maxRate = params.get('max_rate') || '';
    const minTrials = params.get('min_trials') || '';
    const sort = params.get('sort') || '成功率';
    const order = params.get('order') || 'desc';
    const prods = await this.get('/api/products?status=active&page_size=999');
    const options = `<option value="">全部产品</option>` + (prods.data?.items||[]).map(p=>`<option value="${p.id}" ${p.id==productId?'selected':''}>${this.escapeHtml(p.品号)} ${this.escapeHtml(p.品名)}</option>`).join('');

    const query = new URLSearchParams();
    if (productId) query.set('product_id', productId);
    if (dateFrom) query.set('date_from', dateFrom);
    if (dateTo) query.set('date_to', dateTo);
    if (status) query.set('status', status);
    if (minRate) query.set('min_rate', minRate);
    if (maxRate) query.set('max_rate', maxRate);
    if (minTrials) query.set('min_trials', minTrials);
    if (sort) query.set('sort', sort);
    if (order) query.set('order', order);
    const r = await this.get(`/api/success-rate${query.toString()?'?'+query.toString():''}`);
    const items = r.data || [];
    const hero = this.renderPageHero({
      kicker: '成功率工作台',
      title: '按配方组合查看试验成功率',
      subtitle: '优先定位试验次数足够、成功率更稳定的组合。',
      content: `
        <div class="success-rate-hero">
          <select class="form-select" id="sr-product" onchange="app.searchSuccessRate()">${options}</select>
          <input class="form-control" id="sr-min-trials" type="number" min="1" step="1" placeholder="最少试验次数" value="${this.escapeHtml(minTrials)}">
        <button class="btn btn-outline-secondary" title="重置" onclick="location.hash='#/success-rate'">${this.renderIcon('refresh', 'me-1')}重置</button>
        <button class="btn btn-primary" title="查询" onclick="app.searchSuccessRate()">${this.renderIcon('search', 'me-1')}查询</button>
        </div>
      `,
    });

    let rows = '';
    if (items.length === 0) {
      rows = `<tr><td colspan="6">${this.renderEmptyState({
        title: '暂无成功率数据',
        body: '至少需要一条成功或失败的配方记录，才能计算成功率。待观察状态不会参与统计。',
      })}</td></tr>`;
    } else {
      rows = items.map((item, idx) => {
        const rowId = `success-history-${idx}`;
        return `
          <tr>
            <td>${this.escapeHtml(item.品号)} ${this.escapeHtml(item.品名)}</td>
            <td><span class="hash-badge">${item.配方hash.substring(0,8)}…${item.配方hash.slice(-4)}</span></td>
            <td>${item.试验次数}</td>
            <td>${item.成功次数}</td>
            <td>${this.formatSuccessRate(item)}</td>
            <td>
              <div class="td-actions">
                <button class="btn btn-ghost-secondary btn-sm" onclick="event.stopPropagation();app.toggleHashHistory(${item.产品id}, '${item.配方hash}', '${rowId}')">${this.renderIcon('history', 'me-1')}展开历史</button>
                <a class="btn btn-outline-secondary btn-sm" href="#/products/${item.产品id}?tab=success">查看</a>
              </div>
            </td>
          </tr>
          <tr id="${rowId}" class="hide"><td colspan="6">${this.renderEmptyState({
            title: '正在加载历史记录',
            body: '请稍候，正在整理组合明细。',
          })}</td></tr>`;
      }).join('');
    }

    el.innerHTML = `
      ${hero}
      ${this.successRateHelp()}
      <div class="filter-bar">
        <div class="filter-header">
          <div class="filter-title">筛选成功率</div>
          <div class="filter-badge">${items.length} 组配方</div>
        </div>
        <div class="filter-row">
          <div class="filter-field">
            <span class="filter-label">试验日期</span>
            <div class="filter-range">
              <input class="form-control" id="sr-date-from" type="date" value="${this.escapeHtml(dateFrom)}">
              <span class="filter-range-sep">至</span>
              <input class="form-control" id="sr-date-to" type="date" value="${this.escapeHtml(dateTo)}">
            </div>
          </div>
          <div class="filter-field">
            <span class="filter-label">结果</span>
            <select class="form-select" id="sr-status">
              <option value="" ${status===''?'selected':''}>成功/失败</option>
              <option value="success" ${status==='success'?'selected':''}>只看成功</option>
              <option value="failed" ${status==='failed'?'selected':''}>只看失败</option>
            </select>
          </div>
          <div class="filter-field">
            <span class="filter-label">成功率区间</span>
            <div class="filter-range">
              <input class="form-control form-control-sm" id="sr-min-rate" type="number" min="0" max="100" step="1" placeholder="最低" value="${minRate?Math.round(parseFloat(minRate)*100):''}">
              <span class="filter-range-sep">%</span>
              <input class="form-control form-control-sm" id="sr-max-rate" type="number" min="0" max="100" step="1" placeholder="最高" value="${maxRate?Math.round(parseFloat(maxRate)*100):''}">
              <span class="filter-range-sep">%</span>
            </div>
          </div>
          <div class="filter-field">
            <span class="filter-label">排序</span>
            <div class="filter-range">
              <select class="form-select" id="sr-sort">
                <option value="成功率" ${sort==='成功率'?'selected':''}>成功率</option>
                <option value="试验次数" ${sort==='试验次数'?'selected':''}>试验次数</option>
                <option value="品号" ${sort==='品号'?'selected':''}>品号</option>
                <option value="创建时间" ${sort==='创建时间'?'selected':''}>创建时间</option>
              </select>
              <select class="form-select" id="sr-order">
                <option value="desc" ${order==='desc'?'selected':''}>降序</option>
                <option value="asc" ${order==='asc'?'selected':''}>升序</option>
              </select>
            </div>
          </div>
          <div class="filter-actions">
            <button class="btn btn-primary" title="查询" onclick="app.searchSuccessRate()">${this.renderIcon('search', 'me-1')}查询</button>
            <a class="btn btn-outline-secondary" title="重置" href="#/success-rate">${this.renderIcon('refresh', 'me-1')}重置</a>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">组合成功率</h3>
            <div class="text-muted-sm">支持按产品、日期、成功率区间和最少试验次数筛选。</div>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-vcenter card-table">
            <thead><tr><th>产品</th><th>配方组合</th><th>试验次数</th><th>成功次数</th><th>成功率</th><th>操作</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  },

  searchSuccessRate() {
    const pid = document.getElementById('sr-product').value;
    const dateFrom = document.getElementById('sr-date-from').value;
    const dateTo = document.getElementById('sr-date-to').value;
    const status = document.getElementById('sr-status').value;
    const minRate = document.getElementById('sr-min-rate').value;
    const maxRate = document.getElementById('sr-max-rate').value;
    const minTrials = document.getElementById('sr-min-trials').value;
    const sort = document.getElementById('sr-sort').value;
    const order = document.getElementById('sr-order').value;
    const p = new URLSearchParams();
    if (pid) p.set('product_id', pid);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    if (status) p.set('status', status);
    if (minRate) p.set('min_rate', (parseFloat(minRate) / 100).toString());
    if (maxRate) p.set('max_rate', (parseFloat(maxRate) / 100).toString());
    if (minTrials) p.set('min_trials', minTrials);
    if (sort) p.set('sort', sort);
    if (order) p.set('order', order);
    location.hash = '#/success-rate?' + p.toString();
  },

  // ===== Backup / Export =====
  async backup() {
    this.modal('确认备份数据库?', '将把当前 SQLite 数据库打包到 backups 目录，并保留最近 10 个备份。', () => {
      this.runBackup();
    }, '确认备份');
  },

  async runBackup() {
    const r = await this.post('/api/backup');
    if (r.ok) {
      localStorage.setItem('lastBackupAt', new Date().toISOString());
      this.toast('备份完成: ' + r.data.filename);
      this.updateStatusBar();
    }
    else this.toast(r.error || '备份失败', 'error');
  },

  async downloadExport(url, fallbackName) {
    this.closeExportMenu();
    try {
      const res = await fetch(url, { headers: { 'X-Username': encodeURIComponent(this.user || '') } });
      if (!res.ok) {
        let message = '导出失败';
        try {
          const data = await res.json();
          message = data.error || message;
        } catch (_) {}
        this.toast(message, 'error');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match ? decodeURIComponent(match[1]) : fallbackName;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      this.toast('导出完成: ' + filename);
    } catch (err) {
      this.toast('导出失败: ' + (err?.message || err), 'error');
    }
  },

  async exportExcel(type) {
    this.closeExportMenu();
    await this.downloadExport('/api/export/excel?type=' + encodeURIComponent(type), `${type}.xlsx`);
  },

  async exportTemplate(type) {
    this.closeExportMenu();
    await this.downloadExport('/api/export/template?type=' + encodeURIComponent(type), `${type}_import_template.xlsx`);
  },

  async exportJson() {
    this.closeExportMenu();
    await this.downloadExport('/api/export/json', 'export.json');
  },

  importData() {
    this.closeExportMenu();
    const input = document.getElementById('import-file') || document.getElementById('action-import-file');
    if (!input) return;
    input.value = '';
    input.click();
  },

  importSelectedFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    this.modal(
      '确认导入数据?',
      '导入会先备份当前数据库，再用所选 JSON 或 ZIP 备份替换当前数据。',
      () => this.runImport(file),
      '确认导入',
      true
    );
  },

  async runImport(file) {
    try {
      const contentBase64 = await this.readFileBase64(file);
      const r = await this.post('/api/import', {
        filename: file.name,
        content_base64: contentBase64,
      });
      if (r.ok) {
        const data = r.data || {};
        this.toast(`导入完成: 产品 ${data.products || 0} / 配方 ${data.recipes || 0}`);
        this.refreshStatusTotals();
        location.hash = '#/products';
        this.route();
      } else {
        this.toast(r.error || '导入失败', 'error');
      }
    } catch (err) {
      this.toast('导入失败: ' + (err?.message || err), 'error');
    }
  },

  readFileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
      reader.readAsDataURL(file);
    });
  },

  confirmExit() {
    this.modal('确认退出?', '退出前会保存并备份当前数据，然后停止后台端口和 Python 进程。', () => {
      this.runExit();
    }, '确认退出', true);
  },

  async runExit() {
    try {
      const r = await this.post('/api/shutdown');
      if (r.ok) {
        this.toast('正在退出...');
      } else {
        this.toast(r.error || '退出失败', 'error');
      }
    } catch (err) {
      this.toast('正在退出...');
    }
  },
};
