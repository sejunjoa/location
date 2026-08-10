/* Location shared UI utilities - 2026-08-10 */
(function (global) {
  'use strict';

  function formatTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(value));
  }

  function formatRecordDateTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(value));
  }

  function restoreInline(element, value) {
    if (!element) return;
    value === null ? element.removeAttribute('style') : element.setAttribute('style', value);
  }

  function createHomeBadgeElement(label, color) {
    const badge = document.createElement('span');
    badge.className = 'sheet-home-badge';
    badge.style.setProperty('--badge-color', color || '#64748b');
    badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-7 7c0 5.25 7 12.5 7 12.5s7-7.25 7-12.5a7 7 0 0 0-7-7Zm0 9.65a2.65 2.65 0 1 1 0-5.3 2.65 2.65 0 0 1 0 5.3Z"/></svg><span></span>';
    badge.querySelector('span').textContent = label || '미지정';
    return badge;
  }

  global.LocationCommon = Object.freeze({
    formatTime,
    formatRecordDateTime,
    restoreInline,
    createHomeBadgeElement
  });

  /* 기존 인라인 호출부와의 호환성을 유지하는 전역 별칭 */
  global.formatTime = formatTime;
  global.formatRecordDateTime = formatRecordDateTime;
  global.restoreInline = restoreInline;
  global.createHomeBadge = createHomeBadgeElement;
  global.makeHomeBadge = createHomeBadgeElement;
  global.createV14HomeBadge = createHomeBadgeElement;
  global.createV26HomeBadge = createHomeBadgeElement;
})(window);
