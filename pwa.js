(function(){
  'use strict';
  let deferredInstallPrompt=null;
  let swRegistration=null;
  let updateReloadRequested=false;
  const ua=navigator.userAgent||'';
  const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isAndroid=/Android/i.test(ua);
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;

  function buttons(){return Array.from(document.querySelectorAll('[data-pwa-install]'));}
  function syncButtons(){
    const installed=isStandalone();
    buttons().forEach(btn=>{
      if(installed){btn.hidden=true;return;}
      if(isIOS){btn.hidden=false;btn.textContent=btn.dataset.iosLabel||'홈 화면에 앱 추가';return;}
      if(deferredInstallPrompt){btn.hidden=false;btn.textContent=btn.dataset.installLabel||'홈 화면에 앱 추가';return;}
      btn.hidden=!(isAndroid||window.matchMedia('(pointer: coarse)').matches);
      if(!btn.hidden) btn.textContent=btn.dataset.installLabel||'홈 화면에 앱 추가';
    });
  }

  function ensureDialog(){
    let backdrop=document.getElementById('pwaInstallDialogBackdrop');
    if(backdrop) return backdrop;
    backdrop=document.createElement('div');
    backdrop.id='pwaInstallDialogBackdrop';
    backdrop.className='pwa-install-dialog-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    backdrop.innerHTML='<section class="pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="pwaInstallDialogTitle"><div class="pwa-install-dialog-head"><h2 class="pwa-install-dialog-title" id="pwaInstallDialogTitle">홈 화면에 앱 추가</h2><button class="pwa-install-dialog-close" type="button" aria-label="닫기">✕</button></div><div class="pwa-install-dialog-body" id="pwaInstallDialogBody"></div></section>';
    document.body.appendChild(backdrop);
    const close=()=>{backdrop.classList.remove('open');backdrop.setAttribute('aria-hidden','true');window.setTimeout(()=>{if(!backdrop.classList.contains('open'))document.body.style.overflow='';},240);};
    backdrop.querySelector('.pwa-install-dialog-close').addEventListener('click',close);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop) close();});
    return backdrop;
  }

  function showGuide(){
    const backdrop=ensureDialog();
    const body=backdrop.querySelector('#pwaInstallDialogBody');
    if(isIOS){
      body.innerHTML='<strong>iPhone / iPad Safari에서 설치할 수 있습니다.</strong><ol class="pwa-install-steps"><li>Safari 하단 또는 상단의 <strong>공유</strong> 버튼을 누릅니다.</li><li><strong>홈 화면에 추가</strong>를 선택합니다.</li><li>우측 상단의 <strong>추가</strong>를 누릅니다.</li></ol><button class="pwa-install-dialog-ok" type="button">확인</button>';
    }else{
      body.innerHTML='<strong>현재 브라우저에서 자동 설치창을 열 수 없습니다.</strong><ol class="pwa-install-steps"><li>브라우저 메뉴를 엽니다.</li><li><strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택합니다.</li></ol><button class="pwa-install-dialog-ok" type="button">확인</button>';
    }
    body.querySelector('.pwa-install-dialog-ok').addEventListener('click',()=>backdrop.querySelector('.pwa-install-dialog-close').click(),{once:true});
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }

  async function requestInstall(){
    if(isStandalone()) return;
    if(deferredInstallPrompt){
      const promptEvent=deferredInstallPrompt;
      deferredInstallPrompt=null;
      promptEvent.prompt();
      try{await promptEvent.userChoice;}catch(_){ }
      syncButtons();
      return;
    }
    showGuide();
  }

  function ensureUpdateDialog(){
    let backdrop=document.getElementById('pwaUpdateDialogBackdrop');
    if(backdrop) return backdrop;
    backdrop=document.createElement('div');
    backdrop.id='pwaUpdateDialogBackdrop';
    backdrop.className='pwa-update-dialog-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    backdrop.innerHTML=`
      <section class="pwa-update-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pwaUpdateDialogTitle">
        <div class="pwa-update-dialog-icon" aria-hidden="true">↻</div>
        <h2 class="pwa-update-dialog-title" id="pwaUpdateDialogTitle">새 버전 업데이트</h2>
        <p class="pwa-update-dialog-text">새로운 버전이 배포되었습니다.<br>최신 기능과 수정사항을 적용하려면 업데이트해 주세요.</p>
        <div class="pwa-update-dialog-actions">
          <button class="pwa-update-dialog-later" type="button">나중에</button>
          <button class="pwa-update-dialog-update" type="button">지금 업데이트</button>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
    const close=()=>{
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden','true');
      document.body.style.overflow='';
    };
    backdrop.querySelector('.pwa-update-dialog-later').addEventListener('click',close);
    backdrop.addEventListener('click',event=>{if(event.target===backdrop) close();});
    backdrop.querySelector('.pwa-update-dialog-update').addEventListener('click',()=>{
      const waiting=swRegistration?.waiting;
      if(!waiting){close();location.reload();return;}
      updateReloadRequested=true;
      const button=backdrop.querySelector('.pwa-update-dialog-update');
      button.disabled=true;
      button.textContent='업데이트 중...';
      waiting.postMessage({type:'SKIP_WAITING'});
    });
    return backdrop;
  }

  function showUpdateMessage(registration){
    if(registration) swRegistration=registration;
    if(!swRegistration?.waiting || !navigator.serviceWorker.controller) return;
    const backdrop=ensureUpdateDialog();
    const button=backdrop.querySelector('.pwa-update-dialog-update');
    button.disabled=false;
    button.textContent='지금 업데이트';
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }

  function watchRegistration(registration){
    swRegistration=registration;
    if(registration.waiting && navigator.serviceWorker.controller) showUpdateMessage(registration);

    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      if(!worker) return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed' && navigator.serviceWorker.controller){
          showUpdateMessage(registration);
        }
      });
    });
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    syncButtons();
  });
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;syncButtons();});

  document.addEventListener('DOMContentLoaded',()=>{
    document.addEventListener('click',event=>{
      const target=event.target.closest('[data-pwa-install]');
      if(!target) return;
      event.preventDefault();
      requestInstall();
    });
    syncButtons();
  });

  if('serviceWorker' in navigator){
    let controllerChanged=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(controllerChanged) return;
      controllerChanged=true;
      if(updateReloadRequested) location.reload();
    });

    window.addEventListener('load',async()=>{
      try{
        const registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
        watchRegistration(registration);
        // GitHub Pages 등에서 브라우저의 기본 SW 확인 주기를 기다리지 않고 배포본을 즉시 점검한다.
        registration.update().catch(()=>{});
        window.setInterval(()=>registration.update().catch(()=>{}),60*60*1000);
        document.addEventListener('visibilitychange',()=>{
          if(document.visibilityState==='visible') registration.update().catch(()=>{});
        });
      }catch(error){
        console.warn('PWA service worker registration failed:',error);
      }
    });
  }
})();
