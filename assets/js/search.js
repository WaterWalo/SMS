/* ═══════════════════════════════════════════════════════════════════
   SEARCH.JS – Lyrics search with Fuse.js fuzzy matching
   ═══════════════════════════════════════════════════════════════════ */

(async function () {
    // ── I18N STRINGS ──────────────────────────────────────────────
    const lang = window.siteConfig?.lang || 'fr';
    const i18n = {
        fr: {
            loadError: 'Erreur de chargement des données. Veuillez réactualiser la page.',
            resultsCount: (count) => `${count} résultat${count > 1 ? 's' : ''} trouvé${count > 1 ? 's' : ''}`
        },
        en: {
            loadError: 'Error loading data. Please refresh the page.',
            resultsCount: (count) => `${count} result${count > 1 ? 's' : ''} found`
        }
    };
    const t = i18n[lang];

    // ── GLOBAL STATE ──────────────────────────────────────────────
    let fuseInstance = null;
    let songsData = [];
    let albumsData = [];

    // ── DOM ELEMENTS ──────────────────────────────────────────────
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    const searchStats = document.getElementById('search-stats');
    const searchEmpty = document.getElementById('search-empty');
    const searchNoResults = document.getElementById('search-no-results');
    const noResultsQuery = document.getElementById('no-results-query');
    const searchResults = document.getElementById('search-results');

    // ── UTILITY: DEBOUNCE ─────────────────────────────────────────
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    // ── LOAD DATA ─────────────────────────────────────────────────
    async function loadData() {
        try {
            // Always load French lyrics data from ../data/
            const basePath = window.location.pathname.includes('/en/') || window.location.pathname.includes('/fr/')
                ? '../data/'
                : './data/';

            const [lyrics, albums] = await Promise.all([
                fetch(basePath + 'lyrics.json').then(r => r.json()),
                fetch(basePath + 'albums.json').then(r => r.json())
            ]);

            return { lyrics, albums };
        } catch (error) {
            console.error('Error loading data:', error);
            showError(t.loadError);
            return null;
        }
    }

    // ── ENRICH SONGS WITH ALBUM DATA ──────────────────────────────
    function enrichSongsWithAlbums(songs, albums) {
        const albumsMap = {};
        albums.forEach(album => {
            albumsMap[album.id] = album;
        });

        return songs.map(song => {
            const album = albumsMap[song.albumId];
            return {
                ...song,
                albumTitle: album?.title || song.title,
                coverImage: album?.coverImage || '',
                spotifyUrl: album?.spotifyUrl || ''
            };
        });
    }

    // ── INITIALIZE FUSE.JS ────────────────────────────────────────
    function initFuse(songs) {
        // Flatten data structure for Fuse.js
        const searchableData = [];

        songs.forEach(song => {
            // Add each lyric line as searchable
            song.lyrics.forEach(lyric => {
                searchableData.push({
                    type: 'lyric',
                    songId: song.id,
                    songTitle: song.title,
                    albumTitle: song.albumTitle,
                    coverImage: song.coverImage,
                    spotifyUrl: song.spotifyUrl,
                    text: lyric.text,
                    lineNumber: lyric.line
                });
            });

            // Add each reference as searchable
            song.references.forEach(ref => {
                searchableData.push({
                    type: 'reference',
                    songId: song.id,
                    songTitle: song.title,
                    albumTitle: song.albumTitle,
                    coverImage: song.coverImage,
                    spotifyUrl: song.spotifyUrl,
                    text: ref.excerpt,
                    explanation: ref.explanation,
                    keywords: ref.keywords
                });
            });
        });

        const fuseOptions = {
            keys: [
                { name: 'text', weight: 2 },
                { name: 'explanation', weight: 1.5 },
                { name: 'keywords', weight: 2.5 }
            ],
            threshold: 0.3,
            includeMatches: true,
            minMatchCharLength: 2,
            ignoreLocation: true
        };

        return new Fuse(searchableData, fuseOptions);
    }

    // ── PERFORM SEARCH ────────────────────────────────────────────
    function performSearch(query) {
        if (!query || query.trim().length < 2) {
            showEmptyState();
            return;
        }

        const cleanQuery = query.trim();
        const results = fuseInstance.search(cleanQuery);

        // Limit to 50 results
        const limitedResults = results.slice(0, 50);

        if (limitedResults.length === 0) {
            showNoResults(cleanQuery);
        } else {
            renderResults(limitedResults, cleanQuery);
        }
    }

    // ── HIGHLIGHT MATCHES ─────────────────────────────────────────
    function highlightMatches(text, query) {
        if (!query) return text;

        // Simple case-insensitive highlighting
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ── RENDER RESULTS ────────────────────────────────────────────
    function renderResults(results, query) {
        searchEmpty.classList.add('hidden');
        searchNoResults.classList.add('hidden');
        searchResults.classList.remove('hidden');

        // Update stats
        const count = results.length;
        searchStats.textContent = t.resultsCount(count);
        searchStats.classList.remove('hidden');

        // Clear previous results
        searchResults.innerHTML = '';

        // Group results by song to avoid duplicates
        const resultsBySong = {};
        results.forEach(result => {
            const data = result.item;
            const songKey = data.songId;

            if (!resultsBySong[songKey]) {
                resultsBySong[songKey] = {
                    songId: data.songId,
                    songTitle: data.songTitle,
                    albumTitle: data.albumTitle,
                    coverImage: data.coverImage,
                    spotifyUrl: data.spotifyUrl,
                    references: []
                };
            }

            // Add reference with both excerpt and explanation
            if (data.type === 'reference' && data.explanation) {
                // Check if this exact reference already exists
                const refExists = resultsBySong[songKey].references.some(
                    ref => ref.excerpt === data.text && ref.explanation === data.explanation
                );
                if (!refExists) {
                    resultsBySong[songKey].references.push({
                        excerpt: data.text,
                        explanation: data.explanation
                    });
                }
            } else if (data.type === 'lyric') {
                // Add lyric without explanation (for lyrics that matched but aren't references)
                const refExists = resultsBySong[songKey].references.some(
                    ref => ref.excerpt === data.text
                );
                if (!refExists) {
                    resultsBySong[songKey].references.push({
                        excerpt: data.text,
                        explanation: null
                    });
                }
            }
        });

        // Render each unique song result
        Object.values(resultsBySong).forEach(songResult => {
            const resultCard = createResultCard(songResult, query);
            searchResults.appendChild(resultCard);
        });

        // Add reveal animation with slight delay
        setTimeout(() => {
            const cards = searchResults.querySelectorAll('.search-result');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('visible');
                }, index * 50);
            });
        }, 10);
    }

    // ── CREATE RESULT CARD ────────────────────────────────────────
    function createResultCard(songResult, query) {
        const card = document.createElement('div');
        card.className = 'search-result reveal';

        // Cover image
        const coverDiv = document.createElement('div');
        coverDiv.className = 'result-cover';
        if (songResult.coverImage) {
            const img = document.createElement('img');
            img.src = songResult.coverImage;
            img.alt = `${songResult.albumTitle} – cover`;
            img.loading = 'lazy';
            coverDiv.appendChild(img);
        }

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'result-content';

        // Determine if we should show reference numbers
        const referencesToShow = songResult.references.slice(0, 3);
        const referencesWithExplanations = songResult.references.filter(ref => ref.explanation);
        const showNumbers = referencesWithExplanations.length > 1;

        // Excerpts (lyrics) with reference numbers
        const excerptsDiv = document.createElement('div');
        excerptsDiv.className = 'result-excerpt';
        referencesToShow.forEach((ref) => {
            const p = document.createElement('p');
            p.innerHTML = highlightMatches(ref.excerpt, query);

            // Add reference number if multiple references with explanations
            if (showNumbers && ref.explanation) {
                // Find the index of this reference among those with explanations
                const refIndex = referencesWithExplanations.indexOf(ref);
                if (refIndex !== -1 && refIndex < 3) {
                    const refNumber = document.createElement('sup');
                    refNumber.className = 'reference-number';
                    refNumber.textContent = refIndex + 1;
                    p.appendChild(document.createTextNode(' '));
                    p.appendChild(refNumber);
                }
            }

            excerptsDiv.appendChild(p);
        });

        // Meta (song + album)
        const metaDiv = document.createElement('div');
        metaDiv.className = 'result-meta';
        metaDiv.innerHTML = `
            <span class="result-song">${songResult.songTitle}</span>
            <span class="result-separator"> · </span>
            <span class="result-album">${songResult.albumTitle}</span>
        `;

        // Explanations with reference numbers
        const explanationsToShow = referencesWithExplanations.slice(0, 3);
        if (explanationsToShow.length > 0) {
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'result-explanation';
            explanationsToShow.forEach((ref, index) => {
                const p = document.createElement('p');

                // Add reference number if multiple references
                if (showNumbers) {
                    const refLabel = document.createElement('span');
                    refLabel.className = 'reference-label';
                    refLabel.textContent = `[${index + 1}] `;
                    p.appendChild(refLabel);
                }

                p.appendChild(document.createTextNode(ref.explanation));
                explanationDiv.appendChild(p);
            });
            contentDiv.appendChild(excerptsDiv);
            contentDiv.appendChild(metaDiv);
            contentDiv.appendChild(explanationDiv);
        } else {
            contentDiv.appendChild(excerptsDiv);
            contentDiv.appendChild(metaDiv);
        }

        // Actions (Spotify link)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'result-actions';
        if (songResult.spotifyUrl) {
            const spotifyLink = document.createElement('a');
            spotifyLink.href = songResult.spotifyUrl;
            spotifyLink.className = 'spotify-link';
            spotifyLink.target = '_blank';
            spotifyLink.rel = 'noopener noreferrer';
            spotifyLink.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Écouter
            `;
            actionsDiv.appendChild(spotifyLink);
        }

        // Assemble card
        card.appendChild(coverDiv);
        card.appendChild(contentDiv);
        card.appendChild(actionsDiv);

        return card;
    }

    // ── SHOW EMPTY STATE ──────────────────────────────────────────
    function showEmptyState() {
        searchEmpty.classList.remove('hidden');
        searchNoResults.classList.add('hidden');
        searchResults.classList.add('hidden');
        searchStats.classList.add('hidden');
        searchStats.textContent = '';
        searchResults.innerHTML = '';
    }

    // ── SHOW NO RESULTS ───────────────────────────────────────────
    function showNoResults(query) {
        searchEmpty.classList.add('hidden');
        searchNoResults.classList.remove('hidden');
        searchResults.classList.add('hidden');
        searchStats.classList.add('hidden');
        noResultsQuery.textContent = `"${query}"`;
    }

    // ── SHOW ERROR ────────────────────────────────────────────────
    function showError(message) {
        searchEmpty.innerHTML = `<p style="color: var(--text-muted);">⚠️ ${message}</p>`;
        searchEmpty.classList.remove('hidden');
        searchNoResults.classList.add('hidden');
        searchResults.classList.add('hidden');
    }

    // ── EVENT HANDLERS ────────────────────────────────────────────
    const debouncedSearch = debounce((query) => {
        performSearch(query);
    }, 300);

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;

        // Show/hide clear button
        if (query.length > 0) {
            searchClear.style.display = 'block';
        } else {
            searchClear.style.display = 'none';
            showEmptyState();
            return;
        }

        // Trigger debounced search
        debouncedSearch(query);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchClear.style.display = 'none';
            showEmptyState();
        }
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.style.display = 'none';
        searchInput.focus();
        showEmptyState();
    });

    // ── INITIALIZATION ────────────────────────────────────────────
    try {
        const data = await loadData();
        if (!data) return;

        albumsData = data.albums;
        songsData = enrichSongsWithAlbums(data.lyrics.songs, data.albums);

        fuseInstance = initFuse(songsData);

        // Focus search input on load
        searchInput.focus();

        console.log('✅ Search initialized:', songsData.length, 'songs loaded');
    } catch (error) {
        console.error('Failed to initialize search:', error);
        showError('Erreur d\'initialisation. Veuillez réactualiser la page.');
    }
})();
