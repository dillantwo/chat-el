/* ==========================================================================
   香港抗日戰爭遺址互動地圖 — app logic

   形式：標記按「地區」上色並在區內編號，頂部一排彩色地區按鈕同時充當圖例，
        全寬地圖，清單與詳情為滑出式面板，另有語音導覽總開關。
   ========================================================================== */
(function () {
  'use strict';

  var SITES = window.SITES || [];
  var T = window.T;
  var CAT = window.CATEGORY_STYLE;
  var DIST = window.DISTRICT_STYLE;
  var DISTRICT_ORDER = window.DISTRICT_ORDER;
  var SPEECH_LANG = window.SPEECH_LANG;
  var CAT_ORDER = ['base', 'intel', 'rescue', 'battle', 'org', 'person', 'memorial'];

  var HK_CENTER = [22.372, 114.12];
  var VOICE_KEY = 'hkwar.voice';

  var state = {
    cats: new Set(),      // empty = all
    dists: new Set(),     // empty = all
    query: '',
    activeId: null,
    labels: false,
    voice: false,
  };

  var el = {};
  var map, markers = {}, markerLayer;
  var baseLayer = null;   // 只用地政總署地圖一個底圖

  /* ---------------------------------------------------------------- utils */

  function $(id) { return document.getElementById(id); }
  function distColor(site) { return (DIST[site.district] || { color: '#777' }).color; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Readable text colour for a given background — used on the district buttons,
     whose palette ranges from deep navy to gold. */
  function textOn(hex) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var lin = [0, 2, 4].map(function (i) {
      var v = parseInt(c.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    return L > 0.45 ? '#1d1b16' : '#ffffff';
  }

  /* Number each site within its own district (北區 1…12, 西貢 1…14, …) so the
     marker labels match the district buttons, as in the reference design. */
  function assignDistrictNumbers() {
    var counters = {};
    DISTRICT_ORDER.forEach(function (d) { counters[d] = 0; });
    SITES.slice()
      .sort(function (a, b) { return a.id - b.id; })
      .forEach(function (s) {
        if (!(s.district in counters)) counters[s.district] = 0;
        s.dnum = ++counters[s.district];
      });
  }

  function searchBlob(site) {
    return (site.title + ' ' + site.name + ' ' + site.subtitle + ' ' + site.listName + ' ' +
            site.paras.join(' ') + ' ' + T.cats[site.category] + ' ' + T.dists[site.district]
           ).toLowerCase();
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    var out = '', low = text.toLowerCase(), ql = q.toLowerCase(), i = 0;
    while (true) {
      var p = low.indexOf(ql, i);
      if (p < 0) { out += esc(text.slice(i)); break; }
      out += esc(text.slice(i, p)) + '<mark>' + esc(text.slice(p, p + ql.length)) + '</mark>';
      i = p + ql.length;
    }
    return out;
  }

  /* --------------------------------------------------------- filtering */

  function matches(site) {
    if (state.cats.size && !state.cats.has(site.category)) return false;
    if (state.dists.size && !state.dists.has(site.district)) return false;
    if (state.query && searchBlob(site).indexOf(state.query.toLowerCase()) < 0) return false;
    return true;
  }

  function visibleSites() { return SITES.filter(matches); }

  /* =========================================================== voice guide */

  var voice = {
    supported: typeof window.speechSynthesis !== 'undefined' &&
               typeof window.SpeechSynthesisUtterance !== 'undefined',
    queue: [],
    speakingId: null,
  };

  function pickVoice() {
    if (!voice.supported) return null;
    var wanted = SPEECH_LANG;
    var all = [];
    try { all = window.speechSynthesis.getVoices() || []; } catch (e) { return null; }
    for (var i = 0; i < wanted.length; i++) {
      var tag = wanted[i].toLowerCase();
      for (var j = 0; j < all.length; j++) {
        var v = (all[j].lang || '').toLowerCase().replace('_', '-');
        if (v === tag) return all[j];
      }
      for (var k = 0; k < all.length; k++) {
        var v2 = (all[k].lang || '').toLowerCase().replace('_', '-');
        if (v2.indexOf(tag) === 0) return all[k];
      }
    }
    return null;
  }

  function stopSpeaking() {
    if (!voice.supported) return;
    voice.queue = [];
    voice.speakingId = null;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    setSpeakingUi(false);
    clearReadingHighlight();
  }

  function setSpeakingUi(on) {
    if (!el.btnSpeak) return;
    el.btnSpeak.classList.toggle('is-speaking', !!on);
    el.btnSpeakText.textContent = on ? T.voiceStop : T.voicePlay;
    el.btnSpeak.setAttribute('aria-pressed', String(!!on));
  }

  function clearReadingHighlight() {
    if (!el.detailText) return;
    el.detailText.querySelectorAll('p.is-reading').forEach(function (p) {
      p.classList.remove('is-reading');
    });
  }

  /* Reads the site aloud one paragraph at a time, highlighting as it goes.
     Chunking keeps each utterance short, which several engines handle far
     better than one very long string. */
  function speakSite(id) {
    if (!voice.supported) { notify(T.voiceUnsupported); return; }
    var site = siteById(id);
    if (!site) return;
    stopSpeaking();
    var parts = [site.title];
    if (site.subtitle && site.subtitle !== site.title) parts.push(site.subtitle);
    site.paras.forEach(function (p) { parts.push(p); });

    var chosen = pickVoice();
    var langTag = SPEECH_LANG[0];
    voice.speakingId = id;
    setSpeakingUi(true);

    var paraNodes = el.detailText.querySelectorAll('p');
    var headOffset = parts.length - site.paras.length;   // title/subtitle come first

    parts.forEach(function (text, i) {
      var u = new window.SpeechSynthesisUtterance(text);
      u.lang = chosen ? chosen.lang : langTag;
      if (chosen) u.voice = chosen;
      u.rate = 0.96;
      u.onstart = function () {
        if (voice.speakingId !== id) return;
        clearReadingHighlight();
        var node = paraNodes[i - headOffset];
        if (node) node.classList.add('is-reading');
      };
      if (i === parts.length - 1) {
        u.onend = function () {
          if (voice.speakingId !== id) return;
          voice.speakingId = null;
          setSpeakingUi(false);
          clearReadingHighlight();
        };
      }
      u.onerror = function () {
        if (voice.speakingId !== id) return;
        voice.speakingId = null;
        setSpeakingUi(false);
        clearReadingHighlight();
      };
      try { window.speechSynthesis.speak(u); } catch (e) {}
    });
  }

  function toggleSpeakCurrent() {
    if (voice.speakingId != null) stopSpeaking();
    else if (state.activeId != null) speakSite(state.activeId);
  }

  function setVoiceEnabled(on) {
    state.voice = !!on;
    try { localStorage.setItem(VOICE_KEY, on ? '1' : '0'); } catch (e) {}
    el.voiceToggle.checked = !!on;
    if (!on) { stopSpeaking(); hideNotice(); }
    else if (voice.supported) notify(T.voiceOnHint);
    else notify(T.voiceUnsupported);
  }

  /* ------------------------------------------------------------- map */

  function pinHtml(site) {
    return '<div class="pin__body" style="background:' + distColor(site) + '"></div>' +
           '<div class="pin__no">' + site.dnum + '</div>' +
           '<div class="pin__label">' + esc(site.name) + '</div>';
  }

  function pinIcon(site, active) {
    return L.divIcon({
      className: 'pin' + (active ? ' is-active' : ''),
      html: pinHtml(site),
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }

  function buildMap() {
    map = L.map('map', {
      center: HK_CENTER,
      zoom: 11,
      // The Lands Department basemap starts at zoom 10; zoom 10 already shows the
      // whole territory, so there is nothing to gain from allowing less.
      minZoom: 10,
      maxZoom: 20,
      zoomControl: true,
      // Attribution goes bottom-LEFT: the detail panel overlays the bottom-right,
      // and the Lands Department terms require their logo to stay visible.
      attributionControl: false,
      worldCopyJump: false,
    });
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

    // Put the custom buttons into Leaflet's top-left stack so they flow under the
    // zoom control and above the layers control without magic offsets.
    var ToolsControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        L.DomEvent.disableClickPropagation(el.mapTools);
        L.DomEvent.disableScrollPropagation(el.mapTools);
        return el.mapTools;
      },
    });
    new ToolsControl().addTo(map);

    installBaseLayer();

    markerLayer = L.markerClusterGroup({
      // Small radius on purpose: the point of this design is to see the
      // district-coloured numbered pins, so only merge pins that genuinely
      // overlap, and stop clustering as soon as you look at a district.
      maxClusterRadius: 18,
      disableClusteringAtZoom: 13,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderLegPolylineOptions: { weight: 1.4, color: '#7a1f16', opacity: .7 },
      iconCreateFunction: function (cluster) {
        var kids = cluster.getAllChildMarkers();
        var n = kids.length;
        // Sites cluster geographically, so a cluster is almost always within one
        // district — colour it accordingly so the map still reads by district.
        var d = null, mixed = false;
        kids.forEach(function (k) {
          var s = siteById(k.siteId);
          if (!s) return;
          if (d === null) d = s.district;
          else if (d !== s.district) mixed = true;
        });
        var color = (!mixed && d && DIST[d]) ? DIST[d].color : '#1d1b16';
        var size = n < 5 ? 32 : n < 10 ? 38 : 44;
        return L.divIcon({
          className: 'cluster',
          html: '<div class="cluster__body" style="background:' + color + '"></div>' +
                '<span class="cluster__n" style="color:' + textOn(color) + '">' + n + '</span>',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    }).addTo(map);

    SITES.forEach(function (site) {
      var m = L.marker([site.lat, site.lng], {
        icon: pinIcon(site, false),
        title: site.name,
        alt: site.name,
        riseOnHover: true,
      });
      m.siteId = site.id;   // iconCreateFunction uses this to colour clusters
      m.bindPopup(popupHtml(site), {
        maxWidth: 260, minWidth: 244, closeButton: true, autoPanPadding: [30, 30],
      });
      // Leaflet opens the popup itself on click; just sync the selection state.
      m.on('click', function () {
        selectSite(site.id, { pan: false, openDetail: false, openPopup: false });
      });
      m.on('popupopen', function (e) {
        var btn = e.popup.getElement().querySelector('.pop__more');
        if (btn) btn.onclick = function () { openDetail(site.id); };
      });
      markers[site.id] = m;
    });

    map.on('click', function () { clearActivePin(); });
    fitAll(false);
  }

  /* -------------------------------------------------------------- notice */

  function notify(html) {
    if (!el.notice) return;
    el.noticeText.innerHTML = html;
    el.notice.hidden = false;
  }
  function hideNotice() { if (el.notice) el.notice.hidden = true; }

  /* ------------------------------------------------------------ basemaps */

  /* ---- 地政總署「香港地圖服務」— 本地圖唯一的底圖 ---------------------------
     公眾版端點，無須註冊、無須 API key：
       底圖　https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/{z}/{x}/{y}.png
       標註　.../xyz/label/hk/{tc|sc|en}/WGS84/{z}/{x}/{y}.png
     說明文件 https://portal.csdi.gov.hk/csdi-webpage/apilist
     底圖提供第 10–20 級；標註隨介面語言切換。
     使用條款要求在圖面上顯示地政總署標誌及版權聲明，見 landsdAttr()。        */
  var LANDSD = 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz';
  var LANDSD_TERMS = 'https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI';

  function landsdAttr() {
    var dict = T;
    return '<a href="' + LANDSD_TERMS + '" target="_blank" rel="noopener" class="landsd-credit">' +
           '<img src="assets/img/landsd-logo.png" alt="' + esc(dict.landsdLogoAlt) + '" ' +
           'width="20" height="20" class="landsd-logo">' +
           '&copy; ' + esc(dict.landsdMapNotice) + '</a>';
  }

  /* 底圖 + 地名標註兩層疊在一起。標註是語言專屬的磁磚，所以切語言時要重建。 */
  function buildBaseLayer() {
        return L.layerGroup([
      L.tileLayer(LANDSD + '/basemap/WGS84/{z}/{x}/{y}.png', {
        minZoom: 10, maxZoom: 20, maxNativeZoom: 20,
        attribution: landsdAttr(),
      }),
      L.tileLayer(LANDSD + '/label/hk/tc/WGS84/{z}/{x}/{y}.png', {
        minZoom: 10, maxZoom: 20, maxNativeZoom: 20,
      }),
    ]);
  }

  function installBaseLayer() {
    if (baseLayer && map.hasLayer(baseLayer)) map.removeLayer(baseLayer);
    // Tile layers live in Leaflet's tilePane, which already sits below the marker
    // pane — no bringToBack() here (and L.LayerGroup has no such method).
    baseLayer = buildBaseLayer().addTo(map);
  }

  /* ------------------------------------------------------------- popup */

  function popupHtml(site) {
    var color = distColor(site);
    return '' +
      '<img class="pop__img" src="' + site.image + '" alt="' + esc(site.name) + '" loading="lazy">' +
      '<div class="pop__txt">' +
        '<span class="pop__dist" style="background:' + color + ';color:' + textOn(color) + '">' +
          esc(T.dists[site.district]) + ' ' + site.dnum +
        '</span>' +
        '<h3 class="pop__name">' + esc(site.name) + '</h3>' +
        (site.subtitle ? '<p class="pop__sub">' + esc(site.subtitle) + '</p>' : '') +
        '<button type="button" class="pop__more">' + esc(T.readMore) + '</button>' +
      '</div>';
  }

  function refreshMarkers() {
    // bulk replace — much cheaper than add/remove one marker at a time on a cluster group
    markerLayer.clearLayers();
    markerLayer.addLayers(visibleSites().map(function (s) { return markers[s.id]; }));
    if (state.activeId != null) {
      var m = markers[state.activeId];
      if (m && m._icon) m._icon.classList.add('is-active');
    }
  }

  function refreshMarkerContent() {
    SITES.forEach(function (s) {
      var m = markers[s.id];
      m.setIcon(pinIcon(s, state.activeId === s.id));
      m.setPopupContent(popupHtml(s));
      if (m._icon) m._icon.title = s.name;
    });
  }

  function clearActivePin() {
    if (state.activeId == null) return;
    var m = markers[state.activeId];
    if (m && m._icon) m._icon.classList.remove('is-active');
    document.querySelectorAll('.site-item.is-active').forEach(function (n) { n.classList.remove('is-active'); });
    state.activeId = null;
  }

  function fitAll(animate) {
    var vis = visibleSites();
    var pts = (vis.length ? vis : SITES).map(function (s) { return [s.lat, s.lng]; });
    map.fitBounds(L.latLngBounds(pts).pad(0.08), { animate: !!animate, maxZoom: 15 });
  }

  /* ----------------------------------------------------- district buttons */

  function countBy(key, value) {
    return SITES.filter(function (s) {
      if (s[key] !== value) return false;
      // count under the *other* dimension's filters so numbers stay useful
      if (key !== 'category' && state.cats.size && !state.cats.has(s.category)) return false;
      if (key !== 'district' && state.dists.size && !state.dists.has(s.district)) return false;
      if (state.query && searchBlob(s).indexOf(state.query.toLowerCase()) < 0) return false;
      return true;
    }).length;
  }

  function renderDistrictBar() {
    var anySelected = state.dists.size > 0;
    var html = DISTRICT_ORDER.map(function (k) {
      var color = (DIST[k] || { color: '#777' }).color;
      var on = state.dists.has(k);
      var cls = 'dist-btn' + (on ? ' is-on' : (anySelected ? ' is-off' : ''));
      // Names only. The per-district counts stayed in the sidebar list and in the
      // "關於" legend, where there is room to read them.
      return '<button type="button" class="' + cls + '" data-dist="' + k + '"' +
             ' aria-pressed="' + on + '"' +
             ' style="background:' + color + ';color:' + textOn(color) + '">' +
             esc(T.dists[k]) + '</button>';
    }).join('');

    // an explicit "all districts" reset, shown only when a filter is active
    if (anySelected) {
      html += '<button type="button" class="dist-btn dist-btn--all" id="btnAllDistricts">' +
              esc(T.districtAll) + '</button>';
    }
    el.districtBar.innerHTML = html;
  }

  function renderCatChips() {
    el.catChips.innerHTML = CAT_ORDER.map(function (k) {
      var c = CAT[k], n = countBy('category', k);
      return '<button type="button" class="chip' + (state.cats.has(k) ? ' is-on' : '') +
             (n === 0 && !state.cats.has(k) ? ' is-empty' : '') +
             '" data-cat="' + k + '" aria-pressed="' + state.cats.has(k) + '">' +
             '<span class="chip__dot" style="background:' + c.color + '"></span>' +
             esc(T.cats[k]) + '<span class="chip__n">' + n + '</span></button>';
    }).join('');
  }

  /* ------------------------------------------------------------- list */

  function renderList() {
    var vis = visibleSites();
    el.resultCount.textContent = T.resultCount(vis.length, SITES.length);

    if (!vis.length) {
      el.list.innerHTML = '<li class="site-list__empty">' + esc(T.noResult) + '</li>';
      return;
    }

    var byDist = {};
    vis.forEach(function (s) { (byDist[s.district] = byDist[s.district] || []).push(s); });

    var html = '';
    DISTRICT_ORDER.forEach(function (d) {
      var group = byDist[d];
      if (!group || !group.length) return;
      var color = (DIST[d] || { color: '#777' }).color;
      html += '<li class="site-list__group">' +
              '<span class="site-list__swatch" style="background:' + color + '"></span>' +
              esc(T.dists[d]) + '　' + group.length + '</li>';
      group.forEach(function (s) {
        html += '<li><button type="button" class="site-item' +
                (state.activeId === s.id ? ' is-active' : '') + '" data-id="' + s.id + '">' +
                '<span class="site-item__pin" style="background:' + color + '">' + s.dnum + '</span>' +
                '<span class="site-item__txt">' +
                  '<span class="site-item__name">' + highlight(s.name, state.query) + '</span>' +
                  (s.subtitle ? '<span class="site-item__sub">' + highlight(s.subtitle, state.query) + '</span>' : '') +
                '</span></button></li>';
      });
    });
    el.list.innerHTML = html;
  }

  /* ----------------------------------------------------------- detail */

  function siteById(id) {
    for (var i = 0; i < SITES.length; i++) if (SITES[i].id === id) return SITES[i];
    return null;
  }

  function openDetail(id) {
    var site = siteById(id);
    if (!site) return;
    var color = distColor(site);

    stopSpeaking();

    el.detailImg.src = site.image;
    el.detailImg.alt = site.name;
    el.detailDistBadge.textContent = T.siteNoInDistrict(T.dists[site.district], site.dnum);
    el.detailDistBadge.style.background = color;
    el.detailDistBadge.style.color = textOn(color);
    el.detailCat.textContent = T.cats[site.category];
    el.detailTitle.textContent = site.title;
    el.detailSub.textContent = site.subtitle && site.subtitle !== site.title ? site.subtitle : '';
    el.detailText.innerHTML = site.paras.map(function (p) {
      return '<p>' + highlight(p, state.query) + '</p>';
    }).join('');
    el.detailCoords.textContent = site.lat.toFixed(6) + ', ' + site.lng.toFixed(6);
    el.btnDirections.href = 'https://www.google.com/maps/search/?api=1&query=' + site.lat + ',' + site.lng;
    el.btnSource.href = 'https://hk.waranddefence.museum/tc/web/mcd/interactive-map-' + site.id + '.html';

    el.btnSpeak.hidden = !voice.supported;
    setSpeakingUi(false);

    el.detail.classList.add('is-open');
    el.detail.setAttribute('aria-hidden', 'false');
    el.detailScroll.scrollTop = 0;

    var vis = visibleSites();
    var pos = vis.map(function (s) { return s.id; }).indexOf(site.id);
    el.btnPrev.disabled = pos <= 0;
    el.btnNext.disabled = pos < 0 || pos >= vis.length - 1;

    if (window.matchMedia('(max-width: 900px)').matches) closeSidebar();
    if (history.replaceState) history.replaceState(null, '', '#site=' + site.id);

    // master voice switch: read the site out as soon as it opens
    if (state.voice && voice.supported) speakSite(site.id);
  }

  function closeDetail() {
    stopSpeaking();
    el.detail.classList.remove('is-open');
    el.detail.setAttribute('aria-hidden', 'true');
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  }

  function stepDetail(delta) {
    var vis = visibleSites();
    var pos = vis.map(function (s) { return s.id; }).indexOf(state.activeId);
    if (pos < 0) return;
    var next = vis[pos + delta];
    if (next) selectSite(next.id, { pan: true, openDetail: true, openPopup: false });
  }

  /* ----------------------------------------------------------- select */

  function selectSite(id, opts) {
    opts = opts || {};
    var site = siteById(id);
    if (!site) return;

    clearActivePin();
    state.activeId = id;

    var m = markers[id];
    if (m) {
      if (!markerLayer.hasLayer(m)) markerLayer.addLayer(m);

      var done = false;
      function finish() {
        if (done) return;
        done = true;
        if (m._icon) m._icon.classList.add('is-active');
        if (opts.openPopup !== false) m.openPopup();
      }

      // The cluster group renders its markers asynchronously after a pan/zoom, so
      // the icon may not exist yet. Wait for it instead of guessing a delay.
      function whenRendered(tries) {
        if (done) return;
        if (m._icon || tries > 40) return finish();
        setTimeout(function () { whenRendered(tries + 1); }, 100);
      }

      if (opts.pan) {
        // Jump instantly: an animated setView races with the cluster plugin's zoom
        // handling. Crossing disableClusteringAtZoom in one step also leaves the
        // plugin holding stale bounds, so rebuild the layer for the new view.
        var z = Math.max(map.getZoom(), 15);   // past disableClusteringAtZoom
        map.setView([site.lat, site.lng], z, { animate: false });
        if (!m._icon) refreshMarkers();
        whenRendered(0);
      } else if (m._icon) {
        finish();
      } else {
        markerLayer.zoomToShowLayer(m, finish);
      }
    }

    var item = el.list.querySelector('.site-item[data-id="' + id + '"]');
    document.querySelectorAll('.site-item.is-active').forEach(function (n) { n.classList.remove('is-active'); });
    if (item) {
      item.classList.add('is-active');
      var box = item.getBoundingClientRect(), holder = el.list.getBoundingClientRect();
      if (box.top < holder.top + 30 || box.bottom > holder.bottom - 10) {
        item.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }

    if (opts.openDetail !== false) openDetail(id);
  }

  /* -------------------------------------------------------- rendering */

  function renderAll() {
    renderDistrictBar();
    renderCatChips();
    renderList();
    refreshMarkers();
  }

  // Used after a filter change: narrowing the set is only useful if you can see
  // where the remaining sites are. Not called while typing in the search box.
  function renderAllAndFit() {
    renderAll();
    fitAll(true);
  }

  /* Fills every element marked with data-i18n* from the T dictionary, so the
     strings live in one file instead of being duplicated in the HTML. */
  function applyStaticText() {
    var dict = T;
    document.title = dict.appTitle;

    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      var k = n.getAttribute('data-i18n');
      if (typeof dict[k] === 'string') n.textContent = dict[k];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (n) {
      n.placeholder = dict[n.getAttribute('data-i18n-ph')] || n.placeholder;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (n) {
      n.title = dict[n.getAttribute('data-i18n-title')] || n.title;
    });
    document.querySelectorAll('[data-i18n-label]').forEach(function (n) {
      n.setAttribute('aria-label', dict[n.getAttribute('data-i18n-label')] || '');
    });

    el.aboutBody.innerHTML = dict.about_html + districtSwatchHtml();

    el.creditLabel.textContent = dict.creditLabel;
    el.creditLink.textContent = dict.museumName;
    el.creditLink.href = 'https://hk.waranddefence.museum/tc/web/mcd/interactive-map.html';
  }

  /* The district palette is the map's legend, so spell it out in About too. */
  function districtSwatchHtml() {
    return '<h3>' + esc(T.byDistrict) + '</h3><ul class="swatches">' +
      DISTRICT_ORDER.map(function (k) {
        var color = (DIST[k] || { color: '#777' }).color;
        return '<li><i style="background:' + color + '"></i>' + esc(T.dists[k]) +
               ' <span>' + countBy('district', k) + '</span></li>';
      }).join('') + '</ul>';
  }

  /* ------------------------------------------------------- sidebar UI */

  function openSidebar() {
    el.sidebar.classList.add('is-open');
    el.btnMenu.setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    el.sidebar.classList.remove('is-open');
    el.btnMenu.setAttribute('aria-expanded', 'false');
  }

  /* ------------------------------------------------------------ init */

  function cacheEls() {
    [
      'sidebar', 'btnMenu', 'btnCloseSidebar', 'search', 'btnClearSearch',
      'catChips', 'districtBar', 'btnResetCat', 'resultCount',
      'detail', 'detailScroll', 'detailImg', 'detailDistBadge', 'detailCat',
      'detailTitle', 'detailSub', 'detailText', 'detailCoords',
      'btnDirections', 'btnSource', 'btnCloseDetail', 'btnPrev', 'btnNext',
      'btnFit', 'btnLabels', 'mapTools',
      'lightbox', 'lightboxImg', 'lightboxCap', 'btnCloseLightbox',
      'about', 'aboutBody', 'btnAbout', 'btnCloseAbout',
      'creditLabel', 'creditLink', 'notice', 'noticeText', 'btnCloseNotice',
      'voiceToggle', 'voiceWrap', 'btnSpeak', 'btnSpeakText',
    ].forEach(function (id) { el[id] = $(id); });
    el.list = $('site-list');
  }

  function wire() {
    el.btnMenu.addEventListener('click', function () {
      el.sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
    });
    el.btnCloseSidebar.addEventListener('click', closeSidebar);

    el.search.addEventListener('input', function () {
      state.query = el.search.value.trim();
      el.btnClearSearch.hidden = !state.query;
      renderAll();
    });
    el.btnClearSearch.addEventListener('click', function () {
      el.search.value = '';
      state.query = '';
      el.btnClearSearch.hidden = true;
      renderAll();
      el.search.focus();
    });

    // district bar: toggle a district, or reset with "all districts"
    el.districtBar.addEventListener('click', function (e) {
      if (e.target.closest('#btnAllDistricts')) {
        state.dists.clear();
        renderAllAndFit();
        return;
      }
      var b = e.target.closest('[data-dist]');
      if (!b) return;
      var k = b.getAttribute('data-dist');
      state.dists.has(k) ? state.dists.delete(k) : state.dists.add(k);
      renderAllAndFit();
    });

    el.catChips.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      var k = b.getAttribute('data-cat');
      state.cats.has(k) ? state.cats.delete(k) : state.cats.add(k);
      renderAllAndFit();
    });
    el.btnResetCat.addEventListener('click', function () { state.cats.clear(); renderAllAndFit(); });

    el.list.addEventListener('click', function (e) {
      var b = e.target.closest('.site-item');
      if (!b) return;
      selectSite(+b.getAttribute('data-id'), { pan: true, openDetail: true, openPopup: false });
    });

    el.btnCloseDetail.addEventListener('click', function () { closeDetail(); clearActivePin(); });
    el.btnPrev.addEventListener('click', function () { stepDetail(-1); });
    el.btnNext.addEventListener('click', function () { stepDetail(1); });

    el.btnFit.addEventListener('click', function () { fitAll(true); });
    el.btnLabels.addEventListener('click', function () {
      state.labels = !state.labels;
      document.body.classList.toggle('labels-on', state.labels);
      el.btnLabels.classList.toggle('is-on', state.labels);
      el.btnLabels.setAttribute('aria-pressed', String(state.labels));
    });

    // voice guide
    el.voiceToggle.addEventListener('change', function () {
      setVoiceEnabled(el.voiceToggle.checked);
    });
    el.btnSpeak.addEventListener('click', toggleSpeakCurrent);
    window.addEventListener('beforeunload', stopSpeaking);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopSpeaking();
    });
    if (voice.supported && window.speechSynthesis.addEventListener) {
      // voice list loads asynchronously in most browsers
      window.speechSynthesis.addEventListener('voiceschanged', function () {});
    }

    el.detailImg.addEventListener('click', function () {
      if (!el.detailImg.src) return;
      el.lightboxImg.src = el.detailImg.src;
      el.lightboxImg.alt = el.detailImg.alt;
      el.lightboxCap.textContent = el.detailTitle.textContent + '　·　' + T.photoCredit;
      el.lightbox.hidden = false;
      el.btnCloseLightbox.focus();
    });
    function closeLightbox() { el.lightbox.hidden = true; }
    el.btnCloseLightbox.addEventListener('click', closeLightbox);
    el.lightbox.addEventListener('click', function (e) { if (e.target === el.lightbox) closeLightbox(); });

    el.btnCloseNotice.addEventListener('click', hideNotice);

    el.btnAbout.addEventListener('click', function () {
      el.aboutBody.innerHTML = T.about_html + districtSwatchHtml();
      el.about.hidden = false;
      el.btnCloseAbout.focus();
    });
    el.btnCloseAbout.addEventListener('click', function () { el.about.hidden = true; });
    el.about.addEventListener('click', function (e) { if (e.target === el.about) el.about.hidden = true; });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!el.lightbox.hidden) { el.lightbox.hidden = true; return; }
        if (!el.about.hidden) { el.about.hidden = true; return; }
        if (el.detail.classList.contains('is-open')) { closeDetail(); clearActivePin(); return; }
        if (el.sidebar.classList.contains('is-open')) closeSidebar();
        return;
      }
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (!el.detail.classList.contains('is-open')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepDetail(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); stepDetail(1); }
    });

    window.addEventListener('hashchange', openFromHash);
  }

  function openFromHash() {
    var m = /#site=(\d+)/.exec(location.hash);
    if (!m) return;
    var id = +m[1];
    if (markers[id]) selectSite(id, { pan: true, openDetail: true, openPopup: false });
  }

  function init() {
    if (!SITES.length) {
      document.body.insertAdjacentHTML('afterbegin',
        '<p style="padding:20px;font-family:sans-serif">資料檔案未能載入（assets/data/sites.js）。</p>');
      return;
    }

    assignDistrictNumbers();
    cacheEls();

    // restore the voice switch before anything can open a site
    var savedVoice = '0';
    try { savedVoice = localStorage.getItem(VOICE_KEY) || '0'; } catch (e) {}
    state.voice = savedVoice === '1';
    el.voiceToggle.checked = state.voice;
    if (!voice.supported) {
      el.voiceToggle.disabled = true;
      el.voiceWrap.classList.add('is-disabled');
      el.voiceWrap.title = T.voiceUnsupported;
    }
    el.btnSpeak.hidden = !voice.supported;

    applyStaticText();
    buildMap();
    renderAll();
    wire();
    openFromHash();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
