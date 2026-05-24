/* ═══════════════════════════════════════════════════════════════════
   SEARCH.JS – Paroles viewer with Fuse.js fuzzy search
   ═══════════════════════════════════════════════════════════════════ */

(async function () {
  /* ── STATE ──────────────────────────────────────────────────────── */
  let songsData = [];
  let albumsData = [];
  let currentSong = null;
  let activeFuse = null;  // fuzzy search within the active song
  let globalFuse = null;  // fuzzy search across all songs

  /* ── DOM ────────────────────────────────────────────────────────── */
  const sidebarAlbums     = document.getElementById('sidebar-albums');
  const songHeadContainer = document.getElementById('song-head-container');
  const lyricsContainer   = document.getElementById('lyrics-container');
  const annotPanel        = document.getElementById('annot-panel');
  const annotContent      = document.getElementById('annot-content');
  const searchInput       = document.getElementById('search-input');
  const searchClear       = document.getElementById('search-clear');

  /* ── MOBILE DOM ─────────────────────────────────────────────────── */
  const mobileMenuBtn       = document.getElementById('mobile-menu-btn');
  const mobileSearchBtn     = document.getElementById('mobile-search-btn');
  const mobileDrawerEl      = document.getElementById('mobile-drawer');
  const mobileDrawerClose   = document.getElementById('mobile-drawer-close');
  const mobileDrawerContent = document.getElementById('mobile-drawer-content');
  const mobileSearchInput   = document.getElementById('mobile-search-input');
  const mobileProjectsCount = document.getElementById('mobile-projects-count');
  const mobileBackdrop      = document.getElementById('mobile-backdrop');
  const mobileSheet         = document.getElementById('mobile-sheet');
  const mobileSheetClose    = document.getElementById('mobile-sheet-close');
  const sheetNum            = document.getElementById('sheet-num');
  const sheetLine           = document.getElementById('sheet-line');
  const sheetQuote          = document.getElementById('sheet-quote');
  const sheetTitle          = document.getElementById('sheet-title');
  const sheetTags           = document.getElementById('sheet-tags');
  const sheetBody           = document.getElementById('sheet-body');

  /* ── UTILS ──────────────────────────────────────────────────────── */
  const isMobile = () => window.innerWidth <= 768;

  function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  /* ── LOAD DATA ──────────────────────────────────────────────────── */
  async function loadData() {
    const [lyrics, albums] = await Promise.all([
      fetch('./data/lyrics.json').then(r => r.json()),
      fetch('./data/albums.json').then(r => r.json())
    ]);
    return { lyrics, albums };
  }

  /* ── ENRICH SONGS WITH ALBUM DATA ───────────────────────────────── */
  function enrichSongsWithAlbums(songs, albums) {
    const map = {};
    albums.forEach(a => { map[a.id] = a; });
    return songs.map(song => {
      const album = map[song.albumId] || {};
      return {
        ...song,
        albumTitle:  album.title    || song.title,
        albumType:   album.type     || 'Single',
        albumYear:   album.year     || song.year,
        coverImage:  album.coverImage || '',
        spotifyUrl:  album.spotifyUrl || '',
        albumOrder:  album.order    ?? 999,
        isNew:       album.isNew    || false
      };
    });
  }

  /* ── SIDEBAR HELPERS ────────────────────────────────────────────── */
  const HUES = [200, 24, 332, 12, 160, 280, 48, 240];

  function glyphText(title) {
    const words = title.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  // albums.json paths are ../assets/img/... (relative to data/), fix for root HTML
  function fixImgPath(path) {
    return path ? path.replace(/^\.\.\//, '') : '';
  }

  /* ── BUILD ALBUM LIST (shared by sidebar + mobile drawer) ──────── */
  function buildAlbumList(songs, albums, container, onSongClick) {
    const sorted = [...albums].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    container.innerHTML = '';
    let count = 0;

    sorted.forEach((album, idx) => {
      const albumSongs = songs.filter(s => s.albumId === album.id);
      if (!albumSongs.length) return;
      count++;

      const hue   = HUES[idx % HUES.length];
      const group = document.createElement('div');
      group.className = 'album-group';
      group.dataset.albumId = album.id;

      const head  = document.createElement('div');
      head.className = 'album-group__head';

      const glyph = document.createElement('div');
      glyph.className = 'album-glyph';
      glyph.style.background = `oklch(0.55 0.12 ${hue})`;
      glyph.setAttribute('aria-hidden', 'true');

      if (album.coverImage) {
        const img = document.createElement('img');
        img.src     = fixImgPath(album.coverImage);
        img.alt     = '';
        img.loading = 'lazy';
        glyph.appendChild(img);
      } else {
        glyph.textContent = glyphText(album.title);
      }

      const headMeta  = document.createElement('div');
      const titleEl   = document.createElement('p');
      titleEl.className   = 'album-group__title';
      titleEl.textContent = album.title;
      const metaEl    = document.createElement('p');
      metaEl.className    = 'album-group__meta';
      metaEl.textContent  = `${(album.type || 'Single').toUpperCase()} · ${album.year}`;
      headMeta.append(titleEl, metaEl);
      head.append(glyph, headMeta);

      const ul = document.createElement('ul');
      ul.className = 'track-list';
      albumSongs.forEach(song => {
        const li   = document.createElement('li');
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

  /* ── BUILD SIDEBAR ──────────────────────────────────────────────── */
  function buildSidebar(songs, albums) {
    buildAlbumList(songs, albums, sidebarAlbums, id => loadSong(id));
  }

  /* ── BUILD MOBILE DRAWER ────────────────────────────────────────── */
  function buildMobileDrawer(songs, albums) {
    const count = buildAlbumList(songs, albums, mobileDrawerContent, id => {
      loadSong(id);
      closeDrawer();
    });
    if (mobileProjectsCount) mobileProjectsCount.textContent = count;
  }

  function updateSidebarActive(songId) {
    document.querySelectorAll('.track-list li').forEach(li => {
      li.classList.toggle('is-current', li.dataset.songId === songId);
    });
  }

  /* ── RENDER SONG HEADER ─────────────────────────────────────────── */
  function renderSongHead(song) {
    const src      = fixImgPath(song.coverImage);
    const hasCover = !!src;
    const year     = song.albumYear || song.year;

    songHeadContainer.innerHTML = `
      <header class="song-head">
        <div class="cover${hasCover ? ' cover--has-img' : ''}" aria-hidden="true">
          ${hasCover
            ? `<img src="${src}" alt="${song.albumTitle} cover" loading="lazy">`
            : `<span class="cover__letter">${song.title[0]}</span>`}
        </div>
        <div class="song-info">
          <div class="song-info__top">
            <span class="song-eyebrow">SMS · ${song.title.toUpperCase()} (${year})</span>
            ${song.spotifyUrl ? `
            <a class="listen-btn listen-btn--spotify"
               href="${song.spotifyUrl}"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Écouter sur Spotify (ouvre dans un nouvel onglet)">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Écouter sur Spotify
            </a>` : ''}
          </div>
          <h1 class="song-title"><em>${song.title}</em><span class="dot">.</span></h1>
          <div class="song-meta">
            <span><strong>${year}</strong></span>
            <span class="sep">◆</span>
            <span>${song.albumType}</span>
            <span class="sep">◆</span>
            <span>${song.lyrics.length} lignes</span>
          </div>
        </div>
      </header>`;
  }

  /* ── RENDER LYRICS ──────────────────────────────────────────────── */
  function renderLyrics(song) {
    // Build lineNumber → primary-ref map
    const lineRefMap  = new Map();
    const refIndexMap = new Map();

    (song.references || []).forEach((ref, idx) => {
      refIndexMap.set(ref.id, idx + 1);
      ref.lineNumbers.forEach(ln => {
        if (!lineRefMap.has(ln)) lineRefMap.set(ln, ref);
      });
    });

    lyricsContainer.innerHTML = '';

    const STANZA_SIZE = 6;
    let stanzaEl = document.createElement('div');
    stanzaEl.className = 'stanza';

    song.lyrics.forEach((lyric, idx) => {
      if (idx > 0 && idx % STANZA_SIZE === 0) {
        lyricsContainer.appendChild(stanzaEl);
        stanzaEl = document.createElement('div');
        stanzaEl.className = 'stanza';
      }

      const p = document.createElement('p');
      p.dataset.line = lyric.line;

      const ref = lineRefMap.get(lyric.line);
      if (ref) {
        const annSpan = document.createElement('span');
        annSpan.className   = 'line-ann';
        annSpan.textContent = lyric.text;
        annSpan.dataset.refId = ref.id;

        const supSpan = document.createElement('span');
        supSpan.className = 'ann-sup';
        supSpan.setAttribute('aria-hidden', 'true');
        supSpan.textContent = refIndexMap.get(ref.id);

        const openAnnotation = () => showAnnotation(song, ref.id);
        annSpan.addEventListener('click', openAnnotation);
        supSpan.addEventListener('click', openAnnotation);

        p.append(annSpan, supSpan);
      } else {
        p.textContent = lyric.text;
      }

      stanzaEl.appendChild(p);
    });

    lyricsContainer.appendChild(stanzaEl);
  }

  /* ── SHOW ANNOTATION ────────────────────────────────────────────── */
  function showAnnotation(song, refId) {
    const ref = (song.references || []).find(r => r.id === refId);
    if (!ref) return;

    const refIdx = song.references.indexOf(ref) + 1;
    const title  = (ref.keywords || []).slice(0, 2).join(' · ') || ref.excerpt.slice(0, 40);

    // Highlight active lyric span
    document.querySelectorAll('.line-ann').forEach(el => {
      el.classList.toggle('is-active', el.dataset.refId === refId);
    });

    if (isMobile()) {
      // Fill bottom sheet
      sheetNum.textContent   = String(refIdx);
      sheetLine.textContent  = ref.lineNumbers?.[0] ?? '—';
      sheetQuote.textContent = `« ${ref.excerpt} »`;
      sheetTitle.textContent = title;
      sheetTags.innerHTML    = (ref.keywords || []).slice(0, 6)
        .map(k => `<span class="tag">${k}</span>`).join('');
      sheetBody.innerHTML    = ref.explanation || '';

      // Highlight the tapped lyric paragraph
      document.querySelectorAll('.lyrics p.is-sheet-active')
        .forEach(el => el.classList.remove('is-sheet-active'));
      const activePara = document.querySelector(`.line-ann[data-ref-id="${refId}"]`)?.closest('p');
      if (activePara) activePara.classList.add('is-sheet-active');

      openSheet();
      mobileSheet.scrollTop = 0;
    } else {
      // Desktop: right panel
      const tagsHtml = (ref.keywords || []).slice(0, 6)
        .map(k => `<span class="tag">${k}</span>`).join('');

      annotContent.innerHTML = `
        <div class="annot__head">
          <div class="annot__num">${refIdx}</div>
          <div class="annot__label"><strong>ANNOTATION</strong></div>
        </div>
        <blockquote class="annot__quote">« ${ref.excerpt} »</blockquote>
        <h2 class="annot__title">${title}</h2>
        <div class="tags">${tagsHtml}</div>
        <p class="annot__body">${ref.explanation}</p>`;

      document.querySelector('.page').classList.add('has-annotation');
      annotPanel.scrollTop = 0;
    }
  }

  /* ── SHOW PLACEHOLDER (collapses the right column) ──────────────── */
  function showAnnotPlaceholder() {
    document.querySelector('.page').classList.remove('has-annotation');
    document.querySelectorAll('.line-ann').forEach(el => el.classList.remove('is-active'));
  }

  /* ── LOAD SONG ──────────────────────────────────────────────────── */
  function loadSong(songId) {
    const song = songsData.find(s => s.id === songId);
    if (!song) return;

    currentSong = song;
    localStorage.setItem('genie-last-song', songId);

    // Update URL without reload
    const url = new URL(window.location.href);
    url.searchParams.set('song', songId);
    history.pushState({}, '', url.toString());

    updateSidebarActive(songId);
    renderSongHead(song);
    renderLyrics(song);
    showAnnotPlaceholder();

    // Init per-song Fuse on lyric lines
    activeFuse = new Fuse(song.lyrics, {
      keys: [{ name: 'text', weight: 1 }],
      threshold: 0.35,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true
    });

    // Re-apply search highlight if query is active
    const q = searchInput.value.trim();
    if (q.length >= 2) handleSearch(q);
  }

  /* ── INIT GLOBAL FUSE ───────────────────────────────────────────── */
  function initGlobalFuse(songs) {
    const items = [];
    songs.forEach(song => {
      song.lyrics.forEach(lyric => {
        items.push({ type: 'lyric', songId: song.id, text: lyric.text, line: lyric.line });
      });
      (song.references || []).forEach(ref => {
        items.push({ type: 'reference', songId: song.id, text: ref.excerpt, explanation: ref.explanation, keywords: ref.keywords });
      });
    });

    return new Fuse(items, {
      keys: [
        { name: 'text',        weight: 2   },
        { name: 'explanation', weight: 1.5 },
        { name: 'keywords',    weight: 2.5 }
      ],
      threshold: 0.3,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true
    });
  }

  /* ── SEARCH: HIGHLIGHT IN-SONG ──────────────────────────────────── */
  function highlightLyricLines(fuseResults) {
    const matched = new Set(fuseResults.map(r => String(r.item.line)));
    document.querySelectorAll('#lyrics-container p[data-line]').forEach(p => {
      const hit = matched.has(p.dataset.line);
      p.classList.toggle('is-match',  hit);
      p.classList.toggle('is-dimmed', !hit);
    });
  }

  function clearHighlights() {
    document.querySelectorAll('#lyrics-container p').forEach(p => {
      p.classList.remove('is-match', 'is-dimmed');
    });
  }

  /* ── SEARCH: FILTER SIDEBAR ─────────────────────────────────────── */
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

  /* ── SEARCH HANDLER ─────────────────────────────────────────────── */
  function handleSearch(query) {
    const q = query.trim();

    if (q.length < 2) {
      clearHighlights();
      restoreAllTracks();
      return;
    }

    // 1. Search within active song first
    if (activeFuse && currentSong) {
      const inSongResults = activeFuse.search(q);
      if (inSongResults.length > 0) {
        highlightLyricLines(inSongResults);
        restoreAllTracks();
        return;
      }
    }

    // 2. No in-song matches → search globally, filter sidebar
    clearHighlights();
    const globalResults  = globalFuse.search(q).slice(0, 50);
    const matchingSongIds = [...new Set(globalResults.map(r => r.item.songId))];

    if (matchingSongIds.length === 0) {
      document.querySelectorAll('.track-list li').forEach(li => li.classList.add('is-hidden'));
      document.querySelectorAll('.album-group').forEach(g => { g.style.display = 'none'; });
      return;
    }

    filterSidebar(matchingSongIds);

    // Auto-select first matched song if it differs from current
    if (matchingSongIds[0] !== currentSong?.id) {
      loadSong(matchingSongIds[0]);
    }
  }

  /* ── MOBILE DRAWER ──────────────────────────────────────────────── */
  function openDrawer(focusSearch = false) {
    mobileDrawerEl.classList.add('is-open');
    mobileDrawerEl.setAttribute('aria-hidden', 'false');
    mobileBackdrop.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
    if (focusSearch) {
      setTimeout(() => mobileSearchInput?.focus(), 320);
    }
  }

  function closeDrawer() {
    mobileDrawerEl.classList.remove('is-open');
    mobileDrawerEl.setAttribute('aria-hidden', 'true');
    if (!mobileSheet.classList.contains('is-open')) {
      mobileBackdrop.classList.remove('is-visible');
      document.body.style.overflow = '';
    }
  }

  /* ── MOBILE BOTTOM SHEET ────────────────────────────────────────── */
  function openSheet() {
    mobileSheet.classList.add('is-open');
    mobileSheet.setAttribute('aria-hidden', 'false');
    mobileBackdrop.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    mobileSheet.classList.remove('is-open');
    mobileSheet.setAttribute('aria-hidden', 'true');
    if (!mobileDrawerEl.classList.contains('is-open')) {
      mobileBackdrop.classList.remove('is-visible');
      document.body.style.overflow = '';
    }
    document.querySelectorAll('.lyrics p.is-sheet-active')
      .forEach(el => el.classList.remove('is-sheet-active'));
    document.querySelectorAll('.line-ann')
      .forEach(el => el.classList.remove('is-active'));
  }

  /* Touch swipe-down to close the bottom sheet */
  let _swipeStartY = 0;
  let _swipeDelta  = 0;

  mobileSheet.addEventListener('touchstart', e => {
    _swipeStartY = e.touches[0].clientY;
    _swipeDelta  = 0;
  }, { passive: true });

  mobileSheet.addEventListener('touchmove', e => {
    _swipeDelta = e.touches[0].clientY - _swipeStartY;
    if (_swipeDelta > 0) {
      mobileSheet.style.transition = 'none';
      mobileSheet.style.transform  = `translateY(${_swipeDelta}px)`;
    }
  }, { passive: true });

  mobileSheet.addEventListener('touchend', () => {
    mobileSheet.style.transition = '';
    mobileSheet.style.transform  = '';
    if (_swipeDelta > 80) closeSheet();
    _swipeDelta = 0;
  });

  /* ── INIT ────────────────────────────────────────────────────────── */
  try {
    const data  = await loadData();
    albumsData  = data.albums;
    songsData   = enrichSongsWithAlbums(data.lyrics.songs, data.albums);

    buildSidebar(songsData, albumsData);
    buildMobileDrawer(songsData, albumsData);
    globalFuse = initGlobalFuse(songsData);

    // Determine initial song: URL param → localStorage → first by order
    const params      = new URLSearchParams(window.location.search);
    const paramSong   = params.get('song');
    const lastSongId  = localStorage.getItem('genie-last-song');
    const sorted      = [...songsData].sort((a, b) => a.albumOrder - b.albumOrder);
    const initialId   = (paramSong   && songsData.find(s => s.id === paramSong))   ? paramSong
                      : (lastSongId  && songsData.find(s => s.id === lastSongId))  ? lastSongId
                      : sorted[0]?.id;

    if (initialId) loadSong(initialId);

    // ── Search input events ──
    const debouncedSearch = debounce(handleSearch, 300);

    searchInput.addEventListener('input', e => {
      const q = e.target.value;
      searchClear.style.display = q.length > 0 ? 'grid' : 'none';
      debouncedSearch(q);
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchClear.style.display = 'none';
        clearHighlights();
        restoreAllTracks();
      }
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      searchInput.focus();
      clearHighlights();
      restoreAllTracks();
    });

    // ── Mobile button events ──
    mobileMenuBtn?.addEventListener('click', () => openDrawer(false));
    mobileSearchBtn?.addEventListener('click', () => openDrawer(true));
    mobileDrawerClose?.addEventListener('click', closeDrawer);
    mobileSheetClose?.addEventListener('click', closeSheet);
    mobileBackdrop?.addEventListener('click', () => { closeDrawer(); closeSheet(); });

    // Mobile search input
    mobileSearchInput?.addEventListener('input', e => {
      debouncedSearch(e.target.value);
    });
    mobileSearchInput?.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        mobileSearchInput.value = '';
        clearHighlights();
        restoreAllTracks();
      }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      const id = new URLSearchParams(window.location.search).get('song');
      if (id && id !== currentSong?.id) loadSong(id);
    });

  } catch (err) {
    console.error('Failed to initialize paroles:', err);
    lyricsContainer.innerHTML = '<p style="padding:40px 0;color:#8b97a8;font-family:monospace;">Erreur de chargement. Veuillez réactualiser la page.</p>';
  }
})();
