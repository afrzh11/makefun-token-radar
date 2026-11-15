// Token Radar's page: renders the board from window.RADAR, filters it, and opens one protocol's
// detail view. It makes no network requests: every number it shows comes from the data script
// written beside it, and every farm plan is generated in the page from the same templates the
// program used for board.json.
//
// A board row is a positional array; the column order is fixed in lib/model.ts:
// [rank, slug, name, category, chains, tvl_usd, change_7d, age_days,
//  peer_multiple, peer_peers, growth_multiplier, maturity_multiplier, implied_value_usd, on_watchlist]
// A live row is [slug, name, category, chains, tvl_usd, mcap_usd, change_7d].

(function () {
  'use strict';

  var RADAR = window.RADAR;
  if (!RADAR || !Array.isArray(RADAR.rows)) {
    document.getElementById('count').textContent = 'No radar data loaded.';
    return;
  }

  // ---------------------------------------------------------------- helpers

  function $(id) { return document.getElementById(id); }

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function moneyFull(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return s;
  }

  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return days + 'd';
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** The page recomputes a row's implied value from its four factors. */
  function impliedOf(row) {
    return Math.round(row[5] * row[8] * row[10] * row[11]);
  }

  // ---------------------------------------------------------------- static facts

  var rows = RADAR.rows;
  var live = RADAR.live || [];
  var top = rows[0];

  $('meta-date').textContent = 'Snapshot ' + RADAR.as_of;
  $('meta-count').textContent = RADAR.board_size + ' protocols ranked';
  $('meta-floor').textContent = 'Watchlist floor ' + money(RADAR.floor_usd);
  $('fact-rows').textContent = RADAR.board_size;
  $('fact-watchlist').textContent = RADAR.watchlist_size;
  $('fact-early').textContent = RADAR.early_size;
  $('fact-total').textContent = money(RADAR.total_implied_usd);
  $('fact-peer').textContent = RADAR.global_peer_multiple.toFixed(3) + '×';
  $('fact-top').textContent = top ? top[2] + ' · ' + money(top[12]) : '—';
  $('model-global').textContent = RADAR.global_peer_multiple.toFixed(3);
  $('source').textContent = 'Source: ' + RADAR.source + '.';
  $('count').textContent = '';

  // Peer multiples by category, highest first.
  var peerRows = Object.keys(RADAR.peers || {}).map(function (cat) {
    return { cat: cat, multiple: RADAR.peers[cat].multiple, n: RADAR.peers[cat].peers };
  }).sort(function (a, b) { return b.multiple - a.multiple || (a.cat < b.cat ? -1 : 1); });
  $('peer-body').innerHTML = peerRows.map(function (p) {
    return '<tr><td>' + esc(p.cat) + '</td><td class="num">' + p.multiple.toFixed(3) + '×</td><td class="num">' + p.n + '</td></tr>';
  }).join('');

  // ---------------------------------------------------------------- filters

  var categories = {};
  var chains = {};
  rows.forEach(function (r) {
    if (r[3]) categories[r[3]] = true;
    (r[4] || []).forEach(function (c) { chains[c] = true; });
  });
  function fillSelect(el, values) {
    values.sort().forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      el.appendChild(o);
    });
  }
  fillSelect($('category'), Object.keys(categories));
  fillSelect($('chain'), Object.keys(chains));

  var state = { q: '', category: '', chain: '', minTvl: 0, sort: 'implied', tab: 'board' };

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.tab === 'watchlist' && !r[13]) return false;
      if (q && r[2].toLowerCase().indexOf(q) === -1 && r[1].toLowerCase().indexOf(q) === -1) return false;
      if (state.category && r[3] !== state.category) return false;
      if (state.chain && (r[4] || []).indexOf(state.chain) === -1) return false;
      if (r[5] < state.minTvl) return false;
      return true;
    });
    if (state.sort === 'tvl') list.sort(function (a, b) { return b[5] - a[5] || a[0] - b[0]; });
    else if (state.sort === 'growth') list.sort(function (a, b) { return (b[6] === null ? -Infinity : b[6]) - (a[6] === null ? -Infinity : a[6]) || a[0] - b[0]; });
    else if (state.sort === 'age') list.sort(function (a, b) { return (b[7] === null ? -1 : b[7]) - (a[7] === null ? -1 : a[7]) || a[0] - b[0]; });
    else list.sort(function (a, b) { return a[0] - b[0]; });
    return list;
  }

  var maxImplied = top ? top[12] : 1;

  function renderBoard() {
    var list = filtered();
    var body = $('board-body');
    body.innerHTML = list.map(function (r) {
      var chg = r[6];
      var chgCls = chg === null ? '' : (chg >= 0 ? 'pos' : 'neg');
      var badge = r[13]
        ? '<span class="badge">WATCHLIST</span>'
        : '<span class="badge early">EARLY</span>';
      var width = Math.max(2, Math.round((r[12] / maxImplied) * 100));
      return '<tr data-slug="' + esc(r[1]) + '" data-selected="false" tabindex="0">' +
        '<td class="num">' + r[0] + '</td>' +
        '<td><span class="name"><b>' + esc(r[2]) + '</b>' +
        '<span class="sub">' + esc(r[1]) + ' · ' + esc(r[3] || 'Uncategorised') + ' · ' + esc((r[4] || []).join(', ') || '—') + '</span></span></td>' +
        '<td class="num">' + money(r[5]) + '</td>' +
        '<td class="num ' + chgCls + '">' + pct(chg) + '</td>' +
        '<td class="num">' + ageText(r[7]) + '</td>' +
        '<td class="num">' + r[8].toFixed(3) + '×</td>' +
        '<td><span class="implied"><span class="bar"><i style="width:' + width + '%"></i></span><span class="num">' + money(r[12]) + '</span></span><br>' + badge + '</td>' +
        '</tr>';
    }).join('');
    $('empty').hidden = list.length !== 0;
    $('count').textContent = 'Showing ' + list.length + ' of ' + rows.length + ' protocols' +
      (state.tab === 'watchlist' ? ' (watchlist only)' : '');
  }

  function renderLive() {
    $('live-body').innerHTML = live.map(function (r) {
      var ratio = r[5] !== null && r[4] > 0 ? (r[5] / r[4]).toFixed(3) + '×' : '—';
      var chg = r[6];
      var chgCls = chg === null ? '' : (chg >= 0 ? 'pos' : 'neg');
      return '<tr><td><span class="name"><b>' + esc(r[1]) + '</b>' +
        '<span class="sub">' + esc(r[0]) + ' · ' + esc(r[2] || 'Uncategorised') + ' · ' + esc((r[3] || []).join(', ') || '—') + '</span></span></td>' +
        '<td class="num">' + money(r[4]) + '</td>' +
        '<td class="num">' + money(r[5]) + '</td>' +
        '<td class="num ' + chgCls + '">' + pct(chg) + '</td>' +
        '<td class="num">' + ratio + '</td></tr>';
    }).join('');
    $('count').textContent = live.length + ' live-token protocols, by market cap';
  }

  function setTab(tab) {
    state.tab = tab;
    $('tab-board').setAttribute('aria-pressed', tab === 'board' ? 'true' : 'false');
    $('tab-watchlist').setAttribute('aria-pressed', tab === 'watchlist' ? 'true' : 'false');
    $('tab-live').setAttribute('aria-pressed', tab === 'live' ? 'true' : 'false');
    $('board').hidden = tab === 'live';
    $('live-panel').hidden = tab !== 'live';
    if (tab === 'live') renderLive(); else renderBoard();
  }

  // ---------------------------------------------------------------- detail view

  var dialog = $('detail');
  var currentSlug = null;

  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < rows.length; i++) if (rows[i][1] === slug) { row = rows[i]; break; }
    if (!row) return;
    currentSlug = slug;
    var modelValue = impliedOf(row);
    var boardValue = row[12];
    $('detail-rank').textContent = 'RANK #' + row[0] + (row[13] ? ' · WATCHLIST' : ' · EARLY FIND');
    $('detail-title').textContent = row[2];
    $('detail-sub').textContent = row[1] + ' · ' + (row[3] || 'Uncategorised') + ' · ' + (row[4] || []).join(', ');
    var eq = $('detail-equation');
    var lines = [
      ['TVL', moneyFull(row[5])],
      ['Peer multiple (' + (row[3] || 'Uncategorised') + ')', row[8].toFixed(4) + '×'],
      ['Growth multiplier (' + pct(row[6]) + ' over 7 days)', '×' + row[10].toFixed(4)],
      ['Maturity multiplier (' + ageText(row[7]) + ' old)', '×' + row[11].toFixed(4)],
      ['Model value', moneyFull(modelValue)],
    ];
    if (modelValue !== boardValue) {
      lines.push(['Strict-order adjustment', '−' + moneyFull(modelValue - boardValue)]);
    }
    lines.push(['Board value', moneyFull(boardValue)]);
    eq.innerHTML = lines.map(function (l, i) {
      var cls = i === lines.length - 1 ? ' class="total"' : '';
      return '<div' + cls + '><span>' + esc(l[0]) + '</span><b>' + esc(l[1]) + '</b></div>';
    }).join('');
    var note;
    if (row[9] >= 3) {
      note = 'Peer multiple ' + row[8].toFixed(4) + ' is the median market-cap/TVL of ' + row[9] +
        ' traded protocols in ' + (row[3] || 'this category') + '.';
    } else {
      note = 'Peer multiple ' + row[8].toFixed(4) + ' is the global median: ' + (row[3] || 'this category') +
        ' has only ' + row[9] + ' traded peer' + (row[9] === 1 ? '' : 's') + ' in the snapshot, under the 3-peer bar.';
    }
    if (row[8] > 1) {
      note += ' This multiple is high for its category, so the value is multiple-sensitive: at the global median it would be ' +
        money(Math.round(row[5] * RADAR.global_peer_multiple * row[10] * row[11])) + '.';
    }
    $('detail-peer-note').textContent = note;

    var proto = { name: row[2], category: row[3], chains: row[4], tvl_usd: row[5] };
    var steps = window.Plans.farmSteps(proto, row[7]);
    $('detail-steps').innerHTML = steps.map(function (s, i) {
      return '<li><b>Step ' + (i + 1) + ' — ' + esc(s.text) + '</b>' +
        '<span class="cost">Cost: ' + esc(s.cost) + ' · Time: ' + esc(s.time) + '</span></li>';
    }).join('');

    $('detail-record').innerHTML = [
      ['DefiLlama slug', row[1]],
      ['TVL', moneyFull(row[5])],
      ['7-day change', pct(row[6])],
      ['Tracked since', row[7] === null ? 'not reported' : RADAR.as_of + ' minus ' + row[7] + ' days'],
      ['Token recorded', 'none — no market cap, no CoinGecko id, no symbol'],
      ['Chains', (row[4] || []).join(', ') || '—'],
    ].map(function (kv) {
      return '<div><dt>' + esc(kv[0]) + '</dt><dd>' + esc(kv[1]) + '</dd></div>';
    }).join('');

    document.querySelectorAll('#board-body tr').forEach(function (tr) {
      tr.setAttribute('data-selected', tr.getAttribute('data-slug') === slug ? 'true' : 'false');
    });
    if (!dialog.open) dialog.showModal();
    try { history.replaceState(null, '', '#p=' + encodeURIComponent(slug)); } catch (e) { /* file:// */ }
  }

  function closeDetail() {
    if (dialog.open) dialog.close();
    currentSlug = null;
    document.querySelectorAll('#board-body tr').forEach(function (tr) { tr.setAttribute('data-selected', 'false'); });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file:// */ }
  }

  $('board-body').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });
  $('board-body').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var tr = e.target.closest('tr[data-slug]');
    if (tr) { e.preventDefault(); openDetail(tr.getAttribute('data-slug')); }
  });
  $('detail-close').addEventListener('click', closeDetail);
  dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDetail(); });
  dialog.addEventListener('close', function () {
    currentSlug = null;
    document.querySelectorAll('#board-body tr').forEach(function (tr) { tr.setAttribute('data-selected', 'false'); });
  });

  // ---------------------------------------------------------------- controls

  $('search').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  $('category').addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  $('min-tvl').addEventListener('change', function (e) { state.minTvl = Number(e.target.value); renderBoard(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });
  $('tab-board').addEventListener('click', function () { setTab('board'); });
  $('tab-watchlist').addEventListener('click', function () { setTab('watchlist'); });
  $('tab-live').addEventListener('click', function () { setTab('live'); });
  $('reset-filters').addEventListener('click', function () {
    state.q = ''; state.category = ''; state.chain = ''; state.minTvl = 0; state.sort = 'implied';
    $('search').value = ''; $('category').value = ''; $('chain').value = '';
    $('min-tvl').value = '0'; $('sort').value = 'implied';
    setTab('board');
  });

  // ---------------------------------------------------------------- hash routing

  function readHash() {
    var h = location.hash.replace(/^#/, '');
    var params = new URLSearchParams(h);
    var cat = params.get('cat');
    if (cat) { state.category = cat; $('category').value = cat; }
    var tab = params.get('tab');
    if (tab === 'live' || tab === 'watchlist' || tab === 'board') state.tab = tab;
    setTab(state.tab);
    var p = params.get('p');
    if (p) openDetail(p);
    else if (dialog.open) closeDetail();
  }

  readHash();
  window.addEventListener('hashchange', readHash);
})();
