(function () {
  'use strict';
  const V = window.SITEVIZ || {};

  const pat = document.getElementById('ov-pat');
  if (pat && window.SITEBARS && V.pat) {
    pat.replaceChildren(window.SITEBARS.stacked(V.pat.rows.map(r => ({ label: r[0], parts: r[1] })),
      V.pat.series.map(s => ({ name: s[0], color: s[1] })), { note: V.pat.hint }));
  }

  let flowDone = false;
  function flow() {
    const view = document.getElementById('fx-view-charts');
    if (flowDone || !view || view.hidden || !window.FRONT38 || !window.FRONT38.card || !V.flow) return;
    flowDone = true;
    window.FRONT38.card(V.d, V.flow);
  }
  document.addEventListener('fx-view', e => { if (e.detail === 'charts') flow(); });
  flow();
})();
