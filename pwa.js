(function(){
  'use strict';
  let deferredInstallPrompt=null;
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
      if(deferredInstallPrompt){btn.hidden=false;btn.textContent=btn.dataset.installLabel||'앱 설치';return;}
      btn.hidden=!(isAndroid||window.matchMedia('(pointer: coarse)').matches);
      if(!btn.hidden) btn.textContent=btn.dataset.installLabel||'앱 설치';
    });
  }

  function ensureDialog(){
    let backdrop=document.getElementById('pwaInstallDialogBackdrop');
    if(backdrop) return backdrop;
    backdrop=document.createElement('div');
    backdrop.id='pwaInstallDialogBackdrop';
    backdrop.className='pwa-install-dialog-backdrop';
    backdrop.innerHTML='<section class="pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="pwaInstallDialogTitle"><div class="pwa-install-dialog-head"><h2 class="pwa-install-dialog-title" id="pwaInstallDialogTitle">앱 설치</h2><button class="pwa-install-dialog-close" type="button" aria-label="닫기">✕</button></div><div class="pwa-install-dialog-body" id="pwaInstallDialogBody"></div></section>';
    document.body.appendChild(backdrop);
    const close=()=>{backdrop.classList.remove('open');document.body.style.overflow='';};
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
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(error=>console.warn('PWA service worker registration failed:',error)));
  }
})();
