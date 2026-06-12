/* ═══════════════════════════════════════════════════════════════════
   LYRICS-RENDERER.JS – DOM construction for song head, lyrics,
   annotation panel and mobile sheet content. No data fetching, no Fuse.
   Exposed on window.SMSLyricsRenderer.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  const { fixImgPath, isMobile } = window.SMSUtils;

  const STANZA_SIZE = 6;

  function renderSongHead(container, song) {
    const src = fixImgPath(song.coverImage);
    const hasCover = !!src;
    const year = song.albumYear || song.year;

    container.innerHTML = `
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

  /**
   * Render lyrics into `container`. Calls `onAnnotationClick(refId)` when the
   * user taps an annotated lyric line.
   */
  function renderLyrics(container, song, onAnnotationClick) {
    const lineRefMap = new Map();
    const refIndexMap = new Map();

    (song.references || []).forEach((ref, idx) => {
      refIndexMap.set(ref.id, idx + 1);
      ref.lineNumbers.forEach(ln => {
        if (!lineRefMap.has(ln)) lineRefMap.set(ln, ref);
      });
    });

    container.innerHTML = '';

    let stanzaEl = document.createElement('div');
    stanzaEl.className = 'stanza';

    song.lyrics.forEach((lyric, idx) => {
      if (idx > 0 && idx % STANZA_SIZE === 0) {
        container.appendChild(stanzaEl);
        stanzaEl = document.createElement('div');
        stanzaEl.className = 'stanza';
      }

      const p = document.createElement('p');
      p.dataset.line = lyric.line;

      const ref = lineRefMap.get(lyric.line);
      if (ref) {
        const annSpan = document.createElement('span');
        annSpan.className = 'line-ann';
        annSpan.textContent = lyric.text;
        annSpan.dataset.refId = ref.id;

        const supSpan = document.createElement('span');
        supSpan.className = 'ann-sup';
        supSpan.setAttribute('aria-hidden', 'true');
        supSpan.textContent = refIndexMap.get(ref.id);

        const open = e => {
          e.stopPropagation();
          onAnnotationClick(ref.id);
        };
        annSpan.addEventListener('click', open);
        supSpan.addEventListener('click', open);

        p.append(annSpan, supSpan);
      } else {
        p.textContent = lyric.text;
      }

      stanzaEl.appendChild(p);
    });

    container.appendChild(stanzaEl);
  }

  function highlightLyricLines(lineSet) {
    document.querySelectorAll('#lyrics-container p[data-line]').forEach(p => {
      const hit = lineSet.has(p.dataset.line);
      p.classList.toggle('is-match', hit);
      p.classList.toggle('is-dimmed', !hit);
    });
  }

  function clearHighlights() {
    document.querySelectorAll('#lyrics-container p').forEach(p => {
      p.classList.remove('is-match', 'is-dimmed');
    });
  }

  function markAnnotationActive(refId) {
    document.querySelectorAll('.line-ann').forEach(el => {
      el.classList.toggle('is-active', el.dataset.refId === refId);
    });
  }

  function clearAnnotationActive() {
    document.querySelectorAll('.line-ann').forEach(el => el.classList.remove('is-active'));
  }

  function renderAnnotationDesktop(annotContent, song, ref, refIdx) {
    const title = (ref.keywords || []).slice(0, 2).join(' · ') || ref.excerpt.slice(0, 40);
    const tagsHtml = (ref.keywords || []).slice(0, 6)
      .map(k => `<span class="tag">${k}</span>`).join('');
    const firstLine = ref.lineNumbers?.[0] ?? '—';

    annotContent.innerHTML = `
      <div class="annot__head">
        <div class="annot__num">${refIdx}</div>
        <div class="annot__label">
          <strong>ANNOTATION</strong><span class="annot__label-detail"> · LIGNE ${firstLine} · ${song.title.toUpperCase()}</span>
        </div>
      </div>
      <blockquote class="annot__quote">« ${ref.excerpt} »</blockquote>
      <h2 class="annot__title">${title}</h2>
      <div class="tags">${tagsHtml}</div>
      <p class="annot__body">${ref.explanation}</p>`;
  }

  function renderAnnotationSheet(refs, ref, refIdx) {
    const title = (ref.keywords || []).slice(0, 2).join(' · ') || ref.excerpt.slice(0, 40);
    refs.sheetNum.textContent = String(refIdx);
    refs.sheetLine.textContent = ref.lineNumbers?.[0] ?? '—';
    refs.sheetQuote.textContent = `« ${ref.excerpt} »`;
    refs.sheetTitle.textContent = title;
    refs.sheetTags.innerHTML = (ref.keywords || []).slice(0, 6)
      .map(k => `<span class="tag">${k}</span>`).join('');
    refs.sheetBody.innerHTML = ref.explanation || '';
  }

  function highlightActivePara(refId) {
    document.querySelectorAll('.lyrics p.is-sheet-active')
      .forEach(el => el.classList.remove('is-sheet-active'));
    const activePara = document.querySelector(`.line-ann[data-ref-id="${refId}"]`)?.closest('p');
    if (activePara) activePara.classList.add('is-sheet-active');
  }

  function clearActivePara() {
    document.querySelectorAll('.lyrics p.is-sheet-active')
      .forEach(el => el.classList.remove('is-sheet-active'));
  }

  window.SMSLyricsRenderer = {
    renderSongHead,
    renderLyrics,
    highlightLyricLines,
    clearHighlights,
    markAnnotationActive,
    clearAnnotationActive,
    renderAnnotationDesktop,
    renderAnnotationSheet,
    highlightActivePara,
    clearActivePara,
    isMobile
  };
})();
