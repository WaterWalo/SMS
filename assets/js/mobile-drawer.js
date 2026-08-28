/* ═══════════════════════════════════════════════════════════════════
   MOBILE-DRAWER.JS – Mobile drawer + bottom sheet overlay management.
   Encapsulates body overflow + backdrop side-effects + swipe-to-close.
   Exposed on window.SMSMobileDrawer (factory).
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  /**
   * Build a drawer/sheet controller for the given DOM refs.
   * Both drawer and sheet share the same backdrop; body overflow is locked
   * while either one is open.
   */
  function create(refs) {
    const {
      drawer, drawerClose, drawerSearchInput,
      sheet, sheetClose,
      backdrop
    } = refs;

    // Élément qui avait le focus avant l'ouverture : on le lui rend à la
    // fermeture, sinon la navigation clavier repart du haut du document.
    let lastFocused = null;

    function lockBody() { document.body.style.overflow = 'hidden'; }
    function maybeUnlockBody() {
      if (!drawer.classList.contains('is-open') &&
          !sheet.classList.contains('is-open')) {
        backdrop.classList.remove('is-visible');
        document.body.style.overflow = '';
      }
    }

    function rememberFocus() {
      if (!drawer.classList.contains('is-open') && !sheet.classList.contains('is-open')) {
        lastFocused = document.activeElement;
      }
    }

    function restoreFocus() {
      if (drawer.classList.contains('is-open') || sheet.classList.contains('is-open')) return;
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
      lastFocused = null;
    }

    function openDrawer(focusSearch = false) {
      rememberFocus();
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('is-visible');
      lockBody();
      if (focusSearch) {
        setTimeout(() => drawerSearchInput?.focus(), 320);
      }
    }

    function closeDrawer() {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      maybeUnlockBody();
      restoreFocus();
    }

    function openSheet() {
      rememberFocus();
      sheet.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('is-visible');
      lockBody();
    }

    function closeSheet(onClose) {
      const wasOpen = sheet.classList.contains('is-open');
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      maybeUnlockBody();
      if (typeof onClose === 'function') onClose();
      if (wasOpen) restoreFocus();
    }

    /**
     * Wire up button click + backdrop click + touch swipe-to-close.
     * `onSheetClose` runs after the sheet is closed (used to clear
     * lyric highlights).
     */
    function bindEvents({ onSheetClose } = {}) {
      drawerClose?.addEventListener('click', closeDrawer);
      sheetClose?.addEventListener('click', () => closeSheet(onSheetClose));
      backdrop?.addEventListener('click', () => {
        closeDrawer();
        closeSheet(onSheetClose);
      });

      // Échap ferme le panneau ouvert (clavier physique, iPad, Bluetooth).
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (sheet.classList.contains('is-open')) closeSheet(onSheetClose);
        else if (drawer.classList.contains('is-open')) closeDrawer();
      });

      const sheetBody = sheet.querySelector('.mobile-sheet__body');
      let startY = 0;
      let delta = 0;
      let dragging = false;

      // Le glissé ne doit prendre la main que si l'on part de la poignée,
      // ou si le texte est déjà en haut. Sinon, tirer vers le bas pour
      // remonter dans une longue annotation refermait la feuille au lieu
      // de faire défiler le texte.
      sheet.addEventListener('touchstart', e => {
        const fromHandle = e.target.closest('.mobile-sheet__handle-zone');
        dragging = !!fromHandle || !sheetBody || sheetBody.scrollTop <= 0;
        startY = e.touches[0].clientY;
        delta = 0;
      }, { passive: true });

      sheet.addEventListener('touchmove', e => {
        if (!dragging) return;
        delta = e.touches[0].clientY - startY;
        if (delta > 0) {
          sheet.style.transition = 'none';
          sheet.style.transform = `translateY(${delta}px)`;
        }
      }, { passive: true });

      sheet.addEventListener('touchend', () => {
        if (!dragging) return;
        sheet.style.transition = '';
        sheet.style.transform = '';
        if (delta > 80) closeSheet(onSheetClose);
        delta = 0;
        dragging = false;
      });
    }

    return { openDrawer, closeDrawer, openSheet, closeSheet, bindEvents };
  }

  window.SMSMobileDrawer = { create };
})();
