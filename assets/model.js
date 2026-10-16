(function (root) {
  'use strict';
  const LIMIT = 999999999, MAX_COUNTERS = 100;
  const COLORS = ['violet', 'blue', 'mint', 'orange', 'rose'];
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  const integer = (v, min = -LIMIT, max = LIMIT) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
  const clone = v => JSON.parse(JSON.stringify(v));
  function counter(name = '日常计数', value = 0, color = 'violet') {
    return { id: id(), name, value, color, step: 1, goal: null, undo: [], redo: [], log: [] };
  }
  function initial() {
    const c = counter();
    return { app: 'DotCounter', version: 1, activeId: c.id, counters: [c], settings: { theme: 'system', haptic: true, keepAwake: false } };
  }
  function entry(e) {
    if (!e || !integer(e.before) || !integer(e.after) || !integer(e.at, 0, Number.MAX_SAFE_INTEGER)) return null;
    const kinds = ['增加', '减少', '修改', '归零', '撤销', '重做'];
    return { id: typeof e.id === 'string' ? e.id.slice(0, 80) : id(), before: e.before, after: e.after, at: e.at, kind: kinds.includes(e.kind) ? e.kind : '修改' };
  }
  function validate(data) {
    if (!data || data.app !== 'DotCounter' || data.version !== 1 || !Array.isArray(data.counters) || !data.counters.length || data.counters.length > MAX_COUNTERS) throw Error('这不是有效的点点计数备份');
    const ids = new Set();
    const counters = data.counters.map(c => {
      if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 30 || !integer(c.value) || !integer(c.step, 1, 1000000) || !(c.goal === null || integer(c.goal, 1)) || typeof c.id !== 'string' || !c.id || c.id.length > 80 || ids.has(c.id)) throw Error('备份中的计数器数据不完整');
      ids.add(c.id);
      const list = (items, max) => Array.isArray(items) ? items.slice(-max).map(entry).filter(Boolean) : [];
      return { id: c.id, name: c.name.trim(), value: c.value, step: c.step, goal: c.goal, color: COLORS.includes(c.color) ? c.color : 'violet', undo: list(c.undo, 50), redo: list(c.redo, 50), log: list(c.log, 80) };
    });
    const s = data.settings || {};
    return { app: 'DotCounter', version: 1, activeId: ids.has(data.activeId) ? data.activeId : counters[0].id, counters, settings: { theme: ['system','light','dark'].includes(s.theme) ? s.theme : 'system', haptic: s.haptic !== false, keepAwake: s.keepAwake === true } };
  }
  class Store {
    constructor(data, persist = () => true) { this.data = data ? validate(data) : initial(); this.persist = persist; }
    get current() { return this.data.counters.find(c => c.id === this.data.activeId) || this.data.counters[0]; }
    save() { if (this.persist(JSON.stringify(this.data)) === false) throw Error('保存失败，请立即导出备份'); }
    select(key) { if (!this.data.counters.some(c => c.id === key)) return; this.data.activeId = key; this.save(); }
    add(config) {
      if (this.data.counters.length >= MAX_COUNTERS) throw Error('最多可创建 100 个计数器');
      const c = counter(config.name, config.value, config.color);
      c.step = config.step; c.goal = config.goal;
      const next = validate({ ...this.data, counters: [...this.data.counters, c], activeId: c.id });
      this.data = next; this.save(); return this.current;
    }
    configure(config) {
      const c = this.current;
      const candidate = { ...c, ...config, id: c.id };
      validate({ ...this.data, counters: this.data.counters.map(item => item.id === c.id ? candidate : item) });
      Object.assign(c, { name: config.name, color: config.color, step: config.step, goal: config.goal });
      if (config.value !== c.value) this.set(config.value, '修改'); else this.save();
    }
    copy(key) {
      const source = this.data.counters.find(c => c.id === key);
      if (!source) return;
      return this.add({ ...source, name: source.name.slice(0, 27) + ' 副本' });
    }
    remove(key) {
      if (this.data.counters.length === 1) throw Error('请至少保留一个计数器');
      this.data.counters = this.data.counters.filter(c => c.id !== key);
      if (key === this.data.activeId) this.data.activeId = this.data.counters[0].id;
      this.save();
    }
    set(value, kind = '修改', group = null) {
      if (!integer(value)) throw Error('数值范围为 -999,999,999 至 999,999,999');
      const c = this.current;
      if (value === c.value) return false;
      const e = { id: group || id(), before: c.value, after: value, at: Date.now(), kind };
      const last = c.undo[c.undo.length - 1];
      if (group && last && last.id === group && last.after === c.value) {
        last.after = value; last.at = e.at;
        const log = c.log[c.log.length - 1];
        if (log && log.id === group) { log.after = value; log.at = e.at; }
      } else {
        c.undo.push(e); c.undo = c.undo.slice(-50);
        c.log.push(clone(e)); c.log = c.log.slice(-80);
      }
      c.redo = []; c.value = value; this.save(); return true;
    }
    change(sign, group = null) { return this.set(this.current.value + sign * this.current.step, sign > 0 ? '增加' : '减少', group); }
    undo() {
      const c = this.current, e = c.undo[c.undo.length - 1];
      if (!e || e.after !== c.value) return false;
      c.undo.pop(); c.redo.push(e);
      c.log.push({ id: id(), before: c.value, after: e.before, at: Date.now(), kind: '撤销' });
      c.log = c.log.slice(-80); c.value = e.before; this.save(); return true;
    }
    redo() {
      const c = this.current, e = c.redo[c.redo.length - 1];
      if (!e || e.before !== c.value) return false;
      c.redo.pop(); c.undo.push(e);
      c.log.push({ id: id(), before: c.value, after: e.after, at: Date.now(), kind: '重做' });
      c.log = c.log.slice(-80); c.value = e.after; this.save(); return true;
    }
    replace(data) { this.data = validate(data); this.save(); }
    backup() { return JSON.stringify({ ...this.data, exportedAt: new Date().toISOString() }, null, 2); }
  }
  const api = { Store, validate, initial, integer, COLORS, LIMIT, MAX_COUNTERS, id };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CounterModel = api;
})(typeof window === 'undefined' ? globalThis : window);
