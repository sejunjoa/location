function triggerToast(message) {
    const existing = document.getElementById('custom-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'custom-toast';
    toast.setAttribute('role', 'alertdialog');
    toast.setAttribute('aria-modal', 'true');
    Object.assign(toast.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '9999',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'rgba(0, 0, 0, 0.60)',
        cursor: 'pointer',
        opacity: '0',
        transition: 'opacity 260ms ease',
        boxSizing: 'border-box'
    });

    const panel = document.createElement('section');
    panel.id = 'custom-toast-panel';
    Object.assign(panel.style, {
        width: '100%',
        maxWidth: '320px',
        padding: '24px',
        borderRadius: '16px',
        background: '#ffffff',
        color: '#0f172a',
        textAlign: 'center',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)',
        opacity: '0',
        transform: 'translateY(28px) scale(0.98)',
        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease',
        boxSizing: 'border-box',
        cursor: 'pointer'
    });

    const text = document.createElement('p');
    text.textContent = String(message ?? '');
    Object.assign(text.style, {
        margin: '0',
        color: '#0f172a',
        fontSize: '18px',
        fontWeight: '700',
        lineHeight: '1.5',
        whiteSpace: 'pre-line',
        overflowWrap: 'anywhere'
    });

    const hint = document.createElement('p');
    hint.textContent = '(터치로 닫기)';
    Object.assign(hint.style, {
        margin: '8px 0 0',
        color: '#9ca3af',
        fontSize: '12px',
        fontWeight: '500',
        lineHeight: '1.4'
    });

    panel.append(text, hint);
    toast.appendChild(panel);

    let isClosing = false;
    let autoCloseTimer = null;

    const removeToast = () => {
        if (isClosing) return;
        isClosing = true;

        if (autoCloseTimer) clearTimeout(autoCloseTimer);

        toast.style.opacity = '0';
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(42px) scale(0.98)';

        window.setTimeout(() => {
            if (toast.isConnected) toast.remove();
        }, 320);
    };

    toast.addEventListener('click', removeToast);
    toast.addEventListener('touchstart', event => {
        event.preventDefault();
        removeToast();
    }, { passive: false });

    document.body.appendChild(toast);

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
            toast.style.opacity = '1';
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(-10px) scale(1)';

            window.setTimeout(() => {
                if (!isClosing && panel.isConnected) {
                    panel.style.transform = 'translateY(0) scale(1)';
                }
            }, 220);
        });
    });

    autoCloseTimer = window.setTimeout(removeToast, 4500);
}
