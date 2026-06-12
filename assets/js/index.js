/* ═══════════════════════════════════════════════════════════════════
   INDEX.JS – JavaScript for index pages (hero effects, animations)
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    const { createRevealObserver } = window.SMSUtils;

    // ── HERO SCROLL EFFECTS ──────────────────────────────────────────
    const heroEl = document.getElementById('hero');
    const heroContent = document.querySelector('.hero-content');
    const scrollCue = document.querySelector('.scroll-cue');
    const navEl = document.querySelector('nav');
    const dockEl = document.querySelector('.social-dock');
    let navVisible = false;
    let ticking = false;

    function onScroll() {
        if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
        }
    }

    function update() {
        ticking = false;
        const scrollY = window.scrollY;
        const heroH = heroEl.offsetHeight;
        const progress = Math.min(Math.max(scrollY / heroH, 0), 1);

        // Nav fades in once the user passes the hero. Drive a single CSS
        // custom property; the actual rgba()/box-shadow math lives in CSS,
        // which the browser can compose without per-frame style mutations.
        const postHeroProgress = scrollY >= heroH ? 1 : 0;
        navEl.style.setProperty('--nav-progress', postHeroProgress);

        const shouldScroll = scrollY >= heroH;
        if (shouldScroll && !navVisible) {
            navVisible = true;
            navEl.classList.add('nav--scrolled');
            if (dockEl) dockEl.classList.add('social-dock--visible');
        } else if (!shouldScroll && navVisible) {
            navVisible = false;
            navEl.classList.remove('nav--scrolled');
            if (dockEl) dockEl.classList.remove('social-dock--visible');
        }

        // ── hero title: fade + drift upward ─────────────────────────
        heroContent.style.opacity = Math.max(1 - progress * 2, 0);
        heroContent.style.transform = `translateY(${-progress * 60}px)`;

        // ── scroll cue vanishes quickly ──────────────────────────────
        if (scrollCue) scrollCue.style.opacity = Math.max(1 - progress * 5, 0);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    update();

    // ── SCROLL REVEAL ────────────────────────────────────────────────
    createRevealObserver(
        '.reveal, .reveal-slide-right, .reveal-zoom-in, .reveal-cascade',
        el => el.classList.add('visible')
    );

    // ── SECTION DIVIDER GLITCH EFFECT ────────────────────────────────
    // Different from the one-shot reveal: re-trigger glitch each time the
    // divider re-enters, so we keep this observer manual.
    const glitchDividers = document.querySelectorAll('.section-divider.glitch-divider');
    if ('IntersectionObserver' in window && glitchDividers.length) {
        const dividerObserver = new IntersectionObserver(
            entries => entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animation = 'none';
                    setTimeout(() => {
                        entry.target.style.animation = 'divider-glitch 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                    }, 10);
                }
            }),
            { threshold: 0.5, rootMargin: '0px' }
        );
        glitchDividers.forEach(d => dividerObserver.observe(d));
    }

    // ── STATS COUNTER ────────────────────────────────────────────────
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
    createRevealObserver(
        '.stat-number[data-target]',
        el => {
            const target = parseInt(el.getAttribute('data-target'), 10);
            const duration = 1200;
            const start = performance.now();
            (function step(now) {
                const t = Math.min((now - start) / duration, 1);
                el.textContent = Math.round(easeOutCubic(t) * target);
                if (t < 1) requestAnimationFrame(step);
            })(start);
        },
        { threshold: 0.5 }
    );
})();
