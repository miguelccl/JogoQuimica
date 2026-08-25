/**
 * Gera um ID único aleatório (útil para roomId e fallbacks)
 */
export function generateUniqueId(length = 5) {
    return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
}

/**
 * Retorna uma seleção aleatória de itens do array
 */
export function shuffleAndSelect(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

/**
 * Cria um listener de background animado em canvas
 */
export function initCanvasBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h;
    let particles = [];
    let animFrame;
    
    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    for(let i=0; i<40; i++){
        particles.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
            radius: Math.random() * 2 + 1
        });
    }

    function draw() {
        ctx.clearRect(0,0,w,h);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        
        for(let i=0; i<particles.length; i++) {
            let p = particles[i];
            p.x += p.vx; p.y += p.vy;
            
            if(p.x < 0 || p.x > w) p.vx *= -1;
            if(p.y < 0 || p.y > h) p.vy *= -1;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
            ctx.fill();

            for(let j=i+1; j<particles.length; j++) {
                let p2 = particles[j];
                let dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                if(dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        }
        animFrame = requestAnimationFrame(draw);
    }
    draw();
}

/**
 * Dispara confetes usando canvas-confetti
 */
export function fireConfetti() {
    if (typeof confetti === 'undefined') return;
    var duration = 4 * 1000;
    var end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#06b6d4', '#a855f7', '#eab308'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#06b6d4', '#a855f7', '#eab308'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}
