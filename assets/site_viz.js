/* FedRIM: the report's charts on the site's pages (add_site_1156.py section 6 ships this as assets/site_viz.js, after the report's
   own chart code in assets/bars.js and assets/charts.js). window.SITEVIZ is the chart data computed at build from the site's
   records. This file only puts the report's charts in place; it draws nothing of its own. */
(function () {
  'use strict';
  const V = window.SITEVIZ || {};

  // the home page: "Patent records listing VA as an owner, by VA medical center", the report's Overview bars (stacked())
  const pat = document.getElementById('ov-pat');
  if (pat && window.SITEBARS && V.pat) {
    pat.replaceChildren(window.SITEBARS.stacked(V.pat.rows.map(r => ({ label: r[0], parts: r[1] })),
      V.pat.series.map(s => ({ name: s[0], color: s[1] })), { note: V.pat.hint }));
  }

  // the patent finder's Charts view: the report's flow chart with its step-by-step walk-through (the Overview card), drawn the
  // first time the view is open, so it is sized to its box (the finder sends fx-view when it changes view)
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
