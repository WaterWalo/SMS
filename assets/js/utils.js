/* ═══════════════════════════════════════════════════════════════════
   UTILS.JS – Shared helpers (DOM, async, observers)
   Exposed on window.SMSUtils for use by other scripts.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  const isMobile = () => window.innerWidth <= 768;
  const isTablet = () => window.innerWidth >= 769 && window.innerWidth <= 1200;

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // albums.json paths are ../assets/img/... (relative to data/), fix for root HTML
  function fixImgPath(path) {
    return path ? path.replace(/^\.\.\//, '') : '';
  }

  function glyphText(title) {
    const words = String(title).split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  function loadJSON(...paths) {
    return Promise.all(paths.map(p => fetch(p).then(r => r.json())));
  }

  /**
   * Observe elements and run `onVisible(entry.target, observer)` the first
   * time each one enters the viewport. Returns the observer (or null if
   * IntersectionObserver isn't supported — in that case `onVisible` is called
   * synchronously on every element as a fallback).
   *
   * @param {string|NodeList|Element[]} target - selector or list of elements
   * @param {(el: Element, observer: IntersectionObserver) => void} onVisible
   * @param {IntersectionObserverInit} [options]
   */
  function createRevealObserver(target, onVisible, options) {
    const els = typeof target === 'string'
      ? document.querySelectorAll(target)
      : target;

    if (!('IntersectionObserver' in window)) {
      els.forEach(el => onVisible(el, null));
      return null;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          onVisible(entry.target, observer);
          observer.unobserve(entry.target);
        }
      });
    }, options || { threshold: 0.12 });

    els.forEach(el => observer.observe(el));
    return observer;
  }

  window.SMSUtils = {
    isMobile,
    isTablet,
    debounce,
    fixImgPath,
    glyphText,
    getNestedValue,
    loadJSON,
    createRevealObserver
  };
})();
