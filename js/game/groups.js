import { runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../firebase/config.js";
import { getRoomRef, getPlayerRef } from "../firebase/realtime.js";
import { localState } from "./persistence.js";
import { showToast } from "../ui/ui.js";
import { getActivePlayers } from "./players.js";

export function getGroupCapacity(totalPlayers, numGroups) {
    return Math.ceil(totalPlayers / numGroups);
}

export async function joinGroup(groupId, totalPlayers, numGroups) {
    const roomId = localState.roomId;
    const playerId = localState.playerId;
    if (!roomId || !playerId) return;

    const maxCapacity = getGroupCapacity(Math.max(totalPlayers, numGroups), numGroups);
    const roomRef = getRoomRef(roomId);
    const pRef = getPlayerRef(roomId, playerId);

    try {
        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) throw "Sala não existe";

            const roomData = roomDoc.data();
            const groupsMap = roomData.groups || {};
            const groupCount = groupsMap[groupId] || 0;

            const pDoc = await transaction.get(pRef);
            const oldGroupId = pDoc.exists() ? pDoc.data().groupId : null;
            
            // Se tentar entrar no mesmo que ja está, ignora
            if (oldGroupId === groupId) throw "Mesmo grupo";

            if (groupCount >= maxCapacity) {
                throw "Grupo lotado";
            }

            if (oldGroupId && oldGroupId !== groupId) {
                const oldGroupCount = groupsMap[oldGroupId] || 1;
                groupsMap[oldGroupId] = oldGroupCount - 1;
            }

            if (oldGroupId !== groupId) {
                groupsMap[groupId] = groupCount + 1;
                transaction.update(roomRef, { groups: groupsMap });
                transaction.update(pRef, { groupId: groupId });
            }
        });
        showToast("Você mudou de equipe!", "success");
    } catch (e) {
        if (e !== "Mesmo grupo") {
            showToast(e === "Grupo lotado" ? "Este grupo já está cheio!" : "Erro ao entrar no grupo.", "error");
        }
    }
}

export function renderGroupSelection(roomData, playersList) {
    const area = document.getElementById('group-selection-area');
    const grid = document.getElementById('groups-grid');
    if (!area || !grid) return;

    if (roomData.mode !== 'teams' || roomData.status !== 'lobby') {
        area.classList.add('hidden');
        return;
    }

    area.classList.remove('hidden');
    document.getElementById('lobby-waiting-msg').classList.add('hidden');

    const numGroups = 4;
    const active = getActivePlayers(playersList);
    const maxCapacity = getGroupCapacity(Math.max(active.length, numGroups), numGroups);
    const groupsMap = roomData.groups || {};

    const myData = playersList.find(p => p.playerId === localState.playerId);
    const myGroup = myData ? myData.groupId : null;

    // Incremental DOM update
    for (let i = 1; i <= numGroups; i++) {
        const count = groupsMap[`g${i}`] || 0;
        const isFull = count >= maxCapacity;
        const isMine = myGroup === `g${i}`;
        const gId = `g${i}`;
        
        let el = document.getElementById(`card-group-${i}`);
        if (!el) {
            el = document.createElement('div');
            el.id = `card-group-${i}`;
            el.className = 'card p-4 flex flex-col items-center gap-3 transition-colors';
            el.innerHTML = `
                <div class="font-display font-bold text-lg text-slate-200">Equipe ${i}</div>
                <div class="text-[10px] text-slate-400 font-bold tracking-widest group-count-text uppercase"></div>
                <button class="btn-join-group w-full py-3 rounded-lg font-bold text-sm transition-all"></button>
            `;
            grid.appendChild(el);
            
            el.querySelector('.btn-join-group').addEventListener('click', () => {
                joinGroup(gId, active.length, numGroups);
            });
        }
        
        // Atualiza estado visual
        el.querySelector('.group-count-text').innerText = `${count} / ${maxCapacity} Vagas`;
        
        const btn = el.querySelector('.btn-join-group');
        
        if (isMine) {
            el.className = 'card p-4 flex flex-col items-center gap-3 transition-colors border-success bg-success/5 shadow-glow-success';
            btn.className = 'btn-join-group w-full py-3 rounded-lg font-bold text-sm transition-all bg-success text-white cursor-default';
            btn.innerText = 'Você está aqui';
            btn.disabled = true;
        } else if (isFull) {
            el.className = 'card p-4 flex flex-col items-center gap-3 transition-colors opacity-50 bg-surface-hover';
            btn.className = 'btn-join-group w-full py-3 rounded-lg font-bold text-sm transition-all bg-surface border border-white/10 text-slate-500 cursor-not-allowed';
            btn.innerText = 'Lotado';
            btn.disabled = true;
        } else {
            el.className = 'card p-4 flex flex-col items-center gap-3 transition-colors hover:border-primary/50';
            btn.className = 'btn-join-group w-full py-3 rounded-lg font-bold text-sm transition-all bg-surface-hover border border-white/10 text-white hover:bg-primary/20 hover:border-primary/50';
            btn.innerText = 'Entrar na Equipe';
            btn.disabled = false;
        }
    }
}
