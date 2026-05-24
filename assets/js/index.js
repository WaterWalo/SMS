/* ═══════════════════════════════════════════════════════════════════
   INDEX.JS – JavaScript for index pages (hero effects, animations)
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    // ── HERO SCROLL EFFECTS ──────────────────────────────────────────
    const heroEl = document.getElementById('hero');
    const heroContent = document.querySelector('.hero-content');
    const videoBg = document.querySelector('.hero-bg-video');
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

        // ── nav: transition from transparent to white AFTER hero ──────
        // Transition starts only after passing the hero section
        const transitionDistance = 0; // instant transition when reaching end of hero
        const postHeroScroll = Math.max(0, scrollY - heroH);

        // Si transitionDistance est 0, transition instantanée dès qu'on atteint ou dépasse le hero
        const postHeroProgress = transitionDistance === 0
            ? (scrollY >= heroH ? 1 : 0)
            : Math.min(postHeroScroll / transitionDistance, 1);

        // Calculate background opacity (0 → 0.95) only after hero
        const bgOpacity = postHeroProgress * 0.95;
        const borderOpacity = postHeroProgress * 0.5;
        const shadowOpacity = postHeroProgress * 0.05;

        // Apply progressive styles
        navEl.style.background = `rgba(255, 255, 255, ${bgOpacity})`;
        navEl.style.borderBottom = `2px solid rgba(135, 212, 224, ${borderOpacity})`;
        navEl.style.boxShadow = `0 2px 10px rgba(0, 0, 0, ${shadowOpacity})`;

        // Add scrolled class for text color transition - appliqué immédiatement après le hero
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

        // ── video: parallax ──────────────────────────────────────────
        videoBg.style.transform = `translateY(${scrollY * 0.35}px) scale(1.08)`;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    update();

    // ── SCROLL REVEAL ────────────────────────────────────────────────
    // Support for multiple reveal animation types
    const revealEls = document.querySelectorAll('.reveal, .reveal-slide-right, .reveal-zoom-in, .reveal-cascade');
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        revealObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12 }
        );
        revealEls.forEach(function (el) {
            revealObserver.observe(el);
        });
    } else {
        // Fallback for browsers without IntersectionObserver
        revealEls.forEach(function (el) {
            el.classList.add('visible');
        });
    }

    // ── SECTION DIVIDER GLITCH EFFECT ────────────────────────────────
    // Trigger glitch effect on section dividers when they come into view
    const glitchDividers = document.querySelectorAll('.section-divider.glitch-divider');
    if ('IntersectionObserver' in window && glitchDividers.length) {
        const dividerObserver = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        // Trigger glitch animation
                        entry.target.style.animation = 'none';
                        setTimeout(function () {
                            entry.target.style.animation = 'divider-glitch 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                        }, 10);
                    }
                });
            },
            { threshold: 0.5, rootMargin: '0px' }
        );
        glitchDividers.forEach(function (divider) {
            dividerObserver.observe(divider);
        });
    }

    // ── STATS COUNTER ────────────────────────────────────────────────
    const statEls = document.querySelectorAll('.stat-number[data-target]');
    if ('IntersectionObserver' in window && statEls.length) {
        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }
        const counterObserver = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var el = entry.target;
                    var target = parseInt(el.getAttribute('data-target'), 10);
                    var duration = 1200;
                    var start = performance.now();
                    counterObserver.unobserve(el);
                    function step(now) {
                        var elapsed = now - start;
                        var t = Math.min(elapsed / duration, 1);
                        el.textContent = Math.round(easeOutCubic(t) * target);
                        if (t < 1) requestAnimationFrame(step);
                    }
                    requestAnimationFrame(step);
                });
            },
            { threshold: 0.5 }
        );
        statEls.forEach(function (el) {
            counterObserver.observe(el);
        });
    }
})();
