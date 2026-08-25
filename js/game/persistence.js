import { showToast } from "../ui/ui.js";

const SESSION_KEY = "quimicaQuiz_session";

/**
 * Salva os dados críticos da sessão localmente (F5 Persistence)
 */
export function saveSession(roomId, playerId, isHost, playerName) {
    const data = {
        roomId,
        playerId,
        isHost,
        playerName,
        timestamp: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

/**
 * Recupera os dados da sessão
 */
export function getSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        
        const data = JSON.parse(raw);
        // Opcional: expirar sessão muito antiga (ex: > 1 dia)
        if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
            clearSession();
            return null;
        }
        return data;
    } catch(e) {
        return null;
    }
}

/**
 * Limpa a sessão
 */
export function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Estado Local Global
 * Armazena a versão atual que o frontend conhece. 
 */
export const localState = {
    role: null, // 'host' ou 'player'
    roomId: null,
    playerId: null,
    playerName: null,
    roomData: null,      // Snapshot doc sala
    playersList: [],     // Snapshot subcollection players
    timerInterval: null,
    hasAnsweredCurrent: false,
    lastKnownEffectState: {}
};

/**
 * Limpa o estado local
 */
export function resetLocalState() {
    if(localState.timerInterval) cancelAnimationFrame(localState.timerInterval);
    localState.role = null;
    localState.roomId = null;
    localState.roomData = null;
    localState.playersList = [];
    localState.hasAnsweredCurrent = false;
    localState.lastKnownEffectState = {};
}
