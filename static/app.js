// ===== App =====
const app = {
  user: localStorage.getItem('username') || '',
  currentPage: '',

  init() {
    this.user = localStorage.getItem('username') || '';
    const route = this.routeFromLocation();
    if (this.user && route.path === '/login') {
      location.hash = '#/products';
    }
    if (!this.user && route.path !== '/login') {
      location.hash = '#/login';
    }
    this.updateShell();
    this.route();
    window.addEventListener('hashchange', () => this.route());
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('export-menu');
      if (menu && !menu.contains(e.target) && !e.target.closest('[onclick*="toggleExportMenu"]')) {
        menu.classList.add('hide');
      }
    });
  },

  updateShell() {
    const route = this.routeFromLocation();
    const sidebar = document.getElementById('sidebar');
    const topbar = document.getElementById('topbar');
    const shell = document.getElementById('app-shell');
    const loggedIn = Boolean(this.user);

    if (sidebar) {
      sidebar.innerHTML = loggedIn ? this.renderSidebarNav(route.path) : '';
      sidebar.classList.toggle('hide', !loggedIn);
    }

    if (topbar) {
      topbar.innerHTML = loggedIn ? this.renderTopbarActions() : '';
      topbar.classList.toggle('hide', route.path === '/login');
    }

    if (shell) {
      shell.classList.toggle('workspace-shell-guest', !loggedIn);
    }
  },

  routeFromLocation() {
    if (location.hash && location.hash.startsWith('#/')) {
      const [path, query] = location.hash.substring(1).split('?');
      return { path, params: new URLSearchParams(query || '') };
    }
    const path = location.pathname === '/' ? '/products' : location.pathname;
    return { path, params: new URLSearchParams(location.search || '') };
  },

  route() {
    const { path, params } = this.routeFromLocation();
    this.currentPage = path;
    if (path === '/login' && this.user) {
      location.hash = '#/products';
      return;
    }
    this.updateShell();

    const appEl = document.getElementById('app');
    if (!appEl) return;

    if (path === '/login') { this.renderLogin(appEl); return; }
    if (!this.user) { location.hash = '#/login'; return; }

    if (path === '/products') this.renderProducts(appEl, params);
    else if (path === '/products/new') this.renderProductForm(appEl, null);
    else if (path.match(/^\/products\/\d+\/edit$/)) this.renderProductForm(appEl, parseInt(path.split('/')[2]));
    else if (path.match(/^\/products\/\d+$/)) this.renderProductDetail(appEl, parseInt(path.split('/')[2]), params);
    else if (path === '/recipes/new') this.renderRecipeForm(appEl, null, params.get('product_id'));
    else if (path.match(/^\/recipes\/\d+\/edit$/)) this.renderRecipeForm(appEl, parseInt(path.split('/')[2]));
    else if (path.match(/^\/recipes\/\d+$/)) this.renderRecipeDetail(appEl, parseInt(path.split('/')[2]));
    else if (path === '/success-rate') this.renderSuccessRate(appEl, params);
    else { appEl.innerHTML = '<div class="empty-state"><h3>页面不存在</h3></div>'; }
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
    const div = document.createElement('div');
    div.className = `toast toast-${type}`;
    div.textContent = msg;
    box.appendChild(div);
    setTimeout(() => div.remove(), 2500);
  },

  modal(title, body, onConfirm, confirmText='确认', isDanger=false, options = {}) {
    const box = document.getElementById('modal-container');
    const isHtml = options.allowHtml === true;
    const closeOnConfirm = options.closeOnConfirm !== false;
    box.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)app.closeModal()">
        <div class="modal">
          <div class="modal-title">${this.escapeHtml(title)}</div>
          <div class="modal-body">${isHtml ? body : this.escapeHtml(body)}</div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal()">取消</button>
            <button class="btn ${isDanger?'btn-danger':'btn-primary'}" id="modal-confirm">${this.escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>`;
    document.getElementById('modal-confirm').onclick = async () => {
      try {
        await onConfirm();
        if (closeOnConfirm) this.closeModal();
      } catch (error) {
        console.warn(error);
      }
    };
  },

  closeModal() {
    document.getElementById('modal-container').innerHTML = '';
  },

  toggleExportMenu() {
    document.getElementById('export-menu')?.classList.toggle('hide');
  },

  renderSidebarNav(path) {
    return `
      <div class="sidebar-brand">
        <span class="brand-mark">KL</span>
        <div>
          <div class="sidebar-brand-title">样品库知识库</div>
          <div class="sidebar-brand-subtitle">Kitchen Lab</div>
        </div>
      </div>
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
        <input id="import-file" class="hide" type="file" accept=".json,.zip,application/json,application/zip" onchange="app.importSelectedFile(this)">
        <button class="btn btn-secondary" onclick="app.importData()">导入</button>
        <div class="menu-wrap">
          <button class="btn btn-secondary" onclick="app.toggleExportMenu()">导出</button>
          <div id="export-menu" class="export-menu hide">
            <a href="javascript:app.exportExcel('products')">导出产品列表</a>
            <a href="javascript:app.exportExcel('recipes')">导出配方记录</a>
            <a href="javascript:app.exportExcel('success_rate')">导出成功率</a>
            <a href="javascript:app.exportJson()">导出 JSON</a>
            <a href="javascript:app.exportTemplate('products')">产品导入模板</a>
            <a href="javascript:app.exportTemplate('recipes')">配方导入模板</a>
          </div>
        </div>
        <button class="btn btn-exit" onclick="app.confirmExit()">退出</button>
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

  renderEmptyState({ title, body, action = '' }) {
    return `
      <div class="empty-state">
        <h3>${this.escapeHtml(title)}</h3>
        <p>${this.escapeHtml(body)}</p>
        ${action}
      </div>
    `;
  },

  statusBadge(s) {
    const map = { active: ['活跃','badge-active'], archived: ['已归档','badge-archived'], success: ['成功','badge-success'], failed: ['失败','badge-failed'], pending: ['待观察','badge-pending'] };
    const [text, cls] = map[s] || [s,''];
    return `<span class="badge ${cls}">${this.escapeHtml(text)}</span>`;
  },

  successRateHelp() {
    return '<p class="help-note">成功率 = 同一配方组合下成功次数 / 成功或失败试验次数。只有 2 次及以上同组合试验才显示百分比,单次试验标记为样本不足。</p>';
  },

  formatSuccessRate(item) {
    if (!item || item.成功率 == null || !item.试验次数) return '-';
    const trials = Number(item.试验次数 || 0);
    if (trials < 2) {
      return `<span class="metric-warning">样本不足</span><span class="metric-note">${trials} 次试验</span>`;
    }
    const pct = Math.round((item.成功率 || 0) * 100);
    const barColor = pct>=80?'#16A34A':pct>=50?'#2563EB':pct>=1?'#D97706':'#DC2626';
    return `<span class="metric-strong">${pct}%</span><span class="progress-bar"><span class="progress-bar-inner" style="width:${pct}%;background:${barColor};"></span></span>`;
  },

  formatDate(d) {
    if (!d) return '-';
    return d.substring(0, 10);
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
    if (!user) { input.classList.add('error'); return; }
    const r = await this.post('/api/login', { 用户名: user });
    if (r.ok) {
      this.user = user;
      localStorage.setItem('username', user);
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
            <input id="login-user" class="input" placeholder="请输入用户名" value="${safeLast}" onkeydown="if(event.key==='Enter')app.login()">
            <button class="btn btn-primary" onclick="app.login()">进入工作台</button>
            ${last?`<div class="login-last">上次登录: ${safeLast}</div>`:''}
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

    let rows = '';
    if (items.length === 0) {
      rows = `<tr><td colspan="8">${this.renderEmptyState({
        title: q ? '没有找到匹配的产品' : '暂无产品',
        body: q ? '请尝试更换关键词，或清空筛选条件。' : '还没有录入任何产品。先新建一个产品，再记录配方试验。',
        action: q
          ? `<button class="btn btn-primary" onclick="location.hash='#/products'">清空筛选</button>`
          : `<button class="btn btn-primary" onclick="location.hash='#/products/new'">新建产品</button>`,
      })}</td></tr>`;
    } else {
      rows = items.map(p => `
        <tr onclick="location.hash='#/products/${p.id}'" class="${p.状态==='archived'?'archived':''}">
          <td><a href="#/products/${p.id}" onclick="event.stopPropagation()">${this.escapeHtml(p.品号)}</a></td>
          <td>${this.escapeHtml(p.品名)}</td>
          <td>${this.escapeHtml(p.规格)}</td>
          <td>${p.当前数量}</td>
          <td>${this.statusBadge(p.状态)}</td>
          <td>${p.配方数}</td>
          <td>${this.formatDate(p.created_at)}</td>
          <td>
            <a href="#/products/${p.id}" onclick="event.stopPropagation()">查看</a>
            ${p.状态==='active'?`
              <a href="#/products/${p.id}/edit" onclick="event.stopPropagation()">编辑</a>
              <button class="btn btn-subtle-danger" onclick="event.stopPropagation();app.archiveProduct(${p.id})">归档</button>
            `:`
              <button class="btn btn-text" onclick="event.stopPropagation();app.restoreProduct(${p.id})">恢复</button>
              <button class="btn btn-subtle-danger" onclick="event.stopPropagation();app.deleteProduct(${p.id})">删除</button>
            `}
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
          <input class="input" id="prod-q" placeholder="输入品号或品名" value="${safeQ}" onkeydown="if(event.key==='Enter')app.searchProducts()">
          <select class="input" id="prod-status" onchange="app.searchProducts()">
            <option value="active" ${status==='active'?'selected':''}>活跃</option>
            <option value="archived" ${status==='archived'?'selected':''}>已归档</option>
            <option value="全部" ${status==='全部'?'selected':''}>全部</option>
          </select>
        </div>
      `,
      actions: `
        <div class="products-hero-actions">
          <button class="btn btn-secondary" onclick="location.hash='#/products'">重置</button>
          <button class="btn btn-primary" onclick="location.hash='#/products/new'">新建产品</button>
        </div>
      `,
    });

    el.innerHTML = `
      ${hero}
      <section class="card products-panel">
        <div class="panel-heading">
          <div>
            <h3>产品列表</h3>
            <p class="page-subtitle">共 ${total} 条记录，默认显示最活跃的产品数据。</p>
          </div>
        </div>
        <div class="table-wrap"><table><thead>
          <tr><th>品号</th><th>品名</th><th>规格</th><th>当前数量</th><th>状态</th><th>配方数</th><th>创建时间</th><th>操作</th></tr>
        </thead><tbody>${rows}</tbody></table></div>
      </section>
      ${total>page_size?`
      <div class="pagination">
        <span>共 ${total} 条</span>
        <button class="btn btn-secondary" ${page<=1?'disabled':''} onclick="app.navProducts({page:${page-1}})">&lt;</button>
        <span>第 ${page} / ${totalPages} 页</span>
        <button class="btn btn-secondary" ${page>=totalPages?'disabled':''} onclick="app.navProducts({page:${page+1}})">&gt;</button>
      </div>`:''}`;
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
      <div class="breadcrumb"><a href="#/products">产品列表</a> / ${id?'编辑产品':'新建产品'}</div>
      <div class="card form-card">
        <h3>基本信息</h3>
        <div class="form-grid">
          <label>品号 <span style="color:var(--danger)">*</span></label>
          <div><input class="input" id="pf-品号" value="${this.escapeHtml(data.品号)}"><div class="field-error hide" id="err-品号"></div></div>
          <label>品名 <span style="color:var(--danger)">*</span></label>
          <div><input class="input" id="pf-品名" value="${this.escapeHtml(data.品名)}"><div class="field-error hide" id="err-品名"></div></div>
          <label>规格 <span style="color:var(--danger)">*</span></label>
          <div><input class="input" id="pf-规格" value="${this.escapeHtml(data.规格)}"><div class="field-error hide" id="err-规格"></div></div>
          <label>当前数量</label>
          <div><input class="input" id="pf-当前数量" type="number" value="${data.当前数量}"></div>
          <label>备注</label>
          <div><textarea class="input" id="pf-备注">${this.escapeHtml(data.备注||'')}</textarea></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="location.hash='#/products'">取消</button>
          <button class="btn btn-primary" id="pf-save" onclick="app.saveProduct(${id||0})">保存</button>
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
      if (!payload[k]) { el.textContent = '必填'; el.classList.remove('hide'); ok=false; }
      else { el.classList.add('hide'); }
    });
    if (!ok) return;

    const btn = document.getElementById('pf-save');
    btn.disabled = true; btn.textContent = '保存中……';
    const r = id ? await this.put(`/api/products/${id}`, payload) : await this.post('/api/products', payload);
    btn.disabled = false; btn.textContent = '保存';
    if (r.ok) {
      this.toast(id?`已保存产品 ${payload.品号}`:`已创建产品 ${payload.品号}`);
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
    `).join('') : `<tr><td colspan="5"><div class="empty-state empty-state-compact">暂无库存变动记录</div></td></tr>`;

    const hero = this.renderPageHero({
      kicker: '产品详情',
      title: `${p.品号} ${p.品名}`,
      subtitle: `规格 ${p.规格} · 当前数量 ${p.当前数量}`,
      actions: `
        <div class="inline-actions">
          ${p.状态 === 'active' ? `
            <button class="btn btn-primary" onclick="location.hash='#/recipes/new?product_id=${p.id}'">新建配方</button>
            <button class="btn btn-secondary" onclick="app.openInventoryModal(${p.id})">调整库存</button>
            <button class="btn btn-secondary" onclick="location.hash='#/products/${p.id}/edit'">编辑</button>
            <button class="btn btn-subtle-danger" onclick="app.archiveProduct(${p.id})">归档</button>
          ` : `
            <button class="btn btn-secondary" onclick="app.restoreProduct(${p.id})">恢复</button>
            <button class="btn btn-danger" onclick="app.deleteProduct(${p.id})">删除</button>
          `}
        </div>
      `,
    });

    el.innerHTML = `
      ${hero}
      <section class="detail-workspace">
        <div class="detail-primary">
          <section class="card detail-panel">
            <div class="panel-heading">
              <div>
                <h3>产品概览</h3>
                <p class="page-subtitle">围绕当前库存、状态和试验记录进行集中操作。</p>
              </div>
            </div>
            <div class="detail-meta-list">
              <div class="detail-meta-item">
                <span class="detail-meta-label">产品状态</span>
                <div>${this.statusBadge(p.状态)}</div>
              </div>
              <div class="detail-meta-item">
                <span class="detail-meta-label">规格</span>
                <strong>${this.escapeHtml(p.规格)}</strong>
              </div>
              <div class="detail-meta-item">
                <span class="detail-meta-label">当前数量</span>
                <strong>${p.当前数量}</strong>
              </div>
            </div>
            ${p.备注 ? `<div class="status-quiet detail-note">备注：${this.escapeHtml(p.备注)}</div>` : ''}
          </section>
          <section class="card detail-panel">
            <div class="tabs detail-tabs">
              <button class="tab ${showTab==='recipes'?'active':''}" onclick="location.hash='#/products/${p.id}?tab=recipes'">配方记录</button>
              <button class="tab ${showTab==='success'?'active':''}" onclick="location.hash='#/products/${p.id}?tab=success'">成功率汇总</button>
            </div>
            <div id="product-tab-content"></div>
          </section>
        </div>
        <aside class="detail-secondary">
          <section class="card detail-panel inventory-panel">
            <div class="panel-heading">
              <div>
                <h3>库存流水</h3>
                <p class="page-subtitle">最近 5 次库存变动，优先展示调整原因和操作人。</p>
              </div>
              <button class="btn btn-secondary" onclick="app.openInventoryModal(${p.id})">调整库存</button>
            </div>
            <div class="table-wrap"><table><thead>
              <tr><th>时间</th><th>变动</th><th>库存</th><th>原因</th><th>操作人</th></tr>
            </thead><tbody>${movementRows}</tbody></table></div>
          </section>
        </aside>
      </section>`;

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
      <div class="filter-bar filter-bar-recipes">
        <div class="filter-toolbar">
          <div>
            <div class="filter-title">筛选配方记录</div>
          </div>
          <div class="filter-meta">${items.length} 条记录</div>
        </div>
        <div class="filter-grid filter-grid-recipes">
          <label class="filter-field">
            <span class="filter-label">结果状态</span>
            <select class="input" id="prod-rec-status">
              <option value="" ${status===''?'selected':''}>全部状态</option>
              <option value="success" ${status==='success'?'selected':''}>成功</option>
              <option value="failed" ${status==='failed'?'selected':''}>失败</option>
              <option value="pending" ${status==='pending'?'selected':''}>待观察</option>
            </select>
          </label>
          <label class="filter-field filter-field-search">
            <span class="filter-label">原料/辅料</span>
            <input class="input" id="prod-rec-material" list="material-list" placeholder="输入原料或辅料名称" value="${this.escapeHtml(material)}">
          </label>
          <label class="filter-field filter-field-range">
            <span class="filter-label">试验日期</span>
            <span class="range-control">
              <input class="input" id="prod-rec-date-from" type="date" value="${this.escapeHtml(dateFrom)}">
              <span class="range-sep">至</span>
              <input class="input" id="prod-rec-date-to" type="date" value="${this.escapeHtml(dateTo)}">
            </span>
          </label>
          <label class="filter-field filter-field-range filter-field-rate">
            <span class="filter-label">成功率</span>
            <span class="range-control">
              <input class="input input-short" id="prod-rec-min-rate" type="number" min="0" max="100" step="1" placeholder="最低" value="${minRate?Math.round(parseFloat(minRate)*100):''}">
              <span class="range-sep">%</span>
              <input class="input input-short" id="prod-rec-max-rate" type="number" min="0" max="100" step="1" placeholder="最高" value="${maxRate?Math.round(parseFloat(maxRate)*100):''}">
              <span class="range-sep">%</span>
            </span>
          </label>
          <label class="filter-field filter-field-sort">
            <span class="filter-label">排序</span>
            <span class="sort-control">
              <select class="input" id="prod-rec-sort">
                <option value="试验日期" ${sort==='试验日期'?'selected':''}>试验日期</option>
                <option value="成功率" ${sort==='成功率'?'selected':''}>成功率</option>
                <option value="创建时间" ${sort==='创建时间'?'selected':''}>创建时间</option>
                <option value="品号" ${sort==='品号'?'selected':''}>品号</option>
              </select>
              <select class="input" id="prod-rec-order">
                <option value="desc" ${order==='desc'?'selected':''}>降序</option>
                <option value="asc" ${order==='asc'?'selected':''}>升序</option>
              </select>
            </span>
          </label>
          <div class="filter-actions">
            <button class="btn btn-primary" onclick="app.searchProductRecipes(${productId})">查询</button>
            <button class="btn btn-secondary" onclick="location.hash='#/products/${productId}?tab=recipes'">重置</button>
          </div>
          <datalist id="material-list"></datalist>
        </div>
      </div>`;

    if (items.length === 0) {
      box.innerHTML = `${filters}<div class="empty-state"><h3>暂无配方记录</h3><p>这个产品还没有试验记录。可以新建一条配方,记录原料、辅料和试验结果。</p><button class="btn btn-primary" onclick="location.hash='#/recipes/new?product_id=${productId}'">新建配方</button></div>`;
      this.loadMaterialSuggestions();
      return;
    }

    const rows = items.map(item => `
      <tr onclick="location.hash='#/recipes/${item.id}'">
        <td>${this.escapeHtml(item.试验日期)}</td>
        <td>${this.escapeHtml(item.配方名称||'-')}</td>
        <td>${this.statusBadge(item.状态)}</td>
        <td>${item.用了多少||'-'}${item.用了多少?'g':''}</td>
        <td>${this.formatSuccessRate(item)}</td>
        <td>${this.escapeHtml(item.created_by||'-')}</td>
        <td><a href="#/recipes/${item.id}" onclick="event.stopPropagation()">查看</a></td>
      </tr>
    `).join('');

    box.innerHTML = `
      ${filters}
      <div class="table-wrap"><table><thead>
        <tr><th>日期</th><th>配方名称</th><th>状态</th><th>用量</th><th>成功率</th><th>创建人</th><th>操作</th></tr>
      </thead><tbody>${rows}</tbody></table></div>`;
    this.loadMaterialSuggestions();
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
      box.innerHTML = `<div class="empty-state"><h3>暂无成功率数据</h3><p>至少需要一条"成功"或"失败"的配方记录,才能计算成功率。待观察状态不会参与成功率计算。</p></div>`;
      return;
    }

    const rows = items.map((item, idx) => {
      const rowId = `hash-history-${idx}`;
      return `
        <tr>
          <td><span class="hash">${item.配方hash.substring(0,8)}…${item.配方hash.slice(-4)}</span></td>
          <td>${item.试验次数}</td>
          <td>${item.成功次数}</td>
          <td>${this.formatSuccessRate(item)}</td>
          <td><button class="btn btn-text" onclick="event.stopPropagation();app.toggleHashHistory(${productId}, '${item.配方hash}', '${rowId}')">展开历史</button></td>
        </tr>
        <tr id="${rowId}" class="hide"><td colspan="5"><div class="empty-state" style="padding:16px;">正在加载历史记录……</div></td></tr>`;
    }).join('');

    box.innerHTML = `
      ${this.successRateHelp()}
      <div class="table-wrap"><table><thead>
        <tr><th>配方组合</th><th>试验次数</th><th>成功次数</th><th>成功率</th><th>操作</th></tr>
      </thead><tbody>${rows}</tbody></table></div>`;
  },

  async toggleHashHistory(productId, hash, rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.classList.toggle('hide');
    if (row.classList.contains('hide') || row.dataset.loaded === '1') return;

    const r = await this.get(`/api/products/${productId}/recipes-by-hash/${hash}`);
    if (!r.ok) {
      row.innerHTML = `<td colspan="5"><div class="empty-state" style="padding:16px;"><h3>历史记录加载失败</h3></div></td>`;
      return;
    }
    const items = r.data || [];
    const rows = items.map(item => `
      <tr onclick="location.hash='#/recipes/${item.id}'">
        <td>${this.escapeHtml(item.试验日期)}</td>
        <td>${this.statusBadge(item.状态)}</td>
        <td>${this.escapeHtml(item.配方名称||'-')}</td>
        <td>${item.用了多少||'-'}</td>
        <td><a href="#/recipes/${item.id}" onclick="event.stopPropagation()">查看</a></td>
      </tr>
    `).join('');
    row.dataset.loaded = '1';
    row.innerHTML = `
      <td colspan="5">
        <div class="table-wrap"><table><thead>
          <tr><th>日期</th><th>状态</th><th>配方名称</th><th>用量</th><th>操作</th></tr>
        </thead><tbody>${rows}</tbody></table></div>
      </td>`;
  },

  archiveProduct(id) {
    this.modal('确认归档这个产品?', '归档后默认不会在产品列表显示,但可以从"已归档"中恢复。', () => {
      this.post(`/api/products/${id}/archive`).then(r => {
        if (r.ok) { this.toast('已归档'); location.hash='#/products'; }
        else this.toast(r.error, 'error');
      });
    }, '确认归档');
  },

  restoreProduct(id) {
    this.post(`/api/products/${id}/restore`).then(r => {
      if (r.ok) { this.toast('已恢复'); this.route(); }
      else this.toast(r.error, 'error');
    });
  },

  deleteProduct(id) {
    this.modal('确认删除这个产品?', '删除后会移除该产品及其配方记录,不可恢复。', () => {
      this.del(`/api/products/${id}`).then(r => {
        if (r.ok) { this.toast('已删除'); location.hash='#/products?status=archived'; }
        else this.toast(r.error, 'error');
      });
    }, '确认删除', true);
  },

  openInventoryModal(id) {
    const body = `
      <div class="inventory-modal">
        <label class="field-label" for="inventory-delta">变动数量</label>
        <input id="inventory-delta" class="input" type="number" step="any" placeholder="消耗请填负数">
        <label class="field-label" for="inventory-reason">变动原因</label>
        <textarea id="inventory-reason" class="input" placeholder="请输入原因"></textarea>
        <div id="inventory-error" class="field-error hide" role="alert"></div>
      </div>
    `;
    this.modal('调整库存', body, () => this.submitInventoryModal(id), '确认调整', false, {
      allowHtml: true,
      closeOnConfirm: false,
    });
    document.getElementById('inventory-delta')?.focus();
  },

  async submitInventoryModal(id) {
    const deltaInput = document.getElementById('inventory-delta');
    const reasonInput = document.getElementById('inventory-reason');
    const errEl = document.getElementById('inventory-error');
    if (!deltaInput || !reasonInput || !errEl) throw new Error('inventory modal missing');
    const delta = parseFloat(deltaInput.value || '0');
    const reason = reasonInput.value.trim();
    errEl.textContent = '';
    errEl.classList.add('hide');
    if (!delta) {
      errEl.textContent = '库存变动数量必须是非零数字';
      errEl.classList.remove('hide');
      throw new Error('inventory modal validation');
    }
    const r = await this.post(`/api/products/${id}/inventory-adjust`, {
      变动数量: delta,
      原因: reason,
    });
    if (!r.ok) {
      errEl.textContent = r.error || '库存调整失败';
      errEl.classList.remove('hide');
      throw new Error('inventory modal submit failed');
    }
    this.toast(`库存已更新: ${r.data.变动后}`);
    this.closeModal();
    this.route();
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

    el.innerHTML = `
      <div class="breadcrumb"><a href="#/products">产品列表</a> / <a href="#/products/${data.产品id}">${this.escapeHtml(data.品号||'')}</a> / ${id?'编辑配方':'新建配方'}</div>
      <div class="card">
        <h3>试验信息</h3>
        <div class="form-grid">
          <label>产品 <span style="color:var(--danger)">*</span></label>
          <select class="input" id="rf-产品id">${productOptions}</select>
          <label>试验日期 <span style="color:var(--danger)">*</span></label>
          <input class="input" id="rf-试验日期" type="date" value="${this.escapeHtml(data.试验日期)}">
          <label>配方名称</label>
          <input class="input" id="rf-配方名称" value="${this.escapeHtml(data.配方名称||'')}">
          <label>用了多少</label>
          <input class="input" id="rf-用了多少" type="number" value="${data.用了多少||''}">
        </div>
      </div>
      <div class="card">
        <div class="panel-heading">
          <h3>原料 / 辅料</h3>
          <button class="btn btn-secondary" onclick="app.addMatRow()">添加行</button>
        </div>
        <div class="table-wrap"><table><thead>
          <tr><th>类型</th><th>名称</th><th>用量</th><th>单位</th><th>操作</th></tr>
        </thead><tbody id="mat-tbody">${matRows}</tbody></table></div>
        <datalist id="material-list"></datalist>
        <datalist id="unit-list"></datalist>
        <div class="field-error hide" id="mat-error"></div>
      </div>
      <div class="card">
        <h3>结果状态</h3>
        <div class="radio-row">
          <label><input type="radio" name="rf-状态" value="success" ${data.状态==='success'?'checked':''}> 成功</label>
          <label><input type="radio" name="rf-状态" value="failed" ${data.状态==='failed'?'checked':''}> 失败</label>
          <label><input type="radio" name="rf-状态" value="pending" ${data.状态==='pending'?'checked':''}> 待观察</label>
        </div>
        <label class="field-label">备注</label>
        <textarea class="input" id="rf-备注">${this.escapeHtml(data.备注||'')}</textarea>
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="history.back()">取消</button>
          <button class="btn btn-primary" id="rf-save" onclick="app.saveRecipe(${id||0})">保存配方</button>
        </div>
      </div>`;
    this.loadMaterialSuggestions();
  },

  _matRow(idx, m={}) {
    return `<tr data-idx="${idx}">
      <td><select class="input" data-field="类型"><option value="原料" ${m.类型==='原料'?'selected':''}>原料</option><option value="辅料" ${m.类型==='辅料'?'selected':''}>辅料</option></select></td>
      <td><input class="input" data-field="名称" list="material-list" value="${this.escapeHtml(m.名称||'')}"></td>
      <td><input class="input" data-field="用量" type="number" step="any" value="${m.用量||''}"></td>
      <td><input class="input" data-field="单位" list="unit-list" value="${this.escapeHtml(m.单位||'')}"></td>
      <td><button class="btn btn-subtle-danger" onclick="this.closest('tr').remove()">删除</button></td>
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
      if (!名称 && !用量 && !单位) return; // skip empty
      if (!名称) { matError = `第 ${idx+1} 行缺少名称`; }
      else if (!用量) { matError = `第 ${idx+1} 行缺少用量`; }
      else {
        const n = parseFloat(用量);
        if (isNaN(n)) matError = `第 ${idx+1} 行用量不是有效数字`;
        else materials.push({类型, 名称, 用量: n, 单位});
      }
    });

    const errEl = document.getElementById('mat-error');
    if (matError) { errEl.textContent = matError; errEl.classList.remove('hide'); return; }
    if (materials.length === 0) { errEl.textContent = '至少需要填写一行原料或辅料'; errEl.classList.remove('hide'); return; }
    errEl.classList.add('hide');

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
    btn.disabled = true; btn.textContent = '保存中……';
    const r = id ? await this.put(`/api/recipes/${id}`, payload) : await this.post('/api/recipes', payload);
    btn.disabled = false; btn.textContent = '保存配方';
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
    if (!r.ok) { el.innerHTML = '<div class="empty-state"><h3>配方记录不存在</h3></div>'; return; }
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
        <td><a href="#/recipes/${item.id}" onclick="event.stopPropagation()">查看</a></td>
      </tr>
    `).join('');

    el.innerHTML = `
      <div class="breadcrumb"><a href="#/products">产品列表</a> / <a href="#/products/${d.产品id}">${this.escapeHtml(d.品号)}</a> / ${this.escapeHtml(d.配方名称||'配方详情')}</div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <h2 style="margin:0 0 8px;font-size:20px;">${this.escapeHtml(d.配方名称||'未命名配方')}</h2>
            <div style="color:var(--text-sub);font-size:13px;">
              状态: ${this.statusBadge(d.状态)} &nbsp; 日期: ${this.escapeHtml(d.试验日期)} &nbsp; 用量: ${d.用了多少||'-'} &nbsp; 创建人: ${this.escapeHtml(d.created_by||'-')}
            </div>
            <div style="margin-top:8px;">
              <span class="hash">${d.配方hash}</span>
              <button class="btn btn-text" style="height:24px;padding:0 6px;font-size:12px;" onclick="navigator.clipboard.writeText('${d.配方hash}');app.toast('已复制')">复制</button>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" onclick="app.duplicateRecipe(${d.id})">复制配方</button>
            <button class="btn btn-secondary" onclick="location.hash='#/recipes/${d.id}/edit'">编辑</button>
            <button class="btn btn-danger" onclick="app.deleteRecipe(${d.id})">删除</button>
          </div>
        </div>
      </div>
      ${原料.length?`
      <div class="card" style="max-width:480px;">
        <h3 style="margin:0 0 12px;font-size:16px;">原料</h3>
        <table style="border:none;"><tbody>
          ${原料.map(m=>`<tr><td style="border:none;padding:6px 0;">${this.escapeHtml(m.名称)}</td><td style="border:none;padding:6px 0;text-align:right;font-weight:600;">${m.用量} ${this.escapeHtml(m.单位)}</td></tr>`).join('')}
        </tbody></table>
      </div>`:''}
      ${辅料.length?`
      <div class="card" style="max-width:480px;">
        <h3 style="margin:0 0 12px;font-size:16px;">辅料</h3>
        <table style="border:none;"><tbody>
          ${辅料.map(m=>`<tr><td style="border:none;padding:6px 0;">${this.escapeHtml(m.名称)}</td><td style="border:none;padding:6px 0;text-align:right;font-weight:600;">${m.用量} ${this.escapeHtml(m.单位)}</td></tr>`).join('')}
        </tbody></table>
      </div>`:''}
      ${hashInfo?`
      <div class="card">
        <h3 style="margin:0 0 12px;font-size:16px;">同组合试验记录</h3>
        <p style="margin:0 0 12px;color:var(--text-sub);font-size:13px;">
          当前组合成功率: ${this.formatSuccessRate(hashInfo)} &nbsp; 试验 ${hashInfo.试验次数} 次 / 成功 ${hashInfo.成功次数} 次
        </p>
        <div class="table-wrap"><table><thead>
          <tr><th>日期</th><th>状态</th><th>配方名称</th><th>用量</th><th>操作</th></tr>
        </thead><tbody>${historyRows}</tbody></table></div>
      </div>`:''}`;
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
      this.toast('已复制配方,可继续编辑复测记录');
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

    let rows = '';
    if (items.length === 0) {
      rows = `<tr><td colspan="6"><div class="empty-state"><h3>暂无成功率数据</h3><p>至少需要一条"成功"或"失败"的配方记录,才能计算成功率。待观察状态不会参与成功率计算。</p></div></td></tr>`;
    } else {
      rows = items.map(item => {
        return `
          <tr>
            <td>${this.escapeHtml(item.品号)} ${this.escapeHtml(item.品名)}</td>
            <td><span class="hash">${item.配方hash.substring(0,8)}…${item.配方hash.slice(-4)}</span></td>
            <td>${item.试验次数}</td>
            <td>${item.成功次数}</td>
            <td>${this.formatSuccessRate(item)}</td>
            <td><a href="#/products/${item.产品id}?tab=success">查看</a></td>
          </tr>`;
      }).join('');
    }

    el.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">成功率查询</h1><p class="page-subtitle">按配方组合查看试验成功率</p></div>
      </div>
      ${this.successRateHelp()}
      <div class="filter-bar filter-bar-success">
        <div class="filter-toolbar">
          <div>
            <div class="filter-title">筛选成功率</div>
          </div>
          <div class="filter-meta">${items.length} 组配方</div>
        </div>
        <div class="filter-grid filter-grid-success">
          <label class="filter-field filter-field-product">
            <span class="filter-label">产品</span>
            <select class="input" id="sr-product" onchange="app.searchSuccessRate()">${options}</select>
          </label>
          <label class="filter-field filter-field-range">
            <span class="filter-label">试验日期</span>
            <span class="range-control">
              <input class="input" id="sr-date-from" type="date" value="${this.escapeHtml(dateFrom)}">
              <span class="range-sep">至</span>
              <input class="input" id="sr-date-to" type="date" value="${this.escapeHtml(dateTo)}">
            </span>
          </label>
          <label class="filter-field">
            <span class="filter-label">结果</span>
            <select class="input" id="sr-status">
              <option value="" ${status===''?'selected':''}>成功/失败</option>
              <option value="success" ${status==='success'?'selected':''}>只看成功</option>
              <option value="failed" ${status==='failed'?'selected':''}>只看失败</option>
            </select>
          </label>
          <label class="filter-field filter-field-range filter-field-rate">
            <span class="filter-label">成功率区间</span>
            <span class="range-control">
              <input class="input input-short" id="sr-min-rate" type="number" min="0" max="100" step="1" placeholder="最低" value="${minRate?Math.round(parseFloat(minRate)*100):''}">
              <span class="range-sep">%</span>
              <input class="input input-short" id="sr-max-rate" type="number" min="0" max="100" step="1" placeholder="最高" value="${maxRate?Math.round(parseFloat(maxRate)*100):''}">
              <span class="range-sep">%</span>
            </span>
          </label>
          <label class="filter-field">
            <span class="filter-label">最少试验</span>
            <input class="input input-short" id="sr-min-trials" type="number" min="1" step="1" placeholder="次数" value="${this.escapeHtml(minTrials)}">
          </label>
          <label class="filter-field filter-field-sort">
            <span class="filter-label">排序</span>
            <span class="sort-control">
              <select class="input" id="sr-sort">
                <option value="成功率" ${sort==='成功率'?'selected':''}>成功率</option>
                <option value="试验次数" ${sort==='试验次数'?'selected':''}>试验次数</option>
                <option value="品号" ${sort==='品号'?'selected':''}>品号</option>
                <option value="创建时间" ${sort==='创建时间'?'selected':''}>创建时间</option>
              </select>
              <select class="input" id="sr-order">
                <option value="desc" ${order==='desc'?'selected':''}>降序</option>
                <option value="asc" ${order==='asc'?'selected':''}>升序</option>
              </select>
            </span>
          </label>
          <div class="filter-actions">
            <button class="btn btn-primary" onclick="app.searchSuccessRate()">查询</button>
            <button class="btn btn-secondary" onclick="location.hash='#/success-rate'">重置</button>
          </div>
        </div>
      </div>
      <div class="table-wrap"><table><thead>
        <tr><th>产品</th><th>配方组合</th><th>试验次数</th><th>成功次数</th><th>成功率</th><th>操作</th></tr>
      </thead><tbody>${rows}</tbody></table></div>`;
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
    this.modal('确认备份数据库?', '将把当前 SQLite 数据库打包到 backups 目录,并保留最近 10 个备份。', () => {
      this.runBackup();
    }, '确认备份');
  },

  async runBackup() {
    const r = await this.post('/api/backup');
    if (r.ok) this.toast('备份完成: ' + r.data.filename);
    else this.toast(r.error || '备份失败', 'error');
  },

  async downloadExport(url, fallbackName) {
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
    await this.downloadExport('/api/export/excel?type=' + encodeURIComponent(type), `${type}.xlsx`);
  },

  async exportTemplate(type) {
    await this.downloadExport('/api/export/template?type=' + encodeURIComponent(type), `${type}_import_template.xlsx`);
  },

  async exportJson() {
    await this.downloadExport('/api/export/json', 'export.json');
  },

  importData() {
    const input = document.getElementById('import-file');
    if (!input) return;
    input.value = '';
    input.click();
  },

  importSelectedFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    this.modal(
      '确认导入数据?',
      '导入会先备份当前数据库,再用所选 JSON 或 ZIP 备份替换当前数据。',
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
    this.modal('确认退出?', '退出前会保存并备份当前数据,然后停止后台端口和 Python 进程。', () => {
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
