(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const native = window.CounterNative;
  const M = window.CounterModel;
  const icons = {
    focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    exit: '<path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5"/>',
    edit: '<path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15z"/>',
    down: '<path d="m7 10 5 5 5-5"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
    undo: '<path d="M3 10h11a6 6 0 0 1 0 12M3 10l5-5m-5 5 5 5" transform="translate(0 -2)"/>',
    redo: '<path d="M21 10H10a6 6 0 0 0 0 12m11-12-5-5m5 5-5 5" transform="translate(0 -2)"/>',
    reset: '<path d="M3 10a9 9 0 1 1 .6 6M3 4v6h6"/>',
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    count: '<rect x="4" y="3" width="16" height="18" rx="4"/><path d="M8 8h8M8 16h3m3-2v4m-2-2h4"/>',
    list: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    settings: '<path d="m10 3-.5 2-2 .9-1.9-.6L3.5 9l1.4 1.5v3L3.5 15l2.1 3.7 1.9-.6 2 .9.5 2h4l.5-2 2-.9 1.9.6 2.1-3.7-1.4-1.5v-3L20.5 9l-2.1-3.7-1.9.6-2-.9-.5-2z"/><circle cx="12" cy="12" r="3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    export: '<path d="M12 15V3m-4 4 4-4 4 4M4 14v6h16v-6"/>',
    import: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    check: '<path d="m5 12 4 4 10-10"/>',
  };
  const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
  const colors = { violet: '#8b78f2', blue: '#5d96ed', mint: '#42ad98', orange: '#e09a4c', rose: '#db7aa0' };
  const colorNames = { violet: '紫色', blue: '蓝色', mint: '绿色', orange: '橙色', rose: '粉色' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const fmt = n => new Intl.NumberFormat('en-US').format(n);
  let page = 'count', focused = false, restoreFocus = null, modalOpen = false, toastTimer, announceTimer, repeatTimer = null, repeatInterval = null;
  let savedOK = true, raw = '', initialError = '';
  try { raw = native ? native.load() : localStorage.getItem('dot-counter-v1') || ''; }
  catch (e) { initialError = '无法读取本机数据，请留意保存状态'; }
  let loaded;
  try { loaded = raw ? M.validate(JSON.parse(raw)) : undefined; }
  catch (e) { initialError = '原数据读取失败，已打开临时计数器。请尝试导入备份'; }
  const store = new M.Store(loaded, json => {
    try {
      const success = native ? native.save(json) : (localStorage.setItem('dot-counter-v1', json), true);
      savedOK = success !== false;
    } catch (e) { savedOK = false; }
    updateSaved();
    return savedOK;
  });
  function updateSaved() {
    $('.saved').innerHTML = savedOK ? '<i></i> 自动保存' : '<i></i> 保存失败，请备份';
    $('.saved').classList.toggle('failed', !savedOK);
  }
  function toast(message) {
    clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 2800);
  }
  function safe(fn, animate = false) {
    try { const result = fn(); render(animate); return result; }
    catch (e) { render(); toast(e.message || '操作未完成，请重试'); return false; }
  }
  function time(at, full = false) {
    return new Date(at).toLocaleString('zh-CN', full ? { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false } : { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  }
  function applySettings() {
    const s = store.data.settings;
    const dark = s.theme === 'dark' || (s.theme === 'system' && (native ? native.systemDark() : matchMedia('(prefers-color-scheme: dark)').matches));
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    if (native) { native.theme(s.theme); native.keepAwake(s.keepAwake); }
  }
  window.systemThemeChanged = applySettings;
  matchMedia('(prefers-color-scheme: dark)').addListener(applySettings);
  function render(animate = false) {
    const c = store.current;
    document.documentElement.style.setProperty('--accent', colors[c.color]);
    $('#counterName').textContent = c.name;
    $('#counterDot').style.background = colors[c.color];
    $('#value').textContent = fmt(c.value);
    const length = fmt(c.value).length;
    const available = $('#counterCard').clientWidth - 38;
    $('#valueBtn').style.fontSize = Math.min(focused ? 112 : 94, available / Math.max(1, length * .61)) + 'px';
    $('#valueBtn').style.letterSpacing = length > 6 ? '-1.8px' : '-4px';
    $('#valueBtn').setAttribute('aria-label', `当前数值 ${c.value}，点击修改`);
    if (animate) {
      $('#valueBtn').classList.remove('bump'); void $('#valueBtn').offsetWidth; $('#valueBtn').classList.add('bump');
      clearTimeout(announceTimer); announceTimer = setTimeout(() => { $('#liveAnnounce').textContent = '当前数值 ' + c.value; }, 300);
    }
    if (c.goal) {
      const percent = Math.min(100, Math.max(0, c.value / c.goal * 100));
      $('#goalArea').innerHTML = `<div class="goal-line"><span>目标 ${fmt(c.goal)}</span><strong>${c.value >= c.goal ? '目标达成 ✓' : Math.floor(percent) + '%'}</strong></div><div class="progress-track" role="progressbar" aria-label="目标进度" aria-valuemin="0" aria-valuemax="${c.goal}" aria-valuenow="${Math.max(0,Math.min(c.value,c.goal))}"><div class="progress-fill" style="width:${percent}%"></div></div>`;
    } else $('#goalArea').innerHTML = `<button class="goal-empty" id="addGoal">${icon('target',15)} 设置一个小目标</button>`;
    $('#minusStep').textContent = fmt(c.step); $('#plusStep').textContent = fmt(c.step);
    $('#minusBtn').setAttribute('aria-label', `减少 ${c.step}`); $('#plusBtn').setAttribute('aria-label', `增加 ${c.step}`);
    $$('#steps [data-step]').forEach(b => { b.classList.toggle('active', Number(b.dataset.step) === c.step); });
    const custom = ![1,5,10].includes(c.step);
    $('#customStep').textContent = custom ? fmt(c.step) : '自定义'; $('#customStep').classList.toggle('active', custom);
    $('#undoBtn').disabled = !c.undo.length; $('#redoBtn').disabled = !c.redo.length; $('#resetBtn').disabled = c.value === 0;
    const last = c.log[c.log.length - 1];
    $('#latestText').textContent = last ? `${time(last.at)} · ${last.kind} · ${fmt(last.before)} → ${fmt(last.after)}` : '准备好了，从第一次点击开始。';
    if (page === 'list') renderList();
    if (page === 'settings') renderSettings();
    updateSaved();
  }
  function renderList() {
    $('#listSummary').textContent = `共 ${store.data.counters.length} 个计数器 · 各自独立记录`;
    $('#counterList').innerHTML = store.data.counters.map(c => `<div class="counter-item ${c.id === store.data.activeId ? 'current' : ''}" style="--accent:${colors[c.color]}"><button class="counter-open" data-open="${esc(c.id)}"><span class="color-dot"></span><span class="counter-label"><strong>${esc(c.name)}</strong><small>${c.goal ? '目标 ' + fmt(c.goal) : '自由计数'} · 步长 ${fmt(c.step)}</small></span><span class="counter-item-value">${fmt(c.value)}</span></button><button class="counter-more" data-more="${esc(c.id)}" aria-label="管理${esc(c.name)}">${icon('more')}</button></div>`).join('');
  }
  function renderSettings() {
    $$('#themeOptions button').forEach(b => { b.classList.toggle('active', b.dataset.theme === store.data.settings.theme); b.setAttribute('aria-pressed', b.dataset.theme === store.data.settings.theme ? 'true' : 'false'); });
    $('#hapticSetting').checked = store.data.settings.haptic; $('#awakeSetting').checked = store.data.settings.keepAwake;
  }
  function showPage(next) {
    stopRepeat(); page = next;
    $$('.page').forEach(p => { p.hidden = p.id !== 'page-' + page; });
    $$('.bottom-nav button').forEach(b => { b.classList.toggle('selected', b.dataset.page === page); b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false'); });
    $('#focusBtn').hidden = next !== 'count'; render(); window.scrollTo(0,0);
  }
  function openModal(title, content, setup) {
    stopRepeat();
    $('#modalContent').onclick = null;
    if (!modalOpen) restoreFocus = document.activeElement;
    modalOpen = true; $('#modalTitle').textContent = title; $('#modalContent').innerHTML = content;
    $('#modalLayer').hidden = false; $('#app').setAttribute('aria-hidden','true'); $('#app').inert = true; document.body.style.overflow = 'hidden';
    $('#modal').scrollTop = 0; $('#modal').focus(); if (setup) setup();
  }
  function closeModal() {
    modalOpen = false; $('#modalLayer').hidden = true; $('#app').removeAttribute('aria-hidden'); $('#app').inert = false; document.body.style.overflow = '';
    if (restoreFocus && document.contains(restoreFocus) && !restoreFocus.disabled) restoreFocus.focus({preventScroll:true});
    restoreFocus = null;
  }
  function confirm(title, copy, label, action, danger = false) {
    openModal(title, `<p class="modal-copy">${esc(copy)}</p><button id="confirmAction" class="${danger ? 'danger-button' : 'primary-button'}">${esc(label)}</button><button id="cancelAction" class="secondary-button">取消</button>`, () => {
      $('#confirmAction').onclick = () => { closeModal(); safe(action); };
      $('#cancelAction').onclick = closeModal;
    });
  }
  function readInteger(input, min = -M.LIMIT, max = M.LIMIT) {
    const str = input.value.trim();
    if (!/^-?\d+$/.test(str)) throw Error('请输入整数');
    const n = Number(str); if (!M.integer(n, min, max)) throw Error(`请输入 ${fmt(min)} 至 ${fmt(max)} 之间的整数`);
    return n;
  }
  function numberDialog(kind) {
    const step = kind === 'step', c = store.current;
    openModal(step ? '自定义步长' : '修改数值', `<form id="numberForm"><div class="field"><label for="numberInput">${step ? '每次增加或减少多少' : esc(c.name)}</label><input id="numberInput" class="big-input" type="text" inputmode="${step ? 'numeric' : 'text'}" autocomplete="off" value="${step ? c.step : c.value}" maxlength="12"><small>${step ? '支持 1 至 1,000,000 的整数' : '支持正数、零和负数，最多 9 位整数'}</small></div><p id="formError" class="form-error" role="alert"></p><button class="primary-button" type="submit">保存${step ? '步长' : '数值'}</button></form>`, () => {
      const input = $('#numberInput'); input.focus(); input.select();
      $('#numberForm').onsubmit = event => {
        event.preventDefault();
        try {
          const n = readInteger(input, step ? 1 : -M.LIMIT, step ? 1000000 : M.LIMIT);
          if (step) { store.current.step = n; store.save(); } else store.set(n);
          closeModal(); render(!step); toast(step ? '步长已更新' : '数值已更新');
        } catch (e) { $('#formError').textContent = e.message; }
      };
    });
  }
  function counterForm(edit = false, goalOnly = false) {
    const c = edit ? store.current : { name:'', value:0, step:1, goal:null, color:'violet' };
    let selectedColor = c.color;
    openModal(edit ? '编辑计数器' : '新建计数器', `<form id="counterForm"><div class="field"><label for="nameInput">名称</label><input id="nameInput" placeholder="例如：游戏回合" maxlength="30" autocomplete="off" value="${esc(c.name)}"></div><div class="field"><label>标记颜色</label><div id="colorOptions" class="color-options">${M.COLORS.map(color => `<button type="button" data-color="${color}" style="--accent:${colors[color]}" class="${color === selectedColor ? 'active' : ''}" aria-label="${colorNames[color]}" aria-pressed="${color === selectedColor}"></button>`).join('')}</div></div><div class="field"><label for="initialInput">${edit ? '当前数值' : '初始数值'}</label><input id="initialInput" type="text" inputmode="text" autocomplete="off" maxlength="12" value="${c.value}"></div><div class="form-row"><div class="field"><label for="stepInput">步长</label><input id="stepInput" type="text" inputmode="numeric" maxlength="7" value="${c.step}"></div><div class="field"><label for="goalInput">目标（可选）</label><input id="goalInput" type="text" inputmode="numeric" placeholder="不设限" maxlength="9" value="${c.goal === null ? '' : c.goal}"></div></div><p class="form-error" id="formError" role="alert"></p><button type="submit" class="primary-button">${edit ? '保存修改' : '创建计数器'}</button></form>`, () => {
      $('#colorOptions').onclick = e => {
        const b = e.target.closest('[data-color]'); if (!b) return;
        selectedColor = b.dataset.color;
        $$('#colorOptions button').forEach(item => { item.classList.toggle('active', item === b); item.setAttribute('aria-pressed', String(item === b)); });
      };
      $('#counterForm').onsubmit = event => {
        event.preventDefault();
        try {
          const name = $('#nameInput').value.trim(); if (!name) throw Error('请给计数器起个名字');
          const config = { name, color:selectedColor, value:readInteger($('#initialInput')), step:readInteger($('#stepInput'),1,1000000), goal:$('#goalInput').value.trim() ? readInteger($('#goalInput'),1) : null };
          if (edit) store.configure(config); else store.add(config);
          closeModal(); showPage('count'); toast(edit ? '计数器已更新' : '新计数器已创建');
        } catch (e) { $('#formError').textContent = e.message; }
      };
      if (goalOnly) { $('#goalInput').focus(); $('#goalInput').select(); }
    });
  }
  function picker() {
    openModal('切换计数器', `<div>${store.data.counters.map(c => `<button class="option-row ${c.id === store.data.activeId ? 'active' : ''}" data-pick="${esc(c.id)}"><span class="color-dot" style="background:${colors[c.color]}"></span><span class="option-name">${esc(c.name)}</span><span class="option-value">${fmt(c.value)}</span></button>`).join('')}</div><button class="secondary-button" id="newFromPicker">+ 新建计数器</button>`, () => {
      $('#modalContent').onclick = e => {
        const b = e.target.closest('[data-pick]'); if (!b) return;
        safe(() => store.select(b.dataset.pick)); closeModal(); render();
      };
      $('#newFromPicker').onclick = () => { $('#modalContent').onclick = null; counterForm(); };
    });
  }
  function history() {
    const c = store.current;
    openModal('操作记录', `<p class="modal-copy">${esc(c.name)} · 保留最近 80 条操作，支持撤销最近 50 步。长按连续计数合并为一步。</p>${c.log.length ? [...c.log].reverse().map(e => `<div class="history-item"><span class="history-badge">${e.after > e.before ? '+' : '−'}</span><span class="history-detail">${esc(e.kind)}<small>${time(e.at,true)} · ${fmt(e.before)} → ${fmt(e.after)}</small></span><span class="history-value">${e.after - e.before > 0 ? '+' : ''}${fmt(e.after - e.before)}</span></div>`).join('') : '<div class="empty-history">还没有操作记录。<br>每一次变化，都会在这里留下痕迹。</div>'}`);
  }
  function manageCounter(key) {
    safe(() => store.select(key));
    const c = store.current;
    openModal(c.name, `<button id="manageEdit" class="option-row">${icon('edit')}<span class="option-name">编辑计数器</span></button><button id="manageCopy" class="option-row">${icon('list')}<span class="option-name">复制计数器</span></button><button id="manageDelete" class="danger-button" ${store.data.counters.length === 1 ? 'disabled' : ''}>删除计数器</button>`, () => {
      $('#manageEdit').onclick = () => counterForm(true);
      $('#manageCopy').onclick = () => { closeModal(); if (safe(() => store.copy(key))) { showPage('list'); toast('已创建副本'); } };
      $('#manageDelete').onclick = () => confirm('删除这个计数器？', `“${c.name}”的数值和操作记录都会被删除，此操作不能撤销。`, '删除计数器', () => { store.remove(key); toast('计数器已删除'); }, true);
    });
  }
  function haptic() { if (store.data.settings.haptic && native) native.haptic(); }
  function doCount(sign, group) {
    const c = store.current, before = c.value;
    const changed = safe(() => store.change(sign,group), true);
    if (changed) {
      haptic();
      if (c.goal && before < c.goal && c.value >= c.goal) toast('目标达成，继续保持！');
    } else stopRepeat();
    return changed;
  }
  function stopRepeat() {
    clearTimeout(repeatTimer); clearInterval(repeatInterval); repeatTimer = repeatInterval = null;
    $$('.count-button').forEach(b => b.classList.remove('held'));
  }
  window.stopRepeat = stopRepeat;
  function bindCount(button, sign) {
    button.onpointerdown = e => {
      if (e.button !== 0 || modalOpen || page !== 'count') return;
      e.preventDefault(); stopRepeat();
      const group = M.id(); button.classList.add('held');
      try { button.setPointerCapture(e.pointerId); } catch (_) {}
      if (!doCount(sign, group)) return;
      repeatTimer = setTimeout(() => { if (doCount(sign,group)) repeatInterval = setInterval(() => doCount(sign,group),100); },450);
    };
    button.onpointerup = button.onpointercancel = button.onlostpointercapture = stopRepeat;
    button.onpointermove = e => { const r = button.getBoundingClientRect(); if (e.clientX < r.left - 20 || e.clientX > r.right + 20 || e.clientY < r.top - 20 || e.clientY > r.bottom + 20) stopRepeat(); };
    button.onclick = e => { if (e.detail === 0 && !e.pointerType) doCount(sign); };
    button.oncontextmenu = e => e.preventDefault();
  }
  function toggleFocus() {
    focused = !focused; document.body.classList.toggle('focus-mode',focused);
    $('#focusBtn').innerHTML = icon(focused ? 'exit' : 'focus');
    $('#focusBtn').setAttribute('aria-label',focused ? '退出专注模式' : '进入专注模式'); render(); window.scrollTo(0,0);
    if (focused) toast('已进入专注模式，点右上角退出');
  }
  function exportBackup() {
    try {
      const payload = store.backup();
      if (native) native.exportBackup(payload);
      else {
        const url = URL.createObjectURL(new Blob([payload],{type:'application/json'}));
        const a = document.createElement('a'); a.href = url; a.download = '点点计数-备份-' + new Date().toISOString().slice(0,10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
        toast('备份已导出');
      }
    } catch (e) { toast('导出失败，请重试'); }
  }
  window.receiveImport = text => {
    try {
      if (typeof text !== 'string' || text.length > 4000000) throw Error('备份文件过大');
      const data = M.validate(JSON.parse(text));
      confirm('恢复这份备份？', `备份包含 ${data.counters.length} 个计数器。导入会替换本机所有计数器和设置。建议先导出当前数据。`, '确认恢复备份', () => { store.replace(data); applySettings(); showPage('count'); toast('备份已恢复'); });
    } catch (e) { toast('无法导入：' + (e instanceof SyntaxError ? '文件不是有效的 JSON 备份' : e.message)); }
  };
  window.handleBack = () => {
    stopRepeat();
    if (modalOpen) { closeModal(); return true; }
    if (focused) { toggleFocus(); return true; }
    if (page !== 'count') { showPage('count'); return true; }
    return false;
  };
  const staticIcons = { '#focusBtn':'focus', '#editCounterBtn':'edit', '#pickerChevron':'down', '#editValueIcon':'edit', '#latestIcon':'history', '#navCount':'count', '#navList':'list', '#navSettings':'settings', '#exportIcon':'export', '#importIcon':'import', '#closeModal':'close' };
  Object.entries(staticIcons).forEach(([selector,name]) => { $(selector).innerHTML = icon(name); });
  ['undo','redo','reset','history'].forEach((name,i) => { $('#' + name + 'Btn').innerHTML = icon(name) + `<span>${['撤销','重做','归零','记录'][i]}</span>`; });
  bindCount($('#minusBtn'),-1); bindCount($('#plusBtn'),1);
  $('#focusBtn').onclick = toggleFocus; $('#pickerBtn').onclick = picker; $('#editCounterBtn').onclick = () => counterForm(true);
  $('#valueBtn').onclick = $('#editValueBtn').onclick = () => numberDialog('value');
  $('#goalArea').onclick = e => { if (e.target.closest('#addGoal')) counterForm(true,true); };
  $('#steps').onclick = e => { const b = e.target.closest('[data-step]'); if (b) safe(() => { store.current.step = Number(b.dataset.step); store.save(); }); };
  $('#customStep').onclick = () => numberDialog('step');
  $('#undoBtn').onclick = () => safe(() => { if (store.undo()) { haptic(); toast('已撤销上一步'); } },true);
  $('#redoBtn').onclick = () => safe(() => { if (store.redo()) { haptic(); toast('已重做'); } },true);
  $('#resetBtn').onclick = () => confirm('将当前计数归零？', `“${store.current.name}”当前为 ${fmt(store.current.value)}。归零后可通过撤销恢复。`, '确认归零', () => { store.set(0,'归零'); toast('已归零，可撤销'); });
  $('#historyBtn').onclick = history; $('#addCounterBtn').onclick = () => counterForm();
  $('#counterList').onclick = e => {
    const open = e.target.closest('[data-open]'), more = e.target.closest('[data-more]');
    if (open) { safe(() => store.select(open.dataset.open)); showPage('count'); }
    if (more) manageCounter(more.dataset.more);
  };
  $$('.bottom-nav button').forEach(b => { b.onclick = () => showPage(b.dataset.page); });
  $('#themeOptions').onclick = e => { const b = e.target.closest('[data-theme]'); if (b) safe(() => { store.data.settings.theme = b.dataset.theme; store.save(); applySettings(); }); };
  $('#hapticSetting').onchange = e => safe(() => { store.data.settings.haptic = e.target.checked; store.save(); if (e.target.checked) haptic(); });
  $('#awakeSetting').onchange = e => safe(() => { store.data.settings.keepAwake = e.target.checked; store.save(); applySettings(); });
  $('#exportBtn').onclick = exportBackup;
  $('#importBtn').onclick = () => { if (native) native.importBackup(); else $('#importFile').click(); };
  $('#importFile').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 4000000) toast('备份文件过大');
    else try { window.receiveImport(await file.text()); } catch (_) { toast('无法读取文件'); }
    e.target.value = '';
  };
  $('#closeModal').onclick = $('#backdrop').onclick = closeModal;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { window.handleBack(); return; }
    if (e.key === 'Tab' && modalOpen) {
      const elements = $$('#modal button:not(:disabled),#modal input:not(:disabled),#modal [tabindex="0"]');
      const first = elements[0], last = elements[elements.length-1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === $('#modal'))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (!modalOpen && page === 'count' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
      if (['+','=','ArrowUp'].includes(e.key)) { e.preventDefault(); doCount(1); }
      if (['-','ArrowDown'].includes(e.key)) { e.preventDefault(); doCount(-1); }
    }
  });
  window.addEventListener('blur',stopRepeat); document.addEventListener('visibilitychange',stopRepeat);
  window.addEventListener('resize',() => render());
  applySettings(); render();
  if (initialError) { savedOK = false; updateSaved(); toast(initialError); }
})();
