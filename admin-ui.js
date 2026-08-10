/* Admin-only UI helpers - 2026-08-10 */
(function (global) {
  'use strict';

  function refreshStickyLayout() {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('scroll'));
    });
  }

  function releaseStickyLayouts() {
    document.querySelectorAll('.admin-tab-view > .sticky-dashboard').forEach(dashboard => {
      dashboard.classList.remove(
        'admin-final-fixed',
        'admin-v16-fixed',
        'admin-v13-fixed',
        'admin-js-fixed',
        'tab-dashboard-fixed',
        'js-sticky-fixed'
      );
    });

    document.querySelectorAll(
      '.admin-final-sticky-anchor,.admin-v16-sticky-spacer,.admin-v13-sticky-spacer,.tab-dashboard-pin-spacer,.sticky-dashboard-spacer'
    ).forEach(spacer => {
      spacer.classList.remove('active');
      spacer.style.height = '0px';
    });
  }

  function installFilterCollapse(viewId) {
    const view = document.getElementById(viewId);
    const dashboard = view?.querySelector(':scope > .sticky-dashboard');
    const filters = dashboard?.querySelector('.tab-search-actions');
    if (!dashboard || !filters || dashboard.querySelector('.filter-collapse-toggle')) return;

    if (!filters.id) filters.id = `${viewId}-filter-panel`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-collapse-toggle';
    button.setAttribute('aria-controls', filters.id);
    button.innerHTML = '<span class="filter-collapse-toggle-grip" aria-hidden="true"></span><span class="filter-collapse-toggle-label">필터 접기</span><span class="filter-collapse-toggle-arrow" aria-hidden="true"></span>';
    filters.insertAdjacentElement('afterend', button);

    let expanded = false;

    const scheduleLayoutRefresh = () => {
      refreshStickyLayout();
      setTimeout(refreshStickyLayout, 90);
      setTimeout(refreshStickyLayout, 320);
    };

    const apply = (animate = true) => {
      if (!animate) filters.style.setProperty('transition', 'none', 'important');
      dashboard.classList.toggle('filter-dashboard-collapsed', !expanded);
      filters.classList.toggle('filter-panel-collapsed', !expanded);
      filters.setAttribute('aria-hidden', expanded ? 'false' : 'true');
      try { filters.inert = !expanded; } catch (_) {}
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      button.setAttribute('aria-label', expanded ? '검색 및 필터 접기' : '검색 및 필터 펼치기');
      button.querySelector('.filter-collapse-toggle-label').textContent = expanded ? '필터 접기' : '필터 펼치기';
      scheduleLayoutRefresh();
      if (!animate) {
        requestAnimationFrame(() => {
          filters.style.removeProperty('transition');
          scheduleLayoutRefresh();
        });
      }
    };

    button.addEventListener('click', () => {
      expanded = !expanded;
      apply(true);
    });

    filters.addEventListener('transitionend', event => {
      if (event.target === filters && (event.propertyName === 'max-height' || event.propertyName === 'transform')) {
        refreshStickyLayout();
      }
    });

    apply(false);
  }

  function initAdminUi() {
    installFilterCollapse('view-personnel');
    installFilterCollapse('view-records');
  }

  global.LocationAdminUI = Object.freeze({
    refreshStickyLayout,
    releaseStickyLayouts,
    installFilterCollapse
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminUi, { once: true });
  } else {
    initAdminUi();
  }
})(window);
