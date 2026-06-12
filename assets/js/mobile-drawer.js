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

    function lockBody() { document.body.style.overflow = 'hidden'; }
    function maybeUnlockBody() {
      if (!drawer.classList.contains('is-open') &&
          !sheet.classList.contains('is-open')) {
        backdrop.classList.remove('is-visible');
        document.body.style.overflow = '';
      }
    }

    function openDrawer(focusSearch = false) {
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
    }

    function openSheet() {
      sheet.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('is-visible');
      lockBody();
    }

    function closeSheet(onClose) {
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      maybeUnlockBody();
      if (typeof onClose === 'function') onClose();
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

      let startY = 0;
      let delta = 0;

      sheet.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY;
        delta = 0;
      }, { passive: true });

      sheet.addEventListener('touchmove', e => {
        delta = e.touches[0].clientY - startY;
        if (delta > 0) {
          sheet.style.transition = 'none';
          sheet.style.transform = `translateY(${delta}px)`;
        }
      }, { passive: true });

      sheet.addEventListener('touchend', () => {
        sheet.style.transition = '';
        sheet.style.transform = '';
        if (delta > 80) closeSheet(onSheetClose);
        delta = 0;
      });
    }

    return { openDrawer, closeDrawer, openSheet, closeSheet, bindEvents };
  }

  window.SMSMobileDrawer = { create };
})();
