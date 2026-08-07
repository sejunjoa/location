(function(){
  'use strict';

  if (window.__locationMobileBackInstalled) return;
  window.__locationMobileBackInstalled = true;

  const GUARD_KEY = '__location_mobile_back_guard_v1';
  const BLOCKING_MODAL_IDS = new Set(['companyModal', 'homeZoneModal']);
  const CLOSE_BUTTON_BY_OVERLAY_ID = {
    pwaInstallDialogBackdrop: '.pwa-install-dialog-close',

    // 일반 사용자
    settingsHomePickerModal: '#settingsHomePickerCloseButton',
    userRecordsPeriodModal: '#userRecordsPeriodCloseButton',
    moveModal: '#moveCloseBtn',
    settingsModal: '#settingsCloseBtn, #settingsModalCloseBtn',
    messageModal: '#messageCloseBtn',
    confirmModal: '#confirmCancelBtn',

    // 관리자
    zoneFilterModal: '#zoneFilterCloseButton',
    recordsPeriodModal: '#recordsPeriodCloseButton',
    zoneModal: '#cancelZoneBtn',
    deleteZoneConfirmModal: '#cancelDeleteZoneBtn',
    inputWarningModal: '#closeInputWarningBtn',
    adminLogoutConfirmModal: '#adminLogoutConfirmCancel',

    // 공통
    actionToastBackdrop: '#actionToastCancelBtn',
    sheetBackdrop: '#sheetClose'
  };

  let guardArmed = false;
  let pageLeaving = false;
  let tabBackHandler = null;

  function currentStateWithGuard(){
    const current = history.state && typeof history.state === 'object'
      ? history.state
      : {};
    return { ...current, [GUARD_KEY]: true };
  }

  function armGuard(){
    if (guardArmed) return;
    if (history.state?.[GUARD_KEY] === true) {
      guardArmed = true;
      return;
    }
    try {
      history.pushState(currentStateWithGuard(), document.title, location.href);
      guardArmed = true;
    } catch (_) {
      guardArmed = false;
    }
  }

  function isOpenOverlay(element){
    if (!(element instanceof HTMLElement)) return false;
    if (!element.classList.contains('open')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function numericZIndex(element){
    const parsed = Number.parseInt(getComputedStyle(element).zIndex, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function topOpenOverlay(){
    const overlays = Array.from(document.querySelectorAll(
      '.modal-backdrop.open, .sheet-backdrop.open, .action-toast-backdrop.open, .person-card-zoom-backdrop.open, .pwa-install-dialog-backdrop.open'
    )).filter(isOpenOverlay);

    if (!overlays.length) return null;

    overlays.sort((a, b) => {
      const zDiff = numericZIndex(a) - numericZIndex(b);
      if (zDiff) return zDiff;
      if (a === b) return 0;
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });
    return overlays[overlays.length - 1] || null;
  }

  function closeTopOverlay(){
    const overlay = topOpenOverlay();
    if (!overlay) return false;

    // 최초 가입 필수 입력창은 기존 정책대로 뒤로가기로 닫지 않는다.
    if (BLOCKING_MODAL_IDS.has(overlay.id)) return true;

    if (overlay.classList.contains('person-card-zoom-backdrop')) {
      overlay.click();
      return true;
    }

    const selector = CLOSE_BUTTON_BY_OVERLAY_ID[overlay.id];
    const closeButton = selector ? overlay.querySelector(selector) || document.querySelector(selector) : null;
    if (closeButton instanceof HTMLElement && !closeButton.hidden && !closeButton.disabled) {
      closeButton.click();
      return true;
    }

    // 닫기 버튼을 찾지 못한 임시/동적 팝업도 바깥 영역 터치 닫기 로직을 재사용한다.
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }

  function setupTabHistory(){
    const userButtons = Array.from(document.querySelectorAll('[data-user-tab]'));
    const adminButtons = Array.from(document.querySelectorAll('[data-admin-tab]'));
    const buttons = userButtons.length ? userButtons : adminButtons;
    if (!buttons.length) return;

    const dataAttribute = userButtons.length ? 'userTab' : 'adminTab';
    let currentTab = buttons.find(button => button.classList.contains('active'))?.dataset[dataAttribute] || null;
    const backStack = [];
    let restoringTarget = null;
    let restoreTimer = 0;

    function getActiveTab(){
      return buttons.find(button => button.classList.contains('active'))?.dataset[dataAttribute] || null;
    }

    function finishRestoreIfNeeded(nextTab){
      if (!restoringTarget || nextTab !== restoringTarget) return false;
      restoringTarget = null;
      if (restoreTimer) {
        clearTimeout(restoreTimer);
        restoreTimer = 0;
      }
      return true;
    }

    const observer = new MutationObserver(() => {
      const nextTab = getActiveTab();
      if (!nextTab || nextTab === currentTab) return;

      if (!finishRestoreIfNeeded(nextTab) && currentTab) {
        backStack.push(currentTab);
        if (backStack.length > 40) backStack.shift();
      }
      currentTab = nextTab;
    });

    buttons.forEach(button => observer.observe(button, { attributes: true, attributeFilter: ['class'] }));

    tabBackHandler = function(){
      if (restoringTarget) return true;

      while (backStack.length && backStack[backStack.length - 1] === currentTab) {
        backStack.pop();
      }
      const targetTab = backStack.pop();
      if (!targetTab) return false;

      const targetButton = buttons.find(button => button.dataset[dataAttribute] === targetTab);
      if (!targetButton) return false;

      restoringTarget = targetTab;
      targetButton.click();

      // 전환이 차단되었거나 취소되면 스택을 복구한다.
      restoreTimer = window.setTimeout(() => {
        const activeTab = getActiveTab();
        if (activeTab === targetTab) {
          currentTab = targetTab;
          restoringTarget = null;
          restoreTimer = 0;
          return;
        }
        if (restoringTarget === targetTab) {
          backStack.push(targetTab);
          restoringTarget = null;
          restoreTimer = 0;
        }
      }, 650);

      return true;
    };
  }

  function continueNativeBack(){
    const href = location.href;
    pageLeaving = false;
    try {
      history.back();
    } catch (_) {
      armGuard();
      return;
    }

    // 홈 화면 PWA처럼 이전 문서가 없는 경우에도 이후 뒤로가기를 계속 처리할 수 있게 재무장한다.
    window.setTimeout(() => {
      if (!pageLeaving && location.href === href && !guardArmed) armGuard();
    }, 180);
  }

  window.addEventListener('pagehide', () => { pageLeaving = true; });
  window.addEventListener('pageshow', () => { pageLeaving = false; });

  window.addEventListener('popstate', () => {
    if (!guardArmed) return;
    guardArmed = false;

    if (closeTopOverlay()) {
      armGuard();
      return;
    }

    if (typeof tabBackHandler === 'function' && tabBackHandler()) {
      armGuard();
      return;
    }

    continueNativeBack();
  });

  function initialize(){
    setupTabHistory();
    armGuard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
