import { setDoc, updateDoc, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getPlayerRef } from "../firebase/realtime.js";
import { localState } from "./persistence.js";
import { showTicker } from "../ui/ui.js";

let presenceInterval = null;

export async function registerPlayer(roomId, playerId, playerName, isHost = false) {
    const pRef = getPlayerRef(roomId, playerId);
    const data = {
        playerId: playerId,
        name: playerName,
        isHost: isHost,
        // Usamos Date.now() do cliente para evitar descasamento relogio local vs servidor
        lastSeen: Date.now(),
        connected: true
    };
    await setDoc(pRef, data, { merge: true });
}

export function startPresencePing() {
    if (presenceInterval) clearInterval(presenceInterval);
    
    // Ping a cada 15 segundos
    presenceInterval = setInterval(() => {
        if (localState.roomId && localState.playerId) {
            const pRef = getPlayerRef(localState.roomId, localState.playerId);
            // Continua pingando mesmo em background (com menos frequencia pelo navegador, mas pinga)
            updateDoc(pRef, { lastSeen: Date.now(), connected: true }).catch(() => {});
        }
    }, 15000);
    
    // Resume pings imediatos quando a aba volta a ficar visivel
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'visible' && localState.roomId) {
            const pRef = getPlayerRef(localState.roomId, localState.playerId);
            updateDoc(pRef, { lastSeen: Date.now(), connected: true }).catch(() => {});
        }
    });
}

export async function setDisconnected() {
    if (localState.roomId && localState.playerId) {
        const pRef = getPlayerRef(localState.roomId, localState.playerId);
        await updateDoc(pRef, { connected: false }).catch(() => {});
    }
}

/**
 * Retorna jogadores considerados ativos.
 * Timeout de 90s (tolerância alta para celulares em background ou lag).
 */
export function getActivePlayers(playersList) {
    const now = Date.now();
    return playersList.filter(p => {
        if (p.isHost) return false;
        if (p.connected === false) return false;
        
        let lastSeenMs = p.lastSeen || now;
        
        // Se passou mais de 90 segundos sem ping, considera off.
        // Aumentado drasticamente para evitar que jogadores sumam enquanto leem a pergunta.
        // Também removemos a dependencia do serverTimestamp para evitar timezone/clock skew.
        if (now - lastSeenMs > 90000) return false;
        
        return true;
    });
}

export async function sendSabotage(type, targetId) {
    if (!localState.roomId || !localState.playerId) return;
    const pRef = getPlayerRef(localState.roomId, targetId);
    
    const eventId = `sab_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    const event = {
        id: eventId,
        type: type,
        attackerId: localState.playerId,
        createdAt: Date.now()
    };
    
    try {
        await updateDoc(pRef, {
            sabotages: arrayUnion(event)
        });
    } catch (e) {
        console.error("Erro ao sabotar", e);
    }
}

export function processMySabotages(myData) {
    if (!myData.sabotages || !Array.isArray(myData.sabotages)) return [];
    
    const unhandled = [];
    const processedMap = localState.processedSabotages || {};
    
    myData.sabotages.forEach(sab => {
        if (!processedMap[sab.id]) {
            if (Date.now() - sab.createdAt < 10000) {
                unhandled.push(sab);
            }
            processedMap[sab.id] = true;
        }
    });
    
    localState.processedSabotages = processedMap;
    return unhandled;
}

let lastKnownPlayers = new Set();
export function diffPlayersForTicker(activePlayersList) {
    const current = new Set(activePlayersList.map(p => p.playerId));
    
    if (lastKnownPlayers.size > 0) {
        activePlayersList.forEach(p => {
            if (!lastKnownPlayers.has(p.playerId)) {
                showTicker(`${p.name} conectou`);
            }
        });
        // Não vamos floodar ticker de saída caso haja oscilação de rede
    }
    
    lastKnownPlayers = current;
}
