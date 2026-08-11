// 약관/개인정보 동의 버전 관리
const LOCATION_POLICY_CONFIG = Object.freeze({
  terms: Object.freeze({
    key: 'terms',
    title: '서비스 이용약관',
    version: window.LOCATION_LEGAL_CONTENT?.terms?.version || '2026-08-11.2',
    documentKey: 'terms'
  }),
  privacy: Object.freeze({
    key: 'privacy',
    title: '개인정보 수집·이용 동의',
    version: window.LOCATION_LEGAL_CONTENT?.privacy_consent?.version || '2026-08-11.2',
    documentKey: 'privacy_consent'
  }),
  third_party: Object.freeze({
    key: 'third_party',
    title: '개인정보 제3자 제공 동의',
    version: window.LOCATION_LEGAL_CONTENT?.third_party_consent?.version || '2026-08-11.2',
    documentKey: 'third_party_consent'
  })
});

async function getPolicyConsentStatus(userId){
  const keys = Object.keys(LOCATION_POLICY_CONFIG);
  const { data, error } = await sb
    .from('user_policy_consents')
    .select('policy_key,policy_version,agreed_at')
    .eq('user_id', userId)
    .in('policy_key', keys);

  if(error){
    return { allCurrent:false, current:{}, missing:keys, rows:[], error };
  }

  const rows = Array.isArray(data) ? data : [];
  const byKey = new Map(rows.map(row => [row.policy_key, row]));
  const current = {};
  const missing = [];

  keys.forEach(key => {
    const row = byKey.get(key);
    const isCurrent = row?.policy_version === LOCATION_POLICY_CONFIG[key].version;
    current[key] = Boolean(isCurrent);
    if(!isCurrent) missing.push(key);
  });

  return {
    allCurrent: missing.length === 0,
    current,
    missing,
    rows,
    error:null
  };
}

async function savePolicyConsents(userId, policyKeys = Object.keys(LOCATION_POLICY_CONFIG)){
  const uniqueKeys = [...new Set(policyKeys)].filter(key => LOCATION_POLICY_CONFIG[key]);
  if(uniqueKeys.length === 0) return { data:[], error:null };

  const rows = uniqueKeys.map(key => ({
    user_id: userId,
    policy_key: key,
    policy_version: LOCATION_POLICY_CONFIG[key].version
  }));

  return sb
    .from('user_policy_consents')
    .upsert(rows, { onConflict:'user_id,policy_key' })
    .select('policy_key,policy_version,agreed_at');
}

function ensurePolicyConsentGateStyles(){
  if(document.getElementById('policyConsentGateStyles')) return;
  const style = document.createElement('style');
  style.id = 'policyConsentGateStyles';
  style.textContent = `
    .policy-consent-gate{position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,0);opacity:0;visibility:hidden;pointer-events:none;-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0);transition:opacity .2s ease,background-color .2s ease,backdrop-filter .2s ease,visibility 0s linear .22s;}
    .policy-consent-gate.open{opacity:1;visibility:visible;pointer-events:auto;background:rgba(15,23,42,.52);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);transition-delay:0s;}
    .policy-consent-panel{width:min(430px,100%);max-height:min(86vh,720px);overflow:auto;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 24px 64px rgba(15,23,42,.24);padding:22px;opacity:0;transform:translateY(14px) scale(.985);transition:opacity .2s ease,transform .24s cubic-bezier(.22,.8,.28,1);}
    .policy-consent-gate.open .policy-consent-panel{opacity:1;transform:translateY(0) scale(1);}
    .policy-consent-title{margin:0;text-align:center;color:#0f172a;font-size:21px;font-weight:800;letter-spacing:-.35px;}
    .policy-consent-copy{margin:10px 0 18px;text-align:center;color:#64748b;font-size:13px;line-height:1.6;word-break:keep-all;}
    .policy-consent-items{display:grid;gap:10px;}
    .policy-consent-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;}
    .policy-consent-item-title{min-width:0;color:#0f172a;font-size:14px;font-weight:750;line-height:1.4;word-break:keep-all;}
    .policy-consent-item-actions{display:flex;align-items:center;gap:10px;white-space:nowrap;}
    .policy-consent-view{color:#2563eb;font-size:12px;font-weight:750;text-decoration:none;}
    .policy-consent-view:hover{text-decoration:underline;}
    .policy-consent-check{display:inline-flex;align-items:center;gap:5px;color:#475569;font-size:12px;font-weight:700;cursor:pointer;}
    .policy-consent-check input{width:18px;height:18px;margin:0;accent-color:#2563eb;}
    .policy-consent-check input:disabled{opacity:.7;}
    .policy-consent-current{color:#16a34a;font-size:11px;font-weight:800;}
    .policy-consent-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:10px;margin-top:18px;}
    .policy-consent-actions button{min-height:46px;border-radius:11px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;}
    .policy-consent-logout{border:1px solid #cbd5e1;background:#fff;color:#475569;}
    .policy-consent-submit{border:1px solid #1d4ed8;background:#2563eb;color:#fff;}
    .policy-consent-submit:disabled{cursor:default;opacity:.45;}
    @media(max-width:480px){
      .policy-consent-gate{align-items:flex-end;padding:0;}
      .policy-consent-panel{width:100%;max-height:90dvh;border-radius:18px 18px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom));transform:translateY(34px);}
      .policy-consent-gate.open .policy-consent-panel{transform:translateY(0);}
      .policy-consent-item{grid-template-columns:1fr;gap:9px;}
      .policy-consent-item-actions{justify-content:space-between;}
    }
    @media(prefers-reduced-motion:reduce){
      .policy-consent-gate,.policy-consent-panel{transition:none!important;}
    }
  `;
  document.head.appendChild(style);
}

function createPolicyConsentGate(){
  let backdrop = document.getElementById('policyConsentGate');
  if(backdrop) return backdrop;
  ensurePolicyConsentGateStyles();

  backdrop = document.createElement('div');
  backdrop.id = 'policyConsentGate';
  backdrop.className = 'policy-consent-gate';
  backdrop.setAttribute('aria-hidden','true');
  backdrop.innerHTML = `
    <section class="policy-consent-panel" role="dialog" aria-modal="true" aria-labelledby="policyConsentGateTitle">
      <h2 class="policy-consent-title" id="policyConsentGateTitle">약관 동의</h2>
      <p class="policy-consent-copy">서비스 이용을 계속하려면 현재 약관에 동의해주세요.</p>
      <div class="policy-consent-items">
        <div class="policy-consent-item" data-policy-row="terms">
          <div class="policy-consent-item-title">${LOCATION_POLICY_CONFIG.terms.title}</div>
          <div class="policy-consent-item-actions">
            <a class="policy-consent-view" href="#" data-legal-doc="terms">전문보기</a>
            <label class="policy-consent-check"><span>동의</span><input type="checkbox" data-policy-check="terms"></label>
          </div>
        </div>
        <div class="policy-consent-item" data-policy-row="privacy">
          <div class="policy-consent-item-title">${LOCATION_POLICY_CONFIG.privacy.title}</div>
          <div class="policy-consent-item-actions">
            <a class="policy-consent-view" href="#" data-legal-doc="privacy_consent">전문보기</a>
            <label class="policy-consent-check"><span>동의</span><input type="checkbox" data-policy-check="privacy"></label>
          </div>
        </div>
        <div class="policy-consent-item" data-policy-row="third_party">
          <div class="policy-consent-item-title">${LOCATION_POLICY_CONFIG.third_party.title}</div>
          <div class="policy-consent-item-actions">
            <a class="policy-consent-view" href="#" data-legal-doc="third_party_consent">전문보기</a>
            <label class="policy-consent-check"><span>동의</span><input type="checkbox" data-policy-check="third_party"></label>
          </div>
        </div>
      </div>
      <div class="policy-consent-actions">
        <button class="policy-consent-logout" type="button" data-policy-action="logout">로그아웃</button>
        <button class="policy-consent-submit" type="button" data-policy-action="submit" disabled>동의하고 계속</button>
      </div>
    </section>
  `;
  document.body.appendChild(backdrop);
  return backdrop;
}

function showPolicyConsentGate(gate){
  gate.setAttribute('aria-hidden','false');
  void gate.offsetWidth;
  gate.classList.add('open');
}

function hidePolicyConsentGate(gate){
  gate.classList.remove('open');
  gate.setAttribute('aria-hidden','true');
}

async function ensureCurrentPolicyConsentInteractive(user){
  if(!user?.id) return false;
  const state = await getPolicyConsentStatus(user.id);
  if(state.error){
    console.error('약관 동의 상태 조회 실패:', state.error);
    if(typeof triggerToast === 'function') triggerToast('약관 동의 정보를 확인하지 못했습니다.\n관리자에게 문의해주세요.');
    return false;
  }
  if(state.allCurrent) return true;

  const gate = createPolicyConsentGate();
  const gateTitle = gate.querySelector('#policyConsentGateTitle');
  const hasPreviousConsent = Array.isArray(state.rows) && state.rows.length > 0;
  if(gateTitle){
    gateTitle.textContent = hasPreviousConsent
      ? '약관이 업데이트 되었습니다.'
      : '약관 동의';
  }
  const submit = gate.querySelector('[data-policy-action="submit"]');
  const logoutButton = gate.querySelector('[data-policy-action="logout"]');
  const checks = Array.from(gate.querySelectorAll('[data-policy-check]'));

  checks.forEach(input => {
    const key = input.dataset.policyCheck;
    const isCurrent = Boolean(state.current[key]);
    input.checked = isCurrent;
    input.disabled = isCurrent;
    const row = gate.querySelector(`[data-policy-row="${key}"]`);
    const oldBadge = row?.querySelector('.policy-consent-current');
    oldBadge?.remove();
    if(isCurrent){
      const badge = document.createElement('span');
      badge.className = 'policy-consent-current';
      badge.textContent = '동의 완료';
      row?.querySelector('.policy-consent-item-actions')?.prepend(badge);
    }
  });

  const refreshSubmit = () => {
    submit.disabled = checks.some(input => !input.checked);
  };
  checks.forEach(input => input.addEventListener('change', refreshSubmit));
  refreshSubmit();

  showPolicyConsentGate(gate);

  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if(settled) return;
      settled = true;
      hidePolicyConsentGate(gate);
      window.setTimeout(() => resolve(value), 210);
    };

    const onLogout = async () => {
      logoutButton.disabled = true;
      submit.disabled = true;
      try{ await logout(); }catch(_){ }
      finish(false);
    };

    const onSubmit = async () => {
      if(checks.some(input => !input.checked)) return;
      submit.disabled = true;
      logoutButton.disabled = true;
      const keysToSave = checks
        .filter(input => !state.current[input.dataset.policyCheck])
        .map(input => input.dataset.policyCheck);

      const { error } = await savePolicyConsents(user.id, keysToSave);
      if(error){
        console.error('약관 동의 저장 실패:', error);
        if(typeof triggerToast === 'function') triggerToast('약관 동의 정보를 저장하지 못했습니다.\n잠시 후 다시 시도해주세요.');
        submit.disabled = false;
        logoutButton.disabled = false;
        return;
      }
      finish(true);
    };

    logoutButton.onclick = onLogout;
    submit.onclick = onSubmit;
  });
}

async function requireCurrentPolicyConsent(user){
  if(!user?.id) return false;
  const state = await getPolicyConsentStatus(user.id);
  if(state.error){
    console.error('약관 동의 상태 조회 실패:', state.error);
    await logout();
    location.replace('index.html?policy_consent_error=1');
    return false;
  }
  if(state.allCurrent) return true;

  const currentPage = (location.pathname.split('/').pop() || '').toLowerCase();
  if(currentPage !== 'index.html' && currentPage !== ''){
    location.replace('index.html?consent_required=1');
  }
  return false;
}

// 현재 페이지 안에서 모든 약관/개인정보 문서를 렌더링하는 공통 팝업
let locationLegalModalPreviousOverflow = '';
let locationLegalModalRestoreFocus = null;
let locationLegalModalCloseTimer = null;
let locationLegalModalScrollTicking = false;
let locationLegalModalSections = [];
let locationLegalModalActiveArticle = null;

function ensureLocationLegalModalStyles(){
  if(document.getElementById('locationLegalModalStyles')) return;
  const style = document.createElement('style');
  style.id = 'locationLegalModalStyles';
  style.textContent = `
    .location-legal-modal{position:fixed;inset:0;z-index:16000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,0);opacity:0;visibility:hidden;pointer-events:none;-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0);transition:opacity .2s ease,background-color .2s ease,backdrop-filter .2s ease,visibility 0s linear .24s;}
    .location-legal-modal.open{opacity:1;visibility:visible;pointer-events:auto;background:rgba(15,23,42,.58);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);transition-delay:0s;}
    .location-legal-modal-panel{position:relative;display:flex;flex-direction:column;width:min(760px,100%);height:min(88dvh,820px);overflow:hidden;border:1px solid rgba(226,232,240,.95);border-radius:18px;background:#fff;box-shadow:0 26px 72px rgba(15,23,42,.30);opacity:0;transform:translateY(18px) scale(.985);transition:opacity .2s ease,transform .24s cubic-bezier(.22,.8,.28,1);}
    .location-legal-modal.open .location-legal-modal-panel{opacity:1;transform:translateY(0) scale(1);}
    .location-legal-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scroll-behavior:smooth;padding:28px 24px 148px;scroll-padding-bottom:148px;background:#fff;}
    .location-legal-title{margin:0;text-align:center;color:#0f172a;font-size:26px;line-height:1.35;font-weight:800;letter-spacing:-.55px;word-break:keep-all;}
    .location-legal-content{margin-top:24px;color:#0f172a;font-size:14px;line-height:1.75;word-break:keep-all;}
    .location-legal-section{scroll-margin-top:18px;padding:2px 0 26px;margin-bottom:24px;border-bottom:1px solid #eef2f7;}
    .location-legal-section:last-child{margin-bottom:0;border-bottom:0;}
    .location-legal-content .legal-article-heading{margin:0 0 12px;color:#0f172a;font-size:18px;line-height:1.45;font-weight:900;letter-spacing:-.3px;}
    .location-legal-content p{margin:0 0 12px;color:#334155;font-size:14px;line-height:1.78;}
    .location-legal-content p:last-child{margin-bottom:0;}
    .location-legal-content strong{color:#0f172a;font-weight:900;}
    .location-legal-content .legal-list{display:grid;gap:7px;margin:0 0 12px;padding-left:21px;color:#334155;}
    .location-legal-content .legal-list li{padding-left:1px;line-height:1.72;}
    .location-legal-content .legal-note{margin:12px 0 0;padding:12px 13px;border:1px solid #dbeafe;border-radius:11px;background:#eff6ff;color:#1e3a8a;font-size:12.5px;font-weight:750;line-height:1.65;}
    .location-legal-content .legal-kv{display:grid;gap:8px;margin:12px 0;}
    .location-legal-content .legal-kv>div{display:grid;grid-template-columns:minmax(94px,128px) minmax(0,1fr);gap:10px;padding:10px 11px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;}
    .location-legal-content .legal-kv dt{color:#475569;font-size:12px;font-weight:900;}
    .location-legal-content .legal-kv dd{margin:0;color:#0f172a;font-size:12.5px;font-weight:700;line-height:1.65;}
    .location-legal-section.is-empty{min-height:48vh;min-height:48dvh;}
    .location-legal-empty-document{min-height:42vh;min-height:42dvh;}
    .location-legal-controls{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:8px 16px calc(10px + env(safe-area-inset-bottom));border-top:1px solid rgba(203,213,225,.85);background:rgba(255,255,255,.96);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 -8px 24px rgba(15,23,42,.08);}
    .location-legal-bookmarks{display:flex;gap:7px;margin:0 0 8px;padding:2px 1px 3px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:none;-webkit-overflow-scrolling:touch;touch-action:pan-x;}
    .location-legal-bookmarks[hidden]{display:none;}
    .location-legal-bookmarks::-webkit-scrollbar{display:none;}
    .location-legal-bookmark{flex:0 0 auto;min-width:64px;min-height:44px;padding:0 13px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#475569;font:inherit;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 3px 10px rgba(15,23,42,.05);scroll-snap-align:start;touch-action:manipulation;}
    .location-legal-bookmark[aria-current="true"]{border-color:#93c5fd;background:#eff6ff;color:#1d4ed8;}
    .location-legal-bookmark:active{transform:scale(.97);background:#f8fafc;}
    .location-legal-close{width:100%;min-height:52px;border:1px solid #93c5fd;border-radius:11px;background:linear-gradient(145deg,#0f172a,#1e3a8a 70%,#2563eb);color:#fff;font:inherit;font-size:17px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px rgba(30,58,138,.20);touch-action:manipulation;}
    .location-legal-close:active{transform:scale(.985);}
    @media(hover:hover) and (pointer:fine){
      .location-legal-bookmark:hover{background:#f8fafc;}
      .location-legal-close:hover{filter:brightness(1.04);}
    }
    @media(max-width:600px){
      .location-legal-modal{align-items:flex-end;padding:0;}
      .location-legal-modal-panel{width:100%;height:94dvh;max-height:94dvh;border-width:1px 0 0;border-radius:18px 18px 0 0;transform:translateY(44px);}
      .location-legal-modal.open .location-legal-modal-panel{transform:translateY(0);}
      .location-legal-scroll{padding:calc(22px + env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) 142px max(18px,env(safe-area-inset-left));scroll-padding-bottom:142px;}
      .location-legal-title{font-size:24px;}
      .location-legal-content{margin-top:20px;}
      .location-legal-section{padding-bottom:22px;margin-bottom:20px;}
      .location-legal-content .legal-article-heading{font-size:17px;}
      .location-legal-content .legal-kv>div{grid-template-columns:1fr;gap:3px;padding:10px 11px;}
      .location-legal-section.is-empty{min-height:52vh;min-height:52dvh;}
      .location-legal-controls{padding:8px max(12px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));}
      .location-legal-bookmarks{gap:6px;margin-bottom:7px;}
      .location-legal-bookmark{min-width:62px;min-height:44px;padding:0 12px;border-radius:9px;font-size:13px;}
      .location-legal-close{min-height:50px;border-radius:10px;font-size:16px;}
    }
    @media(max-width:360px){
      .location-legal-scroll{padding-left:max(14px,env(safe-area-inset-left));padding-right:max(14px,env(safe-area-inset-right));}
      .location-legal-title{font-size:22px;}
      .location-legal-bookmark{min-width:58px;padding:0 10px;font-size:12.5px;}
    }
    @media(max-height:500px) and (orientation:landscape){
      .location-legal-modal-panel{height:96dvh;max-height:96dvh;}
      .location-legal-scroll{padding-top:18px;padding-bottom:124px;scroll-padding-bottom:124px;}
      .location-legal-controls{padding-top:6px;padding-bottom:calc(6px + env(safe-area-inset-bottom));}
      .location-legal-bookmark{min-height:38px;}
      .location-legal-close{min-height:44px;}
    }
    @media(prefers-reduced-motion:reduce){
      .location-legal-modal,.location-legal-modal-panel{transition:none!important;}
      .location-legal-scroll{scroll-behavior:auto;}
    }
  `;
  document.head.appendChild(style);
}

function createLocationLegalModal(){
  let modal = document.getElementById('locationLegalModal');
  if(modal) return modal;
  ensureLocationLegalModalStyles();

  modal = document.createElement('div');
  modal.id = 'locationLegalModal';
  modal.className = 'location-legal-modal';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML = `
    <section class="location-legal-modal-panel" role="dialog" aria-modal="true" aria-labelledby="locationLegalTitle">
      <div class="location-legal-scroll" id="locationLegalScroll">
        <h2 class="location-legal-title" id="locationLegalTitle"></h2>
        <div class="location-legal-content" id="locationLegalContent"></div>
      </div>
      <div class="location-legal-controls" aria-label="문서 탐색 및 닫기">
        <nav class="location-legal-bookmarks" id="locationLegalBookmarks" aria-label="조항 바로가기" hidden></nav>
        <button class="location-legal-close" id="locationLegalClose" type="button">닫기</button>
      </div>
    </section>
  `;
  document.body.appendChild(modal);

  const scroll = modal.querySelector('#locationLegalScroll');
  const close = modal.querySelector('#locationLegalClose');
  scroll?.addEventListener('scroll', requestLocationLegalBookmarkUpdate, {passive:true});
  close?.addEventListener('click', closeLegalDocumentModal);

  return modal;
}

function getLocationLegalDocument(documentKey){
  return window.LOCATION_LEGAL_CONTENT?.[documentKey] || null;
}

function renderLocationLegalDocument(modal, documentKey){
  const config = getLocationLegalDocument(documentKey);
  if(!config) return false;

  const title = modal.querySelector('#locationLegalTitle');
  const content = modal.querySelector('#locationLegalContent');
  const bookmarks = modal.querySelector('#locationLegalBookmarks');
  const scroll = modal.querySelector('#locationLegalScroll');
  if(!title || !content || !bookmarks || !scroll) return false;

  title.textContent = config.title || '';
  content.replaceChildren();
  bookmarks.replaceChildren();
  locationLegalModalSections = [];
  locationLegalModalActiveArticle = null;

  const sections = Array.isArray(config.sections) ? config.sections : [];
  if(sections.length){
    sections.forEach((sectionConfig, index) => {
      const section = document.createElement('section');
      const articleNumber = String(index + 1);
      section.className = 'location-legal-section';
      section.dataset.article = articleNumber;
      section.id = `legal-${documentKey}-${sectionConfig.id || `article-${articleNumber}`}`;
      section.setAttribute('aria-label', sectionConfig.bookmark || `제${articleNumber}조`);
      if(sectionConfig.html){
        section.innerHTML = sectionConfig.html;
      }else{
        section.classList.add('is-empty');
      }
      content.appendChild(section);
      locationLegalModalSections.push(section);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'location-legal-bookmark';
      button.dataset.article = articleNumber;
      button.textContent = sectionConfig.bookmark || `제${articleNumber}조`;
      button.setAttribute('aria-current', 'false');
      button.addEventListener('click', () => {
        setLocationLegalActiveBookmark(articleNumber);
        scrollLocationLegalSectionIntoView(section);
      });
      bookmarks.appendChild(button);
    });
    bookmarks.hidden = false;
  }else{
    const html = typeof config.html === 'string' ? config.html : '';
    if(html){
      content.innerHTML = html;
    }else{
      const empty = document.createElement('div');
      empty.className = 'location-legal-empty-document';
      empty.setAttribute('aria-hidden','true');
      content.appendChild(empty);
    }
    bookmarks.hidden = true;
  }

  scroll.scrollTop = 0;
  if(locationLegalModalSections.length) setLocationLegalActiveBookmark('1', 'auto');
  return true;
}

function centerLocationLegalBookmark(button, behavior = 'smooth'){
  const bookmarks = document.getElementById('locationLegalBookmarks');
  if(!bookmarks || !button || bookmarks.hidden) return;
  const targetLeft = button.offsetLeft - ((bookmarks.clientWidth - button.offsetWidth) / 2);
  const maxLeft = Math.max(0, bookmarks.scrollWidth - bookmarks.clientWidth);
  bookmarks.scrollTo({left:Math.max(0,Math.min(targetLeft,maxLeft)),behavior});
}

function setLocationLegalActiveBookmark(articleNumber, behavior = 'smooth'){
  const normalized = String(articleNumber);
  if(locationLegalModalActiveArticle === normalized) return;
  locationLegalModalActiveArticle = normalized;
  const bookmarks = document.getElementById('locationLegalBookmarks');
  if(!bookmarks) return;

  let activeButton = null;
  bookmarks.querySelectorAll('.location-legal-bookmark').forEach(button => {
    const isActive = button.dataset.article === normalized;
    button.setAttribute('aria-current', isActive ? 'true' : 'false');
    if(isActive) activeButton = button;
  });
  centerLocationLegalBookmark(activeButton, behavior);
}

function updateLocationLegalBookmarkFromScroll(){
  const modal = document.getElementById('locationLegalModal');
  const scroll = modal?.querySelector('#locationLegalScroll');
  if(!scroll || !locationLegalModalSections.length) return;

  const scrollRect = scroll.getBoundingClientRect();
  const triggerLine = scrollRect.top + Math.max(72, scroll.clientHeight * .28);
  let activeSection = locationLegalModalSections[0];

  for(const section of locationLegalModalSections){
    const rect = section.getBoundingClientRect();
    if(rect.top <= triggerLine){
      activeSection = section;
    }else{
      break;
    }
  }
  setLocationLegalActiveBookmark(activeSection.dataset.article);
}

function requestLocationLegalBookmarkUpdate(){
  if(locationLegalModalScrollTicking) return;
  locationLegalModalScrollTicking = true;
  window.requestAnimationFrame(() => {
    updateLocationLegalBookmarkFromScroll();
    locationLegalModalScrollTicking = false;
  });
}

function scrollLocationLegalSectionIntoView(section){
  const modal = document.getElementById('locationLegalModal');
  const scroll = modal?.querySelector('#locationLegalScroll');
  if(!scroll || !section) return;
  const scrollRect = scroll.getBoundingClientRect();
  const sectionRect = section.getBoundingClientRect();
  const targetTop = scroll.scrollTop + (sectionRect.top - scrollRect.top) - 14;
  scroll.scrollTo({top:Math.max(0,targetTop),behavior:'smooth'});
}

function closeLegalDocumentModal(){
  const modal = document.getElementById('locationLegalModal');
  if(!modal?.classList.contains('open')) return;
  if(locationLegalModalCloseTimer) window.clearTimeout(locationLegalModalCloseTimer);

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  locationLegalModalCloseTimer = window.setTimeout(() => {
    document.documentElement.style.overflow = locationLegalModalPreviousOverflow;
    const content = modal.querySelector('#locationLegalContent');
    const bookmarks = modal.querySelector('#locationLegalBookmarks');
    content?.replaceChildren();
    bookmarks?.replaceChildren();
    if(bookmarks) bookmarks.hidden = true;
    locationLegalModalSections = [];
    locationLegalModalActiveArticle = null;
    locationLegalModalRestoreFocus?.focus?.({preventScroll:true});
    locationLegalModalRestoreFocus = null;
    locationLegalModalCloseTimer = null;
  }, 250);
}

function openLegalDocumentModal(documentKey){
  const config = getLocationLegalDocument(documentKey);
  if(!config) return false;
  const modal = createLocationLegalModal();
  if(locationLegalModalCloseTimer){
    window.clearTimeout(locationLegalModalCloseTimer);
    locationLegalModalCloseTimer = null;
  }
  if(!renderLocationLegalDocument(modal, documentKey)) return false;

  locationLegalModalRestoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  locationLegalModalPreviousOverflow = document.documentElement.style.overflow || '';
  document.documentElement.style.overflow = 'hidden';
  modal.setAttribute('aria-hidden','false');
  void modal.offsetWidth;
  modal.classList.add('open');

  window.requestAnimationFrame(() => {
    requestLocationLegalBookmarkUpdate();
    modal.querySelector('#locationLegalClose')?.focus?.({preventScroll:true});
  });
  return true;
}


// 설정 화면에서 세 동의 문서를 한 곳에서 선택하는 공통 팝업
let locationLegalPickerPreviousOverflow = '';
let locationLegalPickerRestoreFocus = null;
let locationLegalPickerCloseTimer = null;

function ensureLocationLegalPickerStyles(){
  if(document.getElementById('locationLegalPickerStyles')) return;
  const style = document.createElement('style');
  style.id = 'locationLegalPickerStyles';
  style.textContent = `
    .location-legal-picker{position:fixed;inset:0;z-index:15000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,0);opacity:0;visibility:hidden;pointer-events:none;-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0);transition:opacity .2s ease,background-color .2s ease,backdrop-filter .2s ease,visibility 0s linear .24s;}
    .location-legal-picker.open{opacity:1;visibility:visible;pointer-events:auto;background:rgba(15,23,42,.52);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);transition-delay:0s;}
    .location-legal-picker-panel{width:min(430px,100%);overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 24px 64px rgba(15,23,42,.24);padding:22px;opacity:0;transform:translateY(14px) scale(.985);transition:opacity .2s ease,transform .24s cubic-bezier(.22,.8,.28,1);}
    .location-legal-picker.open .location-legal-picker-panel{opacity:1;transform:translateY(0) scale(1);}
    .location-legal-picker-title{margin:0;text-align:center;color:#0f172a;font-size:21px;font-weight:850;letter-spacing:-.35px;}
    .location-legal-picker-copy{margin:9px 0 17px;text-align:center;color:#64748b;font-size:12.5px;line-height:1.55;word-break:keep-all;}
    .location-legal-picker-list{display:grid;gap:9px;}
    .location-legal-picker-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;width:100%;min-height:50px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;color:#0f172a;font:inherit;text-align:left;cursor:pointer;touch-action:manipulation;}
    .location-legal-picker-item span:first-child{font-size:14px;font-weight:800;line-height:1.4;word-break:keep-all;}
    .location-legal-picker-arrow{color:#94a3b8;font-size:18px;font-weight:800;line-height:1;}
    .location-legal-picker-item:active{transform:scale(.985);background:#f1f5f9;}
    .location-legal-picker-close{width:100%;min-height:48px;margin-top:14px;border:1px solid #cbd5e1;border-radius:11px;background:#fff;color:#475569;font:inherit;font-size:14px;font-weight:800;cursor:pointer;touch-action:manipulation;}
    .location-legal-picker-close:active{transform:scale(.985);background:#f8fafc;}
    @media(hover:hover) and (pointer:fine){
      .location-legal-picker-item:hover{border-color:#bfdbfe;background:#eff6ff;}
      .location-legal-picker-close:hover{background:#f8fafc;}
    }
    @media(max-width:480px){
      .location-legal-picker{align-items:flex-end;padding:0;}
      .location-legal-picker-panel{width:100%;border-width:1px 0 0;border-radius:18px 18px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom));transform:translateY(36px);}
      .location-legal-picker.open .location-legal-picker-panel{transform:translateY(0);}
      .location-legal-picker-item{min-height:52px;}
    }
    @media(prefers-reduced-motion:reduce){
      .location-legal-picker,.location-legal-picker-panel{transition:none!important;}
    }
  `;
  document.head.appendChild(style);
}

function createLocationLegalPicker(){
  let picker = document.getElementById('locationLegalPicker');
  if(picker) return picker;
  ensureLocationLegalPickerStyles();

  picker = document.createElement('div');
  picker.id = 'locationLegalPicker';
  picker.className = 'location-legal-picker';
  picker.setAttribute('aria-hidden','true');
  picker.innerHTML = `
    <section class="location-legal-picker-panel" role="dialog" aria-modal="true" aria-labelledby="locationLegalPickerTitle">
      <h2 class="location-legal-picker-title" id="locationLegalPickerTitle">이용약관</h2>
      <p class="location-legal-picker-copy">확인할 약관을 선택해주세요.</p>
      <div class="location-legal-picker-list">
        <button class="location-legal-picker-item" type="button" data-legal-picker-doc="terms"><span>서비스 이용약관</span><span class="location-legal-picker-arrow" aria-hidden="true">›</span></button>
        <button class="location-legal-picker-item" type="button" data-legal-picker-doc="privacy_consent"><span>개인정보 수집·이용 동의</span><span class="location-legal-picker-arrow" aria-hidden="true">›</span></button>
        <button class="location-legal-picker-item" type="button" data-legal-picker-doc="third_party_consent"><span>개인정보 제3자 제공 동의</span><span class="location-legal-picker-arrow" aria-hidden="true">›</span></button>
      </div>
      <button class="location-legal-picker-close" type="button" data-legal-picker-action="close">닫기</button>
    </section>
  `;
  document.body.appendChild(picker);

  picker.querySelector('[data-legal-picker-action="close"]')?.addEventListener('click', closeLegalAgreementPicker);
  picker.addEventListener('click', event => {
    if(event.target === picker){
      closeLegalAgreementPicker();
      return;
    }
    const button = event.target.closest?.('[data-legal-picker-doc]');
    if(!button) return;
    const documentKey = button.dataset.legalPickerDoc;
    if(!getLocationLegalDocument(documentKey)) return;
    transitionLegalPickerToDocument(documentKey);
  });
  return picker;
}

function openLegalAgreementPicker(){
  const picker = createLocationLegalPicker();
  if(locationLegalPickerCloseTimer){
    window.clearTimeout(locationLegalPickerCloseTimer);
    locationLegalPickerCloseTimer = null;
  }
  locationLegalPickerRestoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  locationLegalPickerPreviousOverflow = document.documentElement.style.overflow || '';
  document.documentElement.style.overflow = 'hidden';
  picker.setAttribute('aria-hidden','false');
  void picker.offsetWidth;
  picker.classList.add('open');
  window.requestAnimationFrame(() => picker.querySelector('[data-legal-picker-doc]')?.focus?.({preventScroll:true}));
  return true;
}

function closeLegalAgreementPicker(){
  const picker = document.getElementById('locationLegalPicker');
  if(!picker?.classList.contains('open')) return;
  if(locationLegalPickerCloseTimer) window.clearTimeout(locationLegalPickerCloseTimer);
  picker.classList.remove('open');
  picker.setAttribute('aria-hidden','true');
  locationLegalPickerCloseTimer = window.setTimeout(() => {
    document.documentElement.style.overflow = locationLegalPickerPreviousOverflow;
    locationLegalPickerRestoreFocus?.focus?.({preventScroll:true});
    locationLegalPickerRestoreFocus = null;
    locationLegalPickerCloseTimer = null;
  }, 250);
}

function transitionLegalPickerToDocument(documentKey){
  const picker = document.getElementById('locationLegalPicker');
  const restoreTarget = locationLegalPickerRestoreFocus;
  if(picker){
    picker.classList.remove('open');
    picker.setAttribute('aria-hidden','true');
  }
  if(locationLegalPickerCloseTimer){
    window.clearTimeout(locationLegalPickerCloseTimer);
    locationLegalPickerCloseTimer = null;
  }
  document.documentElement.style.overflow = locationLegalPickerPreviousOverflow;
  restoreTarget?.focus?.({preventScroll:true});
  locationLegalPickerRestoreFocus = null;
  window.setTimeout(() => {
    openLegalDocumentModal(documentKey);
  }, 60);
}

window.openLegalAgreementPicker = openLegalAgreementPicker;
window.closeLegalAgreementPicker = closeLegalAgreementPicker;

window.openLegalDocumentModal = openLegalDocumentModal;
window.closeLegalDocumentModal = closeLegalDocumentModal;

window.addEventListener('keydown', event => {
  if(event.key !== 'Escape') return;
  if(document.getElementById('locationLegalModal')?.classList.contains('open')){
    event.preventDefault();
    closeLegalDocumentModal();
    return;
  }
  if(document.getElementById('locationLegalPicker')?.classList.contains('open')){
    event.preventDefault();
    closeLegalAgreementPicker();
  }
});
window.addEventListener('resize', requestLocationLegalBookmarkUpdate, {passive:true});
window.addEventListener('orientationchange', requestLocationLegalBookmarkUpdate, {passive:true});

function bindLocationLegalDocumentLinks(){
  if(document.documentElement.dataset.locationLegalLinksBound === '1') return;
  document.documentElement.dataset.locationLegalLinksBound = '1';
  document.addEventListener('click', event => {
    const pickerLink = event.target.closest?.('[data-legal-picker="agreements"]');
    if(pickerLink){
      event.preventDefault();
      openLegalAgreementPicker();
      return;
    }
    const link = event.target.closest?.('[data-legal-doc]');
    if(!link) return;
    const key = link.dataset.legalDoc;
    if(!getLocationLegalDocument(key)) return;
    event.preventDefault();
    openLegalDocumentModal(key);
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', bindLocationLegalDocumentLinks, {once:true});
}else{
  bindLocationLegalDocumentLinks();
}
