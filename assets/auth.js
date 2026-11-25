/* FedRIM accounts (written to assets/auth.js by add_site_1156.py; the owner, Nov 24: "account creation ... you can create an account and
   that'll let you download", with check boxes for the emails a reader wants). Sign in with an emailed link or the code in the same
   email: no passwords. Reading the site needs no account; downloads need one. Talks to Supabase Auth and its REST API with fetch,
   so no third-party script runs on the site. With no Supabase project set (window.FEDRIM_AUTH.mode 'stub', the preview), a
   stand-in keeps everything in this browser: no email is sent and no account is created anywhere. */
(function () {
  'use strict';
  const C = window.FEDRIM_AUTH || { mode: 'stub' };
  const STUB = C.mode !== 'supabase';
  const KEY = 'fedrim-session', NEXT = 'fedrim-next', WANT = 'fedrim-want', PENDING = 'fedrim-stub-pending', STUBDB = 'fedrim-stub-accounts';
  const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
  // the emails a reader can ask for: (column in public.profiles, label, when); all off unless the reader turns one on
  const PREFS = [
    ['notify_patents', 'New patent records', 'when newly published USPTO patents or applications that list VA as an owner are added'],
    ['notify_updates', 'Other updates', 'when records or links are corrected, or new kinds of records are added'],
    ['notify_articles', 'Articles and reports', 'when the site publishes an article or report (none yet)']
  ];
  const STORAGE_MSG = 'This browser is blocking site storage, so it cannot keep you signed in. Allow site data for this site and try again.';
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const now = () => Math.floor(Date.now() / 1000);
  const domainOf = e => (String(e).split('@')[1] || '').toLowerCase();
  const accountLink = () => document.querySelector('a[data-acct]');   // the account link in the site's top navigation
  const accountHref = () => { const a = accountLink(); return a ? a.href : 'account.html'; };
  const onlyPrefs = p => Object.fromEntries(PREFS.map(([k]) => [k, !!(p && p[k])]));

  // ---------------------------------------------------------------- Supabase
  async function api(path, opts, token) {
    opts = opts || {};
    const headers = Object.assign({ apikey: C.key, 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, opts.headers || {});
    let r;
    try { r = await fetch(C.url.replace(/\/+$/, '') + path, Object.assign({}, opts, { headers })); }
    catch (e) { const err = new Error('The account service could not be reached. Check your connection and try again.'); err.network = true; throw err; }
    const text = await r.text();
    let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) {}
    if (!r.ok) {
      const err = new Error((j && (j.msg || j.message || j.error_description || j.error)) || 'The account service answered ' + r.status + '.');
      err.status = r.status; err.code = j && (j.error_code || j.code); throw err;
    }
    return j;
  }

  function current() { return ls.get(KEY); }
  function store(s) { ls.set(KEY, s); paintNav(); }

  // the stored session, refreshed if it has run out; null when signed out
  async function session() {
    const s = current();
    if (!s) return null;
    if (STUB) return s.stub ? s : null;
    if (s.stub || !s.refresh_token) { store(null); return null; }   // a stand-in session left over from a preview build
    if (s.expires_at && s.expires_at - 60 > now()) return s;
    try {
      const j = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }) });
      const n = fromResponse(j, s);
      store(n);
      return n;
    } catch (e) {
      if (!e.network) store(null);   // a refused refresh ends the session; a dropped connection does not
      return null;
    }
  }
  const fromResponse = (j, old) => ({ access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: j.expires_at || now() + (j.expires_in || 3600),
    email: (j.user && j.user.email) || (old && old.email), id: (j.user && j.user.id) || (old && old.id) });

  // The ticked boxes stay in this browser until the reader signs in here; only then are they saved to the account. Sending them
  // with the sign-up request would let anyone set choices for someone else's address before that person signs up.
  async function sendLink(email, prefs, captcha) {
    email = String(email || '').trim();
    if (!EMAIL_RE.test(email)) throw new Error('Enter a full email address, like name@example.org.');
    if (STUB) { ls.set(PENDING, { email, prefs: onlyPrefs(prefs) }); return { stub: true, email }; }
    ls.set(WANT, { email: email.toLowerCase(), prefs: onlyPrefs(prefs) });
    const back = accountHref().split('#')[0].split('?')[0];
    const body = { email, create_user: true };
    if (captcha) body.gotrue_meta_security = { captcha_token: captcha };
    await api('/auth/v1/otp?redirect_to=' + encodeURIComponent(back), { method: 'POST', body: JSON.stringify(body) });
    return { email };
  }

  // after signing in here: store the session, then turn on any choices ticked in this browser for this address (opt-ins only)
  async function signedIn(s) {
    store(s);
    if (!current()) return { error: STORAGE_MSG };
    const w = ls.get(WANT);
    if (w && s.email && w.email === String(s.email).toLowerCase()) {
      for (const [k] of PREFS) if (w.prefs[k]) { try { await setPref(k, true); } catch (e) {} }
    }
    ls.set(WANT, null);
    return { ok: true };
  }

  // the sign-in link brings the reader back here with the session (or an error) in the address's #fragment
  async function finishFromLink() {
    if (STUB) return null;
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (!h.has('access_token') && !h.has('error') && !h.has('error_description')) return null;
    history.replaceState(null, '', location.pathname + location.search);   // the tokens do not stay in the address bar
    if (!h.has('access_token')) {   // a fixed sentence: text from the address is never shown on the page
      return { error: (h.get('error_code') || '') === 'otp_expired'
        ? 'That sign-in link has run out or was already used. Type the code from the same email, or send a new link.'
        : 'That sign-in link did not work. Send a new one.' };
    }
    const s = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'),
                expires_at: +h.get('expires_at') || now() + (+h.get('expires_in') || 3600) };
    try { const u = await api('/auth/v1/user', {}, s.access_token); s.email = u.email; s.id = u.id; }
    catch (e) { return { error: 'That sign-in link could not be checked. Send a new one and try again.' }; }
    return signedIn(s);
  }

  // the code in the same email: works where a mail system has already opened (and so used up) the link
  async function verifyCode(email, code) {
    code = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6,10}$/.test(code)) throw new Error('Type the code from the email: six or more digits.');
    let j;
    try { j = await api('/auth/v1/verify', { method: 'POST', body: JSON.stringify({ type: 'email', email, token: code }) }); }
    catch (e) { if (e.network) throw e; throw new Error('That code did not work. It may have run out; send a new link to get a new code.'); }
    const r = await signedIn(fromResponse(j));
    if (r.error) throw new Error(r.error);
    return r;
  }

  function stubFinish() {
    const p = ls.get(PENDING);
    if (!p) return false;
    const db = ls.get(STUBDB) || {};
    if (!db[p.email]) db[p.email] = Object.assign({ email_domain: domainOf(p.email), created_at: new Date().toISOString() }, p.prefs);
    ls.set(STUBDB, db);
    ls.set(PENDING, null);
    store({ stub: true, email: p.email, id: 'stub:' + p.email, expires_at: now() + 30 * 86400 });
    return !!current();
  }

  async function profile() {
    const s = await session();
    if (!s) return null;
    if (STUB) return onlyPrefs((ls.get(STUBDB) || {})[s.email]);
    const rows = await api('/rest/v1/profiles?select=' + PREFS.map(p => p[0]).join(',') + '&id=eq.' + encodeURIComponent(s.id), {}, s.access_token);
    return onlyPrefs(rows && rows[0]);
  }

  async function setPref(key, on) {
    if (!PREFS.some(p => p[0] === key)) return;
    const s = await session();
    if (!s) throw new Error('You are signed out. Sign in again to change this.');
    if (STUB) { const db = ls.get(STUBDB) || {}; if (db[s.email]) db[s.email][key] = !!on; ls.set(STUBDB, db); return; }
    await api('/rest/v1/profiles?id=eq.' + encodeURIComponent(s.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' },
              body: JSON.stringify({ [key]: !!on }) }, s.access_token);
  }

  async function signOut() {
    const s = STUB ? current() : await session();   // a fresh token, so the server ends the session too
    if (s && !STUB && s.access_token) { try { await api('/auth/v1/logout', { method: 'POST' }, s.access_token); } catch (e) {} }
    store(null);
  }

  async function deleteAccount() {
    const s = await session();
    if (!s) throw new Error('You are signed out. Sign in again to delete your account.');
    if (STUB) { const db = ls.get(STUBDB) || {}; delete db[s.email]; ls.set(STUBDB, db); }
    else await api('/rest/v1/rpc/delete_my_account', { method: 'POST', body: '{}' }, s.access_token);
    store(null);
  }

  // ---------------------------------------------------------------- downloads need an account
  async function requireSignIn() {
    if (await session()) return true;
    let d = document.getElementById('acct-ask');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'acct-ask';
      d.className = 'acct-dialog';
      d.setAttribute('aria-labelledby', 'acct-ask-h');
      d.innerHTML = '<h2 id="acct-ask-h">Create a free account to download</h2>' +
        '<p>Downloads need an account: an email address and a sign-in link, with no password. Reading the site needs no account.</p>' +
        '<div class="acct-actions"><a class="btn" id="acct-ask-go">Create an account or sign in</a>' +
        '<button class="btn ghost" type="button" id="acct-ask-no">Not now</button></div>';
      document.body.appendChild(d);
      d.querySelector('#acct-ask-no').onclick = () => d.close();
      d.addEventListener('click', e => {   // a click on the backdrop closes it; a click inside the box does not
        const r = d.getBoundingClientRect();
        if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) d.close();
      });
    }
    const go = d.querySelector('#acct-ask-go');
    go.href = accountHref();
    go.onclick = () => ls.set(NEXT, location.href);   // come back here after signing in
    if (d.showModal) d.showModal(); else location.href = go.href;
    return false;
  }

  function goNext() {
    const n = ls.get(NEXT);
    ls.set(NEXT, null);
    try { if (n && new URL(n).origin === location.origin && new URL(n).pathname !== location.pathname) { location.href = n; return true; } } catch (e) {}
    return false;
  }

  function paintNav() {
    const s = current();
    const signed = !!s && (STUB ? !!s.stub : !s.stub);
    document.querySelectorAll('a[data-acct] span').forEach(sp => { sp.textContent = signed ? 'Account' : 'Sign in'; });
  }

  // ---------------------------------------------------------------- the Account page
  const el = (tag, attrs, kids) => {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v); });
    (kids || []).forEach(k => e.append(k));
    return e;
  };
  const say = (node, text) => setTimeout(() => { node.textContent = text; }, 60);   // set after the node is in the page, so it is announced
  const PREVIEW_NOTE = 'Preview: accounts are simulated in this browser. No email is sent and no account is created anywhere.';
  function prefBoxes(prefix) {
    const boxes = {};
    const list = PREFS.map(([k, lab, when]) => {
      boxes[k] = el('input', { id: prefix + k, type: 'checkbox' });
      return el('label', { class: 'acct-check', for: prefix + k }, [boxes[k], el('span', {}, [el('b', { text: lab }), ': ' + when])]);
    });
    return { boxes, list };
  }

  function loadCaptcha(slot, done) {
    if (STUB || !C.turnstile) return;
    window.fedrimCaptcha = () => window.turnstile.render(slot, { sitekey: C.turnstile, callback: t => done(t), 'expired-callback': () => done('') });
    if (window.turnstile) window.fedrimCaptcha();
    else document.head.append(el('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=fedrimCaptcha&render=explicit', async: '' }));
  }

  function drawSignedOut(box, error) {
    let captcha = '';
    const err = el('p', { class: 'acct-err', role: 'alert' });
    const email = el('input', { id: 'acct-email', type: 'email', autocomplete: 'email', required: '', inputmode: 'email' });
    const prefs = prefBoxes('acct-new-');
    const slot = el('div', { class: 'acct-captcha' });
    const btn = el('button', { class: 'btn', type: 'submit', text: 'Send me a sign-in link' });
    const form = el('form', { class: 'acct-card', novalidate: '' }, [
      el('h2', { text: 'Create an account or sign in' }),
      el('p', { text: 'Enter your email address and you will get a link and a code that sign you in. There is no password, and the same email works for a new account or an existing one.' }),
      el('label', { for: 'acct-email', class: 'acct-label', text: 'Email address' }), email,
      el('fieldset', { class: 'acct-prefs' }, [el('legend', { text: 'Email me (optional; you can change these any time):' })].concat(prefs.list)),
      slot, btn, err,
      el('p', { class: 'small muted' }, ['What an account keeps is set out under ', el('a', { href: 'standards.html#privacy', text: 'Privacy' }), '.'])
    ]);
    if (STUB) form.prepend(el('p', { class: 'acct-note', text: PREVIEW_NOTE }));
    loadCaptcha(slot, t => { captcha = t; });
    form.onsubmit = async e => {
      e.preventDefault();
      err.textContent = '';
      if (!STUB && C.turnstile && !captcha) { err.textContent = 'Please finish the check above first.'; return; }
      btn.disabled = true;
      const chosen = Object.fromEntries(PREFS.map(([k]) => [k, prefs.boxes[k].checked]));
      try { const r = await sendLink(email.value, chosen, captcha); drawSent(box, r); }
      catch (x) { err.textContent = x.message; btn.disabled = false; if (window.turnstile && C.turnstile) { window.turnstile.reset(); captcha = ''; } }
    };
    box.replaceChildren(form);
    if (error) say(err, error);
    email.focus();
  }

  function drawSent(box, r) {
    const h = el('h2', { text: 'Check your email', tabindex: '-1' });
    const err = el('p', { class: 'acct-err', role: 'alert' });
    const card = el('div', { class: 'acct-card' }, [h,   // focus moves to the heading, which announces it
      el('p', {}, ['A sign-in link and a code are on their way to ', el('b', { text: r.email }),
        '. Open the link in this browser, or type the code below. Both work once and run out after an hour.']),
      el('p', { class: 'small muted', text: 'The email choices you ticked are saved to your account when you sign in from this browser.' })
    ]);
    if (r.stub) {
      card.append(el('p', { class: 'acct-note', text: PREVIEW_NOTE + ' The button below stands in for the link in the email.' }),
                  el('div', { class: 'acct-actions' }, [el('button', { class: 'btn', type: 'button', text: 'Open the sign-in link (preview)',
                    onclick: () => { if (!stubFinish()) { err.textContent = STORAGE_MSG; return; } if (!goNext()) drawAccount(); } })]), err);
    } else {
      const code = el('input', { id: 'acct-code', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '10' });
      const go = el('button', { class: 'btn', type: 'submit', text: 'Sign in with the code' });
      const form = el('form', { class: 'acct-code', novalidate: '' }, [el('label', { for: 'acct-code', class: 'acct-label', text: 'Code from the email' }), code, go, err]);
      form.onsubmit = async e => {
        e.preventDefault(); err.textContent = ''; go.disabled = true;
        try { await verifyCode(r.email, code.value); if (!goNext()) drawAccount(); }
        catch (x) { err.textContent = x.message; go.disabled = false; }
      };
      card.append(form);
    }
    card.append(el('p', { class: 'small' }, [el('a', { href: '#', text: 'Use a different address', onclick: e => { e.preventDefault(); drawSignedOut(box); } })]));
    box.replaceChildren(card);
    h.focus();
  }

  async function drawSignedIn(box, s) {
    const err = el('p', { class: 'acct-err', role: 'alert' });
    const saved = el('span', { class: 'acct-saved', role: 'status' });
    const prefs = prefBoxes('acct-');
    const card = el('div', { class: 'acct-card' }, [
      el('h2', { text: 'Your account' }),
      el('p', {}, ['Signed in as ', el('b', { text: s.email || '' }), '.']),
      el('fieldset', { class: 'acct-prefs' }, [el('legend', {}, ['Email me: ', saved])].concat(prefs.list)),
      el('h3', { text: 'Downloads' }),
      el('p', {}, ['Narrow the records on the ', el('a', { href: 'records.html', text: 'patent finder' }), ', then use Download (CSV) to save the records shown.']),
      el('div', { class: 'acct-actions' }, [
        el('button', { class: 'btn ghost', type: 'button', text: 'Sign out', onclick: async () => { await signOut(); drawAccount(); } }),
        el('button', { class: 'btn ghost acct-danger', type: 'button', text: 'Delete my account', onclick: async () => {
          if (!confirm('Delete your account? This removes your email address, your email choices and your sign-in records, and cannot be undone. ' +
                       'The account service\'s short technical logs clear on their own within about a week.')) return;
          try { await deleteAccount(); drawAccount('Your account has been deleted.'); } catch (x) { err.textContent = x.message; }
        } })
      ]),
      err
    ]);
    if (STUB) card.prepend(el('p', { class: 'acct-note', text: PREVIEW_NOTE }));
    box.replaceChildren(card);
    try { const p = await profile(); PREFS.forEach(([k]) => { prefs.boxes[k].checked = !!(p && p[k]); }); } catch (x) { err.textContent = x.message; }
    PREFS.forEach(([k]) => {
      prefs.boxes[k].onchange = async () => {
        err.textContent = ''; saved.textContent = '';
        try { await setPref(k, prefs.boxes[k].checked); saved.textContent = 'Saved.'; }
        catch (x) { err.textContent = x.message; prefs.boxes[k].checked = !prefs.boxes[k].checked; }
      };
    });
  }

  async function drawAccount(message) {
    const box = document.getElementById('acct');
    if (!box) return;
    const fin = await finishFromLink();
    if (fin && fin.ok && goNext()) return;
    const s = await session();
    if (s) await drawSignedIn(box, s);
    else drawSignedOut(box, fin && fin.error ? fin.error : '');
    if (message) { const m = el('p', { class: 'acct-note', role: 'status' }); box.prepend(m); say(m, message); }
  }

  // a sign-in link that Supabase sent to another page (its Site URL) is passed to the Account page, which reads and clears it
  if (!STUB && !document.getElementById('acct') && /(^|[#&])(access_token|error|error_description)=/.test(location.hash)) {
    location.replace(accountHref().split('#')[0] + location.hash);
    return;
  }
  window.FedAuth = { session, requireSignIn, signOut, mode: STUB ? 'stub' : 'supabase' };
  paintNav();
  drawAccount();
  // a sign-in link opened in a tab that is already on the Account page changes only the #fragment, which does not reload the page
  if (document.getElementById('acct')) window.addEventListener('hashchange', () => { if (/access_token=|error=/.test(location.hash)) drawAccount(); });
})();
