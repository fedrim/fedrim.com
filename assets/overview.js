(function () {
  'use strict';
  const host = document.getElementById('rm');
  if (!host) return;
  const L = window.LIB, APP = () => window.APP || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const money = n => '$' + Math.round(Number(n || 0)).toLocaleString('en-US');
  const cssv = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v; else if (k === 'style' && typeof v === 'object') { for (const [p, x] of Object.entries(v)) if (p.startsWith('--')) n.style.setProperty(p, x); else n.style[p] = x; }
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'html') n.innerHTML = v; else n.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  }
  const lk = (u, t) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t);
  const gp = num => { num = String(num || '').replace(/[^0-9A-Za-z]/g, ''); return num ? `https://patents.google.com/patent/${/^[A-Z]{2}/.test(num) ? num : 'US' + num}` : null; };
  const pc = app => { app = String(app || '').replace(/[^0-9]/g, ''); return app ? `https://patentcenter.uspto.gov/applications/${app}` : null; };
  const ac = app => { app = String(app || '').replace(/[^0-9]/g, ''); return app ? `https://assignmentcenter.uspto.gov/search/patent?applicationNumber=${app}` : null; };
  const rgba = (hex, a) => { hex = (hex || '#888').replace('#', ''); if (hex.length === 3) hex = hex.split('').map(c => c + c).join(''); const n = parseInt(hex, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

  const TYPES = [
    ['va_owned', 'VA-only filing', 'patent', 'A filing VA owns alone (no partner on record). Drawn as a small loop at the center.'],
    ['joint', 'Assigned to VA and the partner by the inventors', 'patent', 'The first assignment that gave VA its interest came from the inventors, before the patent issued. Each record is on one kind of line only, set by that first assignment.'],
    ['affil_to_va', 'Partner transferred a share to VA', 'patent', 'The first assignment that gave VA its interest came from an organization, usually the partner, before the patent issued.'],
    ['late_add', 'VA added after the patent issued', 'patent', 'The first assignment that gave VA its interest was recorded after the patent had issued.'],
    ['later_va', 'VA recorded as owner later', 'patent', 'Filed without VA; a later USPTO assignment adds VA. Only filings whose assignments are not in the map data; the rest are sorted into the three kinds above.'],
    ['cross_site', 'Records tied to two VA sites', 'patent', 'A line between two VA sites: the one a record is drawn from, and another that public records connect its inventors to.']];
  const TNAME = Object.fromEntries(TYPES.map(t => [t[0], t[1]])), TGROUP = Object.fromEntries(TYPES.map(t => [t[0], t[2]])), TDESC = Object.fromEntries(TYPES.map(t => [t[0], t[3]]));
  const GROUPS = [['patent', 'Patent records (VA on title)']];
  const LEAD = new Set();
  const GKEY = g => g === 'patent' ? 'patent' : g === 'lead' ? 'lead' : (g === 'tie' || g === 'pay') ? 'tie' : g === 'crada' ? 'crada' : 'ctx';
  const tcol = t => cssv('--g-' + GKEY(TGROUP[t] || 'ctx')) || cssv('--t-' + t) || '#888';
  const CTX = new Set(['affil', 'contract', 'rd', 'npc']);
  const CHIPS = [['patent', ['patent'], 'Patent records, VA on title', '']];
  const kcol = k => cssv('--k-' + k) || '#888';
  const TIELABEL = {}, FLAGNAME = {};

  const S = { groups: new Set(['patent']), low: false, minw: 3, flagged: false, site: '', view: '2d', layout: 'geo', labels: true, sel: null, zoom: 'region' };
  let D = null, SITE = {}, VAS = {}, ORG = {}, LINKS = [], ITEMS = {}, PEOPLE = {}, FLAGS = {}, VIS = [], GCOUNT = {}, CRADAS = [];
  let stage, svgEl, globeEl, tipEl, side, toolbar, R2 = {}, G = null, stateFeat = null;

  async function load() {
    const node = document.getElementById('data-regionmap');
    D = JSON.parse(node.dataset.enc === 'json' ? node.textContent : await L.decodeGzipB64(node.textContent));
    applyScope(window.SCOPE ? window.SCOPE.current.sites : null);
    Object.entries(D.orgs).forEach(([id, o]) => { ORG[id] = { id, name: o[0], kind: (o[1] === 'co' || o[1] === 'large') && /\b(universit|college|regents|trustees of|hospital|medical center|clinic\b|institute of technology)/i.test(o[0]) ? (/hospital|medical center|clinic/i.test(o[0]) && !/universit|college/i.test(o[0]) ? 'hosp' : 'univ') : o[1], city: o[2], state: o[3], country: o[4] || 'US', lat: o[5], lon: o[6], approx: !!o[7], site: o[8], npc: o[9] }; });
    LINKS = D.links.map(l => ({ src: l[0], dst: l[1], type: l[2], items: l[3] }));
    ITEMS = D.items; PEOPLE = D.people; FLAGS = D.flags || {};
    Object.values(ORG).filter(o => o.npc).forEach(o => LINKS.push({ src: o.site, dst: o.id, type: 'npc', items: [o.npc] }));
  }
  function applyScope(ids) {
    SITE = {}; VAS = {};
    D.vasites.forEach(s => { VAS[s[0]] = { id: s[0], name: s[1], city: s[2], state: s[3], lat: s[4], lon: s[5] }; });
    D.sites.forEach(s => {
      if (!ids || ids.has(s[0])) SITE[s[0]] = { id: s[0], name: s[1], short: s[2], station: s[3], visn: s[4], city: s[5], state: s[6], lat: s[7], lon: s[8], research: !!s[9], people: s[10], current: s[11] };
      else VAS[s[0]] = { id: s[0], name: s[1], city: s[5], state: s[6], lat: s[7], lon: s[8] };
    });
    if (S.site && !SITE[S.site]) { S.site = ''; S.sel = null; }
  }
  function setScope(ids) {
    if (!D) return;
    applyScope(ids);
    if (R2.proj) { placeSites(); Object.values(ORG).forEach(o => { delete o._p2; }); }
    const ss = toolbar && toolbar.querySelector('#rm-site');
    if (ss) { ss.replaceChildren(el('option', { value: '' }, `All ${Object.keys(SITE).length} centers`)); Object.values(SITE).sort((a, b) => a.short.localeCompare(b.short)).forEach(x => ss.append(el('option', { value: x.id }, x.short))); ss.value = S.site; }
    if (stage) { draw(); if (S.view === '2d' && S.zoom === 'region') zoomTo('region', 300); }
    try { pairsTable(); } catch (e) { }
  }
  const STATE_LL = {};
  const isForeign = o => o && o.country && o.country !== 'US';
  function orgLL(o) {
    if (o._ll !== undefined) return o._ll;
    let p = null;
    if (o.lat != null && o.lon != null) p = [+o.lat, +o.lon];
    else if (!isForeign(o) && o.state && STATE_LL[o.state]) { p = STATE_LL[o.state]; o.approx = true; }
    o._ll = p; return p;
  }
  const facLL = id => SITE[id] ? [SITE[id].lat, SITE[id].lon] : VAS[id] ? [VAS[id].lat, VAS[id].lon] : null;
  const facName = id => SITE[id] ? SITE[id].short : VAS[id] ? VAS[id].name : id;
  function flagOf(id) { const it = ITEMS[id]; if (!it) return null; if (FLAGS[id]) return FLAGS[id]; if (it.pid && FLAGS[it.pid]) return FLAGS[it.pid]; return null; }
  function itemPass(id) {
    const it = ITEMS[id]; if (!it) return false;
    if (!S.flagged && flagOf(id)) return false;
    if ((it.t === 'T' || it.t === 'R') && it.cf === 'low' && !S.low) return false;
    return true;
  }
  function endpoint(dst) {
    if (dst.startsWith('f:')) { const id = dst.slice(2); return (SITE[id] || VAS[id]) ? { key: dst, kind: 'fac', id } : null; }
    if (dst === 'self' || dst === 'inv') return { key: dst, kind: 'badge' };
    const o = ORG[dst]; return o ? { key: dst, kind: 'org', org: o } : null;
  }
  function compute() {
    const agg = new Map(); GCOUNT = {}; const GSET = {};
    const all = LINKS.concat(cradaLinks());
    for (const l of all) {
      const g = TGROUP[l.type]; if (!g) continue;
      if (S.site && l.src !== S.site && l.dst !== 'f:' + S.site) continue;
      const its = l.type === 'crada' ? l.items : l.items.filter(itemPass);
      if (!its.length) continue;
      its.forEach(i => (GSET[g] = GSET[g] || new Set()).add(recOf(i)));
      if (!S.groups.has(g)) continue;
      const b = endpoint(l.dst); if (!b) continue;
      const key = l.src + '|' + b.key + '|' + l.type;
      let e = agg.get(key); if (!e) { e = { src: l.src, dst: b.key, type: l.type, w: 0, items: [], b }; agg.set(key, e); }
      e.w += l.type === 'affil' ? its.reduce((a, i) => a + ((ITEMS[i] || {}).n || 1), 0) : its.length; e.items.push(...its);
    }
    for (const g in GSET) GCOUNT[g] = GSET[g].size;
    VIS = [...agg.values()].filter(e => !(LEAD.has(e.type) || TGROUP[e.type] === 'tie' || TGROUP[e.type] === 'pay') || e.w >= S.minw);
  }
  function weights() {
    const facW = {}, orgW = {};
    for (const e of VIS) { const cw = e.type === 'cross_site' ? 1e-6 : e.w; facW[e.src] = (facW[e.src] || 0) + cw; if (e.b.kind === 'org') orgW[e.b.key] = (orgW[e.b.key] || 0) + e.w; if (e.b.kind === 'fac') facW[e.b.id] = (facW[e.b.id] || 0) + cw; }
    return { facW, orgW };
  }
  const cradaLinks = () => [];

  function init2D() {
    const W = 1500, H = 940;
    const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');
    const root = svg.append('g'); R2.svg = svg; R2.root = root; R2.W = W; R2.H = H;
    const states = topojson.feature(window.RM_US, window.RM_US.objects.states); stateFeat = states;
    const SN = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico' };
    const byName = {}; states.features.forEach(f => { byName[f.properties.name] = f; const c = d3.geoCentroid(f); STATE_LL[Object.keys(SN).find(k => SN[k] === f.properties.name) || f.properties.name] = [c[1], c[0]]; });
    const lower = states.features.filter(f => f.id !== '72');
    const proj = d3.geoAlbersUsa().fitExtent([[215, 95], [1285, 800]], { type: 'FeatureCollection', features: lower.filter(f => !['02', '15'].includes(f.id)) });
    const path = d3.geoPath(proj);
    R2.proj = (lat, lon) => (lat == null || lon == null) ? null : proj([lon, lat]);
    R2.PORTS = { JP: [150, 170], KR: [150, 210], CN: [150, 250], TW: [150, 290], HK: [150, 330], PH: [150, 370], SG: [150, 410], IN: [150, 450], AU: [150, 500], NZ: [150, 540],
      CA: [760, 50], DK: [1110, 50], SE: [1180, 50], NO: [1250, 50], FI: [1320, 50],
      IE: [1345, 140], GB: [1345, 195], NL: [1345, 245], BE: [1345, 290], FR: [1345, 335], DE: [1345, 380], CH: [1345, 425], AT: [1345, 470], IT: [1345, 515], ES: [1345, 560], PL: [1345, 605], RU: [1345, 650], TR: [1345, 695], IL: [1345, 740], SA: [1345, 785], IR: [1345, 830], ZA: [1345, 875],
      MX: [640, 905], BR: [900, 905], AR: [1000, 905], CL: [1080, 905], CO: [1160, 905] };
    let extra = 0; R2.portFor = cc => { if (!R2.PORTS[cc]) { R2.PORTS[cc] = [1180 + (extra % 3) * 55, 905]; extra++; } return R2.PORTS[cc]; };
    R2.SN = SN; R2.lower = lower; R2.path = path;
    const spot = {};
    R2.orgPos = o => {
      if (o._p2 !== undefined) return o._p2;
      let p = null;
      if (isForeign(o)) { o._p2 = null; return null; }
      if (o.npc && R2.facPos[o.site]) { const q = R2.facPos[o.site]; const h = hash(o.id); p = [q[0] + 9 + (h % 3) * 3, q[1] - 9 - (h % 2) * 4]; }
      else { const ll = orgLL(o); if (ll) p = R2.proj(ll[0], ll[1]); }
      if (!p || isNaN(p[0])) { o._p2 = null; return null; }
      const k = Math.round(p[0] / 3) + ',' + Math.round(p[1] / 3); const i = spot[k] = (spot[k] || 0) + 1;
      if (i > 1) { const a = i * 2.4, r = 2.2 * Math.sqrt(i); p = [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)]; }
      o._p2 = p; return p;
    };
    const gStates = root.append('g'); R2.gStates = gStates;
    gStates.selectAll('path').data(lower).join('path').attr('class', 'rm-state').attr('d', path);
    gStates.append('rect').attr('class', 'rm-inset').attr('x', 120).attr('y', 612).attr('width', 312).attr('height', 180);
    gStates.append('text').attr('class', 'rm-ringtitle').attr('x', 124).attr('y', 607).text('Alaska');
    gStates.append('rect').attr('class', 'rm-inset').attr('x', 436).attr('y', 690).attr('width', 140).attr('height', 96);
    gStates.append('text').attr('class', 'rm-ringtitle').attr('x', 440).attr('y', 685).text('Hawaii');
    R2.gRing = root.append('g'); R2.gTies = root.append('g'); R2.gLinks = root.append('g'); R2.gOrgs = root.append('g'); R2.gFac = root.append('g'); R2.gLbl = root.append('g');
    [['Asia–Pacific', 60, 140], ['Europe · Middle East', 1300, 110], ['Canada', 640, 22], ['Nordics', 1080, 22], ['Latin America', 600, 935]].forEach(([t, x, y]) => R2.gRing.append('text').attr('class', 'rm-ringtitle').attr('x', x).attr('y', y).text(t));
    R2.K = 1;
    R2.zoom = d3.zoom().scaleExtent([0.8, 18]).on('zoom', e => { root.attr('transform', e.transform); R2.K = e.transform.k; clearTimeout(R2.t); R2.t = setTimeout(() => { if (S.layout === 'ties') renderTies(true); else if (S.view === '2d') render2D(); }, 90); });
    svg.call(R2.zoom).on('dblclick.zoom', null);
    svg.on('click', () => { if (S.sel) { S.sel = null; draw(); } });
    placeSites();
  }
  function placeSites() {
    R2.facPos = {};
    Object.values(SITE).forEach(f => { const p = R2.proj(f.lat, f.lon); if (p) R2.facPos[f.id] = p; });
    Object.values(VAS).forEach(f => { const p = R2.proj(f.lat, f.lon); if (p) R2.facPos[f.id] = p; });
    const regionStates = new Set(Object.values(SITE).map(s => R2.SN[s.state]));
    R2.gStates.selectAll('path.rm-state').attr('class', d => 'rm-state' + (regionStates.has(d.properties.name) ? ' region' : ''));
    const pts = Object.values(SITE).map(s => R2.facPos[s.id]).filter(Boolean);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    R2.bbox = pts.length ? [Math.min(...xs) - 70, Math.min(...ys) - 60, Math.max(...xs) + 90, Math.max(...ys) + 70] : [0, 0, R2.W, R2.H];
    if (pts.length > 40) R2.bbox = [Math.max(R2.bbox[0], 100), Math.max(R2.bbox[1], 40), Math.min(R2.bbox[2], 1400), Math.min(R2.bbox[3], 900)];
  }
  function zoomTo(mode, ms) {
    S.zoom = mode;
    const W = R2.W, H = R2.H;
    let t;
    if (S.layout === 'ties' && TL.box) { TL.sig = ''; renderTies(); return; }
    if (mode === 'region') { const [x0, y0, x1, y1] = R2.bbox; const k = Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.96; t = d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k); }
    else if (mode === 'us') t = d3.zoomIdentity.translate(60, 40).scale(0.92);
    else t = d3.zoomIdentity;
    R2.svg.transition().duration(ms == null ? 700 : ms).call(R2.zoom.transform, t);
  }
  const TL = { sig: '', pos: {}, box: null };
  const RING = { patent: 200, lead: 300, tie: 395, ctx: 470, crada: 345 };
  function renderTies(restyle) {
    const K = R2.K; const { facW } = weights(); const W = R2.W, H = R2.H;
    R2.gStates.style('display', 'none'); R2.gRing.style('display', 'none'); R2.gRing.selectAll('g.pt').remove();
    R2.gOrgs.selectAll('path').remove(); R2.gFac.selectAll('circle').remove(); R2.gLbl.selectAll('text.site, text.org').remove();
    const hubs = Object.values(SITE).filter(f => S.site ? f.id === S.site : (facW[f.id] || 0) > 0);
    const hubSet = new Set(hubs.map(h => h.id));
    const drawn = new Map();
    for (const e of VIS) {
      if (!hubSet.has(e.src)) continue;
      const key = e.b.kind === 'fac' && hubSet.has(e.b.id) ? 'f:' + e.b.id : e.b.key;
      const k = e.src + '|' + key + '|' + e.type; let d = drawn.get(k);
      if (!d) { d = { src: e.src, dst: key, type: e.type, w: 0, items: [], b: e.b, base: [] }; drawn.set(k, d); }
      d.w += e.w; d.items.push(...e.items); d.base.push(e);
    }
    const list = [...drawn.values()];
    const pw = {}, pk = {}, pb = {};
    for (const d of list) { if (d.b.kind === 'fac' && hubSet.has(d.b.id)) continue; pw[d.dst] = (pw[d.dst] || 0) + d.w; pb[d.dst] = d.b; const g = GKEY(TGROUP[d.type] || 'ctx'); pk[d.dst] = pk[d.dst] || {}; pk[d.dst][g] = (pk[d.dst][g] || 0) + d.w; }
    const partners = Object.keys(pw).map(id => ({ id, kind: 'p', w: pw[id], b: pb[id], main: Object.entries(pk[id]).sort((a, b) => b[1] - a[1])[0][0] }));
    const sig = JSON.stringify([hubs.map(h => h.id), partners.map(p => p.id + ':' + p.w), S.site, S.minw]);
    if (sig !== TL.sig) {
      const nodes = hubs.map(h => ({ id: 'f:' + h.id, kind: 'hub', r: rScale(facW[h.id] || 0) + 4, fac: h })).concat(partners.map(p => Object.assign({ r: Math.max(4, Math.min(16, 2 + 1.5 * Math.sqrt(p.w))) }, p)));
      const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
      const gp = hubs.map(h => R2.facPos[h.id]).filter(Boolean);
      const gx = gp.length ? [Math.min(...gp.map(p => p[0])), Math.max(...gp.map(p => p[0]))] : [0, 1], gy = gp.length ? [Math.min(...gp.map(p => p[1])), Math.max(...gp.map(p => p[1]))] : [0, 1];
      const sx = x => W * 0.2 + (gx[1] > gx[0] ? (x - gx[0]) / (gx[1] - gx[0]) : 0.5) * W * 0.6, sy = y => H * 0.2 + (gy[1] > gy[0] ? (y - gy[0]) / (gy[1] - gy[0]) : 0.5) * H * 0.6;
      nodes.forEach(n => { if (n.kind === 'hub') { const p = R2.facPos[n.fac.id]; n.x = p ? sx(p[0]) : W / 2; n.y = p ? sy(p[1]) : H / 2; if (hubs.length === 1) { n.fx = W / 2; n.fy = H / 2; } } });
      const links = list.filter(d => byId['f:' + d.src] && byId[d.dst]).map(d => ({ source: 'f:' + d.src, target: d.dst, w: d.w, g: GKEY(TGROUP[d.type] || 'ctx') }));
      nodes.forEach(n => { if (n.kind === 'p') { const l = links.find(x => x.target === n.id); const h = l && byId[l.source]; const a = (hash(n.id) % 360) * Math.PI / 180; n.x = (h ? h.x : W / 2) + 60 * Math.cos(a); n.y = (h ? h.y : H / 2) + 60 * Math.sin(a); } });
      if (hubs.length === 1) {
        const order = ['patent', 'lead', 'tie', 'crada', 'ctx']; const rf = Math.max(1, Math.sqrt(partners.length / 40)); const c = [W / 2, H / 2];
        const RMAX = Math.min(W / 2 - 250, H / 2 - 36); const rk = Math.min(1, RMAX / (RING.ctx * rf)); TL.ringK = rf * rk;
        let off = 0;
        for (const g of order) { const ps = nodes.filter(n => n.kind === 'p' && n.main === g).sort((a, b) => b.w - a.w); if (!ps.length) continue;
          const r0 = RING[g] * TL.ringK; const n = ps.length; const two = n > 18;
          ps.forEach((p, i) => { const a = off + 2 * Math.PI * i / n; const r = two ? r0 + (i % 2 ? 30 : -30) : r0; p.x = c[0] + r * Math.cos(a); p.y = c[1] + r * Math.sin(a); });
          off += 0.37; }
        nodes.filter(n => n.kind === 'hub').forEach(n => { n.x = c[0]; n.y = c[1]; });
      } else {
        const sim = d3.forceSimulation(nodes)
          .force('link', d3.forceLink(links).id(d => d.id).distance(d => 80 + 140 / (1 + Math.log2(1 + d.w))).strength(d => Math.min(1, 0.25 + 0.08 * Math.log2(1 + d.w))))
          .force('charge', d3.forceManyBody().strength(d => d.kind === 'hub' ? -2600 : -220).distanceMax(700))
          .force('collide', d3.forceCollide(d => d.r + (d.kind === 'hub' ? 30 : 12)).strength(0.9))
          .force('x', d3.forceX(W / 2).strength(0.03)).force('y', d3.forceY(H / 2).strength(0.05)).stop();
        for (let i = 0; i < 300; i++) sim.tick();
        const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
        if (nodes.length > 1) { const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); const k = Math.min((W - 320) / Math.max(1, x1 - x0), (H - 80) / Math.max(1, y1 - y0)); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; nodes.forEach(n => { n.x = W / 2 + (n.x - cx) * k; n.y = H / 2 + (n.y - cy) * k; }); }
        TL.ringK = 0;
      }
      TL.pos = Object.fromEntries(nodes.map(n => [n.id, [n.x, n.y]])); TL.sig = sig; TL.box = [0, 0, W, H];
      if (!restyle) R2.svg.transition().duration(400).call(R2.zoom.transform, d3.zoomIdentity);
    }
    const P = TL.pos; const pos = id => P[id] || [W / 2, H / 2];
    const sw = w => 1.5 * Math.max(0.6, Math.min(9, 0.7 + Math.log2(1 + w) * 1.1)); const Kq = 1;   // diagram scale: sizes do not shrink as you zoom
    const items = list.filter(d => P['f:' + d.src] && P[d.dst]);
    const sel = d => select({ kind: 'link', d: d.base.length === 1 ? d.base[0] : { src: d.src, dst: d.dst, type: d.type, w: d.w, items: d.items, b: d.b } });
    R2.gLinks.selectAll('path').data(items, d => d.src + '|' + d.dst + '|' + d.type).join('path')
      .attr('class', 'rm-link').attr('d', d => { const a = pos('f:' + d.src), b = pos(d.dst); return `M${a[0]},${a[1]}L${b[0]},${b[1]}`; }).attr('stroke', d => tcol(d.type))
      .attr('stroke-width', d => (TGROUP[d.type] === 'affil' ? Math.max(0.8, sw(d.w) * 0.55) : sw(d.w)) / Math.sqrt(Kq))
      .attr('stroke-dasharray', d => { const g = TGROUP[d.type]; return g === 'contract' || g === 'rd' || d.type === 'crada' ? '6 4' : g === 'npc' ? '2 3' : null; })
      .classed('ctx', d => CTX.has(TGROUP[d.type])).classed('hl', d => isHL(d))
      .on('mousemove', (ev, d) => tip(ev, `<b>${esc(facName(d.src))}</b> → <b>${esc(nameOf(d.b))}</b><br>${fmt(d.w)} × ${esc(TNAME[d.type])}`))
      .on('mouseleave', hideTip).on('click', (ev, d) => { ev.stopPropagation(); sel(d); });
    R2.root.classed('dim', !!S.sel);
    const shape = k => k === 'univ' ? d3.symbolSquare : (k === 'co' || k === 'large') ? d3.symbolDiamond : k === 'hosp' ? d3.symbolTriangle : d3.symbolCircle;
    const pn = partners.filter(p => P[p.id]);
    const gp = R2.gOrgs.selectAll('g.tnode').data(pn, d => d.id).join(en => { const g = en.append('g').attr('class', 'tnode'); g.append('path'); return g; });
    gp.attr('transform', d => `translate(${pos(d.id)[0]},${pos(d.id)[1]})`).style('cursor', 'pointer')
      .on('mousemove', (ev, d) => tip(ev, `<b>${esc(nameOf(d.b))}</b><br>${d.b.kind === 'org' ? esc([d.b.org.city, d.b.org.state, d.b.org.country !== 'US' ? (CNAME[d.b.org.country] || d.b.org.country) : ''].filter(Boolean).join(', ')) + '<br>' : ''}${fmt(d.w)} linked records`))
      .on('mouseleave', hideTip).on('click', (ev, d) => { ev.stopPropagation(); if (d.b.kind === 'org') select({ kind: 'org', id: d.b.org.id }); else if (d.b.kind === 'fac') select({ kind: 'fac', id: d.b.id }); else { const l = items.find(x => x.dst === d.id); if (l) sel(l); } });
    gp.select('path').attr('class', d => 'rm-org' + (d.b.kind === 'org' && (d.b.org.kind === 'npc' || d.b.org.kind === 'found') ? ' npc' : ''))
      .attr('d', d => d3.symbol().type(d.b.kind === 'org' ? shape(d.b.org.kind) : d.b.kind === 'badge' ? d3.symbolSquare : d3.symbolCircle).size(Math.max(90, Math.min(900, 26 * d.w)))())
      .attr('fill', d => S.sel && S.sel.kind === 'org' && d.b.kind === 'org' && S.sel.id === d.b.org.id ? cssv('--rm-sel') : d.b.kind === 'org' ? kcol(d.b.org.kind) : d.b.kind === 'fac' ? cssv('--ink-3') : cssv('--g-' + d.main)).attr('opacity', .92);
    const hn = hubs.filter(h => P['f:' + h.id]);
    const gh = R2.gFac.selectAll('g.tnode').data(hn, d => d.id).join(en => { const g = en.append('g').attr('class', 'tnode'); g.append('circle'); return g; });
    gh.attr('transform', d => `translate(${pos('f:' + d.id)[0]},${pos('f:' + d.id)[1]})`).style('cursor', 'pointer')
      .on('mousemove', (ev, d) => tip(ev, `<b>${esc(d.name)}</b><br>${fmt(facW[d.id] || 0)} linked records (current filters)`))
      .on('mouseleave', hideTip).on('click', (ev, d) => { ev.stopPropagation(); select({ kind: 'fac', id: d.id }); });
    gh.select('circle').attr('class', d => 'rm-fac site' + (S.sel && S.sel.kind === 'fac' && S.sel.id === d.id ? ' sel' : '') + (S.site === d.id ? ' foc' : '')).attr('r', d => 1.5 * (rScale(facW[d.id] || 0) + 3));
    const labP = S.labels ? (hubs.length === 1 ? pn : pn.slice().sort((a, b) => b.w - a.w).slice(0, K > 2.5 ? 400 : K > 1.5 ? 140 : 50)) : [];
    R2.gLbl.selectAll('text.tl.site').data(hn, d => d.id).join('text').attr('class', 'rm-lbl site tl')
      .attr('x', d => pos('f:' + d.id)[0] + 1.5 * (rScale(facW[d.id] || 0) + 3) + 5).attr('y', d => pos('f:' + d.id)[1] + 6).style('font-size', '21px').text(d => d.short);
    const cx = W / 2; const side = d => pos(d.id)[0] < cx ? -1 : 1;
    R2.gLbl.selectAll('text.tl.org').data(labP, d => d.id).join('text').attr('class', 'rm-lbl org tl')
      .attr('x', d => pos(d.id)[0] + side(d) * (1.6 * Math.max(4, Math.min(16, 2 + 1.5 * Math.sqrt(d.w))) + 6)).attr('y', d => pos(d.id)[1] + 5).attr('text-anchor', d => side(d) < 0 ? 'end' : 'start')
      .style('font-size', '17px').text(d => nameOf(d.b).slice(0, 40));
    const rings = hubs.length === 1 && TL.ringK ? [['patent', 'VA on title']].filter(([g]) => partners.some(p => p.main === g)) : [];
    const rf = TL.ringK || 1;
    const rg = R2.gTies.selectAll('g.ring').data(rings, d => d[0]).join(en => { const g = en.append('g').attr('class', 'ring'); g.append('circle'); g.append('text'); return g; });
    rg.select('circle').attr('cx', W / 2).attr('cy', H / 2).attr('r', d => RING[d[0]] * rf).attr('class', 'rm-ring');
    rg.select('text').attr('class', 'rm-ringtitle').attr('x', W / 2).attr('y', d => H / 2 - RING[d[0]] * rf - 6).attr('text-anchor', 'middle').style('font-size', '15px').style('fill', d => cssv('--g-' + d[0])).text(d => d[1]);
  }
  function fly2D(id) { const p = R2.facPos[id]; if (!p) return; const k = 5; R2.svg.transition().duration(800).call(R2.zoom.transform, d3.zoomIdentity.translate(R2.W / 2 - k * p[0], R2.H / 2 - k * p[1]).scale(k)); }
  const rScale = w => Math.max(2.4, Math.min(24, 2 + 1.7 * Math.sqrt(w)));
  const ti = t => TYPES.findIndex(x => x[0] === t);
  function curve2(a, b, t) { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; const off = (0.14 + 0.03 * (ti(t) % 4)) * d; const mx = (a[0] + b[0]) / 2 - dy / d * off, my = (a[1] + b[1]) / 2 + dx / d * off; return `M${a[0]},${a[1]}Q${mx},${my} ${b[0]},${b[1]}`; }
  function petal2(a, e, K, base) { const h = hash(e.dst); const ang = (ti(e.type) * 33 + (h % 24)) * Math.PI / 180; const r = (base || 0) + (9 + 3 * (h % 3)) / Math.sqrt(K); const s = 0.45 * Math.min(1, 14 / Math.max(14, r * Math.sqrt(K)));
    const c = [a[0] + r * Math.sin(ang), a[1] - r * Math.cos(ang)]; const p1 = [a[0] + r * s * Math.sin(ang + 0.9), a[1] - r * s * Math.cos(ang + 0.9)], p2 = [a[0] + r * s * Math.sin(ang - 0.9), a[1] - r * s * Math.cos(ang - 0.9)];
    return `M${a[0]},${a[1]}Q${p1[0]},${p1[1]} ${c[0]},${c[1]}Q${p2[0]},${p2[1]} ${a[0]},${a[1]}`; }
  const isHL = d => { const s = S.sel; if (!s) return false; if (s.kind === 'fac') return d.src === s.id || d.dst === 'f:' + s.id; if (s.kind === 'org') return d.dst === s.id; if (s.kind === 'port') return d.dst === 'port:' + s.cc; if (s.kind === 'link') return d.src === s.d.src && d.dst === s.d.dst && d.type === s.d.type; return false; };
  function render2D() {
    const K = R2.K; const { facW } = weights();
    R2.gStates.style('display', null); R2.gRing.style('display', null); R2.gFac.selectAll('g.tnode').remove(); R2.gOrgs.selectAll('g.tnode').remove(); R2.gLbl.selectAll('text.tl').remove(); if (R2.gTies) R2.gTies.selectAll('*').remove();
    const drawn = new Map(); const orgW = {}, portW = {};
    for (const e of VIS) {
      const a = R2.facPos[e.src]; if (!a) continue;
      let end = null, key = e.b.key, port = null;
      if (e.b.kind === 'fac') end = R2.facPos[e.b.id];
      else if (e.b.kind === 'org') { const o = e.b.org; if (isForeign(o)) { port = o.country; end = R2.portFor(port); key = 'port:' + port; } else end = R2.orgPos(o); }
      const k = e.src + '|' + key + '|' + e.type; let d = drawn.get(k);
      if (!d) { d = { src: e.src, dst: key, type: e.type, w: 0, items: [], b: port ? { key, kind: 'port', cc: port } : e.b, a, end, petal: !end || Math.hypot(end[0] - a[0], end[1] - a[1]) < 1.2, base: [] }; drawn.set(k, d); }
      d.w += e.w; d.items.push(...e.items); d.base.push(e);
      if (port) portW[key] = (portW[key] || 0) + e.w; else if (e.b.kind === 'org' && end) orgW[e.b.key] = (orgW[e.b.key] || 0) + e.w;
    }
    const list = [...drawn.values()];
    const sw = w => Math.max(0.6, Math.min(9, 0.7 + Math.log2(1 + w) * 1.1));
    const linkD = d => d.petal ? petal2(d.a, d, K, rScale(facW[d.src] || 0) / Math.sqrt(K)) : curve2(d.a, d.end, d.type);
    const sel = d => select({ kind: 'link', d: d.base.length === 1 ? d.base[0] : { src: d.src, dst: d.dst, type: d.type, w: d.w, items: d.items, b: d.b } });
    R2.gLinks.selectAll('path').data(list, d => d.src + '|' + d.dst + '|' + d.type).join('path')
      .attr('class', 'rm-link').attr('d', linkD).attr('stroke', d => tcol(d.type))
      .attr('stroke-width', d => (d.petal ? Math.max(1.2, sw(d.w) * 0.8) : TGROUP[d.type] === 'affil' ? Math.max(0.8, sw(d.w) * 0.55) : sw(d.w)) / Math.sqrt(K))
      .attr('stroke-dasharray', d => { const g = TGROUP[d.type]; return g === 'contract' || g === 'rd' || d.type === 'crada' ? '6 4' : g === 'npc' ? '2 3' : null; })
      .classed('ctx', d => CTX.has(TGROUP[d.type])).classed('hl', d => isHL(d))
      .on('mousemove', (ev, d) => tip(ev, `<b>${esc(facName(d.src))}</b> → <b>${esc(nameOf(d.b))}</b><br>${fmt(d.w)} × ${esc(TNAME[d.type])}${d.petal ? '<br><i>' + (d.b.kind === 'badge' ? (d.dst === 'self' ? 'VA-only filings: no partner.' : 'Released to the inventor(s).') : 'Same place as the center, or no separate location: drawn as a loop.') + '</i>' : ''}`))
      .on('mouseleave', hideTip).on('click', (ev, d) => { ev.stopPropagation(); sel(d); });
    R2.root.classed('dim', !!S.sel).selectAll('.rm-ringtitle').style('font-size', (10 / Math.sqrt(K)) + 'px');
    const orgs = Object.entries(orgW).map(([k, w]) => ({ o: ORG[k], w })).filter(x => x.o && x.o._p2);
    const shape = k => k === 'univ' ? d3.symbolSquare : (k === 'co' || k === 'large') ? d3.symbolDiamond : k === 'hosp' ? d3.symbolTriangle : (k === 'npc' || k === 'found') ? d3.symbolCircle : d3.symbolCircle;
    R2.gOrgs.selectAll('path').data(orgs, d => d.o.id).join('path').attr('class', d => 'rm-org' + (d.o.kind === 'npc' || d.o.kind === 'found' ? ' npc' : ''))
      .attr('d', d => d3.symbol().type(shape(d.o.kind)).size(Math.max(22, Math.min(300, 10 * d.w)) / K)())
      .attr('transform', d => `translate(${d.o._p2[0]},${d.o._p2[1]})`).attr('fill', d => S.sel && S.sel.kind === 'org' && S.sel.id === d.o.id ? cssv('--rm-sel') : kcol(d.o.kind)).attr('opacity', d => d.o.approx ? .5 : .92)
      .on('mousemove', (ev, d) => tip(ev, `<b>${esc(d.o.name)}</b><br>${esc([d.o.city, d.o.state].filter(Boolean).join(', '))}${d.o.approx ? ' (state only)' : ''}<br>${fmt(d.w)} linked records`))
      .on('mouseleave', hideTip).on('click', (ev, d) => { ev.stopPropagation(); select({ kind: 'org', id: d.o.id }); });
    const ports = Object.keys(R2.PORTS).map(cc => ({ cc, p: R2.PORTS[cc], w: portW['port:' + cc] || 0 })).filter(x => x.w > 0);
    const pg = R2.gRing.selectAll('g.pt').data(ports, d => d.cc).join(en => { const g = en.append('g').attr('class', 'pt'); g.append('circle').attr('class', 'rm-port'); g.append('text').attr('class', 'rm-portlbl'); return g; });
    pg.attr('transform', d => `translate(${d.p[0]},${d.p[1]})`).style('cursor', 'pointer').on('click', (ev, d) => { ev.stopPropagation(); select({ kind: 'port', cc: d.cc }); })
      .on('mousemove', (ev, d) => tip(ev, `<b>${esc(CNAME[d.cc] || d.cc)}</b><br>${fmt(d.w)} linked records`)).on('mouseleave', hideTip);
    pg.select('circle').attr('r', d => Math.max(5, Math.min(20, 2 + 2 * Math.sqrt(d.w))) / Math.sqrt(K));
    pg.select('text').attr('x', d => d.p[0] < 200 ? -12 : d.p[0] > 1300 ? 12 : 0).attr('y', d => d.p[1] < 60 ? -14 : d.p[1] > 880 ? -14 : 4)
      .attr('text-anchor', d => d.p[0] < 200 ? 'end' : d.p[0] > 1300 ? 'start' : 'middle').style('font-size', (11 / Math.sqrt(K)) + 'px').text(d => (CNAME[d.cc] || d.cc) + ` ${d.w}`);
    const others = Object.values(VAS).filter(f => R2.facPos[f.id]);
    const facs = Object.values(SITE).filter(f => R2.facPos[f.id]);
    R2.gFac.selectAll('circle.other').data(others, d => d.id).join('circle').attr('class', d => 'rm-fac other' + ((facW[d.id] || 0) ? ' linked' : ''))
      .attr('cx', d => R2.facPos[d.id][0]).attr('cy', d => R2.facPos[d.id][1]).attr('r', d => ((facW[d.id] || 0) ? Math.max(2.2, rScale(facW[d.id]) * 0.6) : 1.6) / Math.sqrt(K))
      .on('mousemove', (ev, d) => tip(ev, `<b>${esc(d.name)}</b> (outside the scope)<br>${fmt(facW[d.id] || 0)} linked records`)).on('mouseleave', hideTip)
      .on('click', (ev, d) => { ev.stopPropagation(); if (facW[d.id]) select({ kind: 'fac', id: d.id }); });
    R2.gFac.selectAll('circle.site').data(facs, d => d.id).join('circle').attr('class', d => 'rm-fac site' + ((facW[d.id] || 0) ? '' : ' zero') + (d.research ? '' : ' small') + (S.sel && S.sel.kind === 'fac' && S.sel.id === d.id ? ' sel' : '') + (S.site === d.id ? ' foc' : ''))
      .attr('cx', d => R2.facPos[d.id][0]).attr('cy', d => R2.facPos[d.id][1]).attr('r', d => rScale(facW[d.id] || 0) / Math.sqrt(K))
      .on('mousemove', (ev, d) => tip(ev, `<b>${esc(d.name)}</b><br>${fmt(facW[d.id] || 0)} linked records (current filters)`))
      .on('mouseleave', hideTip).on('click', (ev, d) => { ev.stopPropagation(); select({ kind: 'fac', id: d.id }); });
    const lab = S.labels ? facs.filter(f => f.research || K > 1.8 || facW[f.id]) : facs.filter(f => S.sel && S.sel.kind === 'fac' && S.sel.id === f.id);
    const topOrgs = K > 2.2 ? orgs.sort((a, b) => b.w - a.w).slice(0, K > 4 ? 60 : 18) : (S.sel && S.sel.kind === 'org' ? orgs.filter(x => x.o.id === S.sel.id) : []);
    R2.gLbl.selectAll('text.site').data(lab, d => d.id).join('text').attr('class', 'rm-lbl site')
      .attr('x', d => R2.facPos[d.id][0] + rScale(facW[d.id] || 0) / Math.sqrt(K) + 2).attr('y', d => R2.facPos[d.id][1] + 3).style('font-size', (10.5 / Math.sqrt(K)) + 'px').text(d => d.short);
    R2.gLbl.selectAll('text.org').data(topOrgs, d => d.o.id).join('text').attr('class', 'rm-lbl org')
      .attr('x', d => d.o._p2[0] + 5 / Math.sqrt(K)).attr('y', d => d.o._p2[1] - 4 / Math.sqrt(K)).style('font-size', (9.5 / Math.sqrt(K)) + 'px').text(d => d.o.name.slice(0, 36));
  }
  const CNAME = { JP: 'Japan', KR: 'South Korea', CN: 'China', TW: 'Taiwan', HK: 'Hong Kong', PH: 'Philippines', SG: 'Singapore', IN: 'India', AU: 'Australia', NZ: 'New Zealand', CA: 'Canada', DK: 'Denmark', SE: 'Sweden', NO: 'Norway', FI: 'Finland', IE: 'Ireland', GB: 'United Kingdom', NL: 'Netherlands', BE: 'Belgium', FR: 'France', DE: 'Germany', CH: 'Switzerland', AT: 'Austria', IT: 'Italy', ES: 'Spain', PL: 'Poland', RU: 'Russia', TR: 'Türkiye', IL: 'Israel', SA: 'Saudi Arabia', IR: 'Iran', ZA: 'South Africa', MX: 'Mexico', BR: 'Brazil', AR: 'Argentina', CL: 'Chile', CO: 'Colombia' };
  const nameOf = b => b.kind === 'fac' ? facName(b.id) : b.kind === 'port' ? (CNAME[b.cc] || b.cc) : b.kind === 'badge' ? (b.key === 'self' ? 'VA-only filings' : 'Released to inventor(s)') : (b.org ? b.org.name : b.key);

  function init3D() {
    if (G) return true;
    if (typeof Globe !== 'function') return false;
    const world = topojson.feature(window.RM_WORLD, window.RM_WORLD.objects.countries);
    G = Globe({ animateIn: false })(globeEl).showAtmosphere(true).atmosphereAltitude(0.12)
      .polygonsData([...world.features.filter(f => f.id !== '840'), ...stateFeat.features]).polygonSideColor(() => 'rgba(0,0,0,0)').polygonAltitude(0.004).polygonsTransitionDuration(0)
      .arcsTransitionDuration(0).pointsTransitionDuration(0).labelsTransitionDuration(0).pointsMerge(false).pointResolution(8).labelResolution(2).arcCurveResolution(32).arcCircularResolution(4).polygonCapCurvatureResolution(8);
    theme3D();
    G.pointOfView({ lat: 43, lng: -87, altitude: 0.9 }, 0);
    G.onGlobeClick(() => { if (S.sel) { S.sel = null; draw(); } }); G.onPolygonClick(() => { if (S.sel) { S.sel = null; draw(); } });
    if (G.lineHoverPrecision) G.lineHoverPrecision(0.8);
    resize3D();
    return true;
  }
  function theme3D() { if (!G) return; G.backgroundColor(cssv('--rm-space')).atmosphereColor(cssv('--rm-atmo')).polygonCapColor(() => cssv('--rm-land')).polygonStrokeColor(() => cssv('--rm-gline')); const m = G.globeMaterial(); if (m && m.color) m.color.set(cssv('--rm-ocean')); }
  function resize3D() { if (!G) return; const r = stage.getBoundingClientRect(); G.width(Math.max(200, r.width)).height(Math.max(200, r.height)); }
  const angDist = (a, b) => { const R = Math.PI / 180, dl = (b[0] - a[0]) * R, dg = (b[1] - a[1]) * R; const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dg / 2) ** 2; return 2 * Math.asin(Math.min(1, Math.sqrt(h))); };
  const spot3 = {};
  function orgLL3(o) { if (o._p3 !== undefined) return o._p3; let p = o.npc && facLL(o.site) ? [facLL(o.site)[0] + 0.14, facLL(o.site)[1] + 0.14] : orgLL(o); if (p) { const k = p[0].toFixed(2) + ',' + p[1].toFixed(2); const i = spot3[k] = (spot3[k] || 0) + 1; if (i > 1) { const a = i * 2.4, r = 0.03 * Math.sqrt(i); p = [p[0] + r * Math.sin(a), p[1] + r * Math.cos(a) / Math.max(0.2, Math.cos(p[0] * Math.PI / 180))]; } } o._p3 = p; return p; }
  function petalEnd(e, a) { const h = hash(e.b.key); const ang = (ti(e.type) * 33 + (h % 24)) * Math.PI / 180, r = 0.9 + 0.25 * (h % 3); return [a[0] + r * Math.sin(ang), a[1] + r * Math.cos(ang) / Math.max(0.2, Math.cos(a[0] * Math.PI / 180))]; }
  function render3D() {
    if (!G) return; const { facW, orgW } = weights();
    const arcs = [];
    for (const e of VIS) { const a = facLL(e.src); if (!a) continue; let end = e.b.kind === 'fac' ? facLL(e.b.id) : (e.b.kind === 'org' ? orgLL3(e.b.org) : null), petal = false; if (!end || angDist(a, end) < 0.0095) { end = petalEnd(e, a); petal = true; } arcs.push({ e, a, end, petal }); }
    G.arcsData(arcs).arcStartLat(d => d.a[0]).arcStartLng(d => d.a[1]).arcEndLat(d => d.end[0]).arcEndLng(d => d.end[1])
      .arcAltitude(d => d.petal ? Math.min(0.045, 0.018 + 0.004 * Math.log2(1 + d.e.w)) : Math.min(0.42, 0.008 + 0.2 * angDist(d.a, d.end)))
      .arcStroke(d => d.petal ? Math.min(0.38, 0.13 + 0.05 * Math.log2(1 + d.e.w)) : (d.e.w >= 3 ? Math.min(0.55, 0.06 + 0.06 * Math.log2(1 + d.e.w)) : null))
      .arcColor(d => rgba(tcol(d.e.type), S.sel ? (isHL(d.e) ? 0.95 : 0.05) : 0.62))
      .arcDashLength(d => d.e.type === 'release' ? 0.35 : d.e.type === 'tie_sec' ? 0.1 : d.e.type === 'crada' ? 0.3 : 1).arcDashGap(d => d.e.type === 'release' ? 0.12 : d.e.type === 'tie_sec' ? 0.06 : d.e.type === 'crada' ? 0.1 : 0).arcDashAnimateTime(d => d.e.type === 'release' ? 2600 : 0)
      .arcLabel(d => `<div class="rm-gtip"><b>${esc(facName(d.e.src))}</b> → <b>${esc(nameOf(d.e.b))}</b><br>${fmt(d.e.w)} × ${esc(TNAME[d.e.type])}${d.petal ? '<br><i>Drawn as a small loop at the center (same place, or no separate location).</i>' : ''}</div>`)
      .onArcClick(d => select({ kind: 'link', d: d.e }));
    const sel = S.sel; const pts = [];
    Object.values(SITE).forEach(f => { const p = facLL(f.id); if (p) pts.push({ kind: 'fac', id: f.id, lat: p[0], lng: p[1], w: facW[f.id] || 0, region: true }); });
    Object.values(VAS).forEach(f => { const p = facLL(f.id); if (p) pts.push({ kind: 'fac', id: f.id, lat: p[0], lng: p[1], w: facW[f.id] || 0, region: false }); });
    Object.entries(orgW).forEach(([k, w]) => { const o = ORG[k]; const p = o && orgLL3(o); if (p) pts.push({ kind: 'org', id: k, lat: p[0], lng: p[1], w }); });
    G.pointsData(pts).pointLat('lat').pointLng('lng')
      .pointColor(d => { if (d.kind === 'fac') { if (sel && sel.kind === 'fac' && sel.id === d.id) return cssv('--rm-sel'); return d.region ? (d.w ? cssv('--rm-va') : rgba(cssv('--rm-va'), 0.55)) : rgba(cssv('--ink-3'), d.w ? 0.8 : 0.35); } const o = ORG[d.id]; if (sel && sel.kind === 'org' && sel.id === d.id) return cssv('--rm-sel'); return rgba(kcol(o.kind), o.approx ? 0.55 : 0.95); })
      .pointAltitude(d => d.kind === 'fac' ? (d.w ? Math.min(0.14, 0.004 + 0.0052 * Math.sqrt(d.w)) : (d.region ? 0.004 : 0.0015)) : Math.min(0.01, 0.0015 + 0.001 * Math.sqrt(d.w)))
      .pointRadius(d => d.kind === 'fac' ? (d.region ? Math.min(0.3, 0.11 + 0.008 * Math.sqrt(d.w)) : (d.w ? 0.1 : 0.05)) : Math.min(0.18, 0.05 + 0.01 * Math.sqrt(d.w)))
      .pointLabel(d => { if (d.kind === 'fac') { const f = SITE[d.id] || VAS[d.id]; return `<div class="rm-gtip"><b>${esc(f.name)}</b>${d.region ? '' : ' (outside the scope)'}<br>Pillar height: ${fmt(d.w)} linked records under the current filters</div>`; } const o = ORG[d.id]; return `<div class="rm-gtip"><b>${esc(o.name)}</b><br>${esc([o.city, o.state, o.country !== 'US' ? (CNAME[o.country] || o.country) : ''].filter(Boolean).join(', '))}${o.approx ? ' (state only)' : ''}<br>${fmt(d.w)} linked records</div>`; })
      .onPointClick(d => { if (d.kind === 'fac' && !SITE[d.id] && !d.w) return; select(d.kind === 'fac' ? { kind: 'fac', id: d.id } : { kind: 'org', id: d.id }); });
    const lbl = (S.labels ? Object.values(SITE).filter(f => f.research || facW[f.id]) : []).map(f => ({ kind: 'fac', id: f.id, lat: f.lat, lng: f.lon, text: f.short, alt: Math.min(0.14, 0.004 + 0.0052 * Math.sqrt(facW[f.id] || 0)) + 0.004 }));
    if (sel && sel.kind === 'org' && ORG[sel.id] && orgLL3(ORG[sel.id])) { const p = orgLL3(ORG[sel.id]); lbl.push({ kind: 'org', id: sel.id, lat: p[0], lng: p[1], text: ORG[sel.id].name.slice(0, 40), alt: 0.014, foc: true }); }
    G.labelsData(lbl).labelLat(d => d.lat).labelLng(d => d.lng).labelText(d => d.text).labelSize(d => d.foc ? 0.42 : 0.36).labelDotRadius(d => d.foc ? 0.12 : 0).labelAltitude(d => d.alt)
      .labelColor(d => d.foc ? cssv('--rm-sel') : cssv('--ink')).onLabelClick(d => select(d.kind === 'fac' ? { kind: 'fac', id: d.id } : { kind: 'org', id: d.id }));
  }
  function fly3D(id) { const p = facLL(id); if (p && G) G.pointOfView({ lat: p[0], lng: p[1], altitude: 0.6 }, 1100); }

  function draw() { compute(); if (S.layout === 'ties') renderTies(); else if (S.view === '3d') render3D(); else render2D(); sidePanel(); chipCounts(); }
  function select(s) { S.sel = s; draw(); }
  function tip(ev, html) { const r = stage.getBoundingClientRect(); tipEl.innerHTML = html; tipEl.style.display = 'block'; let x = ev.clientX - r.left + 12, y = ev.clientY - r.top + 12; if (x > r.width - 300) x = ev.clientX - r.left - 300; tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px'; }
  function hideTip() { tipEl.style.display = 'none'; }
  function setLayout(l) {
    S.layout = l; stage.classList.toggle('ties', l === 'ties');
    toolbar.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('on', b.dataset.layout === l));
    const b3 = toolbar.querySelector('[data-view="3d"]'); if (b3) { b3.disabled = l === 'ties'; b3.title = l === 'ties' ? 'The Ties layout is drawn in 2D for now; a 3D ties view is next' : ''; }
    if (l === 'ties') { if (S.view === '3d') { S.view = '2d'; stage.classList.remove('three'); toolbar.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === '2d')); if (G) G.pauseAnimation(); } TL.sig = ''; }
    toolbar.querySelector('.rm-zoomseg').style.display = (l === 'geo' && S.view === '2d') ? '' : 'none';
    draw();
    if (l === 'geo' && S.view === '2d') zoomTo('region', 300);
  }
  function setView(v) {
    S.view = v;
    if (v === '3d' && !init3D()) { S.view = '2d'; v = '2d'; sideNote('The 3D globe needs WebGL, which this browser did not provide. Showing the 2D map.'); }
    stage.classList.toggle('three', v === '3d');
    toolbar.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    toolbar.querySelector('.rm-zoomseg').style.display = v === '2d' ? '' : 'none';
    if (G) { if (v === '3d') { G.resumeAnimation(); resize3D(); } else G.pauseAnimation(); }
    draw();
    if (v === '2d' && S.layout !== 'ties') zoomTo(S.zoom || 'region', 300);
  }
  function sideNote(t) { const n = side.querySelector('.rm-note'); if (n) n.textContent = t; }

  function flagLine(id) { const f = FLAGS[id]; return f ? `<div class="rm-flag">⚑ ${esc(FLAGNAME[f[0]] || f[0])}: ${esc(f[1])}</div>` : ''; }
  function renderItem(id) {
    const it = ITEMS[id]; if (!it) return '';
    const m = s => `<div class="rm-m">${s}</div>`;
    if (it.t === 'P') {
      const num = it.pat || it.pub || it.app; const links = [it.pat || it.pub ? lk(gp(it.pat || it.pub), 'Google Patents') : '', it.app ? lk(pc(it.app), 'Patent Center') : '', it.app ? lk(ac(it.app), 'Assignment Center') : ''].filter(Boolean).join(' · ');
      return `<div class="rm-item"><div class="rm-ti">${esc(it.ti)}</div>${m(`${esc(num)} · filed ${esc(it.f || '?')}${it.i ? ', issued ' + esc(it.i) : ''} · ${links}`)}${(it.ev || []).map(e => m(`Assignment: ${esc(e[2])}, recorded ${esc(e[3])}, reel/frame ${esc(e[0])}; from ${esc(e[4])} to ${esc(e[5])}`)).join('')}${flagLine(id)}</div>`;
    }
    if (it.t === 'V') return `<div class="rm-item"><div class="rm-ti">${esc(it.ti)}</div>${m(`Serial ${esc(it.ser)} · filed ${esc(it.f)} · applicant ${esc(it.ap)} · assignees ${esc(it.a)} · ${lk(ac(it.ser), 'Assignment Center')}`)}</div>`;
    return '';
  }
  function recordsBlock(items, title) {
    const show = items.slice(0, 40);
    const html = show.map(renderItem).join('') + (items.length > show.length ? `<div class="rm-m"><button class="rm-btn sm" data-more="1">Show all ${fmt(items.length)}</button></div>` : '');
    return `<h4>${esc(title)}</h4>${html}`;
  }
  function bindSide() {
    side.querySelectorAll('[data-more]').forEach(b => b.onclick = () => { side.classList.add('all'); const s = S.sel; if (s && s.kind === 'link') { const box = b.closest('.rm-body'); box.querySelector('.rm-records').innerHTML = s.d.items.map(renderItem).join(''); bindSide(); } });
    side.querySelectorAll('[data-fac]').forEach(b => b.onclick = () => { select({ kind: 'fac', id: b.dataset.fac }); if (S.view === '2d') fly2D(b.dataset.fac); else fly3D(b.dataset.fac); });
    side.querySelectorAll('[data-org]').forEach(b => b.onclick = () => select({ kind: 'org', id: b.dataset.org }));
    side.querySelectorAll('[data-link]').forEach(b => b.onclick = () => { const e = VIS[+b.dataset.link]; if (e) select({ kind: 'link', d: e }); });
    side.querySelectorAll('[data-only]').forEach(b => b.onclick = () => { S.site = S.site === b.dataset.only ? '' : b.dataset.only; syncSite(); draw(); });
    side.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => { S.sel = null; draw(); });
  }
  const chip = t => `<span class="rm-chip" style="--c:${tcol(t)}">${esc(TNAME[t] || t)}</span>`;
  const recOf = i => { const it = ITEMS[i] || {}; return it.app || String(it.ser || '').replace(/\D/g, '') || i; }, recCount = list => new Set(list.flatMap(e => e.items.map(recOf))).size;   // site
  function kindTable(list) {
    const c = {}, u = {}; list.forEach(e => e.items.forEach(i => (u[e.type] = u[e.type] || new Set()).add(recOf(i)))); for (const k in u) c[k] = u[k].size;
    const out = [];
    for (const [key, gs, label, style] of CHIPS) {
      const kinds = TYPES.filter(t => gs.includes(t[2]) && c[t[0]]); if (!kinds.length) continue;
      const tot = recCount(list.filter(e => kinds.some(t => t[0] === e.type)));
      out.push(`<tr class="grp"><td><span class="rm-gchip" style="--c:${tcol(kinds[0][0])};padding:0;border:0;background:none"><i class="${style}"></i>${esc(label)}</span></td><td class="n">${fmt(tot)}</td></tr>`);
      if (kinds.length > 1 || kinds[0][1] !== label) kinds.forEach(t => out.push(`<tr class="sub"><td title="${esc(t[3])}">${esc(t[1])}</td><td class="n">${fmt(c[t[0]])}</td></tr>`));
    }
    return out.length ? `<table class="rm-tbl">${out.join('')}</table>` : '<div class="rm-m">None with the current filters.</div>';
  }
  function routeTable(list) { return list.length ? `<table class="rm-tbl">${list.slice(0, 40).map(e => `<tr class="click" data-link="${VIS.indexOf(e)}"><td>${esc(facName(e.src))}</td><td>${esc(nameOf(e.b))}</td><td><span class="rm-dot" style="background:${tcol(e.type)}" title="${esc(TNAME[e.type])}"></span></td><td class="n">${fmt(e.w)}</td></tr>`).join('')}</table>${list.length > 40 ? `<div class="rm-m">First 40 of ${fmt(list.length)} lines.</div>` : ''}` : '<div class="rm-m">None with the current filters.</div>'; }
  function sidePanel() {
    const s = S.sel; let h = '';
    const close = '<button class="rm-btn sm" data-clear="1">Back</button>';
    if (!s) {
      const n = recCount(VIS), multi = (() => { const k = {}; VIS.forEach(e => new Set(e.items.map(recOf)).forEach(x => { k[x] = (k[x] || 0) + 1; })); return Object.values(k).filter(x => x > 1).length; })();   // site
      h = `<div class="rm-head"><h3>VA medical centers at a glance</h3></div><div class="rm-body"><p class="rm-m">${fmt(VIS.length)} lines and ${fmt(n)} records drawn${multi ? `; ${fmt(multi)} ${multi === 1 ? 'record is' : 'records are'} on more than one line` : ''}. Click a center, a partner or a line; every record links to its source.</p>${kindTable(VIS)}<div class="rm-note rm-m"></div><h4>Reading the map</h4><ul class="rm-m"><li>Every line from a center to a partner is a patent record with VA on the title, by how VA came onto it; a record with no partner is counted as a VA-only filing instead. Thickness is the number of records.</li><li>Blue circles are the VA medical centers (size: records drawn). A small loop beside a center is its records with no partner on record.</li><li>A line between two centers marks records drawn from one of them whose inventors public records connect to the other.</li><li>Squares are universities, triangles hospitals, diamonds companies.</li><li>Foreign partners sit on the edge of the 2D map by country.</li><li>The Ties view drops geography: each center sits among its partners, placed by how many records they share, so partners in the same city stop being loops.</li></ul></div>`;
    } else if (s.kind === 'fac') {
      const f = SITE[s.id] || VAS[s.id]; const mine = VIS.filter(e => e.src === s.id && e.type !== 'cross_site'), xs = VIS.filter(e => e.type === 'cross_site' && (e.src === s.id || e.dst === 'f:' + s.id));   // site
      const partners = {}; mine.forEach(e => { const b = e.src === s.id ? e.b : { kind: 'fac', id: e.src, key: 'f:' + e.src }; const k = b.kind === 'fac' ? b.id : b.key; const x = partners[k] = partners[k] || { b, w: 0, n: 0 }; x.w += e.w; x.n++; });
      const top = Object.values(partners).sort((a, b) => b.w - a.w).slice(0, 25);
      h = `<div class="rm-head"><h3>${esc(f.name)}</h3>${close}</div><div class="rm-body"><p class="rm-m">${esc(f.city)}, ${esc(f.state)}</p>
        ${SITE[s.id] ? `<div class="rm-m"><button class="rm-btn sm" data-only="${esc(s.id)}">${S.site === s.id ? 'Show all centers' : 'Only this center'}</button> ${mine.length ? `<a class="rm-btn sm" href="records.html#site=${encodeURIComponent(f.name)}">See its records</a>` : ''}</div>` : ''}
        <h4>Records by kind</h4>${kindTable(mine)}<h4>Partners (${fmt(Object.keys(partners).length)})</h4><table class="rm-tbl">${top.map(x => `<tr class="click" ${x.b.kind === 'org' ? `data-org="${esc(x.b.key)}"` : x.b.kind === 'fac' ? `data-fac="${esc(x.b.id)}"` : ''}><td>${esc(nameOf(x.b))}</td><td class="n">${fmt(x.w)}</td></tr>`).join('')}</table>${xs.length ? `<h4>Other VA medical centers on the same records</h4><table class="rm-tbl">${Object.values(xs.reduce((m, e) => { const o = e.src === s.id ? e.b.id : e.src; (m[o] = m[o] || { id: o, w: 0 }).w += e.w; return m; }, {})).sort((a, b) => b.w - a.w).map(x => `<tr class="click" data-fac="${esc(x.id)}"><td>${esc((SITE[x.id] || VAS[x.id] || {}).name || x.id)}</td><td class="n">${fmt(x.w)}</td></tr>`).join('')}</table>` : ''}</div>`;
    } else if (s.kind === 'org') {
      const o = ORG[s.id]; const mine = VIS.filter(e => e.dst === s.id);
      h = `<div class="rm-head"><h3>${esc(o.name)}</h3>${close}</div><div class="rm-body"><p class="rm-m">${esc([o.city, o.state, o.country !== 'US' ? (CNAME[o.country] || o.country) : ''].filter(Boolean).join(', ') || 'location not known')}${o.approx ? ' (placed by state only)' : ''} · ${esc(o.kind === 'co' ? 'company' : o.kind === 'large' ? 'large company' : o.kind === 'univ' ? 'university' : o.kind === 'hosp' ? 'hospital or health system' : o.kind === 'npc' ? 'VA nonprofit' : o.kind === 'found' ? 'research foundation' : o.kind === 'npo' ? 'nonprofit' : o.kind)}</p><h4>Lines to VA medical centers</h4>${routeTable(mine)}${mine.length === 1 ? recordsBlock(mine[0].items, 'Records') : ''}</div>`;
    } else if (s.kind === 'port') {
      const mine = VIS.filter(e => e.b.kind === 'org' && e.b.org.country === s.cc);
      h = `<div class="rm-head"><h3>${esc(CNAME[s.cc] || s.cc)}</h3>${close}</div><div class="rm-body"><h4>Lines to partners in this country</h4>${routeTable(mine)}</div>`;
    } else if (s.kind === 'link') {
      const d = s.d;
      h = `<div class="rm-head"><h3>${esc(facName(d.src))} → ${esc(nameOf(d.b))}</h3>${close}</div><div class="rm-body"><p class="rm-m">${chip(d.type)} ${fmt(d.w)} ${d.type === 'affil' ? 'people' : 'record' + (d.w === 1 ? '' : 's')}. ${esc(TDESC[d.type] || '')}</p><div class="rm-records">${recordsBlock(d.items, 'Records')}</div></div>`;
    }
    side.innerHTML = h; bindSide();
  }
  function chipCounts() { host.querySelectorAll('[data-group]').forEach(b => { const gs = (b.dataset.groups || b.dataset.group).split(','); const n = gs.reduce((a, g) => a + (GCOUNT[g] || 0), 0); b.querySelector('.n').textContent = fmt(n); const on = gs.some(g => S.groups.has(g)); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.style.display = !n ? 'none' : ''; }); }
  function syncSite() { const sel = toolbar.querySelector('#rm-site'); if (sel) sel.value = S.site; }

  let globeP = null;
  const globe = then => { if (typeof Globe === 'function') return then(); globeP = globeP || new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'assets/globe.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
    globeP.then(then, () => sideNote('The 3D globe could not be loaded. Showing the 2D map.')); };
  function build() {
    host.classList.add('rm');
    toolbar = el('div', { class: 'rm-toolbar' });
    const seg = el('div', { class: 'rm-seg rm-viewseg', title: 'How it is drawn' }, el('button', { 'data-view': '2d', class: 'on', onclick: () => setView('2d') }, '2D'), el('button', { 'data-view': '3d', onclick: () => globe(() => setView('3d')) }, '3D'));
    const layseg = el('div', { class: 'rm-seg rm-layseg', title: 'Where things sit: on the map, or by connection' }, el('button', { 'data-layout': 'geo', class: 'on', onclick: () => setLayout('geo') }, 'Geographic'), el('button', { 'data-layout': 'ties', onclick: () => setLayout('ties'), title: 'The same records laid out by connection instead of place: each center among its partners' }, 'Ties'));
    const zoomseg = el('div', { class: 'rm-seg rm-zoomseg' }, el('button', { onclick: () => zoomTo('region') }, 'Medical centers'), el('button', { onclick: () => zoomTo('us') }, 'United States'), el('button', { onclick: () => zoomTo('world') }, 'World edges'));
    const chips = el('div', { class: 'rm-chips' }, CHIPS.map(([key, gs, label, style]) => el('button', { class: 'rm-gchip' + (gs.some(g => S.groups.has(g)) ? ' on' : ''), 'data-group': key, 'data-groups': gs.join(','), 'aria-pressed': gs.some(g => S.groups.has(g)) ? 'true' : 'false', style: { '--c': cssv('--g-' + GKEY(gs[0])) }, title: TYPES.filter(t => gs.includes(t[2])).map(t => t[1]).join(' · '),
      onclick: () => { const on = gs.some(g => S.groups.has(g)); gs.forEach(g => on ? S.groups.delete(g) : S.groups.add(g)); draw(); } }, el('i', { class: style }), label, ' ', el('span', { class: 'n' }, '0'))));
    const siteSel = el('select', { id: 'rm-site', 'aria-label': 'Medical center', onchange: e => { S.site = e.target.value; S.sel = S.site ? { kind: 'fac', id: S.site } : null; draw(); if (S.site && S.layout !== 'ties') { if (S.view === '2d') fly2D(S.site); else fly3D(S.site); } } },
      el('option', { value: '' }, 'All centers'));
    const lblBox = el('label', { class: 'rm-check' }, el('input', { type: 'checkbox', checked: true, onchange: e => { S.labels = e.target.checked; draw(); } }), 'Labels');
    const full = el('button', { class: 'rm-btn', id: 'rm-full', onclick: toggleFull }, 'Full screen');
    const tall = el('button', { class: 'rm-btn', onclick: () => { host.classList.toggle('tall'); resize3D(); } }, 'Taller');
    const opts = el('details', { class: 'rm-opts' }, el('summary', null, 'Map options'), el('div', null, zoomseg, lblBox, tall));
    document.addEventListener('click', e => { if (opts.open && !opts.contains(e.target)) opts.open = false; });
    toolbar.append(siteSel, layseg, seg, opts, el('span', { class: 'rm-sp' }), full);
    stage = el('div', { class: 'rm-stage' });
    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svgEl.setAttribute('class', 'rm-svg'); svgEl.setAttribute('role', 'img'); svgEl.setAttribute('aria-label', 'Map of the VA medical centers and their partners');
    globeEl = el('div', { class: 'rm-globe' });
    tipEl = el('div', { class: 'rm-tip' });
    stage.append(svgEl, globeEl, tipEl);
    side = el('aside', { class: 'rm-side', 'aria-label': 'Map details' });
    host.append(toolbar, chips, el('div', { class: 'rm-main' }, stage, side),
      el('p', { class: 'hint rm-m' }, 'The same VA medical centers, partners and records as the full map on the Map tab (USPTO assignment records), on a lighter map. Every record links to its source.'));
    document.addEventListener('fullscreenchange', () => { host.classList.toggle('full', document.fullscreenElement === host); full.textContent = document.fullscreenElement === host ? 'Exit full screen' : 'Full screen'; setTimeout(resize3D, 60); });
    new ResizeObserver(() => resize3D()).observe(stage);
    const mo = new MutationObserver(() => { theme3D(); draw(); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { theme3D(); draw(); });
    document.addEventListener('fx-change', () => { if (D) draw(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.sel) { S.sel = null; draw(); } });
    window.addEventListener('hashchange', () => { if (!G) return; const on = document.getElementById('view-overview').classList.contains('on'); if (on && S.view === '3d') G.resumeAnimation(); else G.pauseAnimation(); });
  }
  function toggleFull() { if (document.fullscreenElement === host) document.exitFullscreen(); else if (host.requestFullscreen) host.requestFullscreen().catch(() => host.classList.toggle('tall')); else host.classList.toggle('tall'); }

  async function start() {
    build();
    try { await load(); } catch (e) { host.append(el('p', { class: 'err' }, 'The map data could not be opened: ' + e.message)); return; }
    const ss = host.querySelector('#rm-site'); ss.firstChild.textContent = `All ${Object.keys(SITE).length} centers`; Object.values(SITE).sort((a, b) => a.short.localeCompare(b.short)).forEach(x => ss.append(el('option', { value: x.id }, x.short)));
    const fb = host.querySelector('#rm-flagbox span'); if (fb) fb.textContent = `Show flagged records`;
    init2D();
    draw();
    zoomTo('region', 0);
    window.REGIONMAP = { S, get VIS() { return VIS; }, get VAS() { return VAS; }, draw, setView, setLayout, zoomTo, select, ITEMS, ORG, get SITE() { return SITE; }, FLAGS, compute, setScope, TGROUP, GKEY, TNAME, TDESC };
    pairsTable();
    const showBtn = document.getElementById('rm-show');
    if (showBtn) showBtn.onclick = () => { const open = host.classList.toggle('rm-collapsed'); showBtn.textContent = open ? 'Show the overview map' : 'Hide the overview map'; showBtn.setAttribute('aria-expanded', open ? 'false' : 'true'); if (!open) { draw(); if (S.layout !== 'ties' && S.view === '2d') zoomTo('region', 0); resize3D(); } };
    document.addEventListener('fx-change', () => { if (D) pairsTable(); });
  }
  function pairsTable() {
    const box = document.getElementById('rm-pairs'); if (!box || !D) return;
    const keep = { site: S.site, groups: new Set(S.groups) }; S.site = ''; compute();
    const agg = new Map();
    const sc38 = window.SCOPE && window.SCOPE.current, in38 = sc38 && sc38.kind !== 'all' && sc38.sites ? new Set(sc38.sites) : null;   // @front_1138 the table follows the scope
    for (const e of VIS) { if (e.b.kind !== 'org' || (in38 && !in38.has(e.src))) continue; const k = e.src + '|' + e.b.key; let o = agg.get(k); if (!o) { o = { src: e.src, org: e.b.org, id: e.b.key, w: 0, kinds: {} }; agg.set(k, o); } o.w += e.w; const g = e.type; o.kinds[g] = (o.kinds[g] || 0) + e.w; }
    S.site = keep.site; compute();
    const GN = {"joint":"assigned by the inventors","affil_to_va":"transferred by the partner","late_add":"VA added after issue","later_va":"VA recorded later","va_owned":"VA only","cross_site":"tied to two VA sites"};
    const rows = [...agg.values()].sort((a, b) => b.w - a.w).slice(0, 12);
    if (!rows.length) { box.replaceChildren(el('p', { class: 'small muted' }, 'No center-to-partner lines under the current scope and filters.')); return; }
    const t = el('table', { class: 'sortable' }, el('thead', null, el('tr', null, el('th', null, 'Medical center'), el('th', null, 'Partner'), el('th', null, 'Kinds of record'), el('th', { class: 'num' }, 'Records'))),
      el('tbody', null, rows.map(r => el('tr', { class: 'click', title: 'Show on the overview map', onclick: () => { host.classList.remove('rm-collapsed'); const b = document.getElementById('rm-show'); if (b) { b.textContent = 'Hide the overview map'; b.setAttribute('aria-expanded', 'true'); } S.site = r.src; const ss = host.querySelector('#rm-site'); if (ss) ss.value = r.src; select({ kind: 'org', id: r.id }); if (S.layout !== 'ties' && S.view === '2d') fly2D(r.src); host.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
        el('td', null, el('button', { type: 'button', class: 'rm-rowbtn', title: 'Show on the overview map' }, (SITE[r.src] || VAS[r.src] || {}).short || r.src)), el('td', null, r.org.name), el('td', { class: 'k' }, Object.entries(r.kinds).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${fmt(n)} ${GN[g] || g}`).join(' · ')), el('td', { class: 'num' }, fmt(r.w))))));
    box.replaceChildren(t, el('p', { class: 'small muted', style: 'margin:6px 0 0' }, 'Summed across kinds of record under the map\'s current filters; a row opens the overview map on that pair, with the records in its side panel.'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
(function () {
  'use strict';
  const SH = JSON.parse(document.getElementById('site-hero').textContent);
  const $ = (s, r) => (r || document).querySelector(s);
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const moneyM = n => { n = Number(n || 0); return n >= 1e5 ? '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M' : '$' + Math.round(n).toLocaleString('en-US'); };
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v); else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v); else e.setAttribute(k, v === true ? '' : v); }
    for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }
  const TGROUP = new Proxy({}, { get: (_, k) => (window.REGIONMAP && window.REGIONMAP.TGROUP || {})[k] }), GKEY = g => (window.REGIONMAP && window.REGIONMAP.GKEY) ? window.REGIONMAP.GKEY(g) : g;
  const HERO = { nodes: [], links: [], yaw: -0.6, pitch: 0.3, dist: 2.9, raf: 0, sig: '' };
  const heroHash = str => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); };
  function heroGraph() {   // the overview map's own lines (VIS), capped for the layout
    const RM = window.REGIONMAP; if (!RM || !RM.VIS) return null;
    const keep = RM.S.site; RM.S.site = ''; RM.compute(); const VIS = RM.VIS; RM.S.site = keep; RM.compute();
    const SITE = RM.SITE || {}, ORG = RM.ORG || {}; const nodes = {}, links = [];
    for (const e of VIS) { if (!SITE[e.src]) continue; const a = 'f:' + e.src; nodes[a] = nodes[a] || { id: a, hub: !!SITE[e.src], vas: !SITE[e.src], name: (SITE[e.src] || {}).short || '', lat: (SITE[e.src] || {}).lat, lon: (SITE[e.src] || {}).lon, w: 0 }; nodes[a].w += e.w; if (e.b.kind === 'badge') continue;
      const bk = e.b.key; nodes[bk] = nodes[bk] || { id: bk, hub: e.b.kind === 'fac' && !!SITE[e.b.id], vas: e.b.kind === 'fac' && !SITE[e.b.id], okind: e.b.kind === 'org' ? (e.b.org || {}).kind : '', name: e.b.kind === 'fac' ? ((SITE[e.b.id] || {}).short || '') : (e.b.org || {}).name, lat: e.b.kind === 'fac' ? (SITE[e.b.id] || {}).lat : undefined, lon: e.b.kind === 'fac' ? (SITE[e.b.id] || {}).lon : undefined, w: 0 }; nodes[bk].w += e.w;
      links.push({ a, b: bk, g: GKEY(TGROUP[e.type] || 'ctx'), w: e.w, t: e.type }); }
    for (const sid of Object.keys(SITE)) { const a = 'f:' + sid; if (!nodes[a]) nodes[a] = { id: a, hub: true, vas: false, name: SITE[sid].short || '', lat: SITE[sid].lat, lon: SITE[sid].lon, w: 0 }; }
    let N = Object.values(nodes); const CAP = Math.min(420, N.filter(n => n.hub).length + 260); if (N.length > CAP) { const keepN = new Set(N.filter(n => n.hub).map(n => n.id)); N.filter(n => !n.hub).sort((x, y) => y.w - x.w).slice(0, Math.max(0, CAP - keepN.size)).forEach(n => keepN.add(n.id)); N = N.filter(n => keepN.has(n.id)); }
    const ids = new Set(N.map(n => n.id)); return { nodes: N, links: links.filter(l => ids.has(l.a) && ids.has(l.b)) };
  }
  function heroLayout(G) {   // a free three-dimensional layout: centers as hubs, partners pulled in by shared records
    const N = G.nodes, L = G.links, idx = new Map(N.map((n, i) => [n.id, i])); const n = N.length;
    const X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n), VX = new Float64Array(n), VY = new Float64Array(n), VZ = new Float64Array(n);
    N.forEach((d, i) => { const h = heroHash(d.id); X[i] = ((h % 1000) / 500 - 1) * .9; Y[i] = (((h >> 10) % 1000) / 500 - 1) * .9; Z[i] = (((h >> 20) % 1000) / 500 - 1) * .9; });
    const LA = L.map(l => idx.get(l.a)), LB = L.map(l => idx.get(l.b)), LD = L.map(l => .3 + .6 / (1 + Math.log2(1 + l.w))), LS = L.map(l => Math.min(1, .2 + .1 * Math.log2(1 + l.w))), rep = N.map(d => d.hub ? .012 : .0022);
    for (let it = 0; it < 220; it++) { const a = 1 - it / 220, cool = .08 + .5 * a; for (let i = 0; i < n; i++) { VX[i] *= .4; VY[i] *= .4; VZ[i] *= .4; }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let dx = X[j] - X[i], dy = Y[j] - Y[i], dz = Z[j] - Z[i]; let d2 = dx * dx + dy * dy + dz * dz; if (d2 < 1e-4) { dx = 1e-3; dy = 1e-3; dz = -1e-3; d2 = 3e-6; } if (d2 > 1.2) continue; const f = (rep[i] + rep[j]) / (d2 + .002), dd = Math.sqrt(d2); dx /= dd; dy /= dd; dz /= dd; VX[i] -= dx * f; VY[i] -= dy * f; VZ[i] -= dz * f; VX[j] += dx * f; VY[j] += dy * f; VZ[j] += dz * f; }
      for (let k = 0; k < LA.length; k++) { const i = LA[k], j = LB[k]; const dx = X[j] - X[i], dy = Y[j] - Y[i], dz = Z[j] - Z[i]; const dd = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6; const f = (dd - LD[k]) * LS[k] * .5 / dd, wi = N[i].hub ? .25 : 1, wj = N[j].hub ? .25 : 1; VX[i] += dx * f * wi; VY[i] += dy * f * wi; VZ[i] += dz * f * wi; VX[j] -= dx * f * wj; VY[j] -= dy * f * wj; VZ[j] -= dz * f * wj; }
      for (let i = 0; i < n; i++) { VX[i] -= X[i] * .02; VY[i] -= Y[i] * .02; VZ[i] -= Z[i] * .02; const v = Math.hypot(VX[i], VY[i], VZ[i]), m = v > cool ? cool / v : 1; X[i] += VX[i] * m; Y[i] += VY[i] * m; Z[i] += VZ[i] * m; } }
    { let mx = 0, my = 0, mz = 0; for (let i = 0; i < n; i++) { mx += X[i]; my += Y[i]; mz += Z[i]; } mx /= n || 1; my /= n || 1; mz /= n || 1; for (let i = 0; i < n; i++) { X[i] -= mx; Y[i] -= my; Z[i] -= mz; } }   // @view_1137 turn around its own middle
    const rs = N.map((d, i) => Math.hypot(X[i], Y[i], Z[i])), r90 = rs.slice().sort((a, b) => a - b)[Math.round(.9 * (n - 1))] || 1, kk = .8 / r90;
    N.forEach((d, i) => { let m = kk; const r = rs[i] * kk; if (r > 1) m = kk * (1 + Math.log(r)) / r; d.x = X[i] * m; d.y = Y[i] * m; d.z = Z[i] * m; });
    { const ex = N.map(() => 0), cp = Math.cos(HERO.pitch), sp = Math.sin(HERO.pitch);   // its drawn extent over a full turn, so it is sized once and stays inside the box
      for (let k = 0; k < 24; k++) { const yw = k * Math.PI / 12, c1 = Math.cos(yw), s1 = Math.sin(yw); N.forEach((d, i) => { const x1 = d.x * c1 - d.z * s1, z1 = d.x * s1 + d.z * c1, y2 = d.y * cp - z1 * sp, z2 = d.y * sp + z1 * cp; ex[i] = Math.max(ex[i], Math.hypot(x1, y2) * HERO.dist / (HERO.dist - z2)); }); }
      ex.sort((a, b) => a - b); HERO.ext = ex[Math.round(.97 * (ex.length - 1))] || 1; }
    HERO.nodes = N; HERO.links = L; HERO.LA = LA; HERO.LB = LB;
  }
  function heroGlow(e, W, Hh, x, y, R) {   // the glow behind the graph follows its centre and size
    const k = W + 'x' + Hh; if (!e || HERO.gk === k) return; HERO.gk = k;
    e.style.setProperty('--hx', Math.round(x) + 'px'); e.style.setProperty('--hy', Math.round(y) + 'px'); e.style.setProperty('--hgr', Math.round(R * 1.9) + 'px'); }
  function heroDraw() {
    const cv = $('#ov-hero-c'); if (!cv || !HERO.nodes.length) return; const dpr = devicePixelRatio || 1, W = cv.clientWidth, Hh = cv.clientHeight; if (!W || !Hh) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, Hh);
    const cy = Math.cos(HERO.yaw), sy = Math.sin(HERO.yaw), cp = Math.cos(HERO.pitch), sp = Math.sin(HERO.pitch), hx0 = W * .72, hy0 = Hh * .45, hR = Math.max(80, Math.min(W - hx0, hy0, Hh - hy0) - 20), sc = hR / (HERO.ext || 1); HERO.cx = hx0; HERO.cy = hy0; HERO.cr = hR; heroGlow(cv.parentElement, W, Hh, hx0, hy0, hR); const nH = HERO.nodes.filter(d => d.hub).length, kR = Math.min(1, Math.sqrt(36 / Math.max(1, nH))), kL = Math.max(.3, Math.min(1, 500 / Math.max(1, HERO.links.length)));
    const P = HERO.nodes.map(d => { const x1 = d.x * cy - d.z * sy, z1 = d.x * sy + d.z * cy; const y2 = d.y * cp - z1 * sp, z2 = d.y * sp + z1 * cp; const per = HERO.dist / (HERO.dist - z2); return { x: hx0 + x1 * sc * per, y: hy0 - y2 * sc * per, z: z2, per }; });
    const GC = { patent: '#4cc9f0', lead: '#ff7a3d', tie: '#c77dff', ctx: '#7c8aa5', crada: '#3ddc97' };
    for (let k = 0; k < HERO.links.length; k++) { const a = P[HERO.LA[k]], b = P[HERO.LB[k]]; const z = (a.z + b.z) / 2; c.strokeStyle = GC[HERO.links[k].g] || GC.ctx; c.globalAlpha = .5 * kL * (.35 + .65 * (z + 1) / 2); c.lineWidth = Math.max(.5, Math.min(4, .6 + Math.log2(1 + HERO.links[k].w) * .9)) * (a.per + b.per) / 2 * .6 * (.5 + .5 * kR); c.shadowBlur = 6; c.shadowColor = c.strokeStyle; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    HERO.P = P; if (HERO.hot != null && HERO.links[HERO.hot]) { const k = HERO.hot, a = P[HERO.LA[k]], b = P[HERO.LB[k]]; c.globalAlpha = 1; c.strokeStyle = '#ffffff'; c.lineWidth = 2.6; c.shadowBlur = 12; c.shadowColor = GC[HERO.links[k].g] || GC.ctx; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }   // @herotip_1143
    c.shadowBlur = 0; const ord = HERO.nodes.map((d, i) => i).sort((i, j) => P[i].z - P[j].z);
    for (const i of ord) { const d = HERO.nodes[i], p = P[i]; const r = (d.hub ? Math.max(4, Math.min(26, 3 + 2.2 * Math.sqrt(d.w)) * kR) : Math.max(2, Math.min(11, 1.5 + 1.2 * Math.sqrt(d.w)) * (.6 + .4 * kR))) * p.per * .8; (HERO.R || (HERO.R = []))[i] = r; c.globalAlpha = .5 + .5 * (p.z + 1) / 2; c.fillStyle = d.hub ? '#e9eef6' : d.vas ? GC.ctx : ((d.okind === 'univ' || d.okind === 'hosp') ? GC.patent : (d.okind === 'co' || d.okind === 'large') ? GC.tie : d.okind === 'npc' ? GC.crada : GC.ctx); if (d.hub) { c.shadowBlur = 18 * kR; c.shadowColor = '#4cc9f0'; } c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0; }
    c.globalAlpha = 1;
    if (HERO.hotN != null && P[HERO.hotN]) { const p = P[HERO.hotN]; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, ((HERO.R || [])[HERO.hotN] || 3) + 3, 0, Math.PI * 2); c.stroke(); }   // @herotip_1143
  }
  function heroSpin() { cancelAnimationFrame(HERO.raf); const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!HERO.io && window.IntersectionObserver) { HERO.io = new IntersectionObserver(es => { const v = es[es.length - 1].isIntersecting; HERO.off = !v; if (v && !HERO.raf) heroSpin(); }); HERO.io.observe(document.getElementById('ov-hero')); }   // site
    const step = () => { if (HERO.off) { HERO.raf = 0; return; } const on = document.getElementById('view-overview').classList.contains('on'); if (on && !document.hidden) { if (!HERO.hold) HERO.yaw += .0022; heroDraw(); } HERO.raf = requestAnimationFrame(step); };
    if (still) heroDraw(); else HERO.raf = requestAnimationFrame(step); }
  function heroCount(el, target, text) { const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; if (still || !(target > 0)) { el.textContent = text; return; }
    const m = /^([^0-9]*)([0-9.,]+)(.*)$/.exec(text); if (!m) { el.textContent = text; return; } const dec = m[2].includes('.') ? 1 : 0, t0 = performance.now();
    (function step(t) { const k = Math.min(1, (t - t0) / 1100), q = 1 - Math.pow(1 - k, 3); const v = target * q; el.textContent = m[1] + (dec ? v.toFixed(1) : Math.round(v).toLocaleString('en-US')) + m[3]; if (k < 1) requestAnimationFrame(step); else el.textContent = text; })(t0); }
  function renderHero(d, SH) {
    const hero = $('#ov-hero'); if (!hero) return; hero.hidden = false; document.getElementById('view-overview').classList.add('has-hero');
    $('#ov-hero-eyebrow').textContent = SH.eyebrow;
    const kh = $('#ov-hero-k'); kh.replaceChildren();
    { const hh = $('#ov-hero-h'); if (hh) hh.replaceChildren(el('em', null, SH.em), SH.rest);
      const cue = $('#ov-hero-cue'); if (cue) cue.textContent = SH.cue; }
    const items = SH.k.map(k => [k[0], fmt(k[0]), k[1], k[2] || '']);
    for (const [n, txt, l, sb] of items) { const v = el('div', { class: 'v' }, txt); kh.append(el('div', { class: 'k' }, v, el('div', { class: 'l' }, l, sb ? el('span', { class: 'sub' }, ' · ' + sb) : ''))); heroCount(v, typeof n === 'number' ? (txt.startsWith('$') ? parseFloat(txt.replace(/[^0-9.]/g, '')) : n) : 0, txt); }
    const rows = SH.firsts;
    const fh = $('#ov-hero-first'); fh.replaceChildren();
    for (const r of rows) fh.append(el('a', { class: 'fc', href: r.href }, el('b', null, r.site), el('span', null, r.line), el('i', null, r.with)));
    const tryGraph = (n) => { const G = heroGraph(); if (!G || !G.nodes.length) { if (n < 60) setTimeout(() => tryGraph(n + 1), 500); return; } const sig = d.kind + ':' + (d.id || '') + ':' + G.nodes.length; if (sig !== HERO.sig) { HERO.sig = sig; heroLayout(G); } heroSpin(); };
    tryGraph(0);
  }
  window.addEventListener('resize', () => heroDraw());
  { const box = $('#ov-hero'), cv = $('#ov-hero-c'); if (box && cv) {
    const tip = document.createElement('div'); tip.id = 'ov-hero-tip'; tip.setAttribute('role', 'status'); tip.hidden = true; box.append(tip);
    const RM = () => window.REGIONMAP || {}, KIND = { univ: 'University', hosp: 'Hospital or institute', co: 'Company', large: 'Company', npc: 'VA nonprofit or research foundation', fed: 'Federal agency' },
      GN = { patent: 'Patent record with VA on title' };
    const seg = (px, py, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1e-6; let t = ((px - a.x) * dx + (py - a.y) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)); };
    const pick = (px, py, slack) => { const P = HERO.P; if (!P) return null; let bn = -1, bd = 1e9;   // a dot first, then the nearest line; the one nearer the viewer wins a tie
      for (let i = 0; i < P.length; i++) { const r = ((HERO.R || [])[i] || 3) + 2 + slack / 2, d = Math.hypot(px - P[i].x, py - P[i].y); if (d <= r && d - P[i].z * 2 < bd) { bd = d - P[i].z * 2; bn = i; } }
      if (bn >= 0) return { node: bn };
      let bl = -1; bd = 1e9; for (let k = 0; k < HERO.links.length; k++) { const a = P[HERO.LA[k]], b = P[HERO.LB[k]], d = seg(px, py, a, b); if (d <= 5 + slack) { const sc = d - (a.z + b.z) * 1.5; if (sc < bd) { bd = sc; bl = k; } } }
      return bl >= 0 ? { link: bl } : null; };
    const line = (cls, t) => { const d = document.createElement(cls === 'b' ? 'b' : 'div'); if (cls && cls !== 'b') d.className = cls; d.textContent = t; return d; };
    const show = (h, px, py) => { const N = HERO.nodes, kids = [];
      if (h.link != null) { const l = HERO.links[h.link], a = N[HERO.LA[h.link]], b = N[HERO.LB[h.link]], tn = (RM().TNAME || {})[l.t] || GN[l.g] || 'Link', td = (RM().TDESC || {})[l.t] || '';
        kids.push(line('b', tn), line('', `${a.name || 'VA medical center'} ↔ ${b.name || 'partner'}`), line('m', `${fmt(l.w)} ${l.t === 'affil' ? (l.w === 1 ? 'person' : 'people') : (l.w === 1 ? 'record' : 'records')} on this line`)); if (td) kids.push(line('m', td)); }
      else { const d = N[h.node]; kids.push(line('b', d.name || 'Unnamed'), line('m', d.hub ? 'VA medical center' : d.vas ? 'VA medical center outside this scope' : (KIND[d.okind] || 'Partner organization'))); }
      tip.replaceChildren(...kids); tip.hidden = false; const bw = box.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(bw - tw - 8, px + 14)) + 'px'; tip.style.top = (py - th - 12 < 8 ? py + 18 : py - th - 12) + 'px'; };
    const clear = hold => { const ch = HERO.hot != null || HERO.hotN != null; HERO.hot = null; HERO.hotN = null; HERO.hold = !!hold; tip.hidden = true; if (ch) heroDraw(); };
    const move = (e, slack) => { if (e.target && e.target.closest && e.target.closest('a, button')) { clear(false); return; }
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, small = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
      if (small ? py < r.height * .45 : px < r.width * .42) { clear(false); return; }   // the faded part of the picture does not answer
      const inDisk = HERO.cr ? Math.hypot(px - HERO.cx, py - HERO.cy) <= HERO.cr + 24 : false, h = pick(px, py, slack);
      if (!h) { clear(inDisk); return; } HERO.hold = true; const hot = h.link != null ? h.link : null, hn = h.node != null ? h.node : null;
      if (hot !== HERO.hot || hn !== HERO.hotN) { HERO.hot = hot; HERO.hotN = hn; heroDraw(); } show(h, px, py); };
    box.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') move(e, 0); }); box.addEventListener('pointerleave', () => clear(false));
    box.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') move(e, 9); });
  } }

  renderHero(SH.d, SH);
})();
