(function(){
  'use strict';

  if (window.__locationMobileBackInstalled) return;
  window.__locationMobileBackInstalled = true;

  const STATE_KEY = '__location_ui_history_v2';
  const BLOCKING_MODAL_IDS = new Set(['companyModal', 'homeZoneModal']);
  const CLOSE_BUTTON_BY_OVERLAY_ID = {
    pwaInstallDialogBackdrop: '.pwa-install-dialog-close',
    pwaUpdateDialogBackdrop: '.pwa-update-dialog-later, .pwa-update-dialog-close',

    settingsHomePickerModal: '#settingsHomePickerCloseButton',
    userRecordsPeriodModal: '#userRecordsPeriodCloseButton, #userRecordsPeriodCancelButton',
    moveModal: '#moveCloseBtn, #moveCancelBtn',
    settingsModal: '#settingsCloseBtn, #settingsModalCloseBtn, #settingsBottomCloseBtn',
    messageModal: '#messageCloseBtn',
    confirmModal: '#confirmCancelBtn',

    zoneFilterModal: '#zoneFilterCloseButton',
    recordsPeriodModal: '#recordsPeriodCloseButton, #recordsPeriodCancelButton',
    zoneModal: '#zoneModalCloseBtn, #cancelZoneBtn',
    deleteZoneConfirmModal: '#cancelDeleteZoneBtn',
    inputWarningModal: '#closeInputWarningBtn',
    adminLogoutConfirmModal: '#adminLogoutConfirmCancel',

    actionToastBackdrop: '#actionToastCancelBtn',
    sheetBackdrop: '#sheetClose'
  };

  let sequence = 0;
  let restoringTab = null;
  let restoreTimer = 0;
  let historyReady = false;
  let leavingDocument = false;

  function getTabConfig(){
    if (document.querySelector('[data-user-tab]')) {
      return {
        buttonSelector: '[data-user-tab]',
        viewSelector: '[data-user-tab-view]',
        buttonKey: 'userTab',
        viewKey: 'userTabView'
      };
    }
    if (document.querySelector('[data-admin-tab]')) {
      return {
        buttonSelector: '[data-admin-tab]',
        viewSelector: '[data-admin-tab-view]',
        buttonKey: 'adminTab',
        viewKey: 'adminTabView'
      };
    }
    return null;
  }

  function getActiveTab(config = getTabConfig()){
    if (!config) return null;
    const visibleView = Array.from(document.querySelectorAll(config.viewSelector))
      .find(view => !view.hidden);
    if (visibleView?.dataset?.[config.viewKey]) return visibleView.dataset[config.viewKey];
    const activeButton = document.querySelector(`${config.buttonSelector}.active`);
    return activeButton?.dataset?.[config.buttonKey] || null;
  }

  function makeState(tab, kind = 'entry'){
    const current = history.state && typeof history.state === 'object' ? history.state : {};
    return {
      ...current,
      [STATE_KEY]: true,
      locationUiKind: kind,
      locationUiSeq: ++sequence,
      locationUiTab: tab || null
    };
  }

  function pushCurrentUiState(kind = 'entry'){
    try {
      history.pushState(makeState(getActiveTab(), kind), document.title, location.href);
      return true;
    } catch (_) {
      return false;
    }
  }

  function isElementVisible(element){
    if (!(element instanceof HTMLElement)) return false;
    if (element.hidden) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0;
  }

  function isOpenOverlay(element){
    if (!(element instanceof HTMLElement) || !isElementVisible(element)) return false;
    if (element.matches('dialog[open]')) return true;
    if (element.classList.contains('open')) return true;
    return element.getAttribute('aria-hidden') === 'false';
  }

  function numericZIndex(element){
    const parsed = Number.parseInt(getComputedStyle(element).zIndex, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function topOpenOverlay(){
    const selector = [
      '.modal-backdrop',
      '.sheet-backdrop',
      '.action-toast-backdrop',
      '.person-card-zoom-backdrop',
      '.pwa-install-dialog-backdrop',
      '.pwa-update-dialog-backdrop',
      'dialog[open]'
    ].join(',');
    const overlays = Array.from(document.querySelectorAll(selector)).filter(isOpenOverlay);
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

    // 최초 가입 시 반드시 완료해야 하는 입력창은 뒤로가기로 우회할 수 없게 유지한다.
    if (BLOCKING_MODAL_IDS.has(overlay.id)) return true;

    if (overlay.classList.contains('person-card-zoom-backdrop')) {
      overlay.click();
      return true;
    }

    const mappedSelector = CLOSE_BUTTON_BY_OVERLAY_ID[overlay.id];
    const genericSelector = [
      '.dialog-close-btn', '.sheet-close', '.pwa-install-dialog-close',
      '.pwa-update-dialog-later', '.pwa-update-dialog-close',
      '[data-modal-close]', '[data-close]'
    ].join(',');
    const closeButton = (mappedSelector ? overlay.querySelector(mappedSelector) : null)
      || overlay.querySelector(genericSelector)
      || (mappedSelector ? document.querySelector(mappedSelector) : null);

    if (closeButton instanceof HTMLElement && !closeButton.hidden && !closeButton.disabled) {
      closeButton.click();
      return true;
    }

    if (overlay.matches('dialog[open]') && typeof overlay.close === 'function') {
      overlay.close();
      return true;
    }

    // 기존의 '배경 터치 시 닫기' 핸들러를 그대로 재사용한다.
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }

  function forceTab(config, targetTab){
    document.querySelectorAll(config.viewSelector).forEach(view => {
      view.hidden = view.dataset[config.viewKey] !== targetTab;
    });
    document.querySelectorAll(config.buttonSelector).forEach(button => {
      const active = button.dataset[config.buttonKey] === targetTab;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.dispatchEvent(new Event('scroll'));
  }

  function restoreTab(targetTab){
    const config = getTabConfig();
    if (!config || !targetTab) return false;
    if (getActiveTab(config) === targetTab) return true;

    const targetButton = Array.from(document.querySelectorAll(config.buttonSelector))
      .find(button => button.dataset[config.buttonKey] === targetTab);
    if (!targetButton) return false;

    restoringTab = targetTab;
    targetButton.click();

    if (restoreTimer) clearTimeout(restoreTimer);
    restoreTimer = window.setTimeout(() => {
      if (getActiveTab(config) !== targetTab) forceTab(config, targetTab);
      restoringTab = null;
      restoreTimer = 0;
    }, 520);
    return true;
  }

  function setupTabHistory(){
    const config = getTabConfig();
    if (!config) return;

    let lastTab = getActiveTab(config);
    const views = Array.from(document.querySelectorAll(config.viewSelector));
    if (!views.length) return;

    const observer = new MutationObserver(() => {
      const nextTab = getActiveTab(config);
      if (!nextTab || nextTab === lastTab) return;
      lastTab = nextTab;

      if (restoringTab === nextTab) {
        restoringTab = null;
        if (restoreTimer) {
          clearTimeout(restoreTimer);
          restoreTimer = 0;
        }
        return;
      }

      if (historyReady) pushCurrentUiState('tab');
    });

    views.forEach(view => observer.observe(view, { attributes: true, attributeFilter: ['hidden'] }));

    // 클릭 전환은 애니메이션이 끝나기 전에도 목적지를 기억해 두어 빠른 연속 뒤로가기도 안정적으로 처리한다.
    window.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest(config.buttonSelector);
      if (!button || restoringTab) return;
      const nextTab = button.dataset[config.buttonKey];
      const currentTab = getActiveTab(config);
      if (!nextTab || nextTab === currentTab) return;
      // 실제 history.pushState는 전환 완료를 확인한 MutationObserver가 담당한다.
    }, true);
  }

  function setupHistoryGuard(){
    const tab = getActiveTab();
    try {
      const existing = history.state && typeof history.state === 'object' ? history.state : {};
      history.replaceState({
        ...existing,
        [STATE_KEY]: true,
        locationUiKind: 'base',
        locationUiSeq: ++sequence,
        locationUiTab: tab || null
      }, document.title, location.href);
      history.pushState(makeState(tab, 'guard'), document.title, location.href);
      historyReady = true;
    } catch (_) {
      historyReady = false;
    }
  }

  function returnToCurrentEntry(){
    if (!historyReady) return;
    pushCurrentUiState('guard');
  }

  window.addEventListener('pagehide', () => { leavingDocument = true; });
  window.addEventListener('pageshow', () => { leavingDocument = false; });

  window.addEventListener('popstate', event => {
    if (!historyReady) return;

    // 1순위: 열린 팝업/시트 하나만 닫고 현재 탭에 머문다.
    if (closeTopOverlay()) {
      returnToCurrentEntry();
      return;
    }

    const state = event.state;
    const targetTab = state && state[STATE_KEY] ? state.locationUiTab : null;
    const currentTab = getActiveTab();

    // 2순위: history에 기록된 직전 탭으로 복귀한다.
    if (targetTab && targetTab !== currentTab) {
      restoreTab(targetTab);
      return;
    }

    // base 엔트리에 도달했는데 탭도 같다면 앱 내부에서 더 닫을 것이 없는 상태다.
    if (state && state[STATE_KEY] && state.locationUiKind === 'base') {
      try { history.back(); } catch (_) { returnToCurrentEntry(); }
      return;
    }

    // 같은 탭의 중복 엔트리가 남아 있으면 한 칸 더 뒤로 이동한다.
    if (state && state[STATE_KEY] && targetTab === currentTab) {
      try { history.back(); } catch (_) { returnToCurrentEntry(); }
      return;
    }

    // 외부 문서로 이동이 시작되지 않았다면 다시 guard를 세운다.
    window.setTimeout(() => {
      if (!leavingDocument && document.visibilityState !== 'hidden') returnToCurrentEntry();
    }, 180);
  });

  function initialize(){
    setupTabHistory();
    setupHistoryGuard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
