import { loginAnonymous } from "./firebase/config.js";
import { getSession, localState, clearSession } from "./game/persistence.js";
import { connectToRoom, createRoom, joinRoom, disconnect } from "./game/room.js";
import { startGame, nextQuestionHost, finishGameHost } from "./game/game.js";
import { startPresencePing, setDisconnected } from "./game/players.js";
import { setupUIBindings, toggleModal, switchScreen } from "./ui/ui.js";
import { initWizard } from "./ui/wizard.js";
import { initRocketBackground } from "./ui/rocket-bg.js";

let stopRocketBg = null;

/**
 * Ponto de entrada (Entry Point)
 */
async function bootstrap() {
    setupUIBindings();
    initWizard();
    
    // Manage background based on screen
    window.addEventListener('screenChanged', (e) => {
        if (e.detail === 'screen-home') {
            if (!stopRocketBg) stopRocketBg = initRocketBackground('rocket-canvas-container');
        } else {
            if (stopRocketBg) {
                stopRocketBg();
                stopRocketBg = null;
            }
        }
    });
    // Bindings de botões principais
    document.getElementById('btn-show-create')?.addEventListener('click', () => toggleModal('modal-create', true));
    document.getElementById('btn-show-join')?.addEventListener('click', () => toggleModal('modal-join', true));
    document.getElementById('btn-do-create')?.addEventListener('click', createRoom);
    document.getElementById('btn-do-join')?.addEventListener('click', () => joinRoom());
    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
        const joinUrl = window.location.href.split('?')[0] + '?code=' + localState.roomId;
        navigator.clipboard.writeText(joinUrl);
    });
    
    // Host buttons
    document.getElementById('btn-start-game')?.addEventListener('click', startGame);
    document.getElementById('btn-host-next')?.addEventListener('click', nextQuestionHost);
    document.getElementById('btn-host-finish')?.addEventListener('click', finishGameHost);
    
    // Home buttons
    document.getElementById('btn-host-home')?.addEventListener('click', disconnect);
    document.getElementById('btn-player-home')?.addEventListener('click', disconnect);

    // Auth
    try {
        await loginAnonymous();
        
        // Verifica se há URL invite
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            document.getElementById('join-code').value = code;
            toggleModal('modal-join', true);
            switchScreen('screen-home');
            return;
        }

        // F5 Persistence / Auto-Reconnect
        const session = getSession();
        if (session && session.roomId && session.playerId) {
            localState.role = session.isHost ? 'host' : 'player';
            localState.roomId = session.roomId;
            localState.playerId = session.playerId;
            localState.playerName = session.playerName;
            
            console.log("Restaurando sessão:", session);
            connectToRoom();
        } else {
            switchScreen('screen-home');
        }
        
        startPresencePing();
        
    } catch (e) {
        console.error("Falha fatal na inicialização", e);
    }
}

// Tratar desconexão ao fechar aba
window.addEventListener('beforeunload', () => {
    setDisconnected();
});

// Iniciar aplicação
window.onload = bootstrap;
