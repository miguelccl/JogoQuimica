export function initWizard() {
    let currentStep = 1;
    let selectedMode = 'ffa';
    let selectedDiff = 'misto';
    let selectedCount = 10;
    let selectedTime = 30;

    const panes = document.querySelectorAll('.wizard-pane');
    
    // Mode selection
    const modeBtns = document.querySelectorAll('.wizard-mode-btn');
    const chaosToggle = document.getElementById('chaos-toggle-container');
    
    modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            modeBtns.forEach(b => b.classList.remove('selected', 'border-primary'));
            btn.classList.add('selected', 'border-primary');
            selectedMode = btn.dataset.mode;
            
            if (selectedMode === 'ffa') {
                chaosToggle.classList.remove('hidden');
            } else {
                chaosToggle.classList.add('hidden');
                document.getElementById('config-chaos-enable').checked = false;
            }
        });
    });

    // Difficulty selection
    const diffChips = document.querySelectorAll('#diff-chips .wizard-chip');
    const countContainer = document.getElementById('config-count-container');
    const fixedMsg = document.getElementById('config-fixed-msg');

    diffChips.forEach(chip => {
        chip.addEventListener('click', () => {
            diffChips.forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            selectedDiff = chip.dataset.diff;
            
            if (selectedDiff === 'misto') {
                countContainer.classList.remove('hidden');
                fixedMsg.classList.add('hidden');
            } else {
                countContainer.classList.add('hidden');
                fixedMsg.classList.remove('hidden');
            }
        });
    });

    // Count and Time segments
    const setupSegments = (containerId, onSelect) => {
        const btns = document.querySelectorAll(`#${containerId} .seg-btn`);
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                onSelect(parseInt(btn.dataset.val, 10));
            });
        });
    };
    
    setupSegments('count-segments', val => selectedCount = val);
    setupSegments('time-segments', val => selectedTime = val);

    // Navigation
    const nextBtns = document.querySelectorAll('.btn-wizard-next');
    const prevBtns = document.querySelectorAll('.btn-wizard-prev');

    function updateView() {
        panes.forEach((p, i) => {
            if (i + 1 === currentStep) p.classList.remove('hidden');
            else p.classList.add('hidden');
        });
    }

    nextBtns.forEach(b => {
        b.addEventListener('click', () => {
            if (currentStep < 2) {
                currentStep++;
                updateView();
            }
        });
    });

    prevBtns.forEach(b => {
        b.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateView();
            }
        });
    });
    
    // Reset wizard when modal opens
    document.addEventListener('modal-opened', (e) => {
        if (e.detail === 'modal-create') {
            currentStep = 1;
            updateView();
        }
    });
}

// Global state fetcher for room creation
window.getWizardState = function() {
    const diffChips = document.querySelectorAll('#diff-chips .wizard-chip');
    let diff = 'misto';
    diffChips.forEach(c => { if(c.classList.contains('selected')) diff = c.dataset.diff; });
    
    let count = 10;
    document.querySelectorAll('#count-segments .seg-btn').forEach(c => { if(c.classList.contains('selected')) count = parseInt(c.dataset.val); });
    
    let time = 30;
    document.querySelectorAll('#time-segments .seg-btn').forEach(c => { if(c.classList.contains('selected')) time = parseInt(c.dataset.val); });
    
    let mode = 'ffa';
    document.querySelectorAll('.wizard-mode-btn').forEach(c => { if(c.classList.contains('selected')) mode = c.dataset.mode; });
    
    const isChaos = document.getElementById('config-chaos-enable').checked;
    
    return {
        mode,
        diff,
        count: diff === 'misto' ? count : -1, // -1 means all available in set
        time,
        chaosEnabled: isChaos && mode === 'ffa'
    };
};
