/*
 * Pantheon Wars — in-game encyclopedia (A005). Built from the same data the engine runs, so it cannot drift from the rules.
 * Sources are listed as offline attribution text; links open only when the player chooses to follow them.
 */
(function (root) {
  'use strict';
  var A = root.PWArt;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cost(c) { var a = []; if (c.faith) a.push(c.faith + ' Faith'); if (c.favor) a.push(c.favor + ' Favor'); return a.join(' + ') || 'no cost'; }
  function cites(ids) { return (ids || []).map(function (id) { return '<a href="#enc-src-' + id + '" class="cite" data-src="' + id + '">[' + id + ']</a>'; }).join(' '); }
  function canvasEl(c, w, h, label) { var x = el('canvas'); x.width = c.width; x.height = c.height; x.getContext('2d').drawImage(c, 0, 0); x.style.width = (w || c.width) + 'px'; x.style.height = (h || c.height) + 'px'; x.className = 'pix'; x.setAttribute('role', 'img'); x.setAttribute('aria-label', label || ''); return x; }

  var GLOSSARY = [
    ['Faith', 'Produced each turn by followers, shrines, routes and some domains. Spent on shrines, priests, omens, callings, roads and powers.'],
    ['Favor', 'The attention of the heavens (cap 15). Earned by winning towns, keeping covenants, festivals and domains; spent on dreams, eclipses, counter-rites and miracles.'],
    ['Followers and control', 'A town kneels to the god with the most followers once they make up half of its people. Winning a town earns 1 Favor.'],
    ['Pressure', 'How strongly a god converts in a town each turn: nearby unshadowed shrines (stronger closer), priests standing there, control momentum and pilgrim roads, adjusted by the town\'s trust, hunger and fear.'],
    ['The three ages', 'Dawn (turns 1–15): omens cost a third less, dreams recover faster. Zenith (16–30): shrines teach 15% harder and roads give +50% Faith. Twilight (31–45): eclipses cost 1 less Favor and kept covenants pay 1 more Favor.'],
    ['Prosperity and safety', 'Every town has prosperity and safety from 0 to 10. They drift toward a level set by its land, its patron, weather, blessings and protection. A hungry town (prosperity 2 or less) does not grow and slowly abandons the god it kneels to. An afraid town (safety 2 or less) listens less to gods who cannot protect it.'],
    ['Trust and memory', 'Towns remember who blessed them, struck them, kept or broke promises, raised or toppled shrines. Trust from −3 to +3 changes that god\'s pressure there by 6% a point.'],
    ['Covenants', 'A public promise to one town: protection (your shrine still stands), plenty (prosperity reaches 6) or faithfulness (your followers do not fall). Keep it for Favor and trust; break or abandon it and pay. At most two at a time.'],
    ['Counter-rites', 'When a rival eclipses or strikes your shrine, you may answer on your next turn for Favor: the lost Ward returns, the eclipse lifts and the attacker loses 1 Favor. A gathering storm (Storm of Susanoo) can be dispersed the same way before it breaks.'],
    ['Diplomacy', 'Envoys propose a truce (8 turns; attacking a partner breaks it at a cost), a shared festival (both pay 4 Faith, both gain 2 Favor next turn) or a border promise (no shrines within 2 hexes of the other\'s shrines). Rivals remember betrayals.'],
    ['Shrine callings', 'Each shrine may be consecrated once: Oracle (sees far, foresees weather, +1 Faith), Sanctuary (Ward, shelter, resistance) or Beacon (pressure and reach, but fragile).'],
    ['Priest callings', 'Emissary (the baseline preacher), Seer (walks 3, sees far, preaches weakly) and Warden (walks 1, guards a shrine and steadies its town). Retrain a priest at your own shrine.'],
    ['Pilgrim roads', 'Roads link nearby towns. Consecrate one where you have followers at both ends and a shrine at one end: it adds pressure at both ends, Faith every turn and faster priests. A rival taking an end town cuts it; a cut road lapses after a few turns.'],
    ['Sacred landmarks', 'Wind summits, springs, groves and standing stones. A god whose priest stands alone on one at the end of a round holds it until another claims it.'],
    ['Weather', 'Drought, storms, seasonal rains, frost and sky omens gather over a region, arrive, do their work and pass. You see weather that has arrived over land you know; coming weather only through oracles, foresight domains and omen powers.'],
    ['Marks on the land', 'Strikes scorch, blessings flower, storms leave fallen trees, toppled shrines leave ruins (cheaper to rebuild), kept covenants leave a stone. Most fade with time.'],
    ['Victory', 'Ascendancy: more than 60% of all mortals from turn 12. Dominion: every rival forgotten. Twilight Judgment: the highest devotion score when turn 45 ends (followers + 3 per shrine + 2 per town + half your Favor). Alternative modes add Sacred Ground and The Kept Word; scenarios set their own trials.']
  ];

  function build(D, opts) {
    opts = opts || {};
    var root = el('div', 'enc'), nav = el('div', 'enc-nav'), body = el('div', 'enc-body');
    var search = el('input'); search.type = 'search'; search.placeholder = 'Search pantheons, powers, rules…'; search.setAttribute('aria-label', 'Search the encyclopedia');
    var tabs = [['pantheons', 'Pantheons'], ['powers', 'Powers'], ['rules', 'Rules'], ['events', 'Events'], ['scenarios', 'Trials'], ['sources', 'Sources & representation']];
    var tabBar = el('div', 'seg enc-tabs'); tabBar.setAttribute('role', 'tablist');
    tabs.forEach(function (t, i) { var b = el('button', i ? '' : 'on', t[1]); b.setAttribute('role', 'tab'); b.dataset.tab = t[0]; b.onclick = function () { show(t[0]); }; tabBar.appendChild(b); });
    nav.appendChild(tabBar); nav.appendChild(search); root.appendChild(nav); root.appendChild(body);
    var factions = {}; D.factions.forEach(function (f) { factions[f.id] = f; });
    var shrines = {}; D.shrines.forEach(function (s) { shrines[s.id] = s; });
    function show(tab) {
      tabBar.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); });
      body.innerHTML = ''; var q = search.value.trim().toLowerCase();
      var match = function (s) { return !q || s.toLowerCase().indexOf(q) >= 0; };
      if (tab === 'pantheons') D.factions.forEach(function (f) {
        var txt = f.name + f.tradition + f.blurb + f.domains.map(function (d) { var x = D.domains.find(function (y) { return y.id === d; }); return x.name + x.inspiredBy; }).join(' ');
        if (!match(txt)) return;
        var sec = el('section', 'enc-faction'); sec.id = 'enc-f-' + f.id; sec.style.setProperty('--c', f.palette.secondary); sec.style.setProperty('--a', f.palette.accent);
        var head = el('div', 'enc-head'); head.appendChild(canvasEl(A.emblem(f.emblem, f.palette, 64), 64, 64, f.name + ' emblem'));
        head.appendChild(el('div', '', '<h3>' + esc(f.name) + '</h3><div class="tb-small">' + esc(f.tradition) + ' · ' + esc(f.deityTitle) + '</div><p>' + esc(f.blurb) + ' ' + cites(f.sources) + '</p>'));
        sec.appendChild(head);
        if (f.representation) sec.appendChild(el('p', 'enc-note', '<b>Representation note.</b> ' + esc(f.representation)));
        var dl = el('div', 'enc-grid');
        f.domains.forEach(function (id) { var d = D.domains.find(function (x) { return x.id === id; }); dl.appendChild(el('div', 'enc-card', '<div class="k">Domain</div><b>' + esc(d.name) + '</b><div class="tb-small">' + esc(d.inspiredBy) + ' ' + cites(d.sources) + '</div><p class="fl">' + esc(d.flavor) + '</p><p>' + esc(d.text) + '</p>')); });
        f.powers.forEach(function (id) { var p = D.powers.find(function (x) { return x.id === id; }); var c = el('div', 'enc-card power x-' + p.x); c.appendChild(canvasEl(A.icon(p.icon, 48), 36, 36, p.name)); c.appendChild(el('div', '', '<div class="k">' + esc(p.x) + '</div><b>' + esc(p.name) + '</b><div class="tb-small">' + esc(cost(p.cost)) + ' · cooldown ' + p.cooldown + ' · ' + esc(p.inspiredBy) + ' ' + cites(p.sources) + '</div><p class="fl">' + esc(p.flavor) + '</p><p>' + esc(p.text) + '</p>')); dl.appendChild(c); });
        sec.appendChild(dl);
        var sh = shrines[f.shrine], srow = el('div', 'enc-shrine');
        ['healthy', 'fortified', 'eclipsed', 'damaged', 'nearlyToppled', 'ruined', 'restored'].forEach(function (cond) { var w = el('figure'); w.appendChild(canvasEl(A.shrineArt(sh.art, f.palette, cond, null), 66, 75, sh.name + ' ' + cond)); w.appendChild(el('figcaption', '', esc(cond.replace('nearlyToppled', 'near collapse')))); srow.appendChild(w); });
        ['emissary', 'seer', 'warden'].forEach(function (role) { var w = el('figure'); w.appendChild(canvasEl(A.up(A.priestSprite(f.priestStyle, role, f.palette, 0), 42), 42, 60, role + ' priest')); w.appendChild(el('figcaption', '', role)); srow.appendChild(w); });
        sec.appendChild(el('p', '', '<b>Shrine: ' + esc(sh.name) + '.</b> ' + esc(sh.description) + ' Faith ' + sh.faith + '/turn, pressure ' + sh.pressure + ', reach ' + sh.radius + ', Ward ' + sh.ward + '. ' + cites(sh.sources)));
        sec.appendChild(srow);
        body.appendChild(sec);
      });
      if (tab === 'powers') { var tbl = el('table', 'enc-table'); tbl.innerHTML = '<tr><th>Power</th><th>Pantheon</th><th>Kind</th><th>Cost</th><th>Effect</th></tr>'; D.powers.forEach(function (p) { if (!match(p.name + p.text + p.inspiredBy + p.faction)) return; var tr = el('tr'); tr.innerHTML = '<td><b>' + esc(p.name) + '</b></td><td>' + esc(factions[p.faction].shortName) + '</td><td class="x-' + p.x + '">' + p.x + '</td><td>' + esc(cost(p.cost)) + ', cd ' + p.cooldown + '</td><td>' + esc(p.text) + ' ' + cites(p.sources) + '</td>'; tbl.appendChild(tr); }); body.appendChild(tbl); }
      if (tab === 'rules') { GLOSSARY.forEach(function (g) { if (match(g[0] + g[1])) body.appendChild(el('div', 'enc-card wide', '<b>' + esc(g[0]) + '</b><p>' + esc(g[1]) + '</p>')); }); D.rules.ages.forEach(function (a) { if (match(a.name + a.text)) body.appendChild(el('div', 'enc-card wide', '<b>' + esc(a.name) + ' (from turn ' + a.from + ')</b><p>' + esc(a.text) + '</p>')); }); }
      if (tab === 'events') D.events.forEach(function (e) { if (!match(e.title + e.text)) return; var c = el('div', 'enc-card event'); c.appendChild(canvasEl(A.eventArt(e.art, 7, 'zenith'), 160, 90, e.title)); c.appendChild(el('div', '', '<b>' + esc(e.title) + '</b>' + (e.factions ? ' <span class="tb-small">(' + e.factions.map(function (x) { return factions[x].shortName; }).join(', ') + ' only)</span>' : '') + (e.climate ? ' <span class="tb-small">· likelier in ' + esc(e.climate) + '</span>' : '') + '<p>' + esc(e.text) + '</p><div class="tb-small">' + e.choices.map(function (x) { return esc(x.label); }).join(' / ') + ' ' + cites(e.sources) + '</div>')); body.appendChild(c); });
      if (tab === 'scenarios') (D.scenarios || []).forEach(function (s) { if (!match(s.name + s.text)) return; body.appendChild(el('div', 'enc-card wide', '<b>' + esc(s.name) + '</b> <span class="tb-small">' + esc(s.kind) + ' · ' + s.players.map(function (p) { return factions[p.faction].shortName; }).join(' vs ') + ' · ' + s.turns + ' turns</span><p>' + esc(s.text) + '</p><p class="tb-small">' + esc(s.fiction) + ' ' + esc(s.hint) + '</p>')); });
      if (tab === 'sources') {
        body.appendChild(el('p', 'enc-note', esc(D.sources._note || '') + ' A full research and representation review is in docs/RESEARCH_AND_REPRESENTATION.md.'));
        var ul = el('ul', 'enc-sources');
        Object.keys(D.sources).filter(function (k) { return k[0] !== '_'; }).forEach(function (k) { var s = D.sources[k]; if (!match(k + s.title + s.supports + (s.publisher || ''))) return; var li = el('li'); li.id = 'enc-src-' + k; li.innerHTML = '<b>[' + k + ']</b> ' + esc(s.title) + ' — ' + esc(s.publisher || '') + '. <span class="tb-small">Supports: ' + esc(s.supports) + ' Verification: ' + esc(s.verification || '') + '; confidence ' + esc(s.confidence || '') + '; accessed ' + esc(s.accessed || '') + '.</span> <a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" class="ext">open source ↗</a>'; ul.appendChild(li); });
        body.appendChild(ul);
      }
    }
    search.oninput = function () { var on = tabBar.querySelector('button.on'); show(on ? on.dataset.tab : 'pantheons'); };
    root.addEventListener('click', function (e) { var c = e.target.closest && e.target.closest('.cite'); if (c) { e.preventDefault(); show('sources'); var li = root.querySelector('#enc-src-' + c.dataset.src); if (li) { li.scrollIntoView({ block: 'center' }); li.classList.add('flash'); } } });
    show(opts.tab || 'pantheons');
    if (opts.faction) { var t = root.querySelector('#enc-f-' + opts.faction); if (t) setTimeout(function () { t.scrollIntoView(); }, 30); }
    return root;
  }
  root.PWEncyclopedia = { build: build, GLOSSARY: GLOSSARY };
})(typeof self !== 'undefined' ? self : this);
