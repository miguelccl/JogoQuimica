import { updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getPlayerRef } from "../firebase/realtime.js";
import { localState } from "./persistence.js";
import { showToast, showFloatingPoints } from "../ui/ui.js";

/**
 * Registra a resposta do jogador e calcula pontos/velocidade
 */
export async function submitAnswer(optIndex, btnElement) {
    if (localState.hasAnsweredCurrent) return;
    
    const room = localState.roomData;
    const qIndex = room.currentQuestion;
    const qData = room.questions[qIndex];
    
    const now = Date.now();
    if (now > room.questionEndsAt) return;
    
    localState.hasAnsweredCurrent = true;
    disableAnswerButtons();
    btnElement.classList.add('selected');

    const isCorrect = qData.a === optIndex;
    let points = 0;
    let basePoints = 0;
    let speedBonus = 0;
    
    if (isCorrect) {
        const timeRemaining = Math.max(0, room.questionEndsAt - now);
        const totalDuration = room.questionEndsAt - room.questionStartedAt;
        
        const timeBonus = (timeRemaining / totalDuration); 
        const difficultyMult = qData.d === 'facil' ? 1.0 : qData.d === 'medio' ? 1.25 : 1.5;
        
        basePoints = Math.round(100 * difficultyMult);
        speedBonus = Math.round((timeBonus * 50) * difficultyMult);
        points = basePoints + speedBonus;
    }

    try {
        const pRef = getPlayerRef(localState.roomId, localState.playerId);
        const myData = localState.playersList.find(p => p.playerId === localState.playerId);
        const currentScore = myData?.score || 0;
        
        await updateDoc(pRef, {
            currentAnswer: optIndex,
            hasAnswered: true,
            answeredAt: now,
            score: currentScore + points,
            [`ans.${qIndex}`]: optIndex
        });
        
        // Guarda na memoria para poder desenhar a animacao de pontos dps que acabar o tempo
        localState.lastPointsEarned = points;
        localState.lastBasePoints = basePoints;
        localState.lastSpeedBonus = speedBonus;
        localState.lastWasCorrect = isCorrect;
        
        // Pequeno feedback
        btnElement.style.transform = "scale(0.95)";
        setTimeout(() => btnElement.style.transform = "none", 150);
        
    } catch (e) {
        showToast("Erro ao enviar resposta.", "error");
        localState.hasAnsweredCurrent = false;
        enableAnswerButtons();
        btnElement.classList.remove('selected');
    }
}

export function disableAnswerButtons() {
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => b.disabled = true);
}

export function enableAnswerButtons() {
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => {
        b.disabled = false;
        b.classList.remove('selected', 'correct', 'wrong');
        b.style = ''; // Limpa ordem flex order se estiver shuffle
        b.innerHTML = b.innerHTML.replace(/<i data-lucide="ban".*?<\/i>/g, '');
    });
}
