/**
 * Sistema de Toasts (Notificações)
 */
export function showToast(msg, type = 'info') {
    let c = document.getElementById('toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        c.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 flex flex-col gap-2 pointer-events-none z-[9999]';
        document.body.appendChild(c);
    }
    
    const toast = document.createElement('div');
    const colors = { 
        info: 'bg-primary text-white', 
        success: 'bg-success text-white', 
        error: 'bg-error text-white', 
        warning: 'bg-warning text-white' 
    };
    
    toast.className = `${colors[type] || colors.info} px-6 py-3 rounded-xl shadow-lg font-bold animate-enter flex items-center gap-3 text-sm z-50`;
    
    let icon = 'info';
    if(type === 'error') icon = 'alert-triangle';
    else if(type === 'success') icon = 'check-circle';
    else if(type === 'warning') icon = 'alert-circle';
    
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i> <span>${msg}</span>`;
    c.appendChild(toast);
    if(window.lucide) window.lucide.createIcons();
    
    setTimeout(() => {
        toast.style.opacity = 0;
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Ticker não-intrusivo para eventos de sala (entrou/saiu)
 */
export function showTicker(msg) {
    const c = document.getElementById('ticker-container');
    if(!c) return;
    
    const ticker = document.createElement('div');
    ticker.className = 'bg-surface border border-white/5 px-4 py-2 rounded-lg shadow-md text-xs font-medium text-slate-300 animate-enter flex items-center gap-2';
    ticker.innerHTML = `<i data-lucide="bell" class="w-3 h-3 text-slate-400"></i> ${msg}`;
    c.appendChild(ticker);
    if(window.lucide) window.lucide.createIcons();
    
    setTimeout(() => {
        ticker.style.opacity = 0;
        ticker.style.transition = 'opacity 0.3s ease';
        setTimeout(() => ticker.remove(), 300);
    }, 3000);
}

/**
 * Animação flutuante de pontos
 */
export function showFloatingPoints(container, text, subtext = '') {
    const el = document.createElement('div');
    el.className = 'floating-points flex flex-col items-center';
    el.innerHTML = `
        <span class="text-success text-2xl">${text}</span>
        ${subtext ? `<span class="text-success/70 text-xs">${subtext}</span>` : ''}
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1600);
}

/**
 * Esconde todas as sections .screen e exibe a especificada com fade suave.
 */
export function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
    }
    window.dispatchEvent(new CustomEvent('screenChanged', { detail: screenId }));
}

/**
 * Controla os modais
 */
export function toggleModal(modalId, forceState = null) {
    const m = document.getElementById(modalId);
    if(!m) return;
    
    const isHidden = m.classList.contains('hidden');
    const shouldShow = forceState !== null ? forceState : isHidden;
    
    if (shouldShow) {
        m.classList.remove('hidden');
        setTimeout(() => { 
            m.classList.remove('opacity-0'); 
            m.querySelector('div').classList.remove('scale-95'); 
        }, 10);
    } else {
        m.classList.add('opacity-0');
        m.querySelector('div').classList.add('scale-95');
        setTimeout(() => m.classList.add('hidden'), 300);
    }
}

export function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {
            showToast("Erro ao entrar em tela cheia.", "error");
        });
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

export function setupUIBindings() {
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.currentTarget.getAttribute('data-modal');
            toggleModal(modalId, false);
        });
    });
    
    const fsBtn = document.getElementById('btn-fullscreen-lobby');
    if(fsBtn) fsBtn.addEventListener('click', toggleFullScreen);
}

/**
 * Atualiza texto de um elemento sem destruir o DOM se for igual
 */
export function updateText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el && el.innerText !== String(text)) {
        el.innerText = text;
    }
}
