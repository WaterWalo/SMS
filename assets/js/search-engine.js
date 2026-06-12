/* ═══════════════════════════════════════════════════════════════════
   SEARCH-ENGINE.JS – Fuse.js wrappers (no DOM, testable in isolation)
   Exposed on window.SMSSearchEngine.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  const FUSE_OPTIONS = {
    threshold: 0.2,
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true
  };

  function buildGlobalFuse(songs) {
    const items = [];
    songs.forEach(song => {
      song.lyrics.forEach(lyric => {
        items.push({
          type: 'lyric',
          songId: song.id,
          text: lyric.text,
          line: lyric.line
        });
      });
      (song.references || []).forEach(ref => {
        items.push({
          type: 'reference',
          songId: song.id,
          text: ref.excerpt,
          explanation: ref.explanation,
          keywords: ref.keywords
        });
      });
    });

    return new Fuse(items, {
      ...FUSE_OPTIONS,
      keys: [
        { name: 'text', weight: 2 },
        { name: 'explanation', weight: 1.5 },
        { name: 'keywords', weight: 2.5 }
      ]
    });
  }

  function buildInSongFuse(song) {
    return new Fuse(song.lyrics, {
      ...FUSE_OPTIONS,
      keys: [{ name: 'text', weight: 1 }]
    });
  }

  /**
   * Run the global search and return matching song IDs (deduplicated, capped).
   */
  function searchGlobal(globalFuse, query, limit = 50) {
    const results = globalFuse.search(query).slice(0, limit);
    return {
      results,
      songIds: [...new Set(results.map(r => r.item.songId))]
    };
  }

  /**
   * Run the in-song search and return the set of matching line numbers as strings.
   */
  function searchInSong(activeFuse, query) {
    const results = activeFuse.search(query);
    return {
      results,
      lineSet: new Set(results.map(r => String(r.item.line)))
    };
  }

  window.SMSSearchEngine = {
    buildGlobalFuse,
    buildInSongFuse,
    searchGlobal,
    searchInSong
  };
})();
