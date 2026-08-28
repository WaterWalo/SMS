/* ═══════════════════════════════════════════════════════════════════
   DATA-RENDERER.JS – Client-side data loading and rendering
   ═══════════════════════════════════════════════════════════════════ */

(async function () {
    try {
        // ── LOAD ALL DATA IN PARALLEL ─────────────────────────────────────
        const basePath = './data/';
        const [albumsData, social, content, config] = await window.SMSUtils.loadJSON(
            basePath + 'albums.json',
            basePath + 'social.json',
            basePath + 'content.json',
            basePath + 'config.json'
        );

        // quotes.json chargé à part : une absence/erreur ne doit désactiver
        // que la « Quote of the Day », pas casser le reste de la page.
        const quotesData = await fetch(basePath + 'quotes.json')
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null);
        const albums = albumsData.albums;

        // Get language from window.siteConfig (set by language-manager.js)
        const lang = window.siteConfig?.lang || 'fr';
        const currentContent = content[lang];

        // ── RENDER ALL COMPONENTS ──────────────────────────────────────────
        renderNav(currentContent.nav, lang);
        initHamburgerMenu(); // Initialize after nav is rendered
        initLogoEasterEgg(lang); // Easter egg: Ctrl+Click logo to access search
        renderSocialDock(social);
        renderSocialLinks(social);
        renderFooter(social);
        renderQuoteOfDay(quotesData);
        renderAlbums(albums, lang, currentContent.cta.newBadge);
        updateContent(currentContent, config);

        // ── LISTEN FOR LANGUAGE CHANGE EVENTS ──────────────────────────────
        // When language is changed by language-manager.js, reload content
        window.addEventListener('languagechange', async function (e) {
            const newLang = e.detail.lang;
            const newContent = content[newLang];

            // Re-render all components with new language
            renderNav(newContent.nav, newLang);
            initHamburgerMenu();
            initLogoEasterEgg(newLang);
            renderAlbums(albums, newLang, newContent.cta.newBadge);
            updateContent(newContent, config);
        });

    } catch (error) {
        console.error('Error loading site data:', error);
    }
})();

/**
 * RENDER NAVIGATION
 * Generates the main navigation bar with logo, links, language switcher, and hamburger menu
 */
function renderNav(navLabels, lang) {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const isAboutPage = window.location.pathname.includes('about.html');
    const isSearchPage = window.location.pathname.includes('search.html');

    // Determine URLs based on current page
    const homeUrl = (isAboutPage || isSearchPage) ? 'index.html' : '#hero';
    const albumsUrl = (isAboutPage || isSearchPage) ? 'index.html#albums' : '#albums';
    const contactUrl = (isAboutPage || isSearchPage) ? 'index.html#social' : '#social';

    // Logo: link to index on about/search pages, just text on index pages
    const logoHtml = (isAboutPage || isSearchPage)
        ? `<a href="index.html" class="nav-logo"></a>`
        : `<a href="index.html" class="nav-logo"></a>`;

    // Le menu mobile n'a qu'une seule affordance de fermeture : le hamburger
    // qui se transforme en ✕, toujours au même endroit. L'ancien bouton ✕
    // séparé faisait doublon (deux croix superposées) et était, en prime, un
    // <button> enfant direct de <ul> — du HTML invalide.
    nav.innerHTML = `
    ${logoHtml}
    <ul class="nav-links" id="nav-links">
      <li><a href="${homeUrl}">${navLabels.home}</a></li>
      <li><a href="${contactUrl}">${navLabels.contact}</a></li>
      <li><a href="${albumsUrl}">${navLabels.albums}</a></li>
      <li><a href="search.html" class="genius-link">${navLabels.genius}</a></li>
    </ul>
    <button class="nav-toggle" type="button" aria-label="Ouvrir le menu"
            aria-expanded="false" aria-controls="nav-links">
      <span></span><span></span><span></span>
    </button>
  `;
}

/**
 * INITIALIZE HAMBURGER MENU
 * Sets up mobile menu toggle functionality after nav is rendered
 */
function initHamburgerMenu() {
    const navEl = document.querySelector('nav');
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (!navToggle || !navEl || !navLinks) return;

    function openMenu() {
        navEl.classList.add('nav--open');
        navToggle.setAttribute('aria-expanded', 'true');
        navToggle.setAttribute('aria-label', 'Fermer le menu');
        // Sans ce verrou, la page continue de défiler derrière l'overlay :
        // on rouvre le menu et le contenu a bougé sous les doigts.
        document.body.classList.add('menu-open');
        document.addEventListener('keydown', onMenuKeydown);
    }

    function closeMenu() {
        const wasOpen = navEl.classList.contains('nav--open');
        navEl.classList.remove('nav--open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Ouvrir le menu');
        document.body.classList.remove('menu-open');
        document.removeEventListener('keydown', onMenuKeydown);
        // Le focus revient sur le hamburger, sinon il retombe sur <body>
        // et la navigation clavier repart du haut de la page.
        if (wasOpen) navToggle.focus();
    }

    function onMenuKeydown(e) {
        if (e.key === 'Escape') closeMenu();
    }

    navToggle.addEventListener('click', function () {
        if (navEl.classList.contains('nav--open')) closeMenu();
        else openMenu();
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeMenu);
    });
}

/**
 * INITIALIZE LOGO EASTER EGG
 * Ctrl+Click on logo redirects to hidden search page
 */
function initLogoEasterEgg(lang) {
    const logo = document.querySelector('.nav-logo');
    if (!logo) return;

    logo.addEventListener('click', function (e) {
        // Check if Ctrl key (Windows/Linux) or Cmd key (Mac) is pressed
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();

            // Redirect to search page with current language parameter
            const currentLang = window.siteConfig?.lang || 'fr';
            window.location.href = `search.html`;
        }
    });

    // Add visual hint on hover (optional - can be removed for true Easter egg)
    logo.style.cursor = 'pointer';
    logo.title = 'Ctrl+Click pour une surprise 🔍';
}

/**
 * RENDER SOCIAL DOCK
 * Generates the fixed social media sidebar with Spotify and Instagram links
 */
function renderSocialDock(socialLinks) {
    const dock = document.querySelector('.social-dock');
    if (!dock) return;

    dock.innerHTML = `
    <a class="dock-link"
      href="${socialLinks.spotify}"
      target="_blank" rel="noopener" aria-label="Spotify">
      <span class="dock-label">Spotify</span>
      <span class="dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      </span>
    </a>
    <a class="dock-link" 
      href="${socialLinks.instagram}" 
      target="_blank" rel="noopener" aria-label="Instagram">
      <span class="dock-label">Instagram</span>
      <span class="dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      </span>
    </a>
  `;
}

/**
 * RENDER SOCIAL LINKS
 * Generates the social media section links (all 4 platforms)
 */
function buildSocialPlatforms(socialLinks) {
    return [
        {
            name: 'Spotify',
            url: socialLinks.spotify,
            icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>`
        },
        {
            name: 'Apple Music',
            url: socialLinks.appleMusic,
            icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>`
        },
        {
            name: 'Instagram',
            url: socialLinks.instagram,
            icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>`
        },
        {
            name: 'YouTube',
            url: socialLinks.youtube,
            icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>`
        },
        {
            name: 'TikTok',
            url: socialLinks.tiktok,
            icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
            </svg>`
        }
    ];
}

function renderSocialLinks(socialLinks) {
    const socialLinksContainer = document.querySelector('.social-links');
    if (!socialLinksContainer) return;

    const platforms = buildSocialPlatforms(socialLinks);

    socialLinksContainer.innerHTML = platforms.map(platform => `
        <a class="social-link" href="${platform.url}" target="_blank" rel="noopener">
            ${platform.icon}
            ${platform.name}
        </a>
    `).join('');
}

/**
 * RENDER FOOTER SOCIAL
 * Generates the compact, icon-only social row in the footer
 */
function renderFooter(socialLinks) {
    const footerSocial = document.querySelector('.footer-social');
    if (!footerSocial) return;

    const platforms = buildSocialPlatforms(socialLinks);

    footerSocial.innerHTML = platforms.map(platform => `
        <a href="${platform.url}" target="_blank" rel="noopener" aria-label="${platform.name}" title="${platform.name}">
            ${platform.icon}
        </a>
    `).join('');
}

/**
 * RENDER QUOTE OF THE DAY
 * Affiche une punchline référencée + le début de son explication, avec un lien
 * « En Savoir plus » qui ouvre la référence dans le viewer Génie (search.html).
 * La citation change chaque jour à minuit heure locale, de façon déterministe
 * (même citation pour tous les visiteurs un jour donné), en rotation sur toutes
 * les références du site.
 */
function renderQuoteOfDay(quotesData) {
    const section = document.getElementById('quote-of-day');
    const card = section && section.querySelector('.quote-card');
    if (!card) return;

    const quotes = quotesData && Array.isArray(quotesData.quotes) ? quotesData.quotes : [];
    if (quotes.length === 0) {
        section.style.display = 'none';
        return;
    }

    // Numéro de jour local (change à minuit dans le fuseau du visiteur).
    const d = new Date();
    const jour = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
        + d.getFullYear() * 366;

    // Pool de chansons distinctes (songId → titre) pour les choix de la devinette.
    const songPool = Array.from(
        new Map(quotes.map(q => [q.songId, q.songTitle])).entries()
    ).map(([songId, songTitle]) => ({ songId, songTitle }));

    renderQuoteCard(card, quotes[jour % quotes.length], quotes, songPool);
}

/**
 * Affiche une citation donnée dans la carte, et branche les actions
 * (devinette + tirage d'une autre citation au hasard).
 */
function renderQuoteCard(card, quote, quotes, songPool) {
    // Début de l'explication : première phrase ou ~160 caractères, + « … ».
    const MAX = 160;
    let snippet = String(quote.explanation).trim();
    let truncated = false;
    const firstStop = snippet.search(/[.!?](\s|$)/);
    if (firstStop !== -1 && firstStop + 1 <= MAX) {
        snippet = snippet.slice(0, firstStop + 1);
    } else if (snippet.length > MAX) {
        snippet = snippet.slice(0, MAX).replace(/\s+\S*$/, '');
        truncated = true;
    }

    const href = `search.html#song=${encodeURIComponent(quote.songId)}&ref=${encodeURIComponent(quote.refId)}`;

    // Structure statique via innerHTML ; textes dynamiques injectés en textContent
    // pour éviter toute injection si une explication contient des caractères spéciaux.
    card.innerHTML = `
        <div class="quote-feature">
            <span class="quote-badge"><em>Génie</em><span class="dot">.</span></span>
            <blockquote class="quote-excerpt"></blockquote>
            <span class="quote-deco" aria-hidden="true">«</span>
        </div>
        <div class="quote-body">
            <p class="quote-snippet"></p>
            <div class="quote-actions">
                <a class="quote-more" href="${href}">En Savoir plus</a>
                <button class="quote-riddle" type="button">Devinette</button>
                <button class="quote-shuffle" type="button" title="Une autre citation">Autre citation</button>
            </div>
        </div>
    `;
    card.querySelector('.quote-excerpt').textContent = `« ${quote.excerpt} »`;
    card.querySelector('.quote-snippet').textContent = truncated ? snippet + ' …' : snippet;
    card.querySelector('.quote-more').setAttribute('aria-label', `Voir la référence « ${quote.excerpt} » sur Génie`);

    card.querySelector('.quote-riddle').addEventListener('click', e => {
        openRiddle(quote, songPool, e.currentTarget);
    });

    card.querySelector('.quote-shuffle').addEventListener('click', () => {
        // Tire une autre citation que celle affichée (si le pool le permet).
        let next = quote;
        if (quotes.length > 1) {
            do {
                next = quotes[Math.floor(Math.random() * quotes.length)];
            } while (next === quote);
        }
        renderQuoteCard(card, next, quotes, songPool);
    });

    // Déclencher l'animation reveal comme pour les albums.
    setTimeout(() => {
        window.SMSUtils.createRevealObserver([card], el => el.classList.add('visible'));
    }, 10);
}

/**
 * RIDDLE MODAL — « De quelle chanson provient ce bar ? »
 * Mini-jeu à choix multiple : le bon titre + 3 distracteurs. Modal légère et
 * accessible (fermeture ✕ / backdrop / Échap, focus géré, focus-trap léger).
 */
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function openRiddle(quote, songPool, triggerEl) {
    const modal = document.getElementById('riddle-modal');
    if (!modal) return;

    const excerptEl = modal.querySelector('.riddle-excerpt');
    const optionsEl = modal.querySelector('.riddle-options');
    const feedbackEl = modal.querySelector('.riddle-feedback');
    const moreEl = modal.querySelector('.riddle-more');

    // Réinitialiser l'état.
    excerptEl.textContent = `« ${quote.excerpt} »`;
    feedbackEl.textContent = '';
    feedbackEl.className = 'riddle-feedback';
    moreEl.hidden = true;
    optionsEl.innerHTML = '';

    // Choix : bonne réponse + 3 distracteurs (chansons distinctes) mélangés.
    const distractors = shuffle(songPool.filter(s => s.songId !== quote.songId)).slice(0, 3);
    const choices = shuffle([{ songId: quote.songId, songTitle: quote.songTitle }, ...distractors]);

    const href = `search.html#song=${encodeURIComponent(quote.songId)}&ref=${encodeURIComponent(quote.refId)}`;

    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'riddle-option';
        btn.textContent = choice.songTitle;
        btn.dataset.songId = choice.songId;
        btn.addEventListener('click', () => answerRiddle(btn, quote, optionsEl, feedbackEl, moreEl, href));
        optionsEl.appendChild(btn);
    });

    // Ouvrir.
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lastRiddleTrigger = triggerEl || null;

    const firstOption = optionsEl.querySelector('.riddle-option');
    if (firstOption) firstOption.focus();

    document.addEventListener('keydown', onRiddleKeydown);
}

function answerRiddle(btn, quote, optionsEl, feedbackEl, moreEl, href) {
    const chosenId = btn.dataset.songId;
    const correct = chosenId === quote.songId;

    optionsEl.querySelectorAll('.riddle-option').forEach(opt => {
        opt.disabled = true;
        if (opt.dataset.songId === quote.songId) opt.classList.add('is-correct');
    });
    if (!correct) btn.classList.add('is-wrong');

    feedbackEl.textContent = correct
        ? `Bien joué ! Ce bar vient bien de « ${quote.songTitle} ».`
        : `Raté ! Ce bar vient de « ${quote.songTitle} ».`;
    feedbackEl.classList.add(correct ? 'is-correct' : 'is-wrong');

    moreEl.href = href;
    moreEl.hidden = false;
}

function closeRiddle() {
    const modal = document.getElementById('riddle-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onRiddleKeydown);
    if (lastRiddleTrigger && typeof lastRiddleTrigger.focus === 'function') {
        lastRiddleTrigger.focus();
    }
    lastRiddleTrigger = null;
}

let lastRiddleTrigger = null;

function onRiddleKeydown(e) {
    if (e.key === 'Escape') {
        closeRiddle();
        return;
    }
    if (e.key !== 'Tab') return;
    // Focus-trap léger : garder le focus dans le dialog.
    const modal = document.getElementById('riddle-modal');
    const focusables = modal.querySelectorAll(
        'button:not([disabled]), a[href]:not([hidden])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

// Fermeture par ✕ ou clic sur le backdrop (délégation, une seule fois).
document.addEventListener('click', e => {
    if (e.target.closest('[data-riddle-close]')) closeRiddle();
});

/**
 * RENDER ALBUMS
 * Generates the album grid from albums data
 */
function renderAlbums(albums, lang, newBadgeText) {
    const albumsGrid = document.querySelector('.album-grid');
    if (!albumsGrid) return;

    // Sort albums by order
    const sortedAlbums = [...albums].sort((a, b) => a.order - b.order);

    albumsGrid.innerHTML = sortedAlbums.map(album => {
        const newBadge = album.isNew
            ? `<span class="new-badge">${newBadgeText}</span>`
            : '';

        return `
      <a class="album-card reveal"
        href="${album.geniusUrl || album.spotifyUrl}"
        ${album.geniusUrl ? '' : 'target="_blank" rel="noopener noreferrer"'}>
        <div class="album-cover">
          <img src="${album.coverImage}" alt="${album.coverAlt[lang]}" loading="lazy">
        </div>
        <div class="album-info">
          ${newBadge}
          <div class="album-title">${album.title}</div>
          <div class="album-meta">${album.year} &nbsp;·&nbsp; ${album.type}</div>
        </div>
      </a>
    `;
    }).join('');

    // Trigger reveal animation for dynamically generated albums
    setTimeout(() => {
        window.SMSUtils.createRevealObserver(
            albumsGrid.querySelectorAll('.reveal'),
            el => el.classList.add('visible')
        );
    }, 10);
}

/**
 * UPDATE CONTENT
 * Updates all elements with data-i18n attributes and dynamic content
 */
function updateContent(content, config) {
    // Update all elements with data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const value = window.SMSUtils.getNestedValue(content, key);

        if (value !== undefined) {
            // Use innerHTML for content that contains HTML tags or entities
            if (value.includes('<') || (value.includes('&') && value.includes(';'))) {
                el.innerHTML = value;
            } else {
                el.textContent = value;
            }
        }
    });

    // Update footer year
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = config.copyright.year;
    }
}

