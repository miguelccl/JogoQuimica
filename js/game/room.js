import { setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getRoomRef, getPlayersRef, subscribe, unsubscribeAll } from "../firebase/realtime.js";
import { localState, saveSession, clearSession } from "./persistence.js";
import { generateUniqueId, shuffleAndSelect } from "../utils/utils.js";
import { ALL_QUESTIONS } from "../data/questions.js";
import { showToast, switchScreen, toggleModal } from "../ui/ui.js";
import { registerPlayer, getActivePlayers, diffPlayersForTicker } from "./players.js";
import { 
    initHostLobby, updateHostLobby, 
    initPlayerLobby, updatePlayerLobby, 
    initHostGame, updateHostGame, 
    initPlayerGame, updatePlayerGame, 
    initHostResult, initPlayerResult 
} from "./game.js";

export async function createRoom() {
    const btn = document.getElementById('btn-do-create');
    btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> Gerando...`;
    btn.disabled = true;

    const conf = window.getWizardState(); // { mode, chaos, diff, count, time }

    let selectedQ = [];
    if (conf.diff === 'misto') {
        selectedQ = shuffleAndSelect(ALL_QUESTIONS, conf.count);
    } else {
        // Fácil, Médio ou Difícil: Banco fixo, não importa o count, pega todas e embaralha a ordem.
        const pool = ALL_QUESTIONS.filter(q => q.d === conf.diff);
        selectedQ = shuffleAndSelect(pool, pool.length);
    }
    
    // Força o modo chaos se o toggle estiver ativo
    const finalMode = conf.chaos ? 'chaos' : conf.mode;

    const roomId = generateUniqueId(5);
    const hostId = `host_${generateUniqueId(4)}`;
    const roomRef = getRoomRef(roomId);

    const initialData = {
        roomId: roomId,
        hostId: hostId,
        status: 'lobby',
        mode: finalMode,
        settings: { count: selectedQ.length, time: conf.time, diff: conf.diff },
        questions: selectedQ,
        currentQuestion: -1,
        questionStartedAt: 0,
        questionEndsAt: 0,
        groups: {}
    };
    
    // Tournament init
    if (finalMode === 'tournament') {
        initialData.tournament = {
            round: 0,
            activePlayers: [], // Preenchido no startGame
            eliminated: []
        };
    }

    try {
        await setDoc(roomRef, initialData);
        
        localState.role = 'host';
        localState.roomId = roomId;
        localState.playerId = hostId;
        localState.playerName = 'Host';
        localState.lastAutoAdvanceQ = -1; // Proteção contra disparos duplicados
        
        saveSession(roomId, hostId, true, 'Host');
        await registerPlayer(roomId, hostId, 'Host', true);
        
        toggleModal('modal-create', false);
        connectToRoom();
    } catch (e) {
        showToast("Erro ao criar sala.", "error");
    } finally {
        btn.innerHTML = `Gerar Sala`;
        btn.disabled = false;
    }
}

export async function joinRoom(codeFromUrl = null) {
    const codeInput = document.getElementById('join-code').value.toUpperCase().trim();
    const nameInput = document.getElementById('join-name').value.trim();
    const roomId = codeFromUrl || codeInput;
    const name = nameInput || "Aluno " + Math.floor(Math.random() * 100);

    if (!roomId) { showToast("Digite o código da sala", "error"); return; }
    
    const btn = document.getElementById('btn-do-join');
    if(btn) { btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> Conectando...`; btn.disabled = true; }

    try {
        const session = JSON.parse(sessionStorage.getItem("quimicaQuiz_session") || "{}");
        let playerId = session.playerId;
        if (!playerId || session.roomId !== roomId || session.isHost) {
            playerId = `p_${generateUniqueId(6)}`;
        }

        localState.role = 'player';
        localState.roomId = roomId;
        localState.playerId = playerId;
        localState.playerName = name;
        
        saveSession(roomId, playerId, false, name);
        await registerPlayer(roomId, playerId, name, false);
        
        if(btn) toggleModal('modal-join', false);
        connectToRoom();
    } catch(e) {
        showToast("Erro de conexão.", "error");
        if(btn) { btn.innerHTML = `Conectar`; btn.disabled = false; }
    }
}

export function connectToRoom() {
    if (!localState.roomId) return;
    
    switchScreen('screen-loading');
    
    const roomRef = getRoomRef(localState.roomId);
    const playersRef = getPlayersRef(localState.roomId);
    
    subscribe('room', roomRef, (docSnap) => {
        if (!docSnap.exists()) {
            showToast("Sala encerrada.", "error");
            disconnect();
            return;
        }
        
        const oldStatus = localState.roomData?.status;
        const oldQ = localState.roomData?.currentQuestion;
        localState.roomData = docSnap.data();
        
        const isNewQuestion = localState.roomData.status === 'playing' && (oldStatus !== 'playing' || oldQ !== localState.roomData.currentQuestion);
        
        if (isNewQuestion) {
            localState.hasAnsweredCurrent = false;
        }
        
        routeRender(oldStatus !== localState.roomData.status, isNewQuestion);
    });

    subscribe('players', playersRef, (querySnap) => {
        const players = [];
        querySnap.forEach(doc => players.push(doc.data()));
        localState.playersList = players;
        
        if (localState.role === 'host') {
            diffPlayersForTicker(getActivePlayers(players));
            if (localState.roomData?.status === 'playing') {
                checkAutoAdvance(players);
            }
        }
        
        routeRender(false, false);
    });
}

function checkAutoAdvance(players) {
    const g = localState.roomData;
    const now = Date.now();
    if (now >= g.questionEndsAt) return; // Ja acabou
    
    const currentQ = g.currentQuestion;
    // Previne disparo multiplo na mesma questão
    if (localState.lastAutoAdvanceQ === currentQ) return;
    
    let activePlayers = getActivePlayers(players);
    if (g.mode === 'tournament' && g.tournament) {
        activePlayers = activePlayers.filter(p => !g.tournament.eliminated.includes(p.playerId));
    }
    
    if (activePlayers.length === 0) return;
    
    const answeredCount = activePlayers.filter(p => p.hasAnswered).length;
    
    if (answeredCount >= activePlayers.length) {
        localState.lastAutoAdvanceQ = currentQ; // Lock para esta pergunta
        updateDoc(getRoomRef(localState.roomId), { questionEndsAt: now }).catch(console.error);
    }
}

let currentScreenState = null;

function routeRender(statusChanged, questionChanged) {
    if(!localState.roomData) return;
    const rd = localState.roomData;
    
    // Se o status principal mudou (Lobby -> Playing -> Finished), fazemos INIT
    if (statusChanged || currentScreenState !== rd.status) {
        currentScreenState = rd.status;
        if (rd.status === 'lobby') {
            if (localState.role === 'host') initHostLobby(); else initPlayerLobby();
        } else if (rd.status === 'playing') {
            // initHostGame será chamado (se isNewQuestion for verdadeiro também cairia, mas statusChanged ganha)
            if (localState.role === 'host') initHostGame(); else initPlayerGame();
        } else if (rd.status === 'finished') {
            if (localState.role === 'host') initHostResult(); else initPlayerResult();
        }
        return; // Retorna pois o INIT ja montou tudo
    }
    
    // Se a PERGUNTA mudou, re-iniciamos a tela de jogo
    if (questionChanged && rd.status === 'playing') {
        if (localState.role === 'host') initHostGame(); else initPlayerGame();
        return;
    }
    
    // Se nada critico mudou, fazemos apenas UPDATE INCREMENTAL
    if (rd.status === 'lobby') {
        if (localState.role === 'host') updateHostLobby(); else updatePlayerLobby();
    } else if (rd.status === 'playing') {
        if (localState.role === 'host') updateHostGame(); else updatePlayerGame();
    }
}

export function disconnect() {
    unsubscribeAll();
    clearSession();
    localState.roomId = null;
    switchScreen('screen-home');
}
