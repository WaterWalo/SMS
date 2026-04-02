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

        // ── nav: show when hero is fully past, hide when back ──────
        const shouldShow = scrollY >= heroH - 10;
        if (shouldShow && !navVisible) {
            navVisible = true;
            navEl.classList.remove('nav--visible');
            void navEl.offsetWidth;
            navEl.classList.add('nav--visible');
            if (dockEl) dockEl.classList.add('social-dock--visible');
        } else if (!shouldShow && navVisible) {
            navVisible = false;
            navEl.classList.remove('nav--visible');
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
    const revealEls = document.querySelectorAll('.reveal');
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
        revealEls.forEach(function (el) {
            el.classList.add('visible');
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
