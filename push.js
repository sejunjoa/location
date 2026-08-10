(function(){
  'use strict';

  const VAPID_PUBLIC_KEY = 'BEgPJKQnyeHSknIPIwEnxvwoLttja4te8FALzNO34TOpzodB4KhZBgLRepUbH8pRwVEyIeSitSONqrw64N-AZ34';
  const BUTTON_ID = 'pushNotificationSettingsBtn';
  const STATUS_ID = 'pushNotificationStatus';
  const PUSH_CLIENT_VERSION = '1.0.9';

  function button(){ return document.getElementById(BUTTON_ID); }
  function status(){ return document.getElementById(STATUS_ID); }

  function setUi(mode, message){
    const btn = button();
    const label = status();
    if (!btn || !label) return;

    btn.classList.remove('is-enabled','is-blocked');
    btn.disabled = false;

    if (mode === 'enabled') {
      btn.textContent = '푸시 알림 끄기';
      btn.classList.add('is-enabled');
    } else if (mode === 'blocked') {
      btn.textContent = '알림 권한이 차단됨';
      btn.classList.add('is-blocked');
      btn.disabled = true;
    } else if (mode === 'unsupported') {
      btn.textContent = '이 기기에서는 사용할 수 없음';
      btn.disabled = true;
    } else if (mode === 'busy') {
      btn.textContent = '처리 중...';
      btn.disabled = true;
    } else {
      btn.textContent = '푸시 알림 켜기';
    }

    label.textContent = message;
  }

  function base64UrlToUint8Array(value){
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from(raw, ch => ch.charCodeAt(0));
  }

  function applicationServerKeyMatches(subscription){
    const key = subscription?.options?.applicationServerKey;
    if (!key) return false;
    const expected = base64UrlToUint8Array(VAPID_PUBLIC_KEY);
    const current = new Uint8Array(key);
    if (expected.length !== current.length) return false;
    for (let i = 0; i < expected.length; i += 1) {
      if (expected[i] !== current[i]) return false;
    }
    return true;
  }

  async function saveSubscription(subscription){
    const json = subscription.toJSON();
    const endpoint = json.endpoint || subscription.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) throw new Error('푸시 구독 정보를 읽지 못했습니다.');

    const { error } = await sb.rpc('save_my_location_push_subscription', {
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: navigator.userAgent || null
    });
    if (error) throw error;
  }

  async function deleteSubscription(endpoint){
    if (!endpoint) return;
    const { error } = await sb.rpc('delete_my_location_push_subscription', {
      p_endpoint: endpoint
    });
    if (error) throw error;
  }

  function withTimeout(promise, timeoutMs, message){
    return Promise.race([
      promise,
      new Promise((_, reject) => window.setTimeout(() => reject(new Error(message)), timeoutMs))
    ]);
  }

  async function getRegistration({ timeoutMs = 6000, ensure = true } = {}){
    if (!('serviceWorker' in navigator)) return null;

    let registration = null;
    try {
      registration = await navigator.serviceWorker.getRegistration();
    } catch (_) {}

    if (!registration && ensure) {
      try {
        registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
      } catch (error) {
        throw new Error(`Service Worker 등록 실패: ${error?.message || String(error)}`);
      }
    }

    if (registration?.active) return registration;

    try {
      return await withTimeout(
        navigator.serviceWorker.ready,
        timeoutMs,
        'Service Worker가 활성 상태가 되지 않았습니다. 앱을 완전히 종료한 뒤 다시 실행해주세요.'
      );
    } catch (error) {
      const state = registration?.installing?.state || registration?.waiting?.state || '없음';
      throw new Error(`${error?.message || String(error)} (현재 worker 상태: ${state})`);
    }
  }

  async function refresh({ syncServer = true } = {}){
    if (!button() || !status()) return;
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
      setUi('unsupported', '이 브라우저는 Web Push 알림을 지원하지 않습니다.');
      return;
    }

    if (Notification.permission === 'denied') {
      setUi('blocked', '브라우저 또는 휴대전화 설정에서 이 사이트의 알림 권한을 허용해야 합니다.');
      return;
    }

    try {
      const registration = await getRegistration();
      let subscription = await registration.pushManager.getSubscription();

      if (subscription && !applicationServerKeyMatches(subscription)) {
        const oldEndpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => false);
        await deleteSubscription(oldEndpoint).catch(() => {});
        subscription = null;
      }

      if (subscription) {
        if (syncServer) await saveSubscription(subscription);
        setUi('enabled', '새 이동 기록과 신규 가입 신청을 이 기기에서 알림으로 받습니다.');
      } else {
        setUi('disabled', Notification.permission === 'granted'
          ? '알림 권한은 허용되어 있습니다. 아래 버튼을 눌러 이 기기를 등록하세요.'
          : '아래 버튼을 눌러 알림 권한을 허용하고 이 기기를 등록하세요.');
      }
    } catch (error) {
      console.warn('푸시 알림 상태 확인 실패:', error);
      setUi('disabled', '푸시 알림 상태를 확인하지 못했습니다. 다시 시도해주세요.');
    }
  }

  async function enablePush(){
    setUi('busy', '푸시 알림을 설정하는 중입니다.');
    try {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          await refresh({ syncServer: false });
          return;
        }
      }
      if (Notification.permission !== 'granted') {
        await refresh({ syncServer: false });
        return;
      }

      const registration = await getRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !applicationServerKeyMatches(subscription)) {
        const oldEndpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => false);
        await deleteSubscription(oldEndpoint).catch(() => {});
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      await saveSubscription(subscription);
      setUi('enabled', '푸시 알림이 켜졌습니다. 새 이동 기록과 신규 가입 신청을 알려드립니다.');
    } catch (error) {
      console.error('푸시 알림 등록 실패:', error);
      setUi('disabled', error?.message || '푸시 알림을 등록하지 못했습니다.');
    }
  }

  async function disablePush(){
    setUi('busy', '푸시 알림을 해제하는 중입니다.');
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await deleteSubscription(endpoint).catch(error => console.warn('서버 구독 삭제 실패:', error));
      }
      setUi('disabled', '이 기기의 푸시 알림이 꺼졌습니다.');
    } catch (error) {
      console.error('푸시 알림 해제 실패:', error);
      setUi('disabled', error?.message || '푸시 알림을 해제하지 못했습니다.');
    }
  }

  async function toggle(){
    if (!('Notification' in window) || !('PushManager' in window)) return;
    const registration = await getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription && applicationServerKeyMatches(subscription)) await disablePush();
    else await enablePush();
  }

  async function clearSubscriptionBeforeLogout(){
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      const endpoint = subscription.endpoint;
      await deleteSubscription(endpoint).catch(() => {});
      await subscription.unsubscribe().catch(() => false);
    } catch (error) {
      console.warn('로그아웃 전 푸시 구독 정리 실패:', error);
    }
  }

  function installLogoutCleanup(){
    if (typeof window.logout !== 'function' || window.logout.__locationPushWrapped) return;
    const originalLogout = window.logout;
    const wrapped = async function(...args){
      await clearSubscriptionBeforeLogout();
      return originalLogout.apply(this, args);
    };
    wrapped.__locationPushWrapped = true;
    window.logout = wrapped;
  }

  function openPushTargetTab(){
    const url = new URL(location.href);
    const target = url.searchParams.get('push');
    const buttonId = target === 'records'
      ? 'adminTabRecords'
      : target === 'applications'
        ? 'adminTabPersonnel'
        : '';
    if (!buttonId) return;

    window.setTimeout(() => {
      document.getElementById(buttonId)?.click();
      url.searchParams.delete('push');
      history.replaceState(history.state, document.title, url.pathname + url.search + url.hash);
    }, 350);
  }


  function diagnosticStatus(){ return document.getElementById('pushDiagnosticStatus'); }

  function setDiagnosticText(message){
    const el = diagnosticStatus();
    if (el) el.textContent = message;
  }

  async function showLocalTestNotification(){
    setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · 로컬 테스트 준비 중...`);
    try {
      if (!window.isSecureContext) {
        setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · 실패: HTTPS 보안 연결이 아닙니다.`);
        return;
      }
      if (!('Notification' in window)) {
        setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · 실패: Notification API를 지원하지 않습니다.`);
        return;
      }
      if (Notification.permission !== 'granted') {
        setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · 알림 권한=${Notification.permission}. 먼저 푸시 알림을 켜주세요.`);
        return;
      }
      if (!('serviceWorker' in navigator)) {
        setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · 실패: Service Worker를 지원하지 않습니다.`);
        return;
      }

      setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · Service Worker 확인 중...`);
      const registration = await getRegistration({ timeoutMs: 6000, ensure: true });
      if (!registration) throw new Error('Service Worker 등록 정보를 찾지 못했습니다.');
      if (!registration.active) throw new Error('활성 Service Worker가 없습니다.');
      if (typeof registration.showNotification !== 'function') throw new Error('showNotification API를 사용할 수 없습니다.');

      setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · 알림 표시 API 호출 중...`);
      await withTimeout(
        registration.showNotification('푸시 알림 표시 테스트', {
          body: '이 알림이 보이면 휴대전화의 알림 표시 기능은 정상입니다.',
          icon: './icons/icon-192.png',
          badge: './icons/icon-96.png',
          tag: `location-local-test-${Date.now()}`,
          data: { url: './location_admin.html' }
        }),
        6000,
        '알림 표시 API 응답 시간이 초과되었습니다.'
      );
      setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · 로컬 알림 표시 요청 성공 · SW active=${registration.active?.state || 'unknown'} · controller=${navigator.serviceWorker.controller ? 'yes' : 'no'}`);
    } catch (error) {
      setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · 로컬 테스트 실패: ${error?.message || String(error)}`);
    }
  }

  async function requestPushDiagnostic(){
    if (!('serviceWorker' in navigator)) {
      setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · Service Worker 미지원`);
      return;
    }
    try {
      const registration = await getRegistration({ timeoutMs: 4000, ensure: true });
      const worker = navigator.serviceWorker.controller || registration?.active;
      if (!worker) {
        setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · 활성 Service Worker를 찾지 못했습니다.`);
        return;
      }
      worker.postMessage({ type: 'GET_PUSH_DIAGNOSTIC' });
      window.setTimeout(() => {
        const el = diagnosticStatus();
        if (el && el.textContent.includes('Service Worker 진단 응답 대기 중')) {
          setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · Service Worker 진단 응답 없음 · controller=${navigator.serviceWorker.controller ? 'yes' : 'no'} · active=${registration?.active?.state || 'no'}`);
        }
      }, 2500);
      setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · Service Worker 진단 응답 대기 중...`);
    } catch (error) {
      setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · Service Worker 확인 실패: ${error?.message || String(error)}`);
    }
  }

  navigator.serviceWorker?.addEventListener?.('message', event => {
    if (event.data?.type !== 'LOCATION_PUSH_DIAGNOSTIC') return;
    const version = event.data?.serviceWorkerVersion || '?';
    const diag = event.data?.diagnostic;
    if (!diag) {
      setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · Service Worker ${version} · 아직 실제 Push 수신 기록이 없습니다.`);
      return;
    }
    const stateMap = {
      received: '실제 Push 수신됨 · 알림 표시 처리 중',
      shown: '실제 Push 수신 및 알림 표시 성공',
      'fallback-shown': '실제 Push 수신됨 · 기본 알림으로 표시 성공',
      'show-error': '실제 Push 수신됨 · 알림 표시 오류',
      'fallback-error': '실제 Push 수신됨 · 기본 알림 표시도 실패'
    };
    const state = stateMap[diag.state] || diag.state || '알 수 없음';
    const error = diag.detail?.message ? ` · ${diag.detail.message}` : '';
    setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · Service Worker ${version} · ${state}${error} · ${diag.at || ''}`);
  });

  function initializePushUi(){
    installLogoutCleanup();
    openPushTargetTab();

    setDiagnosticText(`Push 진단 ${PUSH_CLIENT_VERSION} · 스크립트 로드됨 · Service Worker 확인 대기`);

    const btn = button();
    if (btn && !btn.dataset.locationPushBound) {
      btn.dataset.locationPushBound = '1';
      btn.addEventListener('click', toggle);
    }
    const testBtn = document.getElementById('pushNotificationTestBtn');
    if (testBtn && !testBtn.dataset.locationPushBound) {
      testBtn.dataset.locationPushBound = '1';
      testBtn.addEventListener('click', showLocalTestNotification);
    }

    refresh().catch(() => {});
    window.setTimeout(requestPushDiagnostic, 300);

    const settingsButton = document.getElementById('settingsBtn');
    if (settingsButton && !settingsButton.dataset.locationPushBound) {
      settingsButton.dataset.locationPushBound = '1';
      settingsButton.addEventListener('click', () => {
        window.setTimeout(() => { refresh().catch(() => {}); requestPushDiagnostic(); }, 80);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePushUi, { once: true });
  } else {
    initializePushUi();
  }

  window.LocationPush = { refresh, showLocalTestNotification, requestPushDiagnostic, version: PUSH_CLIENT_VERSION };
})();
