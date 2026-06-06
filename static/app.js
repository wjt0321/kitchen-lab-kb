// ===== App =====
const app = {
  user: localStorage.getItem('username') || '',
  currentPage: '',

  init() {
    this.user = localStorage.getItem('username') || '';
    if (!this.user && location.hash !== '#/login') {
      location.hash = '#/login';
    }
    this.updateTopbar();
    this.route();
    window.addEventListener('hashchange', () => this.route());
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('export-menu');
      if (menu && !menu.contains(e.target) && !e.target.closest('[onclick*="toggleExportMenu"]')) {
        menu.classList.add('hide');
      }
    });
  },

  updateTopbar() {
    const el = document.getElementById('current-user');
    if (el) el.textContent = this.user || '';
    const nav = document.getElementById('topbar-nav');
    if (nav) {
      nav.querySelectorAll('a').forEach(a => {
        a.classList.toggle('active', location.hash.includes(a.getAttribute('href').replace('#', '')));
      });
    }
    const bar = document.getElementById('topbar');
    if (bar) bar.style.display = location.hash === '#/login' ? 'none' : 'flex';
  },

  route() {
    const hash = location.hash || '#/products';
    const [path, query] = hash.substring(1).split('?');
    const params = new URLSearchParams(query || '');
    this.currentPage = path;
    this.updateTopbar();

    const appEl = document.getElementById('app');
    if (!appEl) return;

    if (path === '/login') { this.renderLogin(appEl); return; }
    if (!this.user) { location.hash = '#/login'; return; }

    if (path === '/products') this.renderProducts(appEl, params);
    else if (path === '/products/new') this.renderProductForm(appEl, null);
    else if (path.match(/^\/products\/\d+\/edit$/)) this.renderProductForm(appEl, parseInt(path.split('/')[2]));
    else if (path.match(/^\/products\/\d+$/)) this.renderProductDetail(appEl, parseInt(path.split('/')[2]));
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

  modal(title, body, onConfirm, confirmText='确认', isDanger=false) {
    const box = document.getElementById('modal-container');
    box.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)app.closeModal()">
        <div class="modal">
          <div class="modal-title">${this.escapeHtml(title)}</div>
          <div class="modal-body">${this.escapeHtml(body)}</div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal()">取消</button>
            <button class="btn ${isDanger?'btn-danger':'btn-primary'}" id="modal-confirm">${this.escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>`;
    document.getElementById('modal-confirm').onclick = () => { onConfirm(); this.closeModal(); };
  },

  closeModal() {
    document.getElementById('modal-container').innerHTML = '';
  },

  toggleExportMenu() {
    document.getElementById('export-menu').classList.toggle('hide');
  },

  statusBadge(s) {
    const map = { active: ['活跃','badge-active'], archived: ['已归档','badge-archived'], success: ['成功','badge-success'], failed: ['失败','badge-failed'], pending: ['待观察','badge-pending'] };
    const [text, cls] = map[s] || [s,''];
    return `<span class="badge ${cls}">${this.escapeHtml(text)}</span>`;
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
      <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;">
        <div class="card" style="width:360px;text-align:center;">
          <h2 style="margin:0 0 4px;font-size:20px;">样品库知识库</h2>
          <p style="margin:0 0 20px;color:var(--text-sub);font-size:13px;">研发样品与配方记录工具</p>
          <input id="login-user" class="input" placeholder="请输入用户名" value="${safeLast}" onkeydown="if(event.key==='Enter')app.login()" style="margin-bottom:12px;">
          <button class="btn btn-primary" style="width:100%;" onclick="app.login()">登录</button>
          ${last?`<p style="margin-top:12px;font-size:13px;color:var(--text-weak);">上次登录: ${safeLast}</p>`:''}
        </div>
      </div>`;
  },

  async renderProducts(el, params) {
    const q = params.get('q') || '';
    const status = params.get('status') || 'active';
    const page = parseInt(params.get('page') || '1');
    const safeQ = this.escapeHtml(q);
    const r = await this.get(`/api/products?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${page}`);
    if (!r.ok) { el.innerHTML = '<div class="empty-state"><h3>加载失败</h3></div>'; return; }
    const { items, total, page_size } = r.data;
    const totalPages = Math.max(1, Math.ceil(total / page_size));

    let rows = '';
    if (items.length === 0) {
      rows = `<tr><td colspan="8"><div class="empty-state">
        <h3>${q?'没有找到匹配的产品':'暂无产品'}</h3>
        <p>${q?'请尝试更换关键词,或清空筛选条件。':'还没有录入任何产品。先新建一个产品,再记录配方试验。'}</p>
        ${q?`<button class="btn btn-primary" onclick="app.navProducts()">清空筛选</button>`:`<button class="btn btn-primary" onclick="location.hash='#/products/new'">+ 新建产品</button>`}
      </div></td></tr>`;
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
            ${p.状态==='active'?`<a href="#/products/${p.id}/edit" onclick="event.stopPropagation()" style="margin-left:8px;">编辑</a>`:''}
          </td>
        </tr>
      `).join('');
    }

    el.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">产品列表</h1>
          <p class="page-subtitle">管理产品主数据、库存数量和配方记录</p>
        </div>
        <button class="btn btn-primary" onclick="location.hash='#/products/new'">+ 新建产品</button>
      </div>
      <div class="filter-bar">
        <input class="input" id="prod-q" placeholder="搜索品号 / 品名……" value="${safeQ}" onkeydown="if(event.key==='Enter')app.searchProducts()" style="min-width:220px;">
        <select class="input" id="prod-status" onchange="app.searchProducts()">
          <option value="active" ${status==='active'?'selected':''}>活跃</option>
          <option value="archived" ${status==='archived'?'selected':''}>已归档</option>
          <option value="全部" ${status==='全部'?'selected':''}>全部</option>
        </select>
        <button class="btn btn-secondary" onclick="app.navProducts()">重置</button>
      </div>
      <div class="table-wrap"><table><thead>
        <tr><th>品号</th><th>品名</th><th>规格</th><th>当前数量</th><th>状态</th><th>配方数</th><th>创建时间</th><th>操作</th></tr>
      </thead><tbody>${rows}</tbody></table></div>
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
      <div class="card" style="max-width:680px;">
        <h3 style="margin:0 0 16px;font-size:16px;">基本信息</h3>
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
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
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

  async renderProductDetail(el, id) {
    const r = await this.get(`/api/products/${id}`);
    if (!r.ok) { el.innerHTML = '<div class="empty-state"><h3>产品不存在</h3></div>'; return; }
    const p = r.data;
    const hash = location.hash;
    const showTab = hash.includes('tab=success') ? 'success' : 'recipes';

    el.innerHTML = `
      <div class="breadcrumb"><a href="#/products">产品列表</a> / ${this.escapeHtml(p.品号)}</div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="margin:0 0 6px;font-size:20px;">${this.escapeHtml(p.品号)} ${this.escapeHtml(p.品名)}</h2>
            <div style="color:var(--text-sub);font-size:13px;">
              规格: ${this.escapeHtml(p.规格)} &nbsp; 当前数量: ${p.当前数量} &nbsp; 状态: ${this.statusBadge(p.状态)}
            </div>
            ${p.备注?`<div style="margin-top:6px;color:var(--text-sub);font-size:13px;">备注: ${this.escapeHtml(p.备注)}</div>`:''}
          </div>
          <div style="display:flex;gap:8px;">
            ${p.状态==='active'?`
              <button class="btn btn-primary" onclick="location.hash='#/recipes/new?product_id=${p.id}'">新建配方</button>
              <button class="btn btn-secondary" onclick="location.hash='#/products/${p.id}/edit'">编辑</button>
              <button class="btn btn-subtle-danger" onclick="app.archiveProduct(${p.id})">归档</button>
            `:`
              <button class="btn btn-secondary" onclick="app.restoreProduct(${p.id})">恢复</button>
              <button class="btn btn-danger" onclick="app.deleteProduct(${p.id})">删除</button>
            `}
          </div>
        </div>
      </div>
      <div class="tabs">
        <button class="tab ${showTab==='recipes'?'active':''}" onclick="location.hash='#/products/${p.id}?tab=recipes'">配方记录</button>
        <button class="tab ${showTab==='success'?'active':''}" onclick="location.hash='#/products/${p.id}?tab=success'">成功率汇总</button>
      </div>
      <div id="product-tab-content"></div>`;

    if (showTab === 'recipes') {
      await this.renderProductRecipes(id);
    } else {
      await this.renderProductSuccess(id);
    }
  },

  async renderProductRecipes(productId) {
    const r = await this.get(`/api/recipes?product_id=${productId}`);
    const box = document.getElementById('product-tab-content');
    if (!r.ok || !box) return;
    const items = r.data.items || [];

    if (items.length === 0) {
      box.innerHTML = `<div class="empty-state"><h3>暂无配方记录</h3><p>这个产品还没有试验记录。可以新建一条配方,记录原料、辅料和试验结果。</p><button class="btn btn-primary" onclick="location.hash='#/recipes/new?product_id=${productId}'">+ 新建配方</button></div>`;
      return;
    }

    const rows = items.map(item => `
      <tr onclick="location.hash='#/recipes/${item.id}'">
        <td>${this.escapeHtml(item.试验日期)}</td>
        <td>${this.escapeHtml(item.配方名称||'-')}</td>
        <td>${this.statusBadge(item.状态)}</td>
        <td>${item.用了多少||'-'}${item.用了多少?'g':''}</td>
        <td>${this.escapeHtml(item.created_by||'-')}</td>
        <td><a href="#/recipes/${item.id}" onclick="event.stopPropagation()">查看</a></td>
      </tr>
    `).join('');

    box.innerHTML = `
      <div class="table-wrap"><table><thead>
        <tr><th>日期</th><th>配方名称</th><th>状态</th><th>用量</th><th>创建人</th><th>操作</th></tr>
      </thead><tbody>${rows}</tbody></table></div>`;
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

    const rows = items.map(item => {
      const pct = Math.round((item.成功率||0)*100);
      const barColor = pct>=80?'#16A34A':pct>=50?'#2563EB':pct>=1?'#D97706':'#DC2626';
      return `
        <tr>
          <td><span class="hash">${item.配方hash.substring(0,8)}…${item.配方hash.slice(-4)}</span></td>
          <td>${item.试验次数}</td>
          <td>${item.成功次数}</td>
          <td>
            <span style="font-weight:600;">${Math.round((item.成功率||0)*100)}%</span>
            <span class="progress-bar"><span class="progress-bar-inner" style="width:${pct}%;background:${barColor};"></span></span>
            ${item.试验次数<=2?'<span style="color:var(--text-weak);font-size:12px;margin-left:6px;">试验次数较少</span>':''}
          </td>
        </tr>`;
    }).join('');

    box.innerHTML = `
      <div class="table-wrap"><table><thead>
        <tr><th>配方组合</th><th>试验次数</th><th>成功次数</th><th>成功率</th></tr>
      </thead><tbody>${rows}</tbody></table></div>`;
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
        <h3 style="margin:0 0 16px;font-size:16px;">试验信息</h3>
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
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;font-size:16px;">原料 / 辅料</h3>
          <button class="btn btn-secondary" onclick="app.addMatRow()">+ 添加行</button>
        </div>
        <div class="table-wrap"><table><thead>
          <tr><th>类型</th><th>名称</th><th>用量</th><th>单位</th><th>操作</th></tr>
        </thead><tbody id="mat-tbody">${matRows}</tbody></table></div>
        <div class="field-error hide" id="mat-error"></div>
      </div>
      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">结果状态</h3>
        <div style="display:flex;gap:20px;margin-bottom:12px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="rf-状态" value="success" ${data.状态==='success'?'checked':''}> 成功</label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="rf-状态" value="failed" ${data.状态==='failed'?'checked':''}> 失败</label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="rf-状态" value="pending" ${data.状态==='pending'?'checked':''}> 待观察</label>
        </div>
        <label style="color:var(--text-sub);font-size:14px;">备注</label>
        <textarea class="input" id="rf-备注" style="margin-top:6px;">${this.escapeHtml(data.备注||'')}</textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
          <button class="btn btn-secondary" onclick="history.back()">取消</button>
          <button class="btn btn-primary" id="rf-save" onclick="app.saveRecipe(${id||0})">保存配方</button>
        </div>
      </div>`;
  },

  _matRow(idx, m={}) {
    return `<tr data-idx="${idx}">
      <td><select class="input" data-field="类型"><option value="原料" ${m.类型==='原料'?'selected':''}>原料</option><option value="辅料" ${m.类型==='辅料'?'selected':''}>辅料</option></select></td>
      <td><input class="input" data-field="名称" value="${this.escapeHtml(m.名称||'')}"></td>
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
          当前组合成功率: <strong>${Math.round((hashInfo.成功率||0)*100)}%</strong> &nbsp; 试验 ${hashInfo.试验次数} 次 / 成功 ${hashInfo.成功次数} 次
        </p>
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

  // ===== Success rate page =====
  async renderSuccessRate(el, params) {
    const productId = params.get('product_id') || '';
    const prods = await this.get('/api/products?status=active&page_size=999');
    const options = `<option value="">全部产品</option>` + (prods.data?.items||[]).map(p=>`<option value="${p.id}" ${p.id==productId?'selected':''}>${this.escapeHtml(p.品号)} ${this.escapeHtml(p.品名)}</option>`).join('');

    const r = await this.get(`/api/success-rate${productId?'?product_id='+productId:''}`);
    const items = r.data || [];

    let rows = '';
    if (items.length === 0) {
      rows = `<tr><td colspan="6"><div class="empty-state"><h3>暂无成功率数据</h3><p>至少需要一条"成功"或"失败"的配方记录,才能计算成功率。待观察状态不会参与成功率计算。</p></div></td></tr>`;
    } else {
      rows = items.map(item => {
        const pct = Math.round((item.成功率||0)*100);
        const barColor = pct>=80?'#16A34A':pct>=50?'#2563EB':pct>=1?'#D97706':'#DC2626';
        return `
          <tr>
            <td>${this.escapeHtml(item.品号)} ${this.escapeHtml(item.品名)}</td>
            <td><span class="hash">${item.配方hash.substring(0,8)}…${item.配方hash.slice(-4)}</span></td>
            <td>${item.试验次数}</td>
            <td>${item.成功次数}</td>
            <td>
              <span style="font-weight:600;">${pct}%</span>
              <span class="progress-bar"><span class="progress-bar-inner" style="width:${pct}%;background:${barColor};"></span></span>
            </td>
            <td><a href="#/products/${item.产品id}?tab=success">查看</a></td>
          </tr>`;
      }).join('');
    }

    el.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">成功率查询</h1><p class="page-subtitle">按配方组合查看试验成功率</p></div>
      </div>
      <div class="filter-bar">
        <select class="input" id="sr-product" onchange="app.searchSuccessRate()">${options}</select>
        <button class="btn btn-secondary" onclick="app.searchSuccessRate()">查询</button>
        <button class="btn btn-secondary" onclick="location.hash='#/success-rate'">重置</button>
      </div>
      <div class="table-wrap"><table><thead>
        <tr><th>产品</th><th>配方组合</th><th>试验次数</th><th>成功次数</th><th>成功率</th><th>操作</th></tr>
      </thead><tbody>${rows}</tbody></table></div>`;
  },

  searchSuccessRate() {
    const pid = document.getElementById('sr-product').value;
    const p = new URLSearchParams();
    if (pid) p.set('product_id', pid);
    location.hash = '#/success-rate?' + p.toString();
  },

  // ===== Backup / Export =====
  async backup() {
    const r = await this.post('/api/backup');
    if (r.ok) this.toast('备份完成: ' + r.data.filename);
    else this.toast(r.error || '备份失败', 'error');
  },

  exportExcel(type) {
    window.open('/api/export/excel?type=' + type, '_blank');
    this.toast('正在导出 Excel...');
  },

  exportJson() {
    window.open('/api/export/json', '_blank');
    this.toast('正在导出 JSON...');
  },
};
