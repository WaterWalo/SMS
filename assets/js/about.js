/* ═══════════════════════════════════════════════════════════════════
   ABOUT.JS – JavaScript for about pages (mobile navigation)
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    // ── MOBILE HAMBURGER ─────────────────────────────────────────────
    const navToggle = document.querySelector('.nav-toggle');
    const navEl = document.querySelector('nav');
    const navLinks = document.querySelector('.nav-links');

    if (navToggle) {
        navToggle.addEventListener('click', function () {
            const isOpen = navEl.classList.toggle('nav--open');
            navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        navLinks.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                navEl.classList.remove('nav--open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }
})();
