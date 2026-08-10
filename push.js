(function(){
  'use strict';

  const VAPID_PUBLIC_KEY = 'BEgPJKQnyeHSknIPIwEnxvwoLttja4te8FALzNO34TOpzodB4KhZBgLRepUbH8pRwVEyIeSitSONqrw64N-AZ34';
  const BUTTON_ID = 'pushNotificationSettingsBtn';
  const STATUS_ID = 'pushNotificationStatus';

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

  async function getRegistration(){
    if (!('serviceWorker' in navigator)) return null;
    return navigator.serviceWorker.ready;
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

  document.addEventListener('DOMContentLoaded', () => {
    installLogoutCleanup();
    openPushTargetTab();

    const btn = button();
    if (!btn) return;
    btn.addEventListener('click', toggle);
    refresh().catch(() => {});

    const settingsButton = document.getElementById('settingsBtn');
    settingsButton?.addEventListener('click', () => {
      window.setTimeout(() => refresh().catch(() => {}), 80);
    });
  });

  window.LocationPush = { refresh };
})();
