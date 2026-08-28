/* ═══════════════════════════════════════════════════════════════════
   SEARCH.JS – Coordinator for the paroles viewer.
   Loads data, builds the album sidebar/drawer, wires search + nav,
   delegates rendering to lyrics-renderer and DOM lifecycle to mobile-drawer.
   ═══════════════════════════════════════════════════════════════════ */

(async function () {
  const Utils = window.SMSUtils;
  const Engine = window.SMSSearchEngine;
  const Lyrics = window.SMSLyricsRenderer;

  /* ── STATE ──────────────────────────────────────────────────────── */
  let songsData = [];
  let currentSong = null;
  let activeFuse = null;   // per-song Fuse
  let globalFuse = null;   // cross-song Fuse

  /* ── DOM ────────────────────────────────────────────────────────── */
  const sidebarAlbums = document.getElementById('sidebar-albums');
  const songHeadContainer = document.getElementById('song-head-container');
  const lyricsContainer = document.getElementById('lyrics-container');
  const annotPanel = document.getElementById('annot-panel');
  const annotContent = document.getElementById('annot-content');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  /* ── MOBILE DOM ─────────────────────────────────────────────────── */
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileSearchBtn = document.getElementById('mobile-search-btn');
  const mobileDrawerEl = document.getElementById('mobile-drawer');
  const mobileDrawerContent = document.getElementById('mobile-drawer-content');
  const mobileSearchInput = document.getElementById('mobile-search-input');
  const mobileProjectsCount = document.getElementById('mobile-projects-count');

  const sheetPrev = document.getElementById('sheet-prev');
  const sheetNext = document.getElementById('sheet-next');
  const sheetCount = document.getElementById('sheet-count');

  const sheetRefs = {
    sheetNum: document.getElementById('sheet-num'),
    sheetLine: document.getElementById('sheet-line'),
    sheetQuote: document.getElementById('sheet-quote'),
    sheetTitle: document.getElementById('sheet-title'),
    sheetTags: document.getElementById('sheet-tags'),
    sheetBody: document.getElementById('sheet-body')
  };

  const drawer = window.SMSMobileDrawer.create({
    drawer: mobileDrawerEl,
    drawerClose: document.getElementById('mobile-drawer-close'),
    drawerSearchInput: mobileSearchInput,
    sheet: document.getElementById('mobile-sheet'),
    sheetClose: document.getElementById('mobile-sheet-close'),
    backdrop: document.getElementById('mobile-backdrop')
  });

  /* ── ENRICH SONGS WITH ALBUM DATA ───────────────────────────────── */
  function enrichSongsWithAlbums(songs, albums) {
    const map = {};
    albums.forEach(a => { map[a.id] = a; });
    return songs.map(song => {
      const album = map[song.albumId] || {};
      return {
        ...song,
        albumTitle: album.title || song.title,
        albumType: album.type || 'Single',
        albumYear: album.year || song.year,
        coverImage: album.coverImage || '',
        spotifyUrl: album.spotifyUrl || '',
        albumOrder: album.order ?? 999,
        isNew: album.isNew || false
      };
    });
  }

  /* ── SIDEBAR / DRAWER BUILDERS ──────────────────────────────────── */
  const HUES = [200, 24, 332, 12, 160, 280, 48, 240];

  function buildAlbumList(songs, albums, container, onSongClick) {
    const sorted = [...albums].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    container.innerHTML = '';
    let count = 0;

    sorted.forEach((album, idx) => {
      const albumSongs = songs.filter(s => s.albumId === album.id);
      if (!albumSongs.length) return;
      count++;

      const hue = HUES[idx % HUES.length];
      const group = document.createElement('div');
      group.className = 'album-group';
      group.dataset.albumId = album.id;

      const head = document.createElement('div');
      head.className = 'album-group__head';

      const glyph = document.createElement('div');
      glyph.className = 'album-glyph';
      glyph.style.background = `oklch(0.55 0.12 ${hue})`;
      glyph.setAttribute('aria-hidden', 'true');

      if (album.coverImage) {
        const img = document.createElement('img');
        img.src = Utils.fixImgPath(album.coverImage);
        img.alt = '';
        img.loading = 'lazy';
        glyph.appendChild(img);
      } else {
        glyph.textContent = Utils.glyphText(album.title);
      }

      const headMeta = document.createElement('div');
      const titleEl = document.createElement('p');
      titleEl.className = 'album-group__title';
      titleEl.textContent = album.title;
      const metaEl = document.createElement('p');
      metaEl.className = 'album-group__meta';
      metaEl.textContent = `${(album.type || 'Single').toUpperCase()} · ${album.year}`;
      headMeta.append(titleEl, metaEl);
      head.append(glyph, headMeta);

      const ul = document.createElement('ul');
      ul.className = 'track-list';
      albumSongs.forEach(song => {
        const li = document.createElement('li');
        li.dataset.songId = song.id;
        const name = document.createElement('span');
        name.textContent = song.title;
        li.appendChild(name);
        li.addEventListener('click', () => onSongClick(song.id));
        ul.appendChild(li);
      });

      group.append(head, ul);
      container.appendChild(group);
    });

    return count;
  }

  function updateSidebarActive(songId) {
    document.querySelectorAll('.track-list li').forEach(li => {
      li.classList.toggle('is-current', li.dataset.songId === songId);
    });
  }

  /* ── SIDEBAR FILTER ─────────────────────────────────────────────── */
  function filterSidebar(songIds) {
    const set = new Set(songIds);
    document.querySelectorAll('.track-list li').forEach(li => {
      li.classList.toggle('is-hidden', !set.has(li.dataset.songId));
    });
    document.querySelectorAll('.album-group').forEach(group => {
      const visible = group.querySelectorAll('.track-list li:not(.is-hidden)').length;
      group.style.display = visible === 0 ? 'none' : '';
    });
  }

  function restoreAllTracks() {
    document.querySelectorAll('.track-list li').forEach(li => li.classList.remove('is-hidden'));
    document.querySelectorAll('.album-group').forEach(g => { g.style.display = ''; });
  }

  function hideAllTracks() {
    document.querySelectorAll('.track-list li').forEach(li => li.classList.add('is-hidden'));
    document.querySelectorAll('.album-group').forEach(g => { g.style.display = 'none'; });
  }

  /* ── ANNOTATION ─────────────────────────────────────────────────── */
  /**
   * Barre « précédente / suivante » de la feuille mobile. Sur un morceau
   * qui compte trente références, enchaîner les annotations demandait de
   * refermer la feuille et de retrouver la pastille suivante à l'œil.
   */
  function updateSheetNav(song, refIdx) {
    if (!sheetCount || !sheetPrev || !sheetNext) return;
    const refs = song.references || [];
    sheetCount.textContent = `${refIdx} / ${refs.length}`;
    sheetPrev.disabled = refIdx <= 1;
    sheetNext.disabled = refIdx >= refs.length;
    // Affectation directe plutôt qu'addEventListener : la feuille est
    // réutilisée pour chaque annotation, les écouteurs s'empileraient.
    sheetPrev.onclick = () => showAnnotation(song, refs[refIdx - 2].id);
    sheetNext.onclick = () => showAnnotation(song, refs[refIdx].id);
  }

  function showAnnotation(song, refId, initial = false) {
    const ref = (song.references || []).find(r => r.id === refId);
    if (!ref) return;

    const refIdx = song.references.indexOf(ref) + 1;
    Lyrics.markAnnotationActive(refId);

    if (Utils.isMobile()) {
      Lyrics.renderAnnotationSheet(sheetRefs, ref, refIdx);
      Lyrics.highlightActivePara(refId);
      updateSheetNav(song, refIdx);
      drawer.openSheet();
      document.querySelector('.mobile-sheet__body').scrollTop = 0;
    } else {
      Lyrics.renderAnnotationDesktop(annotContent, song, ref, refIdx);
      document.querySelector('.page').classList.add('has-annotation');
      annotPanel.scrollTop = 0;
    }

    scrollToAnnotatedLine(refId, initial);
  }

  /* Amène la ligne annotée dans la vue (clic ou deep-link #ref=…). */
  function scrollToAnnotatedLine(refId, initial = false) {
    const sel = `#lyrics-container .line-ann[data-ref-id="${CSS.escape(refId)}"]`;

    const doScroll = behavior => {
      const para = document.querySelector(sel)?.closest('p');
      if (para) para.scrollIntoView({ behavior, block: 'center' });
    };

    // Tentative animée une fois le layout initial posé (2 rAF).
    requestAnimationFrame(() => requestAnimationFrame(() => doScroll('smooth')));

    // Sur un deep-link (chargement à froid), les polices web et la pochette se chargent
    // après coup et décalent la mise en page, ce qui annule / fausse le smooth-scroll.
    // On recale donc, sans animation, une fois la page chargée puis peu après.
    if (initial) {
      const recale = () => requestAnimationFrame(() => doScroll('auto'));
      if (document.readyState === 'complete') recale();
      else window.addEventListener('load', recale, { once: true });
      setTimeout(() => doScroll('auto'), 300);
      setTimeout(() => doScroll('auto'), 700);
    }
  }

  function showAnnotPlaceholder() {
    document.querySelector('.page').classList.remove('has-annotation');
    Lyrics.clearAnnotationActive();
  }

  /* ── LOAD SONG ──────────────────────────────────────────────────── */
  function loadSong(songId) {
    const song = songsData.find(s => s.id === songId);
    if (!song) return;

    currentSong = song;
    localStorage.setItem('genie-last-song', songId);

    const url = new URL(window.location.href);
    url.searchParams.set('song', songId);
    history.pushState({}, '', url.toString());

    updateSidebarActive(songId);
    Lyrics.renderSongHead(songHeadContainer, song);
    Lyrics.renderLyrics(lyricsContainer, song, refId => showAnnotation(song, refId));
    showAnnotPlaceholder();

    activeFuse = Engine.buildInSongFuse(song);

    const q = searchInput.value.trim();
    if (q.length >= 2) handleSearch(q);
  }

  /* ── SEARCH HANDLER ─────────────────────────────────────────────── */
  function handleSearch(query) {
    const q = query.trim();

    if (q.length < 2) {
      Lyrics.clearHighlights();
      restoreAllTracks();
      return;
    }

    const { songIds } = Engine.searchGlobal(globalFuse, q);

    if (songIds.length === 0) {
      Lyrics.clearHighlights();
      hideAllTracks();
      return;
    }

    filterSidebar(songIds);

    if (activeFuse && currentSong) {
      const { results, lineSet } = Engine.searchInSong(activeFuse, q);
      if (results.length > 0) {
        Lyrics.highlightLyricLines(lineSet);
        return;
      }
    }

    // No in-song match → auto-navigate to first globally matched song,
    // unless the current song is already in the result set.
    Lyrics.clearHighlights();
    if (!songIds.includes(currentSong?.id)) {
      loadSong(songIds[0]);
    }
  }

  /* ── INIT ────────────────────────────────────────────────────────── */
  try {
    const [lyrics, albumsData] = await Utils.loadJSON('./data/lyrics.json', './data/albums.json');
    const albums = albumsData.albums;
    songsData = enrichSongsWithAlbums(lyrics.songs, albums);

    buildAlbumList(songsData, albums, sidebarAlbums, id => loadSong(id));
    const drawerCount = buildAlbumList(songsData, albums, mobileDrawerContent, id => {
      loadSong(id);
      drawer.closeDrawer();
    });
    if (mobileProjectsCount) mobileProjectsCount.textContent = drawerCount;

    globalFuse = Engine.buildGlobalFuse(songsData);

    // Determine initial song:
    // Hash (#song=X) takes absolute priority — hashes survive server redirects unlike query params.
    // Falls back to query param (?song=X), then localStorage, then first song.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const queryParams = new URLSearchParams(window.location.search);
    const hashSong = hashParams.get('song');
    const querySong = queryParams.get('song');
    const paramSong = hashSong || querySong;
    // Deep-link vers une annotation précise (ex. depuis la « Quote of the Day »).
    const paramRef = hashParams.get('ref') || queryParams.get('ref');
    const lastSongId = localStorage.getItem('genie-last-song');
    const sorted = [...songsData].sort((a, b) => a.albumOrder - b.albumOrder);
    const initialId = paramSong
      ? (songsData.find(s => s.id === paramSong)?.id ?? sorted[0]?.id)
      : (lastSongId && songsData.find(s => s.id === lastSongId) ? lastSongId : sorted[0]?.id);

    // Clean the hash from the URL without triggering a reload
    if (hashSong) history.replaceState({}, '', window.location.pathname + window.location.search);

    if (initialId) loadSong(initialId);

    // Ouvrir l'annotation ciblée une fois la chanson chargée.
    if (paramRef && currentSong && (currentSong.references || []).some(r => r.id === paramRef)) {
      showAnnotation(currentSong, paramRef, true);
    }

    /* ── Search input events ── */
    const debouncedSearch = Utils.debounce(handleSearch, 300);

    searchInput.addEventListener('input', e => {
      const q = e.target.value;
      searchClear.style.display = q.length > 0 ? 'grid' : 'none';
      debouncedSearch(q);
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchClear.style.display = 'none';
        Lyrics.clearHighlights();
        restoreAllTracks();
      }
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      searchInput.focus();
      Lyrics.clearHighlights();
      restoreAllTracks();
    });

    /* ── Annotation panel close (tablet) ── */
    document.getElementById('annot-close')?.addEventListener('click', showAnnotPlaceholder);

    document.addEventListener('click', e => {
      if (Utils.isTablet() && document.querySelector('.page').classList.contains('has-annotation')) {
        if (!annotPanel.contains(e.target)) showAnnotPlaceholder();
      }
    });

    /* ── Mobile drawer + sheet wiring ── */
    // À l'ouverture du catalogue, on amène la piste en cours dans la vue :
    // avec 22 titres répartis en albums, on ne sait pas où l'on est.
    function revealCurrentTrack() {
        const li = mobileDrawerContent?.querySelector('.track-list li.is-current');
        if (li) li.scrollIntoView({ block: 'center' });
    }

    mobileMenuBtn?.addEventListener('click', () => {
        drawer.openDrawer(false);
        revealCurrentTrack();
    });
    mobileSearchBtn?.addEventListener('click', () => drawer.openDrawer(true));
    drawer.bindEvents({
      onSheetClose: () => {
        Lyrics.clearActivePara();
        Lyrics.clearAnnotationActive();
      }
    });

    mobileSearchInput?.addEventListener('input', e => debouncedSearch(e.target.value));
    mobileSearchInput?.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        mobileSearchInput.value = '';
        Lyrics.clearHighlights();
        restoreAllTracks();
        return;
      }
      // La recherche surligne les vers dans les paroles, qui sont cachées
      // derrière le tiroir : valider referme le tiroir sur le résultat.
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch(mobileSearchInput.value);
        mobileSearchInput.blur();
        drawer.closeDrawer();
      }
    });

    /* ── Browser back/forward ── */
    window.addEventListener('popstate', () => {
      const id = new URLSearchParams(window.location.search).get('song');
      if (id && id !== currentSong?.id) loadSong(id);
    });

  } catch (err) {
    console.error('Failed to initialize paroles:', err);
    lyricsContainer.innerHTML = '<p style="padding:40px 0;color:#8b97a8;font-family:monospace;">Erreur de chargement. Veuillez réactualiser la page.</p>';
  }
})();
