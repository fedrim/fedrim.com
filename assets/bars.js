(function () {
  'use strict';
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }
  const _rc = Element.prototype.replaceChildren;
  Element.prototype.replaceChildren = function (...k) { return _rc.apply(this, k.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false)); };
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const tip = el('div', { class: 'tip', role: 'tooltip' });
  document.body.append(tip);
  document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (!t) return; tip.textContent = t.getAttribute('data-tip'); tip.style.display = 'block'; const r = t.getBoundingClientRect(); tip.style.left = Math.min(r.left + 12, window.innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = Math.min(r.bottom + 6, window.innerHeight - tip.offsetHeight - 8) + 'px'; });
  document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('[data-tip]')) tip.style.display = 'none'; });
  document.addEventListener('mousemove', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.style.display = 'none'; return; }
    tip.textContent = t.getAttribute('data-tip');
    tip.style.display = 'block';
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });

  function twinTable(head, rows) {
    const t = el('table', { class: 'twin' }, el('thead', null, el('tr', null, head.map(h => el('th', null, h)))), el('tbody', null, rows.map(r => el('tr', null, r.map((c, i) => el('td', { class: i ? 'num' : '' }, c))))));
    return el('details', { class: 'twin' }, el('summary', null, `Show as a table (${rows.length} row${rows.length === 1 ? '' : 's'})`), t);
  }
  function hbars(rows, opts) {
    opts = opts || {};
    const max = Math.max(1, ...rows.map(r => r.value));
    const box = el('div', { class: 'hb' + (opts.compact ? ' compact' : '') });
    for (const r of rows) {
      const pct = Math.max(0.4, (r.value / max) * 100);
      box.append(el('div', { class: 'hb-row' + (r.hl ? ' hl' : ''), tabindex: '0', role: 'img', 'aria-label': r.tip || `${r.label}: ${opts.fmt ? opts.fmt(r.value) : fmt(r.value)}`, 'data-tip': r.tip || `${r.label}: ${opts.fmt ? opts.fmt(r.value) : fmt(r.value)}` },
        el('div', { class: 'hb-l', title: r.label }, r.label),
        el('div', { class: 'hb-t' }, el('span', { style: { width: pct + '%', background: r.color || 'var(--s1)' } })),
        el('div', { class: 'hb-v' }, opts.fmt ? opts.fmt(r.value) : fmt(r.value))));
    }
    if (opts.twin !== false && rows.length) box.append(twinTable([opts.labelHead || 'Row', opts.valueHead || 'Value'], rows.map(r => [r.label, opts.fmt ? opts.fmt(r.value) : fmt(r.value)])));
    return box;
  }
  function stacked(rows, series, opts) {
    opts = opts || {};
    const max = Math.max(1, ...rows.map(r => r.parts.reduce((a, b) => a + b, 0)));
    const wrap = el('div', { class: 'chart' });
    wrap.append(el('div', { class: 'lg' }, series.map(s => el('span', null, el('i', { style: { background: s.color } }), s.name))));
    const box = el('div', { class: 'hb' });
    for (const r of rows) {
      const total = r.parts.reduce((a, b) => a + b, 0);
      const f = opts.fmt || fmt;
      const track = el('div', { class: 'hb-t stack' });
      r.parts.forEach((v, i) => {
        if (!v || v < 0) return;
        track.append(el('span', { style: { width: (v / max * 100) + '%', background: series[i].color },
          'data-tip': `${r.label} · ${series[i].name}: ${f(v)} (${Math.round(v / total * 100)}%)` }));
      });
      box.append(el('div', { class: 'hb-row' + (r.hl ? ' hl' : ''), tabindex: '0', role: 'img', 'aria-label': r.tip || `${r.label}: ${f(total)}`, 'data-tip': r.tip || null }, el('div', { class: 'hb-l', title: r.label }, r.label), track, el('div', { class: 'hb-v' }, f(total))));
    }
    if (opts.twin !== false && rows.length) box.append(twinTable(['Row', ...series.map(x => x.name), 'Total'], rows.map(r => [r.label, ...r.parts.map(v => (opts.fmt || fmt)(v || 0)), (opts.fmt || fmt)(r.parts.reduce((a, b) => a + b, 0))])));
    wrap.append(box);
    if (opts.note) wrap.append(el('div', { class: 'hint' }, opts.note));
    return wrap;
  }

  const S = v => (v === null || v === undefined) ? '' : String(v);
  function sortableTables() {
    if (window.__sortDelegated) return; window.__sortDelegated = true;
    const UNIT = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9, bn: 1e9 };
    const key = raw => {
      const s = S(raw).trim(); if (!s || /^[—–-]+$/.test(s) || /^(n\/a|n\.a\.?|na)$/i.test(s)) return null;
      const d = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (d) return [+(d[1] + d[2] + d[3]), s];
      const m = s.replace(/,/g, '').match(/^([<>≈~]\s*)?(-|−)?\s*\$?\s*(\d+(?:\.\d+)?)(?:\s*(thousand|million|billion|bn|[KMB])(?![A-Za-z0-9]))?/i);
      if (m) { const v = parseFloat(m[3]) * (m[4] ? UNIT[m[4].toLowerCase()] || 1 : 1); return [m[2] ? -v : v, s]; }
      return [null, s]; };
    const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    document.addEventListener('click', e => {
      const th = e.target && e.target.closest ? e.target.closest('table.sortable > thead > tr > th') : null; if (!th) return;
      const tr = th.parentElement, thead = tr.parentElement, t = thead.parentElement, body = t.tBodies[0];
      if (!body || tr !== thead.rows[thead.rows.length - 1] || !th.textContent.trim() || t.dataset.ownsort) return;   // the column-name row only
      const ths = Array.from(tr.cells), i = ths.indexOf(th);
      const dir = th.classList.contains('asc') ? -1 : 1;
      ths.forEach(x => { x.classList.remove('asc', 'desc'); x.removeAttribute('aria-sort'); });
      th.classList.add(dir === 1 ? 'asc' : 'desc'); th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
      const val = r => { const c = r.cells[i]; return c ? key(c.dataset.v != null ? c.dataset.v : c.textContent) : null; };
      const all = Array.from(body.rows), keep = all.filter(r => r.classList.contains('total'));
      const rows = all.filter(r => !r.classList.contains('total')).map(r => [r, val(r)]).sort(([, x], [, y]) => {
        if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;   // blanks last either way
        const c = x[0] !== null && y[0] !== null ? (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0) || coll.compare(x[1], y[1])   // numbers in order, ties in reading order
          : x[0] === null && y[0] === null ? coll.compare(x[1], y[1]) : x[0] !== null ? -1 : 1;   // numbers before words
        return c * dir; }).map(([r]) => r);
      body.append(...rows, ...keep);
    });
  }
  sortableTables();
  window.SITEBARS = { stacked, hbars };
})();
