import { updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getRoomRef, getPlayerRef } from "../firebase/realtime.js";
import { localState } from "./persistence.js";
import { switchScreen, showToast, showFloatingPoints, updateText } from "../ui/ui.js";
import { getActivePlayers, sendSabotage, processMySabotages } from "./players.js";
import { renderGroupSelection } from "./groups.js";
import { enableAnswerButtons, submitAnswer } from "./scoring.js";
import { fireConfetti } from "../utils/utils.js";

// ================= LIFE CYCLE HOST =================
export async function startGame() {
    const active = getActivePlayers(localState.playersList);
    if (active.length === 0) {
        showToast("É necessário pelo menos 1 jogador ativo.", "warning");
        return;
    }
    const rd = localState.roomData;
    if (rd.mode === 'teams') {
        const noGroup = active.filter(p => !p.groupId);
        if (noGroup.length > 0) {
            showToast(`Ainda há ${noGroup.length} jogadores sem equipe!`, "warning");
            return;
        }
    }
    
    if (rd.mode === 'tournament') {
        const rounds = Math.max(1, Math.ceil(Math.log2(active.length)));
        const qPerRound = Math.max(1, Math.floor(rd.questions.length / rounds));
        await updateDoc(getRoomRef(localState.roomId), { 
            'tournament.totalRounds': rounds,
            'tournament.qPerRound': qPerRound,
            'tournament.activePlayers': active.map(p => p.playerId)
        });
    }

    startNextQuestion(0);
}

export async function nextQuestionHost() {
    const rd = localState.roomData;
    const isTournament = rd.mode === 'tournament';
    const nextQ = rd.currentQuestion + 1;
    
    if (isTournament) {
        const qpr = rd.tournament.qPerRound;
        // Se acabamos uma rodada (e não é a última pergunta do jogo inteiro ainda)
        if (nextQ % qpr === 0 && nextQ < rd.questions.length && rd.tournament.activePlayers.length > 1) {
            // Elimina metade inferior
            const currentActiveIds = rd.tournament.activePlayers;
            const players = localState.playersList.filter(p => currentActiveIds.includes(p.playerId));
            players.sort((a,b) => (b.score||0) - (a.score||0)); // Maior pro menor
            
            const surviveCount = Math.ceil(players.length / 2);
            const survivors = players.slice(0, surviveCount).map(p => p.playerId);
            const eliminated = players.slice(surviveCount).map(p => p.playerId);
            
            await updateDoc(getRoomRef(localState.roomId), {
                'tournament.activePlayers': survivors,
                'tournament.eliminated': [...(rd.tournament.eliminated||[]), ...eliminated],
                'tournament.round': rd.tournament.round + 1
            });
            showToast(`Rodada concluída! ${eliminated.length} eliminados.`, "info");
        }
    }

    if (nextQ >= rd.questions.length || (isTournament && rd.tournament.activePlayers.length <= 1)) {
        await updateDoc(getRoomRef(localState.roomId), { status: 'finished' });
    } else {
        startNextQuestion(nextQ);
    }
}

export async function finishGameHost() {
    await updateDoc(getRoomRef(localState.roomId), { status: 'finished' });
}

async function startNextQuestion(qIndex) {
    const duration = localState.roomData.settings.time * 1000;
    const now = Date.now();
    
    // Limpa respostas (otimização: poderia ser em Cloud Function, aqui usamos loop)
    const promises = getActivePlayers(localState.playersList).map(p => {
        return updateDoc(getPlayerRef(localState.roomId, p.playerId), { hasAnswered: false, currentAnswer: null });
    });
    
    try {
        await Promise.all(promises);
        await updateDoc(getRoomRef(localState.roomId), {
            status: 'playing',
            currentQuestion: qIndex,
            questionStartedAt: now,
            questionEndsAt: now + duration
        });
    } catch(e) {
        showToast("Erro ao iniciar pergunta.", "error");
    }
}

// ================= HOST LOBBY =================
export function initHostLobby() {
    switchScreen('screen-host-lobby');
    const rd = localState.roomData;
    updateText('display-room-code', rd.roomId);
    
    const qrDiv = document.getElementById('qrcode');
    if (qrDiv && qrDiv.innerHTML === '') {
        const joinUrl = window.location.href.split('?')[0] + '?code=' + rd.roomId;
        new QRCode(qrDiv, { text: joinUrl, width: 200, height: 200, colorDark: "#18181b", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
    }
    
    // Limpa a grid pro update preencher
    document.getElementById('lobby-players-grid').innerHTML = '';
    updateHostLobby();
}

export function updateHostLobby() {
    const active = getActivePlayers(localState.playersList);
    updateText('lobby-player-count', active.length);
    document.getElementById('btn-start-game').disabled = active.length === 0;
    
    const emptyState = document.getElementById('lobby-empty-state');
    const grid = document.getElementById('lobby-players-grid');
    
    if (active.length === 0) {
        emptyState.classList.remove('hidden');
        grid.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        grid.classList.remove('hidden');
        
        // Incremental Update DOM
        const currentIds = new Set(active.map(p => p.playerId));
        
        // Remove quem saiu
        Array.from(grid.children).forEach(child => {
            if (!currentIds.has(child.dataset.pid)) child.remove();
        });
        
        // Adiciona ou atualiza quem ta dentro
        active.forEach(p => {
            let el = grid.querySelector(`[data-pid="${p.playerId}"]`);
            if (!el) {
                el = document.createElement('div');
                el.dataset.pid = p.playerId;
                el.className = 'card p-3 flex items-center gap-3 animate-enter';
                el.innerHTML = `
                    <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center font-bold text-primary">${p.name.charAt(0).toUpperCase()}</div>
                    <div class="flex flex-col overflow-hidden">
                        <span class="font-bold text-sm truncate w-full text-white name-slot">${p.name}</span>
                        <span class="text-[10px] text-success font-bold uppercase group-slot"></span>
                    </div>
                `;
                grid.appendChild(el);
            }
            // Atualiza grupo se mudou
            const gSlot = el.querySelector('.group-slot');
            gSlot.innerText = p.groupId ? `Equipe ${p.groupId.replace('g','')}` : '';
        });
    }
}

// ================= PLAYER LOBBY =================
export function initPlayerLobby() {
    switchScreen('screen-player-lobby');
    updateText('player-lobby-name', localState.playerName);
    updatePlayerLobby();
}

export function updatePlayerLobby() {
    renderGroupSelection(localState.roomData, localState.playersList);
}

// ================= HOST GAME =================
export function initHostGame() {
    switchScreen('screen-host-game');
    const rd = localState.roomData;
    const qIndex = rd.currentQuestion;
    const q = rd.questions[qIndex];
    
    updateText('host-q-count', `${qIndex + 1}/${rd.questions.length}`);
    updateText('host-question-text', q.t);
    
    // Zera Graficos
    const barsContainer = document.getElementById('host-bars');
    barsContainer.innerHTML = '';
    ['A','B','C','D'].forEach((letter, i) => {
        barsContainer.innerHTML += `
            <div class="flex flex-col items-center gap-2 h-full justify-end w-full" id="bar-col-${i}">
                <span class="text-xs font-bold text-slate-400 bar-count">0</span>
                <div class="w-full bg-surface-hover rounded-t-lg transition-all duration-[800ms] bar-fill" style="height: 4px;"></div>
                <span class="font-display font-black text-xl text-slate-500 bar-letter">${letter}</span>
            </div>
        `;
    });
    
    document.getElementById('host-stats-area').classList.add('hidden', 'opacity-0');
    document.getElementById('btn-host-next').classList.add('hidden');
    document.getElementById('btn-host-finish').classList.add('hidden');
    document.getElementById('host-leaderboard').innerHTML = ''; // Zera no inicio de cada questao
    
    updateHostGame();
}

export function updateHostGame() {
    const rd = localState.roomData;
    const active = getActivePlayers(localState.playersList);
    const answered = active.filter(p => p.hasAnswered);
    
    updateText('host-answered-count', `${answered.length}/${active.length}`);
    
    const timeUp = Date.now() >= rd.questionEndsAt;
    manageHostTimer(timeUp, rd);
    
    // Tournament Banner
    const tBanner = document.getElementById('host-tournament-banner');
    if (rd.mode === 'tournament' && rd.tournament) {
        tBanner.classList.remove('hidden');
        tBanner.classList.add('flex');
        const rNum = rd.tournament.round + 1;
        const qRem = rd.tournament.qPerRound - (rd.currentQuestion % rd.tournament.qPerRound);
        tBanner.innerText = `RODADA ${rNum} • ${rd.tournament.activePlayers.length} Sobreviventes • Corte em ${qRem} pergunta(s)`;
    } else {
        tBanner.classList.add('hidden');
        tBanner.classList.remove('flex');
    }

    // Leaderboard vs Coop
    const list = document.getElementById('host-leaderboard');
    const coopContainer = document.getElementById('host-coop-bar-container');
    
    if (rd.mode === 'coop') {
        list.classList.add('hidden');
        coopContainer.classList.remove('hidden');
        coopContainer.classList.add('flex');
        
        const totalScore = active.reduce((acc, p) => acc + (p.score||0), 0);
        // Meta: todos responderem tudo super rapido? Digamos 100 base + 50 vel = 150 pts max por questão.
        const maxScore = active.length * rd.questions.length * 150; 
        const pct = Math.min(100, Math.max(0, (totalScore / maxScore) * 100));
        
        document.getElementById('coop-score-text').innerText = `${totalScore} / ${maxScore}`;
        document.getElementById('coop-progress-fill').style.width = `${pct}%`;
    } else {
        coopContainer.classList.add('hidden');
        coopContainer.classList.remove('flex');
        list.classList.remove('hidden');
        
        // Incremental Leaderboard
        const ranks = [];
        if (rd.mode === 'teams') {
            const groupsScores = {};
            active.forEach(p => {
                if(p.groupId) {
                    groupsScores[p.groupId] = (groupsScores[p.groupId]||0) + (p.score||0);
                }
            });
            Object.keys(groupsScores).forEach(k => ranks.push({ id: k, name: `Equipe ${k.replace('g','')}`, score: groupsScores[k] }));
        } else {
            active.forEach(p => ranks.push({ id: p.playerId, name: p.name, score: p.score||0, eliminated: rd.mode === 'tournament' && rd.tournament?.eliminated.includes(p.playerId) }));
        }
        
        ranks.sort((a,b) => b.score - a.score);
        const topRanks = rd.mode === 'tournament' ? ranks : ranks.slice(0,8);
        
        // Update DOM
        const currentRanks = new Set(topRanks.map(r => r.id));
        Array.from(list.children).forEach(child => { if (!currentRanks.has(child.dataset.rid)) child.remove(); });
        
        topRanks.forEach((r, idx) => {
            let el = list.querySelector(`[data-rid="${r.id}"]`);
            let color = idx === 0 ? 'text-warning' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-orange-400' : 'text-slate-500';
            
            if (!el) {
                el = document.createElement('div');
                el.dataset.rid = r.id;
                el.className = 'card p-3 flex justify-between items-center transition-all duration-500';
                el.innerHTML = `
                    <div class="flex items-center gap-3 overflow-hidden">
                        <span class="font-black text-lg w-5 rank-pos"></span>
                        <span class="font-bold text-sm truncate rank-name text-white"></span>
                    </div>
                    <span class="font-black text-accent rank-score"></span>
                `;
                list.appendChild(el);
            }
            // Move visualmente reordenando no DOM
            if (Array.from(list.children).indexOf(el) !== idx) list.appendChild(el);
            
            if (r.eliminated) {
                el.classList.add('opacity-40', 'grayscale');
                color = 'text-error';
            } else {
                el.classList.remove('opacity-40', 'grayscale');
            }
            
            el.querySelector('.rank-pos').className = `font-black text-lg w-5 rank-pos ${color}`;
            el.querySelector('.rank-pos').innerText = r.eliminated ? 'X' : `${idx+1}º`;
            el.querySelector('.rank-name').innerText = r.name;
            el.querySelector('.rank-score').innerText = r.score;
        });
    }

    // Revela os Resultados se o tempo acabou
    if (timeUp) {
        document.getElementById('host-stats-area').classList.remove('hidden');
        setTimeout(() => document.getElementById('host-stats-area').classList.remove('opacity-0'), 50);
        
        const isLast = rd.currentQuestion === rd.questions.length - 1;
        if (isLast) document.getElementById('btn-host-finish').classList.remove('hidden');
        else document.getElementById('btn-host-next').classList.remove('hidden');
        
        const qData = rd.questions[rd.currentQuestion];
        const counts = [0,0,0,0];
        answered.forEach(p => { if(p.currentAnswer !== null) counts[p.currentAnswer]++; });
        const maxCount = Math.max(...counts, 1);
        
        ['A','B','C','D'].forEach((letter, i) => {
            const isCor = (i === qData.a);
            const col = document.getElementById(`bar-col-${i}`);
            if(col) {
                col.querySelector('.bar-count').innerText = counts[i];
                const pct = Math.max((counts[i] / maxCount) * 100, 2);
                const fill = col.querySelector('.bar-fill');
                fill.style.height = `${pct}%`;
                
                if (isCor) {
                    fill.className = 'w-full bg-success shadow-glow-success rounded-t-lg transition-all duration-[800ms] bar-fill';
                    col.querySelector('.bar-letter').classList.replace('text-slate-500', 'text-success');
                }
            }
        });
    }
}

// ================= PLAYER GAME =================
export function initPlayerGame() {
    switchScreen('screen-player-game');
    const rd = localState.roomData;
    const qIndex = rd.currentQuestion;
    const q = rd.questions[qIndex];
    
    updateText('player-q-current', qIndex + 1);
    updateText('player-q-total', rd.questions.length);
    updateText('player-avatar-mini', localState.playerName.charAt(0).toUpperCase());
    updateText('player-question-text', q.t);
    
    enableAnswerButtons(); // Reset buttons
    
    // Injeta Botões da Pergunta uma única vez
    const grid = document.getElementById('player-options-grid');
    const optsHTML = [0,1,2,3].map(i => {
        const label = ['A','B','C','D'][i];
        return `
            <button class="option-btn p-5 md:p-6 text-left flex items-center gap-4 transition-transform hover:scale-[1.02] active:scale-95" id="p-opt-${i}">
                <span class="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/5 flex items-center justify-center font-black text-lg shrink-0 border border-white/10 shadow-sm">${label}</span>
                <span class="font-semibold text-white text-lg md:text-xl leading-snug">${q.o[i]}</span>
            </button>
        `;
    }).join('');
    grid.innerHTML = optsHTML;
    
    // Bind click
    [0,1,2,3].forEach(i => {
        const btn = document.getElementById(`p-opt-${i}`);
        if(btn) btn.onclick = () => submitAnswer(i, btn);
    });
    
    document.getElementById('player-feedback').classList.add('hidden');
    document.getElementById('player-feedback').classList.remove('flex');
    document.getElementById('chaos-victim-overlay').classList.add('hidden');
    
    // Chaos Bar Logic Init
    const chaosBar = document.getElementById('chaos-powers-bar');
    if (rd.mode === 'chaos') {
        chaosBar.classList.remove('hidden');
        document.querySelectorAll('.btn-power').forEach(btn => {
            btn.onclick = () => activatePower(btn);
        });
    } else {
        chaosBar.classList.add('hidden');
    }
    
    updatePlayerGame();
}

export function updatePlayerGame() {
    const rd = localState.roomData;
    const q = rd.questions[rd.currentQuestion];
    const myData = localState.playersList.find(p => p.playerId === localState.playerId) || {};
    const active = getActivePlayers(localState.playersList);
    
    updateText('player-score-mini', `${myData.score || 0} pts`);
    const rank = active.filter(p => (p.score||0) > (myData.score||0)).length + 1;
    updateText('player-rank-mini', `${rank}º LUGAR`);
    
    const timeUp = Date.now() >= rd.questionEndsAt;
    managePlayerTimer(timeUp, rd);
    
    const isEliminated = rd.mode === 'tournament' && rd.tournament?.eliminated.includes(localState.playerId);
    const badge = document.getElementById('player-tournament-badge');
    if (isEliminated) {
        badge.classList.remove('hidden');
        badge.classList.add('block');
    } else {
        badge.classList.add('hidden');
        badge.classList.remove('block');
    }

    if (myData.hasAnswered || timeUp || isEliminated) {
        disableAnswerButtons();
        if(myData.currentAnswer !== null && myData.currentAnswer !== undefined) {
            document.getElementById(`p-opt-${myData.currentAnswer}`)?.classList.add('selected');
        }
    }
    
    // Feedback de Fim de Questão
    const fb = document.getElementById('player-feedback');
    if (timeUp && fb.classList.contains('hidden')) {
        fb.classList.remove('hidden');
        fb.classList.add('flex');
        
        const isCor = localState.lastWasCorrect; // Derivado na hora de submit, se não clicou é falso
        
        // Marcação dos botões por baixo do overlay
        document.getElementById(`p-opt-${q.a}`)?.classList.add('correct');
        if (myData.currentAnswer !== null && myData.currentAnswer !== q.a) {
            document.getElementById(`p-opt-${myData.currentAnswer}`)?.classList.add('wrong');
        }
        
        const fbIcon = document.getElementById('feedback-icon');
        const fbTitle = document.getElementById('feedback-title');
        const fbPoints = document.getElementById('feedback-points');
        
        if (isEliminated) {
            fbIcon.className = `w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-xl bg-slate-800/80 text-white`;
            fbIcon.innerHTML = `<i data-lucide="eye" class="w-12 h-12 text-slate-400"></i>`;
            fbTitle.innerText = 'ESPECTADOR';
            fbTitle.className = `text-4xl font-display font-black mb-2 text-slate-400`;
            fbPoints.innerHTML = "Você foi eliminado.";
        }
        else if (myData.currentAnswer !== null && myData.currentAnswer !== undefined) {
            fbIcon.className = `w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-xl ${isCor ? 'bg-success/20 shadow-glow-success' : 'bg-error/20'}`;
            fbIcon.innerHTML = `<i data-lucide="${isCor ? 'check' : 'x'}" class="w-12 h-12 ${isCor ? 'text-success' : 'text-error'}"></i>`;
            fbTitle.innerText = isCor ? 'CORRETO!' : 'INCORRETO!';
            fbTitle.className = `text-4xl font-display font-black mb-2 ${isCor ? 'text-success' : 'text-error'}`;
            fbPoints.innerHTML = isCor ? `+${localState.lastBasePoints} base <br> +${localState.lastSpeedBonus} vel.` : "0 pontos";
            
            if(window.lucide) window.lucide.createIcons();
            
            if (isCor) {
                // Microinteração flutuante do score global
                showFloatingPoints(document.getElementById('player-score-mini').parentElement, `+${localState.lastPointsEarned}`);
            }
        } else {
            // Tempo esgotado e ninguem respondeu
            fbIcon.className = `w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-xl bg-warning/20 text-warning`;
            fbIcon.innerHTML = `<i data-lucide="clock" class="w-12 h-12 text-warning"></i>`;
            fbTitle.innerText = 'TEMPO ESGOTADO!';
            fbTitle.className = `text-4xl font-display font-black mb-2 text-warning`;
            fbPoints.innerHTML = "0 pontos";
        }
    }

    // Processamento de Sabotagens Recebidas (Modo Caos)
    if (rd.mode === 'chaos' && !timeUp && !myData.hasAnswered) {
        const unhandled = processMySabotages(myData);
        unhandled.forEach(sab => applySabotage(sab));
    }
}

// ================= SABOTAGENS (MODO CAOS) =================
const COOLDOWN_MS = 20000;
function activatePower(btn) {
    if (btn.disabled) return;
    
    // Seleciona vitima aleatoria ativa, exeto eu
    const active = getActivePlayers(localState.playersList).filter(p => p.playerId !== localState.playerId && !p.hasAnswered);
    if (active.length === 0) {
        showToast("Nenhuma vítima disponível para sabotar agora.", "warning");
        return;
    }
    
    const target = active[Math.floor(Math.random() * active.length)];
    const type = btn.dataset.power;
    
    sendSabotage(type, target.playerId);
    showToast(`Você sabotou ${target.name}!`, "success");
    
    // Cooldown local UI
    btn.disabled = true;
    let cd = COOLDOWN_MS / 1000;
    const txt = btn.querySelector('.cooldown-text');
    txt.innerText = `${cd}s`;
    
    const cdInt = setInterval(() => {
        cd--;
        if(cd <= 0) {
            clearInterval(cdInt);
            btn.disabled = false;
            txt.innerText = "Pronto";
        } else {
            txt.innerText = `${cd}s`;
        }
    }, 1000);
}

function applySabotage(sab) {
    if (sab.type === 'block') {
        const overlay = document.getElementById('chaos-victim-overlay');
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        
        const opts = document.getElementById('player-options-grid');
        opts.classList.add('chaos-blocked');
        
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
            opts.classList.remove('chaos-blocked');
        }, 3000); // Bloqueio de 3s
    } 
    else if (sab.type === 'shuffle') {
        const grid = document.getElementById('player-options-grid');
        // Usamos CSS Flex order para embaralhar visualmente
        Array.from(grid.children).forEach(btn => {
            btn.style.order = Math.floor(Math.random() * 4);
        });
        showToast("Suas opções foram embaralhadas!", "error");
    }
}

// ================= RESULTS =================
export function initHostResult() {
    switchScreen('screen-host-result');
    const active = getActivePlayers(localState.playersList);
    const arr = [...active].sort((a,b) => (b.score||0) - (a.score||0));
    
    const pc = document.getElementById('podium-container');
    pc.innerHTML = ''; // Aqui é OK recriar pois a tela só aparece 1x no final
    
    if(arr.length > 1) pc.innerHTML += createPodiumCol(arr[1], 2);
    if(arr.length > 0) pc.innerHTML += createPodiumCol(arr[0], 1);
    if(arr.length > 2) pc.innerHTML += createPodiumCol(arr[2], 3);

    fireConfetti(); 
    if(window.lucide) window.lucide.createIcons();
}

function createPodiumCol(p, pos) {
    const isFirst = pos === 1;
    const h = isFirst ? 'h-full' : pos === 2 ? 'h-[75%]' : 'h-[50%]';
    const grad = isFirst ? 'from-warning to-amber-300' : pos === 2 ? 'from-slate-700 to-slate-400' : 'from-orange-800 to-orange-500';
    const txtColor = isFirst ? 'text-warning' : pos === 2 ? 'text-white' : 'text-orange-400';
    
    let html = `<div class="flex flex-col items-center animate-enter" style="animation-delay: ${isFirst ? 0.6 : pos === 2 ? 0.3 : 0.1}s">`;
    if (isFirst) html += `<i data-lucide="crown" class="w-10 h-10 text-warning mb-2 animate-bounce shadow-glow"></i>`;
    
    html += `
        <div class="text-${isFirst ? 'xl' : 'lg'} font-bold truncate w-24 md:w-32 text-center ${txtColor} bg-surface px-2 py-1 rounded-lg border border-white/5 mb-2">${p.name}</div>
        <div class="text-xs text-slate-400 mb-2 font-bold">${p.score || 0} pts</div>
        <div class="w-24 md:w-32 ${h} bg-gradient-to-t ${grad} rounded-t-2xl flex justify-center pt-4 shadow-md border-t border-white/30 ${isFirst ? 'z-10 relative shadow-glow' : ''}">
            <span class="text-${isFirst ? '5xl' : '4xl'} font-display font-black text-black/20">${pos}</span>
        </div>
    </div>`;
    return html;
}

export function initPlayerResult() {
    // Redireciona player para tela de lobby "Fim" (a tela de pódio não foi criada para o player na refat html, 
    // ou usamos um Modal/Alerta final) - Simplificando, ele volta pro Home e ve os pontos dele.
    switchScreen('screen-player-lobby');
    document.getElementById('lobby-waiting-msg').innerHTML = `
        <h2 class="text-3xl font-display font-black text-white mb-2">Fim de Jogo!</h2>
        <p class="text-primary font-bold">Olhe para a tela principal para ver o Pódio.</p>
    `;
}

// ================= TIMERS =================
function manageHostTimer(timeUp, rd) {
    if (localState.timerInterval) cancelAnimationFrame(localState.timerInterval);
    const txt = document.getElementById('host-timer-text');
    
    if (timeUp) {
        if(txt) {
            txt.innerText = '00';
            txt.classList.add('text-error', 'border-error');
        }
        return;
    }
    
    const tick = () => {
        const now = Date.now();
        const rem = Math.max(0, rd.questionEndsAt - now);
        const seconds = Math.ceil(rem / 1000);
        
        if(txt) {
            txt.innerText = seconds.toString().padStart(2, '0');
            if (seconds <= 5 && rem > 0) {
                txt.classList.add('text-error', 'border-error');
                txt.classList.remove('border-white/5');
            } else {
                txt.classList.remove('text-error', 'border-error');
                txt.classList.add('border-white/5');
            }
        }
        if (rem > 0 && localState.roomData.status === 'playing') localState.timerInterval = requestAnimationFrame(tick);
    };
    tick();
}

function managePlayerTimer(timeUp, rd) {
    if (localState.timerInterval) cancelAnimationFrame(localState.timerInterval);
    const el = document.getElementById('player-timer');
    
    if (timeUp) {
        if(el) { 
            el.innerText = '00'; 
            el.classList.add('text-error', 'border-error');
        }
        return;
    }
    
    const tick = () => {
        const now = Date.now();
        const rem = Math.max(0, rd.questionEndsAt - now);
        const seconds = Math.ceil(rem / 1000);
        
        if(el) {
            el.innerText = seconds.toString().padStart(2, '0');
            if (seconds <= 5 && rem > 0) {
                el.classList.add('text-error', 'border-error');
                el.classList.remove('border-white/5');
            } else {
                el.classList.remove('text-error', 'border-error');
                el.classList.add('border-white/5');
            }
        }
        if (rem > 0 && localState.roomData.status === 'playing') localState.timerInterval = requestAnimationFrame(tick);
    };
    tick();
}
