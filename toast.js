function triggerToast(message){

    const existing = document.getElementById("custom-toast");
    if(existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "custom-toast";
    toast.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-6 cursor-pointer";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 260ms ease";

    toast.innerHTML = `
        <div id="custom-toast-panel" class="bg-white rounded-2xl p-6 text-center shadow-2xl max-w-xs w-full">
            <p class="font-bold text-lg whitespace-pre-line">${message}</p>
            <p class="text-xs text-gray-400 mt-2">(터치로 닫기)</p>
        </div>
    `;

    const panel = toast.querySelector("#custom-toast-panel");

    panel.style.opacity = "0";
    panel.style.transform = "translateY(28px) scale(0.98)";
    panel.style.transition =
        "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease";

    let isClosing = false;
    let autoCloseTimer = null;

    const removeToast = () => {
        if(isClosing) return;

        isClosing = true;

        if(autoCloseTimer){
            clearTimeout(autoCloseTimer);
        }

        toast.style.opacity = "0";
        panel.style.opacity = "0";
        panel.style.transform = "translateY(42px) scale(0.98)";

        setTimeout(() => {
            if(toast.isConnected){
                toast.remove();
            }
        }, 320);
    };

    toast.addEventListener("click", removeToast);

    toast.addEventListener("touchstart", event => {
        event.preventDefault();
        removeToast();
    }, {
        passive: false
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.opacity = "1";
            panel.style.opacity = "1";
            panel.style.transform = "translateY(-10px) scale(1)";

            setTimeout(() => {
                if(!isClosing && panel.isConnected){
                    panel.style.transform = "translateY(0) scale(1)";
                }
            }, 220);
        });
    });

    autoCloseTimer = setTimeout(removeToast, 4500);
}