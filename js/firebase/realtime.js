import { onSnapshot, doc, collection, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId } from "./config.js";

// Armazena as assinaturas ativas para garantir que não haja vazamentos
const activeListeners = new Map();

/**
 * Registra e inicia um listener de snapshot, substituindo o antigo se houver
 * @param {string} key Identificador único do listener (ex: 'room', 'players')
 * @param {object} ref Referência do Firestore (doc, collection, query)
 * @param {function} onData Callback ao receber dados
 * @param {function} onError Callback ao falhar
 */
export function subscribe(key, ref, onData, onError = console.error) {
    unsubscribe(key); // Cancela o antigo se existir
    
    const unsubs = onSnapshot(ref, onData, onError);
    activeListeners.set(key, unsubs);
}

/**
 * Cancela um listener específico
 */
export function unsubscribe(key) {
    if (activeListeners.has(key)) {
        activeListeners.get(key)();
        activeListeners.delete(key);
    }
}

/**
 * Cancela todos os listeners (ideal para logout/fechamento de sala)
 */
export function unsubscribeAll() {
    activeListeners.forEach(unsubs => unsubs());
    activeListeners.clear();
}

/**
 * Utilitários para obter paths comuns
 */
export function getRoomRef(roomId) {
    return doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
}

export function getPlayersRef(roomId) {
    return collection(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players');
}

export function getPlayerRef(roomId, playerId) {
    return doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'players', playerId);
}
