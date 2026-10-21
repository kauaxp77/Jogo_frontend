// Bug Buster - Renderização (Canvas), entrada, áudio e controle de telas.
// Toda regra de jogo fica em logic.js (GameLogic).

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

const TILE_SIZE = 32;
const STEP = 1000 / 60; // passo fixo da simulação (60 ticks/s)
const game = new GameLogic();

const ui = {
    container: $('game-container'),
    area: $('game-area'),
    score: $('score'),
    highscore: $('highscore'),
    lives: $('lives'),
    level: $('level-display'),
    toast: $('toast'),
    powerFill: $('power-fill'),
    powerLabel: $('power-label'),
    menu: $('menu-screen'),
    pause: $('pause-screen'),
    gameOver: $('game-over-screen'),
    victory: $('victory-screen'),
    gameOverMsg: $('gameover-msg'),
    finalScore: $('final-score'),
    newRecord: $('new-record'),
    commitMsg: $('commit-msg'),
    levelStats: $('level-stats'),
    mute: $('mute-indicator')
};

const WALL_COLORS = ['#00ff88', '#ffd23f', '#ff3b3b'];

const GAME_OVER_MESSAGES = [
    'Funcionava na minha máquina! 🤷',
    'Segmentation fault (core dumped)',
    'Você fez deploy na sexta-feira...',
    'Erro 404: vidas não encontradas',
    'NullPointerException em Programador.java:42',
    'O Ransomware criptografou o seu café ☕',
    'git push --force deu muito ruim',
    'Stack Overflow está fora do ar. Boa sorte.',
    'undefined is not a function (nem você)'
];

const COMMIT_MESSAGES = [
    'fix: bugs exterminados com sucesso',
    'feat: código limpo e cheiroso',
    'test: todos os testes passaram (de primeira!)',
    'refactor: removidos 100% dos bugs',
    'chore: café reabastecido',
    'docs: o código agora se explica sozinho',
    'perf: programador 200% mais rápido'
];

let state = 'MENU'; // MENU | READY | PLAYING | PAUSED | DYING | VICTORY | GAMEOVER
let stateTimer = 0;
let frame = 0;
let flash = 0;
let deathPos = null;
let particles = [];
let floaters = [];
let rainbow = false;
let levelStats = { bugs: 0, ticks: 0, startScore: 0 };
let wallLayer = null;
let lastRecordIndex = -1;

// ------------------------------------------------------------------
// Recordes (localStorage)
// ------------------------------------------------------------------
const Scores = {
    key: 'bugbuster.scores',
    load() {
        try {
            return JSON.parse(localStorage.getItem(this.key)) || [];
        } catch (e) {
            return [];
        }
    },
    save(score, level) {
        const list = this.load();
        const entry = { score, level, date: new Date().toLocaleDateString('pt-BR') };
        list.push(entry);
        list.sort((a, b) => b.score - a.score);
        const top = list.slice(0, 5);
        try {
            localStorage.setItem(this.key, JSON.stringify(top));
        } catch (e) { /* modo privado: ignora */ }
        return top.indexOf(entry);
    },
    best() {
        const list = this.load();
        return list.length ? list[0].score : 0;
    }
};

function renderLeaderboard(listId) {
    const el = $(listId);
    const list = Scores.load();
    el.innerHTML = '';
    if (list.length === 0) {
        el.innerHTML = '<li>Nenhum recorde ainda. Seja o primeiro!</li>';
        return;
    }
    list.forEach((s, i) => {
        const li = document.createElement('li');
        li.textContent = `${String(s.score).padStart(6, ' ')} pts · fase ${s.level} · ${s.date}`;
        if (i === lastRecordIndex) li.className = 'me';
        el.appendChild(li);
    });
}

// ------------------------------------------------------------------
// Áudio sintetizado (Web Audio API) - nenhum arquivo externo
// ------------------------------------------------------------------
const Sound = {
    ctx: null,
    master: null,
    muted: false,
    musicTimer: null,
    musicStep: 0,
    wakaToggle: false,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.6;
            this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    tone(freq, dur, type = 'square', vol = 0.08, delay = 0, slideTo = null) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    },

    arpeggio(notes, gap, type = 'square', vol = 0.07) {
        notes.forEach((n, i) => this.tone(n, gap * 1.4, type, vol, i * gap));
    },

    play(name, extra = 0) {
        switch (name) {
            case 'dot':
                this.wakaToggle = !this.wakaToggle;
                this.tone(this.wakaToggle ? 520 : 680, 0.06, 'triangle', 0.06);
                break;
            case 'power':
                this.tone(300, 0.35, 'square', 0.08, 0, 900);
                this.arpeggio([523, 659, 784, 1047], 0.06, 'triangle', 0.06);
                break;
            case 'eatEnemy':
                this.tone(200 + extra * 120, 0.25, 'sawtooth', 0.09, 0, 1400 + extra * 200);
                break;
            case 'die':
                this.tone(700, 0.9, 'sawtooth', 0.12, 0, 50);
                this.tone(350, 0.9, 'square', 0.06, 0.1, 40);
                break;
            case 'freeze':
                this.tone(1800, 0.5, 'sine', 0.08, 0, 300);
                this.arpeggio([1568, 1319, 1047, 784], 0.05, 'sine', 0.05);
                break;
            case 'pizza':
                this.arpeggio([523, 659, 784, 1047, 1319], 0.07, 'square', 0.06);
                break;
            case 'extraLife':
                this.arpeggio([392, 523, 659, 784, 1047, 1319], 0.08, 'triangle', 0.08);
                break;
            case 'item':
                this.tone(880, 0.08, 'square', 0.05);
                this.tone(1320, 0.1, 'square', 0.05, 0.09);
                break;
            case 'start':
                this.arpeggio([262, 330, 392, 523, 392, 523, 659], 0.11, 'square', 0.06);
                break;
            case 'win':
                this.arpeggio([523, 523, 784, 784, 880, 1047, 1319, 1568], 0.1, 'square', 0.07);
                break;
            case 'gameover':
                this.arpeggio([392, 370, 349, 330, 311, 294, 277, 262], 0.15, 'triangle', 0.08);
                break;
        }
    },

    // Música chiptune procedural (baixo + arpejo)
    startMusic() {
        this.stopMusic();
        const bass = [110, 110, 131, 110, 147, 110, 131, 98];
        const lead = [440, 523, 659, 523, 587, 698, 659, 494];
        const tick = () => {
            if (state !== 'PLAYING') return;
            const s = this.musicStep++ % 8;
            if (game.frozenTimer > 0) {
                if (s % 4 === 0) this.tone(bass[s] * 4, 0.3, 'sine', 0.02);
            } else {
                this.tone(bass[s], 0.14, 'square', 0.035);
                if (game.player.poweredUp) this.tone(lead[s] * 1.5, 0.08, 'triangle', 0.03);
                else if (s % 2 === 0) this.tone(lead[s], 0.08, 'triangle', 0.018);
            }
            this.musicTimer = setTimeout(tick, game.player.poweredUp ? 110 : 160);
        };
        tick();
    },

    stopMusic() {
        clearTimeout(this.musicTimer);
    },

    toggleMute() {
        this.muted = !this.muted;
        ui.mute.textContent = this.muted ? '🔇' : '🔊';
        if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    }
};

// ------------------------------------------------------------------
// Efeitos visuais
// ------------------------------------------------------------------
function burst(x, y, color, count = 12, speed = 3) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = Math.random() * speed + 0.5;
        particles.push({
            x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            life: 30 + Math.random() * 25, max: 55, color, size: 2 + Math.random() * 2
        });
    }
}

function floatText(x, y, text, color = '#fff') {
    floaters.push({ x, y, text, color, life: 60 });
}

function shake() {
    ui.area.classList.remove('shake');
    void ui.area.offsetWidth; // reinicia a animação CSS
    ui.area.classList.add('shake');
}

let toastTimer = null;
function toast(text, color = '#00ff88') {
    ui.toast.textContent = text;
    ui.toast.style.borderColor = color;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1600);
}

const center = v => v * TILE_SIZE + TILE_SIZE / 2;

// ------------------------------------------------------------------
// Controle de estados / telas
// ------------------------------------------------------------------
function hideOverlays() {
    [ui.menu, ui.pause, ui.gameOver, ui.victory].forEach(o => o.classList.remove('active'));
}

function startGame() {
    Sound.init();
    hideOverlays();
    lastRecordIndex = -1;
    game.reset();
    beginLevel();
}

function startNextLevel() {
    hideOverlays();
    game.nextLevel();
    beginLevel();
}

function beginLevel() {
    buildWallLayer();
    levelStats = { bugs: 0, ticks: 0, startScore: game.score };
    particles = [];
    floaters = [];
    enterReady(150);
    Sound.play('start');
    updateUI();
}

function enterReady(duration) {
    state = 'READY';
    stateTimer = duration;
}

function goToMenu() {
    hideOverlays();
    Sound.stopMusic();
    state = 'MENU';
    renderLeaderboard('leaderboard-menu');
    ui.menu.classList.add('active');
}

function togglePause() {
    if (state === 'PLAYING') {
        state = 'PAUSED';
        Sound.stopMusic();
        ui.pause.classList.add('active');
    } else if (state === 'PAUSED') {
        state = 'PLAYING';
        ui.pause.classList.remove('active');
        Sound.startMusic();
    }
}

function showGameOver() {
    state = 'GAMEOVER';
    const previousBest = Scores.best();
    lastRecordIndex = Scores.save(game.score, game.level);
    ui.gameOverMsg.textContent = pick(GAME_OVER_MESSAGES);
    ui.finalScore.textContent = game.score;
    ui.newRecord.classList.toggle('show', game.score > previousBest && game.score > 0);
    renderLeaderboard('leaderboard-over');
    ui.gameOver.classList.add('active');
    Sound.play('gameover');
    updateUI();
}

function showVictory() {
    state = 'VICTORY';
    Sound.stopMusic();
    Sound.play('win');
    ui.commitMsg.textContent = pick(COMMIT_MESSAGES);
    const seconds = (levelStats.ticks / 60).toFixed(1);
    ui.levelStats.innerHTML = `
        <li>Fase:</li><li><b>${game.level} · ${game.map.name}</b></li>
        <li>Tempo:</li><li><b>${seconds}s</b></li>
        <li>Bugs exterminados:</li><li><b>${levelStats.bugs}</b></li>
        <li>Pontos na fase:</li><li><b>+${game.score - levelStats.startScore}</b></li>`;
    ui.victory.classList.add('active');
    for (let i = 0; i < 6; i++) {
        setTimeout(() => burst(Math.random() * canvas.width, Math.random() * canvas.height * 0.6,
            `hsl(${Math.random() * 360},100%,60%)`, 30, 5), i * 250);
    }
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function updateUI() {
    ui.score.textContent = game.score;
    ui.highscore.textContent = Math.max(Scores.best(), game.score);
    ui.lives.textContent = '❤'.repeat(game.lives) || '—';
    ui.level.textContent = `Fase ${game.level} · ${game.map.name}`;
    ui.container.classList.toggle('powered', game.player.poweredUp);
    ui.container.classList.toggle('frozen', game.frozenTimer > 0);

    if (game.player.poweredUp) {
        ui.powerFill.className = '';
        ui.powerFill.style.width = (game.player.powerTimer / game.powerDuration * 100) + '%';
        ui.powerLabel.textContent = `☕ CAFEÍNA ${(game.player.powerTimer / 60).toFixed(1)}s`;
    } else if (game.frozenTimer > 0) {
        ui.powerFill.className = 'ice';
        ui.powerFill.style.width = (game.frozenTimer / 240 * 100) + '%';
        ui.powerLabel.textContent = `⏸ BREAKPOINT ${(game.frozenTimer / 60).toFixed(1)}s`;
    } else {
        ui.powerFill.style.width = '0';
        ui.powerLabel.textContent = '';
    }
}

// Reage aos eventos emitidos pela lógica
function handleEvents(events) {
    for (const ev of events) {
        switch (ev.type) {
            case 'dot':
                Sound.play('dot');
                burst(center(ev.x), center(ev.y), '#9fffcf', 3, 1.5);
                break;
            case 'power':
                Sound.play('power');
                flash = 1;
                burst(center(ev.x), center(ev.y), '#ffcc33', 25, 4);
                toast('☕ CAFÉ! Os bugs estão vulneráveis!', '#ffcc33');
                break;
            case 'eatEnemy':
                levelStats.bugs++;
                Sound.play('eatEnemy', game.combo);
                burst(center(ev.x), center(ev.y), ev.color, 30, 5);
                floatText(center(ev.x), center(ev.y), `+${ev.points}`, '#ffcc33');
                if (game.combo >= 2) toast(`🔥 COMBO x${game.combo}! ${ev.name} deletado`, '#ff9900');
                break;
            case 'freeze':
                Sound.play('freeze');
                flash = 0.6;
                toast('⏸ BREAKPOINT! Bugs congelados', '#7fe7ff');
                break;
            case 'pizza':
                Sound.play('pizza');
                burst(center(ev.x), center(ev.y), '#ffaa33', 25, 4);
                floatText(center(ev.x), center(ev.y), '+500', '#ffaa33');
                toast('🍕 Pizza da madrugada! +500', '#ffaa33');
                break;
            case 'itemSpawn':
                Sound.play('item');
                burst(center(ev.x), center(ev.y), '#ffffff', 14, 2);
                break;
            case 'extraLife':
                Sound.play('extraLife');
                toast('❤ VIDA EXTRA! Backup restaurado', '#ff3355');
                break;
            case 'die':
            case 'gameover':
                Sound.stopMusic();
                Sound.play('die');
                deathPos = { x: ev.x, y: ev.y };
                burst(center(ev.x), center(ev.y), '#2f8cff', 40, 5);
                shake();
                toast(`💥 Exception! Pego pelo ${ev.killer}`, '#ff3355');
                state = 'DYING';
                stateTimer = 80;
                break;
            case 'win':
                showVictory();
                break;
        }
    }
    if (events.length) {
        ui.score.classList.remove('bump');
        void ui.score.offsetWidth;
        ui.score.classList.add('bump');
    }
}

// ------------------------------------------------------------------
// Atualização por tick (60x/s, independente do monitor)
// ------------------------------------------------------------------
function update() {
    frame++;
    if (state === 'READY') {
        if (--stateTimer <= 0) {
            state = 'PLAYING';
            Sound.startMusic();
        }
    } else if (state === 'PLAYING') {
        levelStats.ticks++;
        handleEvents(game.tick());
        updateUI();
    } else if (state === 'DYING') {
        if (--stateTimer <= 0) {
            deathPos = null;
            if (game.gameOver) showGameOver();
            else enterReady(90);
        }
    }

    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.life--;
    });
    particles = particles.filter(p => p.life > 0);
    floaters.forEach(f => { f.y -= 0.6; f.life--; });
    floaters = floaters.filter(f => f.life > 0);
    if (flash > 0) flash = Math.max(0, flash - 0.04);

    if (rainbow && state === 'PLAYING' && frame % 2 === 0) {
        const pos = entityPos(game.player, game.playerStepTicks);
        particles.push({ x: pos.x, y: pos.y, vx: 0, vy: 0, life: 25, max: 25,
            color: `hsl(${frame * 6 % 360},100%,60%)`, size: 5 });
    }
}

// ------------------------------------------------------------------
// Renderização
// ------------------------------------------------------------------

// Paredes são pré-desenhadas numa camada separada (shadowBlur é caro)
function buildWallLayer() {
    wallLayer = document.createElement('canvas');
    wallLayer.width = canvas.width;
    wallLayer.height = canvas.height;
    const w = wallLayer.getContext('2d');
    const color = WALL_COLORS[(game.level - 1) % WALL_COLORS.length];
    const isWall = (x, y) => game.grid[y] && game.grid[y][x] === TILE.WALL;

    for (let y = 0; y < game.height; y++) {
        for (let x = 0; x < game.width; x++) {
            if (!isWall(x, y)) continue;
            const px = x * TILE_SIZE, py = y * TILE_SIZE;
            w.fillStyle = color + '1f';
            w.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            w.strokeStyle = color;
            w.lineWidth = 2;
            w.shadowBlur = 10;
            w.shadowColor = color;
            w.beginPath();
            const inset = 3;
            if (!isWall(x, y - 1)) { w.moveTo(px, py + inset); w.lineTo(px + TILE_SIZE, py + inset); }
            if (!isWall(x, y + 1)) { w.moveTo(px, py + TILE_SIZE - inset); w.lineTo(px + TILE_SIZE, py + TILE_SIZE - inset); }
            if (!isWall(x - 1, y)) { w.moveTo(px + inset, py); w.lineTo(px + inset, py + TILE_SIZE); }
            if (!isWall(x + 1, y)) { w.moveTo(px + TILE_SIZE - inset, py); w.lineTo(px + TILE_SIZE - inset, py + TILE_SIZE); }
            w.stroke();
        }
    }
}

// Posição suavizada (interpolação entre a casa anterior e a atual)
function entityPos(e, stepTicks) {
    let t = Math.min(1, e.stepTimer / stepTicks);
    if (e.wrapped || (e.prevX === e.x && e.prevY === e.y)) t = 1;
    return {
        x: center(e.prevX + (e.x - e.prevX) * t),
        y: center(e.prevY + (e.y - e.prevY) * t)
    };
}

function drawBackground() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0,255,136,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += TILE_SIZE) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = 0; y <= canvas.height; y += TILE_SIZE) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
}

function drawItems() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y = 0; y < game.height; y++) {
        for (let x = 0; x < game.width; x++) {
            const t = game.grid[y][x];
            const cx = center(x), cy = center(y);
            if (t === TILE.DOT) {
                ctx.font = 'bold 11px Consolas, monospace';
                ctx.fillStyle = (x * 7 + y * 3 + Math.floor(frame / 40)) % 9 === 0 ? '#ffffff' : '#7dffc0';
                ctx.fillText((x + y) % 2 ? '1' : '0', cx, cy + 1);
            } else if (t === TILE.COFFEE) {
                drawCoffee(cx, cy);
            } else if (t === TILE.FREEZE) {
                drawBreakpoint(cx, cy);
            } else if (t === TILE.PIZZA) {
                drawPizza(cx, cy);
            }
        }
    }
}

function drawCoffee(cx, cy) {
    const pulse = 1 + Math.sin(frame * 0.15) * 0.08;
    ctx.save();
    ctx.translate(cx, cy + 2);
    ctx.scale(pulse, pulse);
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffaa00';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-7, -6, 12, 13);
    ctx.fillStyle = '#7a3e12';
    ctx.fillRect(-6, -5, 10, 3);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(6, 0, 3.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        const sx = -4 + i * 5;
        ctx.moveTo(sx, -8);
        ctx.quadraticCurveTo(sx + Math.sin(frame * 0.2 + i) * 3, -12, sx, -15);
        ctx.stroke();
    }
    ctx.restore();
}

function drawBreakpoint(cx, cy) {
    const blink = game.item && game.item.timer < 120 && frame % 10 < 5;
    if (blink) return;
    const ring = (frame % 40) / 40;
    ctx.strokeStyle = `rgba(127,231,255,${1 - ring})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + ring * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff3355';
    ctx.fillStyle = '#ff3355';
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 4, cy - 5, 3, 10);
    ctx.fillRect(cx + 1, cy - 5, 3, 10);
}

function drawPizza(cx, cy) {
    const blink = game.item && game.item.timer < 120 && frame % 10 < 5;
    if (blink) return;
    ctx.save();
    ctx.translate(cx, cy + Math.sin(frame * 0.1) * 2);
    ctx.rotate(Math.sin(frame * 0.05) * 0.2);
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffaa33';
    ctx.fillStyle = '#ffcc4d';
    ctx.beginPath();
    ctx.moveTo(0, 11);
    ctx.lineTo(-10, -8);
    ctx.lineTo(10, -8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b5651d';
    ctx.fillRect(-11, -11, 22, 4);
    ctx.fillStyle = '#e8364f';
    [[-4, -3], [3, -2], [0, 4]].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawPlayer(x, y, p, dyingProgress = 0) {
    const r = TILE_SIZE / 2 - 3;
    let color = p.poweredUp ? '#ffd23f' : '#2f8cff';
    if (rainbow) color = `hsl(${frame * 6 % 360},100%,60%)`;
    if (p.invulnerable > 0 && frame % 8 < 4) return;
    if (p.poweredUp && p.powerTimer < 120 && frame % 12 < 6) color = '#ffffff';

    ctx.save();
    ctx.translate(x, y);
    const angles = { right: 0, down: Math.PI / 2, left: 0, up: -Math.PI / 2 };
    ctx.rotate(angles[p.facing] || 0);
    if (p.facing === 'left') ctx.scale(-1, 1);

    const moving = state === 'PLAYING' && p.dir && game.canMove(p, p.dir);
    let mouth = moving ? Math.abs(Math.sin(frame * 0.3)) * 0.35 + 0.05 : 0.2;
    if (dyingProgress > 0) mouth = Math.min(Math.PI, 0.2 + dyingProgress * Math.PI);

    ctx.shadowBlur = p.poweredUp ? 25 : 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * (1 - dyingProgress * 0.3), mouth * Math.PI, (2 - mouth) * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    if (dyingProgress < 0.6) {
        // Óculos de programador
        ctx.fillStyle = '#0a0f1a';
        ctx.fillRect(-7, -9, 6, 5);
        ctx.fillRect(1, -9, 6, 5);
        ctx.fillRect(-1, -8, 2, 2);
        ctx.fillStyle = '#bfe8ff';
        ctx.fillRect(-6, -8, 2, 2);
        ctx.fillRect(2, -8, 2, 2);
        // Fone de ouvido
        ctx.strokeStyle = '#0a0f1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r - 1, -Math.PI * 0.95, -Math.PI * 0.55);
        ctx.stroke();
    }
    ctx.restore();
}

function drawBug(e) {
    const pos = entityPos(e, game.enemyStepTicks(e));
    const p = game.player;
    const frightened = p.poweredUp && e.waitTicks === 0;
    const frozen = game.frozenTimer > 0;
    let body = e.color;
    if (frightened) body = p.powerTimer < 120 && frame % 16 < 8 ? '#ffffff' : '#2244ff';
    if (frozen) body = '#9fdfff';

    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (e.waitTicks > 0) ctx.globalAlpha = 0.45 + Math.sin(frame * 0.2) * 0.2;

    const wiggle = frozen ? 0 : Math.sin(frame * 0.5 + e.spawnX) * 3;

    // Pernas
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
        const lx = i * 5;
        const swing = (i % 2 === 0 ? wiggle : -wiggle);
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx - 4 + swing, 11);
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx + 4 - swing, -11);
        ctx.stroke();
    }

    // Corpo
    ctx.shadowBlur = 15;
    ctx.shadowColor = body;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 2, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Antenas
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.quadraticCurveTo(-6, -13, -9 + wiggle * 0.5, -13);
    ctx.moveTo(3, -6);
    ctx.quadraticCurveTo(6, -13, 9 - wiggle * 0.5, -13);
    ctx.stroke();

    // Olhos que seguem o jogador
    const dx = Math.sign(p.x - e.x), dy = Math.sign(p.y - e.y);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -1, 3.5, 0, Math.PI * 2);
    ctx.arc(4, -1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (frightened) {
        // Boca assustada em zigue-zague
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-6, 6);
        for (let i = 0; i < 4; i++) ctx.lineTo(-4 + i * 3.3, i % 2 ? 6 : 4);
        ctx.stroke();
        ctx.fillStyle = '#2244ff';
        ctx.fillRect(-5, -2, 2, 2);
        ctx.fillRect(3, -2, 2, 2);
    } else {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-4 + dx * 1.5, -1 + dy * 1.5, 1.8, 0, Math.PI * 2);
        ctx.arc(4 + dx * 1.5, -1 + dy * 1.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
        // Sobrancelhas bravas
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-7, -6); ctx.lineTo(-2, -4);
        ctx.moveTo(7, -6); ctx.lineTo(2, -4);
        ctx.stroke();
    }

    if (frozen) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-12, -12, 24, 24);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('zZ', 10, -12);
    }
    ctx.restore();
}

function drawEffects() {
    particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.font = 'bold 16px Consolas, monospace';
    floaters.forEach(f => {
        ctx.globalAlpha = Math.min(1, f.life / 30);
        ctx.fillStyle = f.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = f.color;
        ctx.fillText(f.text, f.x, f.y);
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (game.frozenTimer > 0) {
        ctx.fillStyle = 'rgba(127,231,255,0.07)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawReadyBanner() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, canvas.height / 2 - 60, canvas.width, 120);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const color = WALL_COLORS[(game.level - 1) % WALL_COLORS.length];
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = 'bold 30px Consolas, monospace';
    ctx.fillText(`FASE ${game.level} — ${game.map.name}`, canvas.width / 2, canvas.height / 2 - 25);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d8ffe9';
    ctx.font = '14px Consolas, monospace';
    ctx.fillText(game.map.subtitle, canvas.width / 2, canvas.height / 2 + 5);
    if (frame % 30 < 20) {
        ctx.fillStyle = '#ffcc33';
        ctx.font = 'bold 20px Consolas, monospace';
        ctx.fillText(stateTimer > 60 ? '$ npm run start...' : 'READY!', canvas.width / 2, canvas.height / 2 + 35);
    }
}

// Chuva "Matrix" no fundo dos menus
const rain = Array.from({ length: Math.ceil(608 / 16) }, () => Math.random() * -30);
function drawMatrixRain() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Consolas, monospace';
    ctx.textAlign = 'center';
    rain.forEach((drop, i) => {
        for (let k = 0; k < 12; k++) {
            const y = (drop - k) * 16;
            if (y < 0 || y > canvas.height) continue;
            ctx.fillStyle = k === 0 ? '#d8ffe9' : `rgba(0,255,136,${0.8 - k * 0.065})`;
            const ch = ((i * 31 + Math.floor(drop) * 7 + k * 13) % 3 === 0) ? '1' : ((i + k) % 5 === 0 ? '{' : '0');
            ctx.fillText(ch, i * 16 + 8, y);
        }
        rain[i] = drop > canvas.height / 16 + 12 ? Math.random() * -20 : drop + 0.25 + (i % 3) * 0.08;
    });
}

function render() {
    if (state === 'MENU' || state === 'GAMEOVER') {
        drawMatrixRain();
        drawEffects();
        return;
    }

    drawBackground();
    if (wallLayer) ctx.drawImage(wallLayer, 0, 0);
    drawItems();

    game.enemies.forEach(drawBug);

    if (state === 'DYING' && deathPos) {
        const progress = 1 - stateTimer / 80;
        drawPlayer(center(deathPos.x), center(deathPos.y), game.player, progress);
    } else {
        const pos = entityPos(game.player, game.playerStepTicks);
        drawPlayer(pos.x, pos.y, game.player);
    }

    drawEffects();
    if (state === 'READY') drawReadyBanner();
}

// Loop principal: requestAnimationFrame + passo fixo de simulação
let lastTime = performance.now();
let accumulator = 0;
function loop(now) {
    accumulator += Math.min(250, now - lastTime);
    lastTime = now;
    while (accumulator >= STEP) {
        update();
        accumulator -= STEP;
    }
    render();
    requestAnimationFrame(loop);
}

// ------------------------------------------------------------------
// Entrada: teclado, botões, toque e easter egg
// ------------------------------------------------------------------
const KEY_DIRS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right'
};
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiProgress = 0;

window.addEventListener('keydown', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (key === KONAMI[konamiProgress]) {
        konamiProgress++;
        if (konamiProgress === KONAMI.length) {
            konamiProgress = 0;
            rainbow = !rainbow;
            Sound.init();
            Sound.play('extraLife');
            toast(rainbow ? '🌈 MODO ARCO-ÍRIS ATIVADO!' : 'Modo arco-íris desativado', '#ff4fd8');
        }
    } else {
        konamiProgress = key === KONAMI[0] ? 1 : 0;
    }

    if (KEY_DIRS[key]) {
        e.preventDefault();
        if (state === 'PLAYING' || state === 'READY') game.setDirection(KEY_DIRS[key]);
        return;
    }

    if (key === 'p' || key === 'Escape') togglePause();
    else if (key === 'm') { Sound.init(); Sound.toggleMute(); }
    else if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        if (state === 'MENU') startGame();
        else if (state === 'GAMEOVER') startGame();
        else if (state === 'VICTORY') startNextLevel();
        else if (state === 'PAUSED') togglePause();
    }
});

$('start-btn').addEventListener('click', startGame);
$('retry-btn').addEventListener('click', startGame);
$('menu-btn').addEventListener('click', goToMenu);
$('next-btn').addEventListener('click', startNextLevel);
$('resume-btn').addEventListener('click', togglePause);

document.querySelectorAll('#touch-controls button').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        Sound.init();
        game.setDirection(btn.dataset.dir);
    });
});

// Gestos de deslizar sobre o canvas
let touchStart = null;
ui.area.addEventListener('touchstart', e => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
ui.area.addEventListener('touchend', e => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    game.setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

// Pausa automática ao trocar de aba
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'PLAYING') togglePause();
});

renderLeaderboard('leaderboard-menu');
buildWallLayer();
updateUI();
requestAnimationFrame(loop);
