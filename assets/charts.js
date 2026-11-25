(function () {
  'use strict';
  const META = JSON.parse(document.getElementById('meta').textContent);
  const SV = window.SITEVIZ || {};
  if (SV.flow) SV.flow = SV.flow.map(r => ({ app: r[0], tier: r[1], applicant: r[2], status: r[3] }));
  if (SV.tiles) SV.tiles = SV.tiles.map(r => ({ site: r[0], app: r[1], filed: r[2], tier: r[3] ? 'A1' : 'A' }));   // A1: in force
  if (SV.tmap) SV.tmap = SV.tmap.map(r => ({ site: r[0], filed: r[1], how_linked: '' }));
  const $ = (s, r) => (r || document).querySelector(s);
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const moneyM = n => { n = Number(n || 0); return n >= 1e5 ? '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M' : '$' + Math.round(n).toLocaleString('en-US'); };
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v); else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }
  const BYS = Object.fromEntries(META.centersAll.map(c => [c.site, c]));
  const TR38 = {"joint":0,"affil_to_va":1,"late_add":2,"none":3};
  const st38 = v => { const s = String(v || ''); return /^Patented|^Granted patent/.test(s) ? 'Patented' : /Expired Due to NonPayment|Patent Expired/i.test(s) ? 'Patent lapsed (fees unpaid)' : /Provisional Application Expired/i.test(s) ? 'Provisional, expired' : /Abandoned/i.test(s) ? 'Abandoned' : /^PCT|^RO PROCESSING/i.test(s) ? 'International (PCT)' : s ? 'Pending or in examination' : 'Status not read'; };
  const own38 = a => { const s = String(a || '').toUpperCase(), co = /\b(INC|LLC|CORP|LTD|L\.L\.C|CORPORATION|COMPANY|GMBH|PHARMA|THERAPEUTICS)\b/;
    if (!s.trim() || s.includes('NONE LISTED')) return 'VA alone';
    if (/VETERANS AFFAIRS|VETERANS ADMIN/.test(s)) return 'VA named with others';
    if (/UNIVERSIT|COLLEGE|REGENTS|INSTITUTE OF TECHNOLOGY|SCHOOL OF|ALUMNI|RESEARCH FOUNDATION|STC\.UNM|EDUCATIONAL FUND|NUTECH|BOARD OF (TRUSTEES|SUPERVISORS|GOVERNORS|REGENTS)|CURATORS|UNIV\b|POLYTECHNIC|TRUSTEES OF|FELLOWS OF HARVARD|WARF|UNIVERSITE|UNIVERSIDAD/.test(s)) return 'University';
    if (/HOSPITAL|MEDICAL CENT|CLINIC|HEALTH|INSTITUTE|CANCER|FOUNDATION|RESEARCH CENT|INFIRMARY|SLOAN|MAYO|CEDARS|JOSLIN|SCRIPPS|SALK|JACKSON LAB|LABORATORY|LABORATORIES/.test(s) && !co.test(s)) return 'Hospital or institute';
    if (/UNITED STATES|U\.S\. |SECRETARY|DEPARTMENT OF|NATIONAL INSTITUTES|GOVERNMENT/.test(s)) return 'Other federal agency';
    if (/\b(INC|LLC|CORP|LTD|L\.L\.C|CORPORATION|COMPANY|CO|GMBH|PHARMA\w*|THERAPEUTICS|BIO\w*|TECHNOLOGIES|SCIENCES|LABS|AG|SA|BV|PLC|LP|LLP|AKTIENGESELLSCHAFT|LIMITED|AB|N\.V|NV|KK|S\.A|SPA|OY|A\/S|PTY|VENTURES|INNOVATIONS|HOLDINGS|SYSTEMS|MEDICAL|DEVICES|GENETICS|DIAGNOSTICS)\b/.test(s)) return 'Company';
    if (/HOSPITAL|MEDICAL CENT|CLINIC|HEALTH|INSTITUTE|FOUNDATION/.test(s)) return 'Hospital or institute';
    return 'Other organization'; };
  let tip38 = null;
  const tipOn38 = (e, kids) => { if (!tip38) { tip38 = el('div', { id: 'n38-tip', role: 'tooltip' }); document.body.append(tip38); } tip38.replaceChildren(...kids); tip38.hidden = false; const r = tip38.getBoundingClientRect(); let x = e.clientX + 14, y = e.clientY + 14; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14; tip38.style.left = Math.max(4, x) + 'px'; tip38.style.top = Math.max(4, y) + 'px'; };
  const tipOff38 = () => { if (tip38) tip38.hidden = true; };
  function renderFlow38(d, leads, tgt) {   // tgt: draw into another box (the Visuals tab), without the walk-through
    const card = tgt ? null : $('#ov-flow'), host = tgt ? tgt.host : $('#ov-flow-c'); if ((!tgt && !card) || !host || !window.d3 || !d3.sankey) return; host.classList.add('n38');
    const m = new Map(); for (const l of leads) { const k = l.app || l.number; if (!k || TR38[l.tier] == null) continue; const p = m.get(k); if (!p || TR38[l.tier] < TR38[p.tier]) m.set(k, l); }
    const F = [...m.values()].map(l => [l.tier, own38(l.applicant), l.status]); if (card) card.hidden = !F.length; if (!F.length) { if (tgt) host.textContent = 'No records.'; return; }
    const TIER = [["joint","Assigned to VA by the inventors","#2563eb"],["affil_to_va","Transferred to VA by an organization","#60a5fa"],["late_add","VA added after the patent issued","#7c3aed"],["none","Not yet read","#a8a29e"]], TC = Object.fromEntries(TIER.map(x => [x[0], x[2]]));
    const OWN = ['University', 'Hospital or institute', 'Company', 'Other federal agency', 'VA named with others', 'Other organization', 'VA alone'], OUT = ["In force","Pending application","Expired (fees not paid)","Expired (end of term)","Expired","Abandoned application"];
    const cnt = new Map(); for (const f of F) { const k = f.join('|'); cnt.set(k, (cnt.get(k) || 0) + 1); }
    const nodes = [...TIER.map(x => ({ id: 't:' + x[0], name: x[1], tier: x[0] })), ...OWN.map(o => ({ id: 'o:' + o, name: o })), ...OUT.map(o => ({ id: 'u:' + o, name: o }))], l1 = new Map(), links = [];
    for (const [k, n] of cnt) { const [tr, o, u] = k.split('|'); l1.set(tr + '|' + o, (l1.get(tr + '|' + o) || 0) + n); links.push({ source: 'o:' + o, target: 'u:' + u, value: n, tier: tr, own: o, out: u }); }
    for (const [k, n] of l1) { const [tr, o] = k.split('|'); links.push({ source: 't:' + tr, target: 'o:' + o, value: n, tier: tr, own: o, out: null }); }
    const used = new Set(links.flatMap(l => [l.source, l.target])), idx = Object.fromEntries(nodes.map((n, i) => [n.id, i])), W = tgt ? Math.max(420, tgt.w) : Math.max(520, Math.round(host.clientWidth || 860)), Hh = tgt ? Math.max(240, tgt.h) : Math.min(Math.round(W * 470 / 860), Math.max(470, Math.round((window.innerHeight || 900) * 0.85))), mini = !!(tgt && tgt.mini),
      nw38 = tgt ? 10 : Math.round(12 * Math.min(1.6, Math.max(1, W / 860))), np38 = tgt ? (mini ? 4 : 8) : Math.max(8, Math.round(13 * Hh / 470)), fs38 = W >= 1000 ? 13 : W >= 800 ? 12 : 11; if (!tgt) host.style.setProperty('--fs38', fs38 + 'px');
    const g = d3.sankey().nodeId(x => x.id).nodeWidth(nw38).nodePadding(np38).nodeSort((a, b) => idx[a.id] - idx[b.id]).linkSort((a, b) => TR38[a.tier] - TR38[b.tier] || idx[a.target.id] - idx[b.target.id] || idx[a.source.id] - idx[b.source.id]).extent([[2, tgt ? 20 : 26], [W - 2, Hh - (tgt ? 4 : 6)]])({ nodes: nodes.filter(n => used.has(n.id)).map(x => ({ ...x })), links: links.map(x => ({ ...x })) });
    const tot = F.length, NK = k => F.filter(f => f[0] === k).length, nIF = F.filter(f => f[2] === 'In force').length, nVA = F.filter(f => f[1] === 'VA alone').length;
    host.replaceChildren(); const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${Hh}`).attr('role', 'img').attr('aria-label', `Flow of ${fmt(tot)} records from how VA came onto the title, to who owns them with VA, to their status. ${fmt(nIF)} are in force.`);
    [['How VA came on', 2, 'start'], ['Who owns it with VA', W / 2, 'middle'], ['Status', W - 2, 'end']].forEach(([tx, x, a]) => svg.append('text').attr('x', x).attr('y', tgt ? 10 : 13).attr('text-anchor', a).style('font-size', tgt ? '10px' : (fs38 - 1.5) + 'px').style('letter-spacing', '.1em').text(tx.toUpperCase()));
    const lk = svg.append('g').attr('fill', 'none').selectAll('path').data(g.links).join('path').attr('d', d3.sankeyLinkHorizontal()).style('stroke', x => TC[x.tier]).attr('stroke-width', x => Math.max(1, x.width)).attr('stroke-opacity', .5)
      .on('mousemove', (e, x) => tipOn38(e, [el('b', null, `${fmt(x.value)} record${x.value === 1 ? '' : 's'}`), `${(TIER.find(t => t[0] === x.tier) || [0, x.tier])[1]} → ${x.own}${x.out ? ' → ' + x.out : ''}`])).on('mouseleave', tipOff38);
    const nd = svg.append('g').selectAll('g').data(g.nodes).join('g');
    nd.append('rect').attr('x', x => x.x0).attr('y', x => x.y0).attr('width', x => x.x1 - x.x0).attr('height', x => Math.max(1, x.y1 - x.y0)).attr('rx', 2).style('fill', x => x.tier ? TC[x.tier] : 'var(--ink-2)');
    nd.append('text').attr('class', 'halo').attr('x', x => x.x0 > W - 40 ? x.x0 - 6 : x.x1 + 6).attr('y', x => (x.y0 + x.y1) / 2).attr('dy', '.35em').attr('text-anchor', x => x.x0 > W - 40 ? 'end' : 'start').style('fill', 'var(--ink)').text(x => x.name).append('tspan').style('fill', 'var(--ink-2)').text(x => '  ' + fmt(x.value));
    if (tgt) return;
    if (!window.__flow38) window.addEventListener('resize', () => { clearTimeout(window.__flow38t); window.__flow38t = setTimeout(() => { const h = $('#ov-flow-c'); if (h && h.clientWidth && window.__flow38 && Math.abs(h.clientWidth - window.__flow38w) > 24) window.__flow38(); }, 250); });
    window.__flow38 = () => renderFlow38(d, leads); window.__flow38w = host.clientWidth;
    const where = d.kind === 'all' ? '' : ' in this scope', pl = (n, a, b) => n === 1 ? a : b;
    const STEPS = [
      [null, tot, `${pl(tot, 'record lists', 'records list')} VA as an owner, each counted once. Read left to right: how VA came onto the title, who owns it with VA, and its status.`],
      [x => x.tier === 'joint', NK('joint'), `${pl(NK('joint'), 'was', 'were')} assigned to VA by the inventors.`],
      [x => x.tier === 'affil_to_va', NK('affil_to_va'), `${pl(NK('affil_to_va'), 'was', 'were')} transferred to VA by an organization, usually the partner.`],
      [x => x.tier === 'late_add', NK('late_add'), `had VA added after the patent issued.`],
      [x => x.out === 'In force', nIF, `${pl(nIF, 'is', 'are')} in force as Google Patents shows ${pl(nIF, 'it', 'them')}.`],
      [x => x.own === 'VA alone', nVA, `list VA as the only organization that owns ${pl(nVA, 'it', 'them')}.`]];
    let step = 0; const dots = $('#ov-flow-dots'); dots.replaceChildren(...STEPS.map(() => el('span')));
    const go = i => { step = Math.max(0, Math.min(STEPS.length - 1, i)); const [f, n, tx] = STEPS[step]; lk.transition().duration(350).attr('stroke-opacity', x => !f ? .5 : f(x) ? .8 : .06);
      $('#ov-flow-sn').textContent = `Step ${step + 1} of ${STEPS.length}`; $('#ov-flow-n').textContent = fmt(n); $('#ov-flow-l').textContent = tx; [...dots.children].forEach((x, j) => x.classList.toggle('on', j <= step)); $('#ov-flow-back').disabled = step === 0; $('#ov-flow-next').disabled = step === STEPS.length - 1; };
    $('#ov-flow-back').onclick = () => go(step - 1); $('#ov-flow-next').onclick = () => go(step + 1); $('#ov-flow-all').onclick = () => go(0); go(0);
    $('#ov-flow-h').textContent = `How the ${fmt(tot)} records sort: ${fmt(nIF)} in force, ${fmt(tot - nVA)} owned with another organization`;
  }
  window.FRONT38 = { flow: (host, d, leads, o) => renderFlow38(d, leads, { host, w: o.w, h: o.h, mini: o.mini }), card: (d, rows) => renderFlow38(d, rows) };   // card: the walk-through (site)

  const P40 = (META.n1140 || {}).prof || null, Y40 = [2000, 2026], nm40 = s => BYS[s] ? BYS[s].short : s;
  const m40 = v => v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'K' : '$' + fmt(v);
  function tiles38(host, leads, o) {
    host.classList.add('n38'); const by = {}, seen = new Set(), n = Y40[1] - Y40[0] + 1;
    for (const l of leads) { if (l.tier !== 'A' && l.tier !== 'A1') continue; const f = l.app || l.number, k = l.site + '|' + f, r = by[l.site] = by[l.site] || { s: l.site, yA: new Array(n).fill(0), yA1: new Array(n).fill(0), af: 0, a1: 0, s1: new Set() }, y = +(String(l.filed || l.priority || '').slice(0, 4)), j = y >= Y40[0] && y <= Y40[1] ? y - Y40[0] : -1;
      if (!seen.has(k)) { seen.add(k); r.af++; if (j >= 0) r.yA[j]++; } if (l.tier === 'A1' && !r.s1.has(f)) { r.s1.add(f); r.a1++; if (j >= 0) r.yA1[j]++; } }
    const D = Object.values(by).sort((a, b) => b.af - a.af), show = o.mini ? D.slice(0, 12) : D; if (!D.length) { host.textContent = 'No records.'; return; }
    const W = 150, Hh = o.mini ? 26 : 44, bw = W / n, gmax = Math.max(1, ...D.map(r => Math.max(...r.yA))), h = v => v ? Math.max(1.5, v / gmax * (Hh - 4)) : 0, bar = (v, j, col) => v ? `<rect x="${(j * bw + .5).toFixed(1)}" y="${(Hh - h(v)).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${h(v).toFixed(1)}" rx="1" style="fill:var(${col})"/>` : '';
    const grid = el('div', { class: 'n38-tiles' + (o.mini ? ' mini' : ''), style: o.mini ? null : { maxHeight: Math.max(200, o.h - 40) + 'px' } });
    for (const r of show) { const tl = el('div', { class: 'n38-tile' }, el('div', { class: 'nm' }, nm40(r.s)), el('div', { class: 'ct' }, `${fmt(r.af)} record${r.af === 1 ? '' : 's'}${r.a1 ? ' · ' + r.a1 + ' in force' : ''}`), el('div', { html: `<svg viewBox="0 0 ${W} ${Hh}" aria-hidden="true">${r.yA.map((v, j) => bar(v, j, '--s1')).join('')}${r.yA1.map((v, j) => bar(v, j, '--s2')).join('')}<line x1="0" x2="${W}" y1="${Hh}" y2="${Hh}" style="stroke:var(--line-strong, var(--line))"/></svg>` }));
      tl.addEventListener('mousemove', e => { const b = tl.lastChild.getBoundingClientRect(), j = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - b.left) / b.width * n))); tipOn38(e, [el('b', null, nm40(r.s)), `${Y40[0] + j}: ${fmt(r.yA[j])} record${r.yA[j] === 1 ? '' : 's'} filed${r.yA1[j] ? ', ' + r.yA1[j] + ' of them in force' : ''}`]); }); tl.addEventListener('mouseleave', tipOff38); grid.append(tl); }
    host.replaceChildren(...(o.mini ? [] : [el('div', { class: 'n38-leg' }, el('span', null, el('i', { style: { background: 'var(--s1)', borderRadius: '3px' } }), `Records by filing year, ${Y40[0]}–${Y40[1]}; the same scale for every center`), el('span', null, el('i', { style: { background: 'var(--s2)', borderRadius: '3px' } }), 'of which in force'), el('span', null, `${D.length} center${D.length === 1 ? '' : 's'}; each record once per center`))]), grid);
  }
  const TPOS40 = { AK: [0, 0], ME: [0, 11], VT: [1, 10], NH: [1, 11], WA: [2, 1], ID: [2, 2], MT: [2, 3], ND: [2, 4], MN: [2, 5], IL: [2, 6], WI: [2, 7], MI: [2, 8], NY: [2, 9], RI: [2, 10], MA: [2, 11], OR: [3, 1], NV: [3, 2], WY: [3, 3], SD: [3, 4], IA: [3, 5], IN: [3, 6], OH: [3, 7], PA: [3, 8], NJ: [3, 9], CT: [3, 10], CA: [4, 1], UT: [4, 2], CO: [4, 3], NE: [4, 4], MO: [4, 5], KY: [4, 6], WV: [4, 7], VA: [4, 8], MD: [4, 9], DE: [4, 10], AZ: [5, 2], NM: [5, 3], KS: [5, 4], AR: [5, 5], TN: [5, 6], NC: [5, 7], SC: [5, 8], DC: [5, 9], OK: [6, 4], LA: [6, 5], MS: [6, 6], AL: [6, 7], GA: [6, 8], HI: [7, 0], TX: [7, 4], FL: [7, 9], PR: [7, 11] };
  function tmap38(host, patents, o) {
    host.classList.add('n38'); const stY = {}, Ys = 1982, Ye = Y40[1]; let nodate = 0, off = 0;
    for (const p of patents) { const st = (BYS[p.site] || {}).state, y = +(String(p.filed || p.date || p.priority || '').slice(0, 4)); if (!st || !TPOS40[st]) { off++; continue; } if (!y) { nodate++; continue; } const yy = Math.max(Ys, Math.min(Ye, y)); (stY[st] = stY[st] || {})[yy] = (stY[st][yy] || 0) + 1; }
    const cum = {}, tot = {}; for (const st in TPOS40) { let a = 0; cum[st] = {}; for (let y = Ys; y <= Ye; y++) { a += (stY[st] || {})[y] || 0; cum[st][y] = a; } } for (let y = Ys; y <= Ye; y++) tot[y] = Object.keys(TPOS40).reduce((a, st) => a + cum[st][y], 0);
    const TH = [1, 5, 15, 40, 80], OP = [.05, .16, .3, .45, .6, .78], step = v => v <= 0 ? 0 : TH.filter(x => v >= x).length, S = 44, gap = 3, W = 12 * (S + gap), Hh = 8 * (S + gap);
    const box = el('div', { class: 'n38-scroll' }), yl = el('div', { class: 'n38-year' }), tl = el('div', { class: 'small muted' }), rg = el('input', { type: 'range', min: Ys, max: Ye, 'aria-label': 'Year' }), pb = el('button', { type: 'button', class: 'btn sm' }, 'Play'); let cur = Ye, timer = null;
    const set = y => { cur = +y; rg.value = cur; yl.textContent = cur; tl.textContent = `${fmt(tot[cur])} records listing VA as an owner, filed through ${cur}`;
      box.innerHTML = `<svg class="n38-tmap" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Tile map of the states: ${fmt(tot[cur])} records listing VA as an owner, filed through ${cur}" style="max-height:${Math.max(150, o.h - (o.mini ? 0 : 84))}px;max-width:${o.mini ? o.w : 760}px">` + Object.entries(TPOS40).map(([st, [r, c]]) => { const v = cum[st][cur]; return `<g transform="translate(${c * (S + gap)},${r * (S + gap)})"><rect width="${S}" height="${S}" rx="5" style="fill:var(--s1);stroke:var(--line-strong, var(--line))" fill-opacity="${OP[step(v)]}" stroke-width=".75"><title>${st}: ${fmt(v)} records listing VA as an owner, filed through ${cur}</title></rect><text x="5" y="15" style="font-weight:600;fill:var(--ink);font-size:11px;pointer-events:none">${st}</text><text x="5" y="34" style="fill:var(--ink);font-size:11.5px;pointer-events:none">${v ? fmt(v) : ''}</text></g>`; }).join('') + '</svg>'; };
    const stop = () => { clearInterval(timer); timer = null; pb.textContent = 'Play'; };
    pb.onclick = () => { if (timer) return stop(); if (cur >= Ye) set(Ys); pb.textContent = 'Pause'; timer = setInterval(() => { if (!document.body.contains(box) || cur >= Ye) return stop(); set(cur + 1); }, 260); };
    rg.oninput = () => { stop(); set(rg.value); };
    host.replaceChildren(...(o.mini ? [box] : [el('div', { class: 'n38-bar' }, yl, pb, rg, tl), box, el('div', { class: 'n38-leg' }, ['None', '1–4', '5–14', '15–39', '40–79', '80 or more'].map((tx, i) => el('span', null, el('i', { style: { background: 'var(--s1)', opacity: OP[i], borderRadius: '3px' } }), tx)), el('span', null, `By the state of the VA medical center; each record once per state${nodate ? `; ${nodate} without a date left out` : ''}${off ? `; ${off} outside the 50 states, DC and PR left out` : ''}`))])); set(Ye);
  }
  const MS40 = [['Records listing VA as an owner', fmt], ['Granted patents', fmt], ['In force', fmt], ['Published applications', fmt], ['Partner organizations', fmt], ['Citations by later patents', fmt], ['Records VA owns with no other organization', fmt]];   // site
  function prof38(host, o, site0) {
    if (!P40) { host.textContent = 'No profile data in this file.'; return; } host.classList.add('n38');
    const S = Object.keys(P40.rows), ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
    const sorted = MS40.map((_, k) => S.map(s => P40.rows[s][k]).sort((a, b) => b - a)), rank = (k, v) => sorted[k].indexOf(v) + 1, mx = MS40.map((_, k) => sorted[k][0] || 1);
    let a = site0 && P40.rows[site0] ? site0 : (P40.first || S[0]), b = '';
    const body = el('div'), opts = () => S.slice().sort((x, y) => nm40(x).localeCompare(nm40(y))).map(s => el('option', { value: s }, `${nm40(s)} (${(BYS[s] || {}).state || ''})`));
    const sa = el('select', { 'aria-label': 'Center', onchange: e => { a = e.target.value; draw(); } }, opts()), sb = el('select', { 'aria-label': 'Compare with', onchange: e => { b = e.target.value; draw(); } }, el('option', { value: '' }, 'No comparison'), opts()); sa.value = a;
    function draw() { const A = P40.rows[a], Bv = b && b !== a ? P40.rows[b] : null, ca = BYS[a] || {}, W = 600, rh = o.mini ? 24 : 30, Lx = 236, Rx = 92;
      const strips = MS40.map(([label, f], k) => { const x = v => Lx + Math.sqrt(Math.max(0, v) / mx[k]) * (W - Rx - Lx), y = k * rh + 16;
        return `<text x="0" y="${y + 4}" style="fill:var(--ink)">${label}</text><line x1="${Lx}" x2="${W - Rx}" y1="${y}" y2="${y}" style="stroke:var(--line)"/>` + S.map(s => { const xx = x(P40.rows[s][k]).toFixed(1); return `<line x1="${xx}" x2="${xx}" y1="${y - 5}" y2="${y + 5}" style="stroke:var(--ink-2)" stroke-opacity=".25"/>`; }).join('') + (Bv ? `<circle cx="${x(Bv[k]).toFixed(1)}" cy="${y}" r="5" style="fill:var(--surface);stroke:var(--s2)" stroke-width="3"/>` : '') + `<circle cx="${x(A[k]).toFixed(1)}" cy="${y}" r="6" style="fill:var(--s1);stroke:var(--surface)" stroke-width="2"/><text x="${W}" y="${y + 4}" text-anchor="end" style="fill:var(--ink);font-variant-numeric:tabular-nums">${f(A[k])}${A[k] ? ' · ' + ord(rank(k, A[k])) : ''}</text>`; }).join('');
      const svg = `<svg class="n38-strips" viewBox="0 0 ${W} ${MS40.length * rh + 8}" role="img" aria-label="${nm40(a)}: where it stands among the ${S.length} centers on ${MS40.length} measures" style="max-width:${W}px">${strips}</svg>`;
      if (o.mini) { body.replaceChildren(el('div', { style: { fontWeight: '600', marginBottom: '4px' } }, nm40(a)), el('div', { html: svg })); return; }
      const stat = k => el('div', { class: 'n38-stat' }, el('div', { class: 'v' }, MS40[k][1](A[k])), el('div', { class: 'l' }, MS40[k][0]), el('div', { class: 'r' }, (A[k] ? `${ord(rank(k, A[k]))} of ${S.length}` : 'none on record') + (Bv ? ` · ${nm40(b)}: ${MS40[k][1](Bv[k])}` : '')));
      const list = (rows, none) => rows.length ? el('ul', { class: 'n38-plist' }, rows.map(r => el('li', null, el('span', null, r[0]), el('span', null, el('span', { class: 'b', style: { width: Math.max(3, r[1] / rows[0][1] * 100) + '%' } })), el('span', { class: 'num' }, fmt(r[1]))))) : el('div', { class: 'small muted', style: { marginBottom: '12px' } }, none);
      const yA = P40.yA[a] || [], ym = Math.max(1, ...yA), n = yA.length || 1, SW = 380, SH = 56, bw = SW / n;
      const spark = yA.some(Boolean) ? `<svg viewBox="0 0 ${SW} ${SH + 14}" style="max-width:${SW}px" role="img" aria-label="${nm40(a)}: records by filing year, most in one year ${ym}">${yA.map((v, j) => v ? `<rect x="${(j * bw + 1).toFixed(1)}" y="${(SH - v / ym * (SH - 16)).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${(v / ym * (SH - 16)).toFixed(1)}" rx="1.5" style="fill:var(--s1)"><title>${Y40[0] + j}: ${v}</title></rect>` : '').join('')}<line x1="0" x2="${SW}" y1="${SH}" y2="${SH}" style="stroke:var(--line-strong, var(--line))"/><text x="0" y="${SH + 12}">${Y40[0]}</text><text x="${SW}" y="${SH + 12}" text-anchor="end">${Y40[1]}</text><text x="${SW}" y="9" text-anchor="end">most in one year: ${ym}</text></svg>` : '';
      body.replaceChildren(el('div', { class: 'n38-pfh' }, el('strong', null, ca.name || nm40(a)), el('span', { class: 'small muted' }, ` ${ca.city || ''}, ${ca.state || ''}`)),
        el('div', { class: 'n38-stats' }, [0, 1, 2, 3, 4, 6].map(stat)),
        el('div', { class: 'n38-pfg' }, el('div', null, el('h4', null, `Where it stands among the ${S.length} centers`), el('div', { class: 'n38-leg' }, el('span', null, el('i', { style: { background: 'var(--s1)' } }), nm40(a)), Bv ? el('span', null, el('i', { style: { background: 'var(--surface)', border: '3px solid var(--s2)' } }), nm40(b) + ' (ring)') : null, el('span', null, el('i', { style: { width: '1px', background: 'var(--ink-2)', borderRadius: '0' } }), 'every other center')), el('div', { class: 'n38-scroll', html: svg }), spark ? el('h4', { style: { marginTop: '10px' } }, 'Records by filing year') : null, spark ? el('div', { html: spark }) : null),
          el('div', null, el('h4', null, 'Owners with VA (records)'), list(P40.filers[a] || [], 'VA is the only organization that owns these records.'), el('h4', null, 'Technology areas (records)'), list((P40.tech || {})[a] || [], 'Not yet classified.'))),
        el('p', { class: 'hint' }, `Rank 1 is the highest count among the ${S.length} VA medical centers with records. From USPTO assignment records and Google Patents.`)); }
    host.replaceChildren(...(o.mini ? [] : [el('div', { class: 'n38-bar no-print' }, el('label', null, 'Center ', sa), el('label', null, 'Compare with ', sb))]), body); draw();
  }
  Object.assign(window.FRONT38 = window.FRONT38 || {}, { tiles: tiles38, tmap: tmap38, prof: prof38 });
})();
(function () {
  'use strict'; // @vizlib1134
  const d3 = window.d3, topojson = window.topojson;
  const SC = window.SCOPE || null;
  const META = JSON.parse(document.getElementById('meta').textContent);
  const host0 = document.getElementById('view-visuals'); if (!host0 || !d3) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cssv = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }
  const ALLC = META.centersAll || [], SHORT = Object.fromEntries(ALLC.map(c => [c.site, c.short])), BYC = Object.fromEntries(ALLC.map(c => [c.site, c]));
  const sh = s => SHORT[s] || s;
  const C = () => ({
    ink: cssv('--ink') || '#1a1a1a', ink2: cssv('--ink-2') || '#555', ink3: cssv('--ink-3') || '#888', grid: cssv('--cds-chart-grid') || '#e4e2da', axis: cssv('--cds-chart-axis') || '#8a897f',
    s: [1, 2, 3, 4, 5].map(i => cssv('--s' + i) || ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#8c8a99'][i - 1]), lead: cssv('--g-lead') || '#eb6834', patent: cssv('--g-patent') || '#2a78d6',
    tie: cssv('--g-tie') || '#1a9c74', ctx: cssv('--g-ctx') || '#8c8a99', crada: cssv('--g-crada') || '#7c3aed', surface: cssv('--surface') || '#fff', surface2: cssv('--surface-2') || '#f4f4f2', line: cssv('--line') || '#ddd',
    dark: document.documentElement.getAttribute('data-theme') === 'dark' || (document.documentElement.getAttribute('data-theme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches),
  });

  let tipEl = null;
  function tip(ev, html) {
    if (!tipEl) { tipEl = el('div', { class: 'vz-tip', role: 'tooltip' }); document.body.append(tipEl); }
    if (!html) { tipEl.style.display = 'none'; return; }
    tipEl.innerHTML = html; tipEl.style.display = 'block';
    const r = tipEl.getBoundingClientRect(); let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    tipEl.style.left = Math.max(4, x) + 'px'; tipEl.style.top = Math.max(4, y) + 'px';
  }
  const hideTip = () => tip(null, '');
  const onTip = (sel, f, o) => { if (o.mini) return sel; return sel.style('cursor', o.click ? 'pointer' : 'default').on('mousemove', (ev, d) => tip(ev, f(d))).on('mouseleave', hideTip); };

  let GP = null;
  async function gather() {
    if (GP) return GP;
    GP = (async () => {
      const V = window.SITEVIZ || {};
      const d = SC ? SC.describe() : { sites: ALLC.map(c => c.site), kind: 'all', label: 'Every VA medical center' };
      const G = { d, sites: new Set(V.withRecords || d.sites), all: !SC || d.kind === 'all', V };
      G.label = G.all ? 'every VA medical center' : d.label;
      return G;
    })();
    return GP;
  }
  const iticks = (sc, n) => sc.ticks(n).filter(t => Number.isInteger(t));
  function svgFor(host, o) {
    return d3.select(host).append('svg').attr('viewBox', `0 0 ${o.w} ${o.h}`).attr('width', o.w).attr('height', o.h).attr('role', 'img').attr('aria-label', [o.title, o.note].filter(Boolean).join('. '))
      .style('font-family', 'var(--font)').style('max-width', '100%').style('height', 'auto').style('display', 'block');
  }
  function keyRow(svg, keys, x0, y0, c, maxW) {   // a one-line legend; wraps to a second line when needed
    let x = x0, y = y0; const g = svg.append('g').attr('font-size', 11.5).attr('fill', c.ink2);
    for (const [name, col, shape] of keys) {
      const w = 22 + name.length * 6.7; if (x + w > x0 + maxW && x > x0) { x = x0; y += 16; }
      if (shape === 'line') g.append('rect').attr('x', x).attr('y', y - 5).attr('width', 12).attr('height', 3).attr('rx', 1.5).attr('fill', col);
      else if (shape === 'dot') g.append('circle').attr('cx', x + 5).attr('cy', y - 4).attr('r', 5).attr('fill', col);
      else g.append('rect').attr('x', x).attr('y', y - 9).attr('width', 11).attr('height', 11).attr('rx', 2).attr('fill', col);
      g.append('text').attr('x', x + 16).attr('y', y).text(name); x += w + 8;
    }
    return y + 10;
  }
  function empty(host, o, msg) { const svg = svgFor(host, o); svg.append('text').attr('x', o.w / 2).attr('y', o.h / 2).attr('text-anchor', 'middle').attr('fill', C().ink3).attr('font-size', 14).text(msg || 'Nothing in this scope.'); }

  function hbar(host, o) {
    const c = C(), W = o.w, H = o.h, rows = o.rows; if (!rows.length) return empty(host, o);
    const svg = svgFor(host, o); const keys = o.keys || [];
    let top = 8; if (o.head) { svg.append('text').attr('x', 8).attr('y', 16).attr('font-size', 12.5).attr('font-weight', 600).attr('fill', c.ink).text(o.head); top = 26; }
    if (keys.length > 1) top = keyRow(svg, keys, 8, top + 8, c, W - 16) + 4;
    const labW = Math.min(o.labW || 220, W * .42), m = { t: top, r: 54, b: o.more ? 36 : 20, l: labW + 10 };
    const step = (H - m.t - m.b) / rows.length, bh = Math.max(3, Math.min(rows.length <= 6 ? 34 : 24, step * .62));
    const tot = r => r.vals.reduce((a, b) => a + b, 0), mx = o.max || d3.max(rows, tot) || 1;
    const x = d3.scaleLinear().domain([0, mx]).range([0, W - m.l - m.r]).nice();
    const ax = svg.append('g').attr('transform', `translate(${m.l},${H - m.b})`);
    for (const t of iticks(x, Math.max(2, Math.floor((W - m.l - m.r) / 90)))) { ax.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', 0).attr('y2', -(H - m.t - m.b)).attr('stroke', c.grid); ax.append('text').attr('x', x(t)).attr('y', 14).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', c.ink2).text(o.fmtx ? o.fmtx(t) : d3.format('~s')(t)); }
    const fs = Math.max(9, Math.min(12.5, step * .62));
    rows.forEach((r, i) => {
      const y = m.t + i * step + (step - bh) / 2; const g = svg.append('g');
      { const cap = Math.floor(labW / (fs * .55)), lab = String(r.label || ''); const t = g.append('text').attr('x', m.l - 8).attr('text-anchor', 'end').attr('font-size', fs).attr('fill', r.strong ? c.ink : c.ink2).attr('font-weight', r.strong ? 600 : 400);
        if (lab.length > cap && step >= fs * 2.2 && !o.mini) { let cut = lab.lastIndexOf(' ', cap); if (cut < cap * .5) cut = cap; const l1 = lab.slice(0, cut), l2 = trunc(lab.slice(cut).trim(), cap);
          t.attr('y', y + bh / 2 - fs * .2); t.append('tspan').attr('x', m.l - 8).text(l1); t.append('tspan').attr('x', m.l - 8).attr('dy', fs * 1.1).text(l2); }
        else t.attr('y', y + bh / 2 + fs * .35).text(trunc(lab, cap)); }
      let x0 = 0;
      r.vals.forEach((v, k) => {
        if (!v) return; const col = r.color || (keys[k] ? keys[k][1] : c.s[k % 5]);
        const seg = g.append('rect').attr('x', m.l + x(x0)).attr('y', y).attr('width', Math.max(.5, x(x0 + v) - x(x0))).attr('height', bh).attr('fill', col).attr('rx', Math.min(3, bh / 3)).attr('stroke', r.vals.filter(Boolean).length > 1 ? c.surface : null).attr('stroke-width', r.vals.filter(Boolean).length > 1 ? 1 : null);
        onTip(seg, () => `<b>${esc(r.label)}</b><br>${keys[k] ? esc(keys[k][0]) + ': ' : ''}${fmt(v)}${r.vals.length > 1 ? ` (${pct(v, tot(r))} of ${fmt(tot(r))})` : ''}${r.tip ? '<br>' + r.tip : ''}`, o);
        if (r.click && !o.mini) seg.style('cursor', 'pointer').on('click', () => r.click());
        x0 += v;
      });
      g.append('text').attr('x', m.l + x(tot(r)) + 5).attr('y', y + bh / 2 + fs * .35).attr('font-size', fs).attr('fill', c.ink2).text(o.fmtv ? o.fmtv(tot(r)) : fmt(tot(r)));
    });
    if (o.more) svg.append('text').attr('x', 8).attr('y', H - 4).attr('font-size', 11).attr('fill', c.ink3).text(o.more);
  }
  function vbar(host, o) {
    const c = C(), W = o.w, H = o.h, cats = o.cats, S = o.series; if (!cats.length) return empty(host, o);
    const svg = svgFor(host, o); let top = 10; if (S.length > 1) top = keyRow(svg, S.map(s => [s.name, s.color]), 8, 16, c, W - 16) + 6;
    const m = { t: top, r: 14, b: 34, l: 48 };
    const tot = i => S.reduce((a, s) => a + (s.vals[i] || 0), 0), mx = Math.max(o.ymin || 0, d3.max(cats.map((_, i) => tot(i))) || 1);
    const x = d3.scaleBand().domain(cats.map(String)).range([m.l, W - m.r]).padding(.18), y = d3.scaleLinear().domain([0, mx]).range([H - m.b, m.t]).nice();
    for (const t of iticks(y, 4)) { svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', c.grid); svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', c.ink2).text(d3.format('~s')(t)); }
    const every = Math.ceil(cats.length / Math.max(2, Math.floor((W - m.l - m.r) / 44)));
    cats.forEach((cat, i) => {
      let y0 = 0;
      S.forEach(s => { const v = s.vals[i] || 0; if (!v) return; const r = svg.append('rect').attr('x', x(String(cat))).attr('width', x.bandwidth()).attr('y', y(y0 + v)).attr('height', Math.max(.5, y(y0) - y(y0 + v))).attr('fill', s.color).attr('fill-opacity', o.partial && o.partial(cat) ? .45 : 1).attr('stroke', S.length > 1 ? c.surface : null).attr('stroke-width', S.length > 1 ? 1 : null);
        onTip(r, () => `<b>${esc(o.catLabel ? o.catLabel(cat) : cat)}</b><br>${S.length > 1 ? esc(s.name) + ': ' : ''}${fmt(v)}${S.length > 1 ? ` (of ${fmt(tot(i))})` : ''}${o.tipx ? o.tipx(cat, s) : ''}`, o); y0 += v; });
      if (o.partial && o.partial(cat) && !o.mini) svg.append('text').attr('x', x(String(cat)) + x.bandwidth() / 2).attr('y', y(tot(i)) - 4).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', c.ink3).text('partial');
      if (i % every === 0) svg.append('text').attr('x', x(String(cat)) + x.bandwidth() / 2).attr('y', H - m.b + 15).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', c.ink2).text(o.catLabel ? o.catLabel(cat) : cat);
    });
    if (o.xlab) svg.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', H - 4).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', c.ink3).text(o.xlab);
    if (o.ylab) svg.append('text').attr('transform', `translate(12,${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', c.ink3).text(o.ylab);
  }
  function lines(host, o) {
    const c = C(), W = o.w, H = o.h, xs = o.xs, S = o.series; if (!xs.length) return empty(host, o);
    const svg = svgFor(host, o); const top = keyRow(svg, S.map(s => [s.name, s.color, 'line']), 8, 16, c, W - 16) + 6;
    const m = { t: top, r: 18, b: 30, l: 50 };
    const x = d3.scaleLinear().domain(d3.extent(xs)).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, d3.max(S.flatMap(s => s.vals)) || 1]).range([H - m.b, m.t]).nice();
    for (const t of iticks(y, 4)) { svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', c.grid); svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', c.ink2).text(o.fmty ? o.fmty(t) : d3.format('~s')(t)); }
    for (const t of x.ticks(Math.min(xs.length, Math.floor((W - m.l - m.r) / 60)))) svg.append('text').attr('x', x(t)).attr('y', H - m.b + 16).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', c.ink2).text(Math.round(t));
    const pf = o.partialFrom;
    if (pf && pf <= xs[xs.length - 1]) { const x0 = x(Math.max(xs[0], pf - .5)); svg.append('rect').attr('x', x0).attr('y', m.t).attr('width', W - m.r - x0).attr('height', H - m.t - m.b).attr('fill', c.ink3).attr('opacity', .08);
      if (!o.mini) svg.append('text').attr('x', W - m.r - 4).attr('y', m.t + 12).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', c.ink3).text(o.partialLabel || 'incomplete'); }
    S.forEach(s => {
      const pts = xs.map((xv, i) => [xv, s.vals[i]]).filter(p => p[1] !== null && p[1] !== undefined);
      if (s.area) svg.append('path').attr('d', d3.area().x(p => x(p[0])).y0(y(0)).y1(p => y(p[1]))(pts)).attr('fill', s.color).attr('opacity', .16);
      const a = pf ? pts.filter(p => p[0] <= pf - 1) : pts, b = pf ? pts.filter(p => p[0] >= pf - 1) : [];
      svg.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[1]))(a)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', o.mini ? 2.5 : 2.2).attr('stroke-dasharray', s.dash || null);
      if (b.length > 1) svg.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[1]))(b)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', o.mini ? 2.5 : 2.2).attr('stroke-dasharray', '5 4');
    });
    if (!o.mini) {   // hover: a vertical rule with every series' value
      const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', c.ink3).attr('stroke-dasharray', '3 3').style('display', 'none');
      svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
        .on('mousemove', ev => { const [px] = d3.pointer(ev); const xv = Math.round(x.invert(px)); const i = xs.indexOf(xv); if (i < 0) return; rule.attr('x1', x(xv)).attr('x2', x(xv)).style('display', null);
          tip(ev, `<b>${xv}</b>` + S.map(s => `<br><span style="color:${s.color}">■</span> ${esc(s.name)}: ${s.vals[i] == null ? '—' : (o.fmty ? o.fmty(s.vals[i]) : fmt(s.vals[i]))}`).join('')); })
        .on('mouseleave', () => { rule.style('display', 'none'); hideTip(); });
    }
    if (o.ylab) svg.append('text').attr('transform', `translate(12,${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', c.ink3).text(o.ylab);
  }
  function scatter(host, o) {
    const c = C(), W = o.w, H = o.h, P = o.pts; if (!P.length) return empty(host, o);
    const svg = svgFor(host, o); const m = { t: 14, r: 20, b: 40, l: 56 };
    const sc = (k) => o.scale === 'sqrt' ? d3.scaleSqrt() : o.scale === 'log' ? d3.scaleSymlog().constant(1) : d3.scaleLinear();
    const mx = d3.max(P, p => p.x) || 1, my = d3.max(P, p => p.y) || 1;
    const x = sc().domain([0, mx * 1.04]).range([m.l, W - m.r]).nice(), y = sc().domain([0, my * 1.04]).range([H - m.b, m.t]).nice();
    for (const t of iticks(x, 5)) { svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', c.grid); svg.append('text').attr('x', x(t)).attr('y', H - m.b + 15).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', c.ink2).text(d3.format('~s')(t)); }
    for (const t of iticks(y, 5)) { svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', c.grid); svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', c.ink2).text(d3.format('~s')(t)); }
    if (o.diag) { const d = Math.min(x.domain()[1], y.domain()[1]); const pts = d3.range(0, 41).map(i => d * i / 40); svg.append('path').attr('d', d3.line().x(v => x(v)).y(v => y(v))(pts)).attr('stroke', c.ink3).attr('stroke-dasharray', '4 4').attr('fill', 'none');
      svg.append('text').attr('x', x(d * .82)).attr('y', y(d * .82) - 6).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', c.ink3).text(o.diag); }
    const dots = svg.append('g');
    P.slice().sort((a, b) => (a.hl ? 1 : 0) - (b.hl ? 1 : 0)).forEach(p => {
      const d = dots.append('circle').attr('cx', x(p.x)).attr('cy', y(p.y)).attr('r', p.r || (o.mini ? 5 : 5.5)).attr('fill', p.hl ? (p.color || c.patent) : c.ctx).attr('opacity', p.hl ? .85 : .35).attr('stroke', c.surface).attr('stroke-width', 1);
      onTip(d, () => p.tip || `<b>${esc(p.label)}</b><br>${esc(o.xlab)}: ${fmt(p.x)}<br>${esc(o.ylab)}: ${fmt(p.y)}`, o);
    });
    const lab = P.filter(p => p.hl).sort((a, b) => (b.y + b.x) - (a.y + a.x)).slice(0, o.mini ? 5 : (o.nlab || 14));
    const boxes = P.map(p => [x(p.x) - 5, y(p.y) - 5, x(p.x) + 5, y(p.y) + 5]);
    for (const p of lab) { const t = trunc(p.label, 22), fs = o.mini ? 12 : 11; let bx = [x(p.x) + 8, y(p.y) - fs * .7, x(p.x) + 8 + t.length * fs * .56, y(p.y) + fs * .4], anchor = 'start';
      if (bx[2] > W - 4) { bx = [x(p.x) - 8 - t.length * fs * .56, bx[1], x(p.x) - 8, bx[3]]; anchor = 'end'; }
      if (boxes.some(q => !(bx[2] < q[0] || bx[0] > q[2] || bx[3] < q[1] || bx[1] > q[3])) && boxes.length > P.length) continue;
      if (boxes.slice(P.length).some(q => !(bx[2] < q[0] || bx[0] > q[2] || bx[3] < q[1] || bx[1] > q[3]))) continue;
      boxes.push(bx); svg.append('text').attr('x', anchor === 'start' ? bx[0] : bx[2]).attr('y', y(p.y) + 4).attr('text-anchor', anchor).attr('font-size', fs).attr('fill', c.ink2).attr('paint-order', 'stroke').attr('stroke', c.surface).attr('stroke-width', 3).text(t); }
    svg.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', H - 6).attr('text-anchor', 'middle').attr('font-size', 11.5).attr('fill', c.ink3).text(o.xlab);
    svg.append('text').attr('transform', `translate(13,${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 11.5).attr('fill', c.ink3).text(o.ylab);
  }
  function heat(host, o) {
    const c = C(), W = o.w, H = o.h; if (!o.rows.length) return empty(host, o);
    const svg = svgFor(host, o); const labW = Math.min(o.labW || 170, W * .3), headH = o.headH || 30;
    const m = { t: headH + 8, r: 8, b: 8, l: labW + 8 }, cw = (W - m.l - m.r) / o.cols.length, rh = Math.min(26, (H - m.t - m.b) / o.rows.length);
    const fs = Math.max(8, Math.min(12, rh * .6)), cfs = Math.max(8, Math.min(12, Math.min(cw, rh) * .5));
    o.cols.forEach((h, j) => { const tx = m.l + j * cw + cw / 2;
      if (o.rotate) svg.append('text').attr('transform', `translate(${tx + 3},${m.t - 6}) rotate(-50)`).attr('font-size', Math.min(11, cw * .9)).attr('fill', c.ink2).text(h);
      else svg.append('text').attr('x', tx).attr('y', m.t - 8).attr('text-anchor', 'middle').attr('font-size', Math.min(11, cw / Math.max(4, String(h).length) * 1.8)).attr('fill', c.ink2).text(h); });
    o.rows.forEach((rl, i) => {
      const y = m.t + i * rh;
      svg.append('text').attr('x', m.l - 8).attr('y', y + rh / 2 + fs * .35).attr('text-anchor', 'end').attr('font-size', fs).attr('fill', c.ink2).text(trunc(rl, Math.floor(labW / (fs * .55))));
      o.cols.forEach((_, j) => {
        const z = o.cell(i, j); const x = m.l + j * cw;
        const r = svg.append('rect').attr('x', x + .5).attr('y', y + .5).attr('width', Math.max(0, cw - 1)).attr('height', Math.max(0, rh - 1)).attr('rx', 2).attr('fill', z && z.col ? z.col : c.surface2);
        if (z && z.t && cw > 14 && rh > 11) svg.append('text').attr('x', x + cw / 2).attr('y', y + rh / 2 + cfs * .36).attr('text-anchor', 'middle').attr('font-size', cfs).attr('font-weight', 600).attr('fill', z.col ? bestInk(z.col) : c.ink).attr('pointer-events', 'none').text(z.t);
        if (z && z.tip) onTip(r, () => z.tip, o);
      });
    });
  }
  function split(host, o, parts) {
    const tot = d3.sum(parts, p => p.rows.length + (p.keys && p.keys.length > 1 ? 3 : 2));
    for (const p of parts) { const d = el('div', { class: 'vz-part' }); host.append(d); hbar(d, Object.assign({}, o, p, { h: Math.max(80, Math.round(o.h * (p.rows.length + (p.keys && p.keys.length > 1 ? 3 : 2)) / tot)) })); }
  }
  const lum = col => { const r = d3.rgb(col); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r.r) + .7152 * f(r.g) + .0722 * f(r.b); };
  const bestInk = bg => (1.05 / (lum(bg) + .05) >= (lum(bg) + .05) / .05 ? '#ffffff' : '#000000');
  function dots(host, o) {   // pts [{t: Date, row, label, tip, url, col}]
    const c = C(), W = o.w, H = o.h, P = o.pts.filter(p => p.t && !isNaN(p.t)); if (!P.length) return empty(host, o);
    const svg = svgFor(host, o), rows = o.rows, labW = Math.min(o.labW || 200, W * .34), m = { t: 12, r: 16, b: 30, l: labW + 10 };
    const ext = d3.extent(P, p => p.t); if (o.today) { ext[0] = new Date(Math.min(ext[0], o.today)); ext[1] = new Date(Math.max(ext[1], o.today)); } const x = d3.scaleTime().domain(ext).range([m.l, W - m.r]).nice();
    const step = (H - m.t - m.b) / rows.length;
    for (const t of x.ticks(Math.max(2, Math.floor((W - m.l - m.r) / 80)))) { svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', c.grid); svg.append('text').attr('x', x(t)).attr('y', H - m.b + 15).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', c.ink2).text(d3.timeFormat(o.tfmt || '%Y')(t)); }
    if (o.today) { svg.append('line').attr('x1', x(o.today)).attr('x2', x(o.today)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', c.lead).attr('stroke-dasharray', '4 3'); svg.append('text').attr('x', x(o.today) + 4).attr('y', m.t + 10).attr('font-size', 10.5).attr('fill', c.lead).text(o.todayLabel || 'today'); }
    rows.forEach((rl, i) => { const fs = Math.max(9, Math.min(12, step * .55)); svg.append('text').attr('x', m.l - 8).attr('y', m.t + i * step + step / 2 + fs * .35).attr('text-anchor', 'end').attr('font-size', fs).attr('fill', c.ink2).text(trunc(rl, Math.floor(labW / (fs * .55))));
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', m.t + i * step + step / 2).attr('y2', m.t + i * step + step / 2).attr('stroke', c.grid).attr('stroke-dasharray', '2 3'); });
    const seen = {};
    for (const p of P) { const ri = rows.indexOf(p.row); if (ri < 0) continue; const k = ri + ':' + Math.round(x(p.t) / 6); seen[k] = (seen[k] || 0) + 1; const jit = ((seen[k] - 1) % 3 - 1) * Math.min(6, step * .2);
      const d = svg.append('circle').attr('cx', x(p.t)).attr('cy', m.t + ri * step + step / 2 + jit).attr('r', o.mini ? 5 : 6).attr('fill', p.col || c.patent).attr('fill-opacity', .85).attr('stroke', c.surface).attr('stroke-width', 1.2);
      onTip(d, () => p.tip, Object.assign({ click: !!p.url }, o)); if (p.url && !o.mini) d.on('click', () => window.open(p.url, '_blank', 'noopener')); }
    if (o.xlab) svg.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', H - 3).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', c.ink3).text(o.xlab);
  }
  const ramp = (c, hi, v, mx) => { if (!v) return null; const t = Math.min(1, .18 + .82 * Math.sqrt(v / Math.max(1, mx))); return d3.interpolateRgb(c.surface2, hi)(t); };
  const inkOn = (c, v, mx) => bestInk(ramp(c, c.lead, v, mx) || c.surface2);

  function usmap(host, o) {
    const c = C(), W = o.w, H = o.h; const svg = svgFor(host, o);
    if (!window.RM_US || !topojson) return empty(host, o, 'The map outline is not in this file.');
    const states = topojson.feature(window.RM_US, window.RM_US.objects.states), feats = states.features.filter(f => f.id !== '72');
    const SN = (SC && SC.STATE_NAMES) || { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico', PH: 'Philippines', GU: 'Guam' }; const codeOf = {}; for (const [k, v] of Object.entries(SN)) codeOf[v] = k;
    const fitF = o.fit && o.fit.size ? feats.filter(f => o.fit.has(codeOf[f.properties.name]) && !['02', '15'].includes(f.id)) : feats;
    const bottom = o.mini ? 6 : 46, pdx = (o.pad || 0) * W, pdy = (o.pad || 0) * H, proj = d3.geoAlbersUsa().fitExtent([[8 + pdx, 8 + pdy], [W - 8 - pdx, H - bottom - pdy]], { type: 'FeatureCollection', features: fitF.length ? fitF : feats }), path = d3.geoPath(proj);
    const sv = o.stateVals || {}, smx = d3.max(Object.values(sv)) || 1;
    svg.append('g').selectAll('path').data(feats).join('path').attr('d', path).attr('stroke', c.line).attr('stroke-width', .8)
      .attr('fill', f => { const v = sv[codeOf[f.properties.name]]; return o.mode === 'states' && v ? ramp(c, c.patent, v, smx) : (o.scoped && o.scoped.has(codeOf[f.properties.name]) ? c.surface2 : c.surface); })
      .each(function (f) { if (o.mode === 'states') onTip(d3.select(this), () => { const k = codeOf[f.properties.name]; return `<b>${esc(f.properties.name)}</b><br>${esc(o.metricName)}: ${fmt(sv[k] || 0)}${o.stateTip ? o.stateTip(k) : ''}`; }, o); });
    if (o.outline && o.outline.size) svg.append('g').attr('pointer-events', 'none').selectAll('path').data(feats.filter(f => o.outline.has(codeOf[f.properties.name]))).join('path').attr('d', path).attr('fill', 'none').attr('stroke', c.ink).attr('stroke-width', o.mini ? 1.2 : 2);
    if (o.mode === 'bubbles') {
      const P = o.pts.map(p => Object.assign({}, p, { xy: proj([p.lon, p.lat]) })).filter(p => p.xy);
      const mx = d3.max(P, p => p.v) || 1, r = d3.scaleSqrt().domain([0, mx]).range([0, o.mini ? 12 : Math.min(30, W / 32)]);
      const g = svg.append('g');
      P.filter(p => !p.hl).forEach(p => g.append('circle').attr('cx', p.xy[0]).attr('cy', p.xy[1]).attr('r', o.mini ? 1.6 : 2.2).attr('fill', c.ctx).attr('opacity', .5));
      P.filter(p => p.hl).sort((a, b) => b.v - a.v).forEach(p => {
        const d = g.append('circle').attr('cx', p.xy[0]).attr('cy', p.xy[1]).attr('r', Math.max(2.5, r(p.v))).attr('fill', p.v ? c.lead : 'none').attr('fill-opacity', .62).attr('stroke', p.v ? c.lead : c.ink3).attr('stroke-width', 1.2);
        onTip(d, () => p.tip, Object.assign({ click: !!p.click }, o)); if (p.click && !o.mini) d.on('click', p.click);
      });
      if (!o.mini) {
        const boxes = []; P.filter(p => p.hl && p.v).sort((a, b) => b.v - a.v).filter(p => { const b = [p.xy[0] + r(p.v) + 3, p.xy[1] - 9, p.xy[0] + r(p.v) + 3 + p.short.length * 6.2, p.xy[1] + 5]; if (b[2] > W || boxes.some(q => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]))) return false; boxes.push(b); return true; }).slice(0, o.nlab || 12).forEach(p => svg.append('text').attr('x', p.xy[0] + r(p.v) + 3).attr('y', p.xy[1] + 4).attr('font-size', 11).attr('fill', c.ink).attr('paint-order', 'stroke').attr('stroke', c.surface).attr('stroke-width', 3).text(p.short));
        const lg = svg.append('g').attr('transform', `translate(16,${H - 16})`).attr('font-size', 10.5).attr('fill', c.ink2); let x = 0;
        for (const v of [mx, mx / 4, mx / 16].map(v => Math.max(1, Math.round(v)))) { lg.append('circle').attr('cx', x + r(v)).attr('cy', -r(v)).attr('r', r(v)).attr('fill', 'none').attr('stroke', c.ink3); lg.append('text').attr('x', x + 2 * r(v) + 4).attr('y', -3).text(fmt(v)); x += 2 * r(v) + 14 + String(fmt(v)).length * 6; }
        lg.append('text').attr('x', x + 6).attr('y', -3).attr('fill', c.ink3).text(o.metricName + (o.offmap ? ' · ' + o.offmap : ''));
      }
    } else if (!o.mini) {
      const lg = svg.append('g').attr('transform', `translate(16,${H - 24})`), n = 6;
      for (let i = 0; i < n; i++) lg.append('rect').attr('x', i * 26).attr('y', 0).attr('width', 26).attr('height', 9).attr('fill', ramp(c, c.patent, (i + 1) * smx / n, smx));
      lg.append('text').attr('x', 0).attr('y', 21).attr('font-size', 10.5).attr('fill', c.ink2).text('fewer');
      lg.append('text').attr('x', n * 26).attr('y', 21).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', c.ink2).text(fmt(smx));
      { const lt = o.metricName + ', by state', fit = n * 26 + 12 + lt.length * 5.8 <= W - 24;   // site
        lg.append('text').attr('x', fit ? n * 26 + 12 : 0).attr('y', fit ? 8 : -7).attr('font-size', 10.5).attr('fill', c.ink3).text(lt); }
    }
  }

  const CH = [];
  const add = (spec) => CH.push(spec);
  const GROUPS = [['map', 'Map'], ['centers', 'Medical centers'], ['records', 'Records'], ['owners', 'Owners'], ['timing', 'Timing'], ['products', 'Products']];   // site

  function topRows(rows, o, n) { const k = o.mini ? Math.min(12, n) : n; const more = Math.max(0, rows.length - k); return { rows: rows.slice(0, k), more, moreTxt: more ? `Showing ${k} of ${rows.length}${o.mini ? '' : '; open the chart alone, or make the window taller, to see more'}` : '' }; }
  const MAPM = (window.SITEVIZ || {}).mapm || [];
  const mapTip = (M, s) => { const m = M[s]; return `<b>${esc(m.short)}</b> · ${esc(m.state)}${m.visn ? ' · VISN ' + esc(m.visn) : ''}<br>` + MAPM.map(([k, n]) => `${esc(n)}: <b>${fmt(m[k])}</b>`).join('<br>'); };
  add({ id: 'map-centers', group: 'map', title: 'Medical centers on the map', note: 'One circle per VA medical center with records, sized by the measure you pick; other VA medical centers are gray dots. Click a center to see its records.',
    controls: [{ key: 'm', label: 'Size by', options: MAPM, def: 'records' }],
    async draw(host, o, G, st) {
      const M = G.V.centers, XY = G.V.xy, k = st.m || 'records', name = MAPM.find(x => x[0] === k)[1];
      const pts = Object.values(M).filter(m => XY[m.site]).map(m => ({ site: m.site, short: m.short, lon: XY[m.site][0], lat: XY[m.site][1], v: m[k], hl: G.sites.has(m.site), tip: mapTip(M, m.site),
        click: G.sites.has(m.site) ? () => { closeStage(); location.href = 'records.html#site=' + encodeURIComponent(m.short); } : null }));
      const off = [...G.sites].filter(s => M[s] && !XY[s]).length;
      usmap(host, Object.assign({}, o, { mode: 'bubbles', pts, metricName: name, fit: G.all ? null : new Set([...G.sites].map(s => (M[s] || {}).state).filter(Boolean)), offmap: off ? `${off} center${off === 1 ? '' : 's'} off the map (Puerto Rico, Philippines)` : '' }));
    } });
  add({ id: 'map-states', group: 'map', title: 'States shaded by the same measures', note: 'Each state is shaded by the records at its VA medical centers, each record once per state.',
    controls: [{ key: 'm', label: 'Shade by', options: MAPM, def: 'records' }],
    async draw(host, o, G, st) {
      const k = st.m || 'records', name = MAPM.find(x => x[0] === k)[1], sv = {}, n = {};
      for (const [s, v] of Object.entries(G.V.states)) { sv[s] = v[k] || 0; n[s] = v.n; }
      usmap(host, Object.assign({}, o, { mode: 'states', stateVals: sv, metricName: name, fit: G.all ? null : new Set(Object.keys(n)), scoped: new Set(Object.keys(n)), stateTip: s => n[s] ? `<br>${n[s]} VA medical center${n[s] === 1 ? '' : 's'} with records` : '' }));
    } });

  add({ id: 'pl-status', group: 'records', title: 'What happened to the records: status by how VA came onto the title', note: 'Each record once, by its status as Google Patents shows it (read Nov 24, 2026), stacked by how VA came onto the title.',
    draw(host, o, G) {
      const c = C(), order = G.V.status.order, by = G.V.status.by;
      hbar(host, Object.assign({}, o, { rows: order.map(k => ({ label: k, vals: by[k] })).filter(r => d3.sum(r.vals)), keys: G.V.status.keys, labW: 190 }));
    } });
  add({ id: 'pl-heat', group: 'timing', title: 'Records by medical center and filing year', note: 'Where and when the records were filed: each record once at each of its VA medical centers, by filing year (2000 means 2000 or earlier). 2025 and 2026 are incomplete: applications are published about 18 months after filing.',
    draw(host, o, G) {
      const c = C(), by = {}, yrs = d3.range(2000, 2027);
      Object.assign(by, G.V.heat);
      let rows = Object.entries(by).map(([s, r]) => [s, d3.sum(Object.values(r))]).sort((a, b) => b[1] - a[1]);
      rows = rows.slice(0, o.mini ? 12 : Math.max(10, Math.min(40, Math.floor((o.h - 50) / 15))));
      const mx = d3.max(rows.flatMap(([s]) => Object.values(by[s]))) || 1;
      heat(host, Object.assign({}, o, { rows: rows.map(([s]) => sh(s)), cols: yrs.map((y, i) => y === 2000 ? '≤2000' : (i === yrs.length - 1 || y % 5 === 0) ? String(y) : String(y).slice(2)), labW: 150,
        cell: (i, j) => { const s = rows[i][0], v = (by[s] || {})[yrs[j]] || 0; return v ? { v, t: o.mini ? '' : String(v), col: ramp(c, c.patent, v, mx), ink: inkOn(c, v, mx), tip: `<b>${esc(sh(s))}</b>, ${yrs[j] === 2000 ? '2000 or earlier' : yrs[j]}<br>${fmt(v)} record${v === 1 ? '' : 's'}` } : null; } }));
    } });
  { const F38 = () => window.FRONT38 || {}, need = (host, f) => { if (!f) { host.textContent = 'This chart could not be drawn.'; return false; } return true; };
    add({ id: 'ov-flow38', group: 'records', title: 'How the records sort: how VA came onto the title, who owns them with VA, and their status', note: 'Each record once. Owner kinds are grouped by words in the owners\' names, so a few are approximate. The patent finder\'s Charts view walks through this picture step by step.',
      draw(host, o, G) { if (need(host, F38().flow)) F38().flow(host, G.d, G.V.flow, o); } });
    add({ id: 'ov-tiles38', group: 'centers', title: 'One chart per center: when the records were filed', note: 'Records by filing year, 2000–2026, one small chart per VA medical center on the same scale; orange is the records in force. 2025 and 2026 are incomplete: applications are published about 18 months after filing.',
      draw(host, o, G) { if (need(host, F38().tiles)) F38().tiles(host, G.V.tiles, o); } });
    add({ id: 'map-lapse38', group: 'map', title: 'Records listing VA as an owner, state by state, as they accumulated (press Play)', note: 'Every state the same size. Records filed through the year shown, by the state of their VA medical center, each record once per state (USPTO assignment records).',
      draw(host, o, G) { if (need(host, F38().tmap)) F38().tmap(host, G.V.tmap, o); } });
    add({ id: 'ov-prof38', group: 'centers', title: 'Center profile: one VA medical center against the other 75', note: 'Pick a center, and a second one to lay over it: seven measures with the center\'s rank, its owners with VA, its technology areas and its records by filing year. A rank says how large a figure is.',
      draw(host, o, G) { if (need(host, F38().prof)) F38().prof(host, o, null); } });
  }
  add({ id: 'ov-pat', group: 'centers', title: (window.SITEVIZ || {}).pat.title, note: (window.SITEVIZ || {}).pat.note,
    draw(host, o, G) { const P = G.V.pat; host.replaceChildren(window.SITEBARS.stacked(P.rows.map(r => ({ label: r[0], parts: r[1] })), P.series.map(s => ({ name: s[0], color: s[1] })), { note: P.hint, twin: !o.mini })); } });
  { const SRC = {"map-centers":[["USPTO assignment records","https://assignmentcenter.uspto.gov/"],["Google Patents","https://patents.google.com/"]],"map-states":[["USPTO assignment records","https://assignmentcenter.uspto.gov/"],["Google Patents","https://patents.google.com/"]],"map-lapse38":[["USPTO assignment records","https://assignmentcenter.uspto.gov/"]],"pl-status":[["USPTO assignment records","https://assignmentcenter.uspto.gov/"],["Google Patents","https://patents.google.com/"]],"pl-heat":[["USPTO assignment records","https://assignmentcenter.uspto.gov/"]],"ov-flow38":[["USPTO assignment records","https://assignmentcenter.uspto.gov/"],["Google Patents","https://patents.google.com/"]],"ov-tiles38":[["USPTO assignment records","https://assignmentcenter.uspto.gov/"],["Google Patents","https://patents.google.com/"]],"ov-prof38":[["USPTO assignment records","https://assignmentcenter.uspto.gov/"],["Google Patents","https://patents.google.com/"]],"ov-pat":[["USPTO assignment records","https://assignmentcenter.uspto.gov/"]]};   // the sources of these charts, listed as the library cards list theirs
    for (const ch of CH) if (SRC[ch.id]) { ch.src = SRC[ch.id]; ch.srcText = SRC[ch.id].map(x => x[0]).join('; '); } }

  const VLIB = (META.vizlib || {}).cards || [];
  const vcol = (c, k) => { if (!k) return c.patent; const n = (k.match(/~/g) || []).length, b = k.replace(/~/g, ''); const base = /^s\d$/.test(b) ? c.s[+b[1]] : (c[b] || b); const t = Math.min(.6, .38 * n) + (b === 's3' && !c.dark ? .25 : 0); return t ? d3.interpolateRgb(base, c.ink)(t) : base; };   // 'patent~' = a deeper shade (stays above 3:1 on the page); the yellow is deepened in light mode
  const m2$ = d => Math.abs(d) >= 1e6 && Math.abs(d) < 1e8 ? '$' + (d / 1e6).toFixed(2) + 'M' : money$(d);
  const money$ = d => { if (d == null || isNaN(d)) return '—'; const a = Math.abs(d), s = d < 0 ? '−' : ''; return s + (a >= 1e9 ? '$' + (a / 1e9).toFixed(a >= 1e11 ? 0 : 1) + 'B' : a >= 1e6 ? '$' + (a / 1e6).toFixed(a >= 1e8 ? 0 : 1) + 'M' : a >= 1e3 ? '$' + Math.round(a / 1e3) + 'K' : '$' + Math.round(a)); };
  const VFMT = { musd: v => money$(v * 1e6), m: v => money$(v * 1e6), b: v => money$(v * 1e9), usd: v => money$(v) };
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function vdate(s) {
    s = String(s == null ? '' : s).trim(); let m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return new Date(+m[3], +m[1] - 1, +m[2]);
    if ((m = s.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/)) && MON[m[1].toLowerCase()] != null) return new Date(+m[3], MON[m[1].toLowerCase()], +m[2]);
    if ((m = s.match(/^(\d{4})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, 15);
    if ((m = s.match(/(\d{4})/))) return new Date(+m[1], 6, 1);
    return null;
  }
  const mdTxt = s => String(s == null ? '' : s).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  const mdHtml = s => esc(s).replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (m, l, u) => `<a href="${u}" target="_blank" rel="noopener">${l}</a>`);
  const stripH = s => String(s == null ? '' : s).replace(/<br\s*\/?>/gi, '; ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  const vlScoped = (cd, G) => !cd.nat && !G.all;
  const vlSite = s => s === 'vaco' ? 'VA Central Office (national reports)' : sh(s);
  const inSites = (G, s) => (Array.isArray(s) ? s : [s]).some(x => x && G.sites.has(x));
  const scopeStates = G => { if (!G._st) G._st = new Set([...G.sites].map(s => (BYC[s] || {}).state).filter(Boolean)); return G._st; };
  const keySet = (G, kind) => kind === 'state' ? scopeStates(G) : G.sites;
  function sumParts(parts, G, kind, nS, nX) { const K = keySet(G, kind), S = Array.from({ length: nS }, () => Array(nX).fill(0)); let any = false;
    for (const [keys, arr] of parts) { if (!(Array.isArray(keys) ? keys : [keys]).some(k => K.has(k))) continue; any = true; arr.forEach((v, i) => v.forEach((x, j) => { S[i][j] += +x || 0; })); }
    return any ? S : S; }
  function sumBy(by, G, n, kind) { const K = keySet(G, kind); let v = null; for (const [s, x] of Object.entries(by || {})) if (K.has(s)) { if (!v) v = Array(n).fill(0); x.forEach((y, i) => { v[i] += +y || 0; }); } return v; }
  function sumByOld(by, G, n) { let v = null; for (const [s, x] of Object.entries(by || {})) if (G.sites.has(s)) { if (!v) v = Array(n).fill(0); x.forEach((y, i) => { v[i] += +y || 0; }); } return v; }

  function spans(host, o, rows, S, today) {
    const c = C(), W = o.w, H = o.h; if (!S.length || !rows.length) return empty(host, o);
    const svg = svgFor(host, o), labW = Math.min(o.labW || 210, W * .36), m = { t: 10, r: 16, b: 28, l: labW + 10 };
    if (o.keys && o.keys.length && !o.mini) m.t = keyRow(svg, o.keys.map(([n, k]) => [n, vcol(c, k)]), 8, 16, c, W - 16) + 8;
    const hi = d3.max(S, s => s.b), ext = [d3.min(S, s => s.a), today && today > hi ? today : hi];
    const x = d3.scaleTime().domain(ext).range([m.l, W - m.r]).nice(), step = (H - m.t - m.b) / rows.length;
    for (const t of x.ticks(Math.max(2, Math.floor((W - m.l - m.r) / 80)))) { svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', c.grid); svg.append('text').attr('x', x(t)).attr('y', H - m.b + 15).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', c.ink2).text(d3.timeFormat('%Y')(t)); }
    const lane = new Map(), nl = {};
    rows.forEach(r => { const ss = S.filter(s => s.row === r).sort((a, b) => a.a - b.a), ends = []; for (const s of ss) { let k = ends.findIndex(e => e <= s.a); if (k < 0) { k = ends.length; ends.push(0); } ends[k] = s.b; lane.set(s, k); } nl[r] = Math.max(1, ends.length); });
    const fs = Math.max(9, Math.min(12, step * .5));
    rows.forEach((r, i) => { svg.append('text').attr('x', m.l - 8).attr('y', m.t + i * step + step / 2 + fs * .35).attr('text-anchor', 'end').attr('font-size', fs).attr('fill', c.ink2).text(trunc(r, Math.floor(labW / (fs * .55))));
      if (i) svg.append('line').attr('x1', 8).attr('x2', W - m.r).attr('y1', m.t + i * step).attr('y2', m.t + i * step).attr('stroke', c.grid).attr('stroke-dasharray', '2 3'); });
    for (const s of S) {
      const i = rows.indexOf(s.row); if (i < 0) continue; const n = nl[s.row], bh = Math.max(3, Math.min(26, step * .74 / n)), y = m.t + i * step + (step - bh * n) / 2 + lane.get(s) * bh;
      const x0 = x(s.a), w = Math.max(3, x(s.b) - x0);
      const r = svg.append('rect').attr('x', x0).attr('y', y + .5).attr('width', w).attr('height', Math.max(2, bh - 1)).attr('rx', Math.min(3, bh / 3)).attr('fill', s.col).attr('fill-opacity', .9).attr('stroke', c.surface).attr('stroke-width', 1);
      onTip(r, () => s.tip, Object.assign({ click: !!s.url }, o)); if (s.url && !o.mini) r.on('click', () => window.open(s.url, '_blank', 'noopener'));
      if (!o.mini && s.label && bh >= 13 && w > 44) svg.append('text').attr('x', x0 + 5).attr('y', y + bh / 2 + 4).attr('font-size', 11).attr('fill', bestInk(s.col)).attr('pointer-events', 'none').text(trunc(s.label, Math.floor((w - 8) / 6.1)));
    }
    if (today) { svg.append('line').attr('x1', x(today)).attr('x2', x(today)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', c.lead).attr('stroke-dasharray', '4 3'); if (!o.mini) svg.append('text').attr('x', x(today) - 4).attr('y', m.t + 10).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', cssv('--accent') || c.lead).text("Nov 2026"); }   // site
  }
  function refbar(host, o, R, ref, refLabel) {
    const c = C(), W = o.w, H = o.h; if (!R.length) return empty(host, o);
    const svg = svgFor(host, o), labW = Math.min(o.labW || 260, W * .42), m = { t: 24, r: 70, b: 26, l: labW + 10 };
    if (o.keys && o.keys.length && !o.mini) m.t = keyRow(svg, o.keys.map(([n, k]) => [n, vcol(c, k)]), 8, 16, c, W - 16) + 26;
    const x = d3.scaleLinear().domain([0, Math.max(ref, d3.max(R, r => r.v)) * 1.04]).range([m.l, W - m.r]).nice();
    const step = (H - m.t - m.b) / R.length, bh = Math.max(3, Math.min(22, step * .6)), fs = Math.max(9, Math.min(12, step * .55));
    for (const t of x.ticks(Math.max(2, Math.floor((W - m.l - m.r) / 90)))) { svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', c.grid); svg.append('text').attr('x', x(t)).attr('y', H - m.b + 15).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', c.ink2).text(money$(t)); }
    R.forEach((r, i) => {
      const y = m.t + i * step + (step - bh) / 2;
      svg.append('text').attr('x', m.l - 8).attr('y', y + bh / 2 + fs * .35).attr('text-anchor', 'end').attr('font-size', fs).attr('fill', c.ink2).text(trunc(r.label, Math.floor(labW / (fs * .55))));
      const b = svg.append('rect').attr('x', m.l).attr('y', y).attr('width', Math.max(1, x(r.v) - m.l)).attr('height', bh).attr('rx', Math.min(3, bh / 3)).attr('fill', r.col);
      onTip(b, () => r.tip, Object.assign({ click: !!r.url }, o)); if (r.url && !o.mini) b.on('click', () => window.open(r.url, '_blank', 'noopener'));
      if (!o.mini) svg.append('text').attr('x', x(r.v) + 5).attr('y', y + bh / 2 + fs * .35).attr('font-size', fs).attr('fill', c.ink2).text(m2$(r.v));
    });
    svg.append('line').attr('x1', x(ref)).attr('x2', x(ref)).attr('y1', m.t - 6).attr('y2', H - m.b).attr('stroke', c.lead).attr('stroke-width', 1.6).attr('stroke-dasharray', '5 3');
    svg.append('text').attr('x', x(ref)).attr('y', m.t - 10).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600).attr('fill', c.lead).text(refLabel);
  }
  function vlTable(host, o, head, rows, siteCol) {
    const w = el('div', { class: 'vz-tbl' + (o.mini ? ' mini' : '') }); if (!o.mini) w.style.maxHeight = o.h + 'px';
    w.innerHTML = '<table><thead><tr>' + head.map(h => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map((x, i) => `<td>${i === siteCol ? esc(sh(x)) : mdHtml(x)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    host.append(w);
  }

  function vlData(cd, G, st) {
    const d = cd.d, c = C(), k = cd.k, sc = vlScoped(cd, G);
    if (k === 'hbar') {
      const rows = [];
      for (const r of d.rows) {
        let vals = r[1];
        if (sc) { if (r[4]) vals = sumBy(r[4], G, vals.length, d.rowKey); else if (!(r[2] && inSites(G, r[2]))) vals = null; }
        if (!vals || !vals.some(v => v)) continue;
        rows.push({ label: d.siteLab ? vlSite(r[0]) : r[0], vals, tip: r[3] || '', site: Array.isArray(r[2]) ? r[2].map(sh).join('; ') : (r[2] ? sh(r[2]) : '') });
      }
      if (sc && d.resort !== false) rows.sort((a, b) => d3.sum(b.vals) - d3.sum(a.vals));
      return { rows, keys: (d.keys || []).map(([n, t]) => [n, vcol(c, t)]) };
    }
    if (k === 'vbar' || k === 'lines') {
      const S = d.series.map(([n, t, v]) => ({ name: n, color: vcol(c, t), vals: v.slice(), dash: null }));
      if (sc && d.parts) { const P = sumParts(d.parts, G, d.partKey, S.length, S[0] ? S[0].vals.length : 0); S.forEach((s, i) => { s.vals = P[i]; }); }
      else if (sc && d.bySite) { S.forEach(s => { s.vals = s.vals.map(() => 0); }); for (const [site, arr] of Object.entries(d.bySite)) if (G.sites.has(site)) arr.forEach((v, i) => v.forEach((x, j) => { S[i].vals[j] += x || 0; })); }
      return { S: S.filter(s => s.vals.some(v => v)) };
    }
    if (k === 'dots') {
      const pts = d.pts.filter(p => !sc || (p[6] && inSites(G, p[6]))).map(p => ({ t: vdate(p[0]), row: d.siteRows ? vlSite(p[1]) : p[1], label: p[2], tip: p[3], url: p[4], col: vcol(c, p[5]), raw: p }));
      const rows = d.rows.map(r => d.siteRows ? vlSite(r) : r).filter(r => pts.some(p => p.row === r));
      return { pts, rows };
    }
    if (k === 'spans') {
      const S = d.spans.filter(s => !sc || !s[7] || inSites(G, s[7])).map(s => ({ row: s[0], a: vdate(s[1]), b: vdate(s[2] || s[1]), label: s[3], tip: s[4], url: s[5], col: vcol(c, s[6]), raw: s })).filter(s => s.a && s.b);
      return { S, rows: d.rows.filter(r => S.some(s => s.row === r)) };
    }
    if (k === 'usmap') {
      const yv = d.years[st.y] || {}, sv = {};
      for (const [kk, v] of Object.entries(yv)) if (v && v[st.m] != null) sv[kk] = v[st.m];
      return { yv, sv, lab: (d.measures.find(x => x[0] === st.m) || [st.m, st.m])[1] };
    }
    if (k === 'heat') return {};
    if (k === 'table') return { rows: d.site != null && sc ? d.rows.filter(r => G.sites.has(r[d.site])) : d.state != null && sc ? d.rows.filter(r => scopeStates(G).has(r[d.state])) : d.rows };
    if (k === 'refbar') return { R: d.rows.map(r => ({ label: r[0], v: r[1], tip: r[2], url: r[3], col: vcol(c, r[4]) })).sort((a, b) => b.v - a.v) };
    return {};
  }
  function vlDraw(cd, host, o, G, st) {
    const d = cd.d, k = cd.k, c = C(), X = vlData(cd, G, st), F = VFMT[d.fmt];
    const sc = vlScoped(cd, G);
    if (k === 'hbar') {
      if (!X.rows.length) return empty(host, o, 'Nothing in this scope.');
      const rows = X.rows.map(r => Object.assign({}, r, { tip: (F ? 'Total ' + F(d3.sum(r.vals)) + (r.tip ? '<br>' : '') : '') + r.tip }));
      const T = topRows(rows, o, Math.max(6, Math.floor((o.h - (X.keys.length > 1 ? 80 : 60)) / 18)));
      return hbar(host, Object.assign({}, o, { rows: T.rows, more: T.moreTxt, keys: X.keys, labW: d.labW || 200, fmtv: F || null, fmtx: F || null }));
    }
    if (k === 'vbar') {
      if (!X.S.length) return empty(host, o, 'Nothing in this scope.');
      return vbar(host, Object.assign({}, o, { cats: d.cats, series: X.S, ylab: d.ylab, xlab: d.xlab, partial: d.partial ? (cat => d.partial.includes(String(cat))) : null, tipx: d.extra ? ((cat, s) => d.extra[cat + '|' + s.name] ? '<br>' + d.extra[cat + '|' + s.name] : (d.extra[cat] ? '<br>' + d.extra[cat] : '')) : null }));
    }
    if (k === 'lines') { if (!X.S.length) return empty(host, o, 'Nothing in this scope.'); return lines(host, Object.assign({}, o, { xs: d.xs, series: X.S, fmty: F || null, ylab: d.ylab, partialFrom: d.partialFrom || null, partialLabel: d.partialLabel })); }
    if (k === 'dots') { if (!X.pts.length) return empty(host, o, 'Nothing in this scope.'); return dots(host, Object.assign({}, o, { pts: X.pts, rows: X.rows, labW: d.labW || 210, today: d.today ? vdate(d.today) : null, todayLabel: 'Nov 2026', xlab: d.xlab })); }
    if (k === 'spans') return spans(host, Object.assign({}, o, { labW: d.labW, keys: d.keys }), X.rows, X.S, d.today ? vdate(d.today) : null);
    if (k === 'usmap') {
      if (!Object.keys(X.sv).length) return empty(host, o, 'VA did not publish this figure for that year.');
      const unit = st.m === 'perVet' ? ' ($ per veteran)' : ' ($ millions)';
      const SS = sc ? scopeStates(G) : null;   // in a scope: zoom to its states (neighbours stay shaded on the national scale, for comparison) and outline them
      return usmap(host, Object.assign({}, o, { mode: 'states', fit: SS, scoped: SS, outline: SS, pad: SS ? (SS.size === 1 ? .32 : SS.size <= 3 ? .16 : SS.size <= 6 ? .06 : .02) : 0, stateVals: X.sv, metricName: X.lab + unit + ', FY' + st.y, stateTip: kk => { const g = X.yv[kk] || {}; return (st.m !== 'total' && g.total != null ? '<br>All VA spending: ' + money$(g.total * 1e6) : '') + (g.veteran_population ? '<br>Veterans: ' + fmt(g.veteran_population) : ''); } }));
    }
    if (k === 'heat') {
      const M = new Map(d.cells.map(z => [z[0] + ':' + z[1], z])), mx = d3.max(d.cells, z => z[2]) || 1;
      return heat(host, Object.assign({}, o, { rows: d.rows, cols: d.cols, labW: d.labW || 170, rotate: !!d.rotate, headH: d.headH, cell: (i, j) => {
        const z = M.get(i + ':' + j); if (!z || !z[2]) return null;
        return { col: d.scale ? ramp(c, c.patent, z[2], mx) : c.patent, t: d.pct ? Math.round(z[2]) + '%' : d.scale ? (o.mini ? '' : money$(z[2] * 1e6).replace('.0', '')) : '✓', tip: z[3] || `<b>${esc(d.rows[i])}</b><br>${esc(d.cols[j])}: ${esc(d.yes || fmt(z[2]))}` }; } }));
    }
    if (k === 'table') { if (!X.rows.length) return empty(host, o, 'Nothing in this scope.'); return vlTable(host, o, d.head, X.rows, d.site); }
    if (k === 'refbar') return refbar(host, Object.assign({}, o, { labW: d.labW, keys: d.keys }), X.R, d.ref, d.refLabel);
    return empty(host, o, 'Unknown chart kind.');
  }
  const navOf = sec => document.querySelector(`.nav-btn[data-view="${sec === 'History' ? 'history' : 'report'}"]`);
  async function vlGoto(sec) {
    const btn = navOf(sec); if (!btn) return; btn.click(); if (sec === 'History') return;
    let re; try { re = new RegExp(sec, 'i'); } catch (e) { return; }
    for (let k = 0; k < 40; k++) {
      const R = document.getElementById('view-report'); if (!R) return;
      const h = [...R.querySelectorAll('h2, h3, h4')].find(x => re.test(x.textContent.trim())) || [...R.querySelectorAll('p > strong:first-child, p > b:first-child')].find(x => re.test(x.textContent.trim())) || [...R.querySelectorAll('p, li, figcaption')].find(x => re.test(x.textContent));
      if (h) { let p = h.closest('details'); while (p) { p.open = true; p = p.parentElement && p.parentElement.closest('details'); } h.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      await new Promise(r => setTimeout(r, 150));
    }
  }
  for (const cd of VLIB) {
    const ch = { id: 'vl-' + cd.id, group: cd.g, title: cd.t, note: cd.n, national: !!cd.nat, pri: cd.pri, vl: cd, src: cd.src || [], controls: cd.ctl || null,
      srcText: (cd.src || []).map(x => x[0]).join('; '), sec: cd.sec && navOf(cd.sec) ? cd.sec : null,
      draw(host, o, G, st) { return vlDraw(cd, host, o, G, st || {}); } };
    add(ch);
  }

  let mmBuilt = false;
  const PAINTS = [];
  function moneyMore() {
    if (mmBuilt) return; mmBuilt = true; PAINTS.length = 0;
    for (const MMG of document.querySelectorAll('[data-vz-ids]')) { MMG.replaceChildren();
    for (const ch of MMG.dataset.vzIds.split(' ').map(id => CH.find(x => x.id === id)).filter(Boolean)) {
      const box = el('div', { class: 'vz-mchart' });
      const paint = () => { const bw = Math.floor(box.clientWidth || 560), w = wideW(box, ch, Math.max(320, bw)), H0 = (META.inlineH || {})[ch.id] || 380, ph = (META.inlinePhoneH || {})[ch.id];
        return drawInto(box, ch, { w, h: w > bw ? H0 : (ph && bw < 600) ? ph : Math.min(H0, Math.max(320, Math.round(bw * 1.1))), mini: false, title: ch.title, note: ch.note }); };
      const ctr = (ch.controls || []).length ? el('div', { class: 'vz-ctr' }, ch.controls.map(k => el('label', null, k.label + ' ', (() => { const s = el('select', { onchange: e => { stOf(ch)[k.key] = e.target.value; paint(); } }, k.options.map(([v, l]) => el('option', { value: v }, l))); s.value = stOf(ch)[k.key]; return s; })()))) : null;
      const card = el('div', { class: 'vz-mbox', 'data-id': ch.id }, el('h4', null, ch.title), el('p', null, ch.note), ctr, box,
        el('div', { class: 'vz-links' }, (ch.src || []).map(([l, u]) => u ? el('a', { href: u, target: '_blank', rel: 'noopener' }, l) : el('span', null, l)),
          el('button', { class: 'btn sm ghost', onclick: () => { if (!built) charts = CH; openStage([ch.id]); } }, 'Open large')));
      MMG.append(card);
      const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); paint(); PAINTS.push([box, paint, box.clientWidth]); } }, { rootMargin: '300px' });
      io.observe(card);
    }
    }
  }
  { let t = 0; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { for (const p of PAINTS) if (Math.abs(p[0].clientWidth - p[2]) > 40 && p[0].clientWidth) { p[2] = p[0].clientWidth; p[1](); } }, 200); }); }
  new MutationObserver(() => { if (mmBuilt) { mmBuilt = false; moneyMore(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  setTimeout(moneyMore, 0);

  async function reportFigs() {
    if (!window.REPORT || !window.REPORT.model) return [];
    let B; try { B = await window.REPORT.model(); } catch (e) { return []; }
    const out = []; let sec = '';
    for (const b of B) {
      if (b.h2) sec = b.h2;
      if (!(b.fig || b.bars)) continue;
      if (/money|budget|account|fund|obligat/i.test(sec + ' ' + ((b.fig || b.bars).title || ''))) continue;
      const t = String((b.fig || b.bars).title || 'Figure').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      out.push({ id: 'rep-' + out.length, group: 'report', title: t, note: 'From the report: ' + sec.replace(/\*\*/g, ''), report: b,
        draw(host) {
          const { html } = window.REPORT.toHtml([b]); const thumb = host.classList.contains('vz-thumb'); const w = el('div', { class: thumb ? 'vz-repwrap' : 'vz-repbox' }); w.innerHTML = html;
          w.querySelectorAll('.exh').forEach(x => x.remove()); w.querySelectorAll('figure').forEach(f => f.classList.add('in', 'vz-repfig')); host.replaceChildren(w);
          if (thumb) { const fit = () => { w.style.transform = `scale(${Math.max(.1, host.clientWidth - 16) / 860})`; }; fit(); try { new ResizeObserver(fit).observe(host); } catch (e) { /* older browsers: fixed scale */ } }
        } });
    }
    return out;
  }

  const STATE = {};   // per chart: control values
  const picked = [];
  let built = false, stale = true, charts = [];
  const root = $('#vz-grid', host0), bar = $('#vz-bar', host0);
  function stOf(ch) { if (!STATE[ch.id]) { STATE[ch.id] = {}; for (const k of ch.controls || []) STATE[ch.id][k.key] = k.def; } return STATE[ch.id]; }
  const wideW = (box, ch, w) => { const m = (META.inlineMinW || {})[ch.id] || 0; box.classList.toggle('vz-wide', m > w); box.style.setProperty('--vz-w', m + 'px'); return Math.max(w, m); };   // site
  async function drawInto(box, ch, o) {
    box.replaceChildren(); hideTip();
    try { const G = await gather(); await ch.draw(box, o, G, stOf(ch)); }
    catch (e) { console.warn(e); box.replaceChildren(el('p', { class: 'muted small' }, 'This chart could not be drawn: ' + e.message)); }
  }
  function syncBar() {
    const n = picked.length;
    const cmp = $('#vz-cmp', bar); if (cmp) { cmp.disabled = n < 2; cmp.textContent = n >= 4 ? 'Compare 4 side by side (the most)' : n >= 2 ? `Compare ${n} side by side` : 'Tick 2 to 4 charts to compare'; }
    const clr = $('#vz-clr', bar); if (clr) clr.style.display = n ? '' : 'none';
    root.querySelectorAll('.vz-card').forEach(cd => { const on = picked.includes(cd.dataset.id); cd.classList.toggle('picked', on); const cb = cd.querySelector('input'); if (cb) { cb.checked = on; cb.disabled = !on && n >= 4; } });
  }
  async function build() {
    built = true; stale = false;
    const G = await gather().catch(e => null);
    const rep = await reportFigs();
    charts = rep.concat(CH); charts.forEach(ch => { ch.where = (META.where || {})[ch.id] || null; });   // site
    const groups = GROUPS.filter(([g]) => charts.some(ch => ch.group === g));
    bar.replaceChildren(
      el('input', { class: 'vz-q', type: 'search', placeholder: 'Search the charts', 'aria-label': 'Search the charts', oninput: e => qfilt(e.target.value) }), el('div', { class: 'vz-chips', role: 'group', 'aria-label': 'Show a group' }, el('button', { class: 'vz-chip on', 'data-g': '', onclick: e => filt(e, '') }, 'All'), el('button', { class: 'vz-chip', 'data-g': '*key', onclick: e => filt(e, '*key') }, 'Key charts'), groups.map(([g, n]) => el('button', { class: 'vz-chip', 'data-g': g, onclick: e => filt(e, g) }, n))),
      el('div', { class: 'vz-acts' }, el('button', { class: 'btn sm', id: 'vz-cmp', disabled: true, onclick: () => openStage(picked.slice()) }, 'Tick 2 to 4 charts to compare'), el('button', { class: 'btn sm ghost', id: 'vz-clr', style: 'display:none', onclick: () => { picked.length = 0; syncBar(); } }, 'Clear')));
    root.replaceChildren();
    if (G) $('#vz-scope', host0).textContent = `${charts.length} charts, drawn from the site's records.`;
    for (const [g, name] of groups) {
      const sec = el('section', { class: 'vz-sec', 'data-g': g }, el('h2', { class: 'vz-h' }, name));
      const grid = el('div', { class: 'vz-cards' });
      for (const ch of charts.filter(x => x.group === g)) {
        const thumb = el('div', { class: 'vz-thumb', 'aria-hidden': 'true' });
        const card = el('div', { class: 'vz-card', 'data-id': ch.id, tabindex: '0', role: 'button', 'aria-label': 'Open: ' + ch.title,
          onclick: e => { if (e.target.closest('label, a')) return; openStage([ch.id]); }, onkeydown: e => { if (e.key === 'Enter') openStage([ch.id]); } },
          thumb, el('div', { class: 'vz-cap' }, el('div', { class: 'vz-t' }, ch.title), el('div', { class: 'vz-n' }, ch.note), ch.srcText ? el('div', { class: 'vz-src' }, 'Source: ' + ch.srcText) : null, ch.where ? el('a', { class: 'vz-where', href: ch.where[0] }, ch.where[1] + ' →') : null,
            el('label', { class: 'vz-pick', title: 'Pick for side-by-side' }, el('input', { type: 'checkbox', onchange: e => { const i = picked.indexOf(ch.id); if (e.target.checked && i < 0 && picked.length < 4) picked.push(ch.id); if (!e.target.checked && i >= 0) picked.splice(i, 1); syncBar(); } }), 'Compare')));
        grid.append(card);
        const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); if (ch.report) ch.draw(thumb); else drawInto(thumb, ch, { w: 600, h: 375, mini: true, title: ch.title, note: ch.note }); } }, { rootMargin: '200px' });
        io.observe(card);
      }
      sec.append(grid); root.append(sec);
    }
    syncBar();
  }
  function filt(e, g) { bar.querySelectorAll('.vz-chip').forEach(b => b.classList.toggle('on', b.dataset.g === g)); const q = bar.querySelector('.vz-q'); if (q) q.value = '';
    const KEY = new Set(((META.vizlib || {}).key || []).concat(charts.filter(c => c.pri === 'A').map(c => c.id)));
    root.querySelectorAll('.vz-card').forEach(cd => { cd.hidden = g === '*key' && !KEY.has(cd.dataset.id); });
    root.querySelectorAll('.vz-sec').forEach(s => { s.hidden = g === '*key' ? !s.querySelector('.vz-card:not([hidden])') : (!!g && s.dataset.g !== g); }); }
  function qfilt(q) { const w = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); bar.querySelectorAll('.vz-chip').forEach(b => b.classList.toggle('on', b.dataset.g === ''));
    root.querySelectorAll('.vz-card').forEach(cd => { const ch = charts.find(c => c.id === cd.dataset.id) || {}; const t = ((ch.title || '') + ' ' + (ch.note || '') + ' ' + (ch.srcText || '')).toLowerCase(); cd.hidden = w.length > 0 && !w.every(x => t.includes(x)); });
    root.querySelectorAll('.vz-sec').forEach(s => { s.hidden = !s.querySelector('.vz-card:not([hidden])'); }); }

  let stage = null, shown = [];
  function openStage(ids) {
    shown = ids.filter(id => charts.some(c => c.id === id)); if (!shown.length) return;
    if (!stage) {
      stage = el('div', { class: 'vz-stage', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Charts' });
      document.body.append(stage);
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && stage && stage.classList.contains('on')) closeStage(); });
      stage.addEventListener('keydown', e => { if (e.key !== 'Tab') return; const f = [...stage.querySelectorAll('button, select, input, a[href], [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.getClientRects().length);   // site
        if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && (document.activeElement === a || !stage.contains(document.activeElement))) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } });
      let t = 0; window.addEventListener('resize', () => { if (stage.classList.contains('on')) { clearTimeout(t); t = setTimeout(() => { const had = stage.contains(document.activeElement); renderStage(); if (had) focusClose(); }, 180); } });
    }
    if (!stage.classList.contains('on')) stage._back = document.activeElement;
    stage.classList.add('on'); document.body.classList.add('vz-locked'); renderStage(); focusClose();
  }
  const focusClose = () => { const b = stage && stage.querySelector('.vz-shead button:last-of-type'); if (b) b.focus(); };   // site
  function closeStage() { if (!stage) return; const back = stage.classList.contains('on') && stage._back; stage._back = null; stage.classList.remove('on'); document.body.classList.remove('vz-locked'); stage.replaceChildren(); hideTip();
    if (back && back.isConnected && back.focus) back.focus(); }
  function renderStage() {
    const n = shown.length; stage.dataset.n = n;
    const allNat = shown.every(id => (charts.find(c => c.id === id) || {}).national);
    const head = el('div', { class: 'vz-shead' }, el('b', null, n === 1 ? 'Chart' : `${n} charts side by side`), el('span', { class: 'muted small' }, allNat ? ' · All of VA (national)' : SC ? ' · ' + (SC.describe().label || '') + (shown.some(id => (charts.find(c => c.id === id) || {}).national) ? '; charts marked national cover all of VA' : '') : ''),
      el('span', { class: 'sp' }), n === 1 ? null : el('button', { class: 'btn sm ghost', onclick: () => { picked.length = 0; syncBar(); closeStage(); } }, 'Clear picks'), el('button', { class: 'btn sm', onclick: closeStage, 'aria-label': 'Close (Esc)' }, 'Close ✕'));
    const body = el('div', { class: 'vz-panels n' + n });
    stage.replaceChildren(head, body);
    for (const id of shown) {
      const ch = charts.find(c => c.id === id);
      const box = el('div', { class: 'vz-pbox' });
      const ctr = el('div', { class: 'vz-ctr' }, (ch.controls || []).map(k => el('label', null, k.label + ' ', (() => { const s = el('select', { onchange: e => { stOf(ch)[k.key] = e.target.value; paint(); } }, k.options.map(([v, l]) => el('option', { value: v }, l))); s.value = stOf(ch)[k.key]; return s; })())));
      const panel = el('div', { class: 'vz-panel' }, el('div', { class: 'vz-pt' }, el('div', { class: 'vz-t' }, ch.title), el('div', { class: 'vz-n' }, ch.note),
        (ch.src || ch.csv || ch.sec) ? el('div', { class: 'vz-links' }, (ch.src || []).length ? el('span', { class: 'muted' }, 'Sources:') : null, (ch.src || []).map(([l, u]) => u ? el('a', { href: u, target: '_blank', rel: 'noopener' }, l) : el('span', null, l)),
          ch.sec ? el('button', { class: 'btn sm ghost', onclick: () => { closeStage(); vlGoto(ch.sec); } }, ch.sec === 'History' ? 'Open the History tab' : 'Read in the report') : null) : null), ctr, box);
      body.append(panel);
      const paint = () => { if (ch.report) { ch.draw(box); return; } const r = box.getBoundingClientRect(); drawInto(box, ch, { w: wideW(box, ch, Math.max(320, Math.floor(r.width))), h: Math.max(260, Math.floor(r.height)), mini: false, title: ch.title, note: ch.note }); };
      requestAnimationFrame(paint);
    }
  }

  async function show() { if (!built || stale) await build(); }
  window.VIEW_HOOKS = Object.assign(window.VIEW_HOOKS || {}, { visuals: show });
  if (SC) SC.onChange(() => { GP = null; stale = true; picked.length = 0; closeStage(); if (host0.classList.contains('on')) build(); });
  new MutationObserver(() => { if (built) { stale = true; if (host0.classList.contains('on')) build(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (host0.classList.contains('on')) show();
  window.VISUALS = { charts: () => charts, open: openStage, close: closeStage, gather, drawInto, stOf, moneyMore, build: () => build() };
})();
