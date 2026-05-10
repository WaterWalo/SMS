/**
 * LANGUAGE MANAGER
 * Handles language detection, switching, and persistence without automatic redirection
 * Default language is French (fr)
 */

(function () {
    'use strict';

    const SUPPORTED_LANGUAGES = ['fr', 'en'];
    const DEFAULT_LANGUAGE = 'fr';
    const STORAGE_KEY = 'sms-lang';

    /**
     * Detect current language from multiple sources (in order of priority):
     * 1. URL parameter (?lang=fr or ?lang=en)
     * 2. localStorage (previous user choice)
     * 3. Default to French
     * 
     * NOTE: We deliberately do NOT use navigator.language for automatic detection
     * to avoid SEO issues with Google not liking auto-redirects
     * 
     * @returns {string} Language code ('fr' or 'en')
     */
    function detectLanguage() {
        // 1. Check URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && SUPPORTED_LANGUAGES.includes(urlLang)) {
            return urlLang;
        }

        // 2. Check localStorage (user preference from previous visit)
        const storedLang = localStorage.getItem(STORAGE_KEY);
        if (storedLang && SUPPORTED_LANGUAGES.includes(storedLang)) {
            return storedLang;
        }

        // 3. Default to French
        return DEFAULT_LANGUAGE;
    }

    /**
     * Set the current language and update all related state
     * - Updates localStorage for persistence
     * - Updates URL parameter using history.pushState (no page reload)
     * - Updates window.siteConfig for other scripts
     * - Triggers language change event for components to update
     * 
     * @param {string} lang - Language code ('fr' or 'en')
     */
    function setLanguage(lang) {
        if (!SUPPORTED_LANGUAGES.includes(lang)) {
            console.warn(`Unsupported language: ${lang}. Defaulting to ${DEFAULT_LANGUAGE}`);
            lang = DEFAULT_LANGUAGE;
        }

        // Update localStorage
        localStorage.setItem(STORAGE_KEY, lang);

        // Update URL parameter without page reload
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.history.pushState({}, '', url);

        // Update global config
        window.siteConfig = window.siteConfig || {};
        window.siteConfig.lang = lang;

        // Dispatch custom event so other components can react
        window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
    }

    /**
     * Initialize language switcher button functionality
     * Finds the language switcher link and attaches click handler
     * Updates content dynamically without page reload
     */
    function initLanguageSwitcher() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initLanguageSwitcher);
            return;
        }

        const switcher = document.querySelector('.lang-switcher');
        if (!switcher) {
            console.warn('Language switcher not found in DOM');
            return;
        }

        switcher.addEventListener('click', function (e) {
            e.preventDefault();

            const currentLang = window.siteConfig?.lang || DEFAULT_LANGUAGE;
            const newLang = currentLang === 'en' ? 'fr' : 'en';

            // Set new language (this updates URL and triggers languagechange event)
            setLanguage(newLang);

            // Update page content dynamically
            // This will be handled by data-renderer.js listening to languagechange event
        });
    }

    /**
     * Initialize the language system on page load
     * - Detects current language
     * - Sets up window.siteConfig
     * - Initializes switcher button
     */
    function init() {
        const detectedLang = detectLanguage();

        // Set up window.siteConfig (may already exist from HTML script tag)
        window.siteConfig = window.siteConfig || {};
        window.siteConfig.lang = detectedLang;

        // Store in localStorage for next visit
        localStorage.setItem(STORAGE_KEY, detectedLang);

        // Update URL if needed (but only if URL param doesn't match detected lang)
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang !== detectedLang) {
            const url = new URL(window.location);
            url.searchParams.set('lang', detectedLang);
            window.history.replaceState({}, '', url);
        }

        // Initialize switcher (deferred to ensure DOM is ready)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initLanguageSwitcher);
        } else {
            initLanguageSwitcher();
        }
    }

    // Export functions to global scope for use by other scripts
    window.LanguageManager = {
        detectLanguage,
        setLanguage,
        initLanguageSwitcher,
        init,
        SUPPORTED_LANGUAGES,
        DEFAULT_LANGUAGE
    };

    // Auto-initialize on script load
    init();
})();
