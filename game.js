const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level-display');

const TILE_SIZE = 40;
const game = new GameLogic();

const menuScreen = document.getElementById('menu-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');

let gameState = 'MENU';
let audioCtx = null;

function playSound(type) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'power') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'die') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

let baseSpeed = 40;
let bugs = [];

function spawnBugs() {
    let currentSpeed = Math.max(10, baseSpeed - (game.level * 5)); 
    let randomSpeed = Math.max(10, (baseSpeed - 10) - (game.level * 4));

    bugs = [
        { type: 'chaser', color: '#ff0000', x: 8, y: 7, spawnX: 8, spawnY: 7, moveTimer: 0, speed: currentSpeed },
        { type: 'random', color: '#aa00ff', x: 5, y: 5, spawnX: 5, spawnY: 5, moveTimer: 0, speed: randomSpeed }
    ];
}

function startGame() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    menuScreen.classList.remove('active');
    gameState = 'PLAYING';
    game.reset();
    spawnBugs();
    updateUI();
}

function resetGame() {
    gameOverScreen.classList.remove('active');
    gameState = 'PLAYING';
    game.reset();
    spawnBugs();
    updateUI();
}

function startNextLevel() {
    victoryScreen.classList.remove('active');
    gameState = 'PLAYING';
    game.nextLevel();
    spawnBugs();
    updateUI();
}

function updateUI() {
    scoreElement.textContent = "Score: " + game.score;
    levelElement.textContent = "Lvl: " + game.level;
}

function drawMap() {
    for (let y = 0; y < game.grid.length; y++) {
        for (let x = 0; x < game.grid[y].length; x++) {
            if (game.grid[y][x] === 1) {
                ctx.fillStyle = '#002200';
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#00ff00';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00ff00';
                ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                ctx.shadowBlur = 0;
            } else if (game.grid[y][x] === 2) {
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#ffffff';
                ctx.beginPath();
                ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else if (game.grid[y][x] === 3) {
                ctx.fillStyle = '#ffaa00';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ffaa00';
                ctx.fillRect(x * TILE_SIZE + 12, y * TILE_SIZE + 12, 16, 16);
                ctx.shadowBlur = 0;
            }
        }
    }
}

function drawPlayer() {
    ctx.fillStyle = game.player.poweredUp ? '#ffff00' : '#0088ff'; 
    if(game.player.poweredUp) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffff00';
    }
    ctx.beginPath();
    ctx.arc(game.player.x * TILE_SIZE + TILE_SIZE/2, game.player.y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawBugs() {
    bugs.forEach(bug => {
        ctx.fillStyle = game.player.poweredUp ? '#0000ff' : bug.color; 
        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(bug.x * TILE_SIZE + 4, bug.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        ctx.shadowBlur = 0;
    });
}

function updateBugs() {
    bugs.forEach(bug => {
        bug.moveTimer++;
        if (bug.moveTimer > bug.speed) {
            bug.moveTimer = 0;
            let moveX = 0;
            let moveY = 0;

            if (bug.type === 'chaser' && !game.player.poweredUp) {
                const diffX = game.player.x - bug.x;
                const diffY = game.player.y - bug.y;
                
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    moveX = diffX > 0 ? 1 : -1;
                } else {
                    moveY = diffY > 0 ? 1 : -1;
                }
            } else {
                const directions = [
                    {dx: 0, dy: -1},
                    {dx: 0, dy: 1},
                    {dx: -1, dy: 0},
                    {dx: 1, dy: 0}
                ];
                const move = directions[Math.floor(Math.random() * directions.length)];
                moveX = move.dx;
                moveY = move.dy;
            }

            const newX = bug.x + moveX;
            const newY = bug.y + moveY;
            
            if (game.grid[newY] && game.grid[newY][newX] !== 1 && game.grid[newY][newX] !== undefined) {
                bug.x = newX;
                bug.y = newY;
            }
        }
    });
}

function checkGameStatus() {
    bugs.forEach(bug => {
        if (game.player.x === bug.x && game.player.y === bug.y) {
            if (game.player.poweredUp) {
                game.score += 100;
                playSound('eat');
                bug.x = bug.spawnX;
                bug.y = bug.spawnY;
                updateUI();
            } else {
                playSound('die');
                gameState = 'GAMEOVER';
                gameOverScreen.classList.add('active');
            }
        }
    });

    if (gameState === 'PLAYING' && game.isWin()) {
        gameState = 'VICTORY';
        victoryScreen.classList.add('active');
    }
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'PLAYING') {
        game.tick();
        updateBugs();
        checkGameStatus();
    }
    
    drawMap();
    drawPlayer();
    drawBugs();
    
    requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
    if (gameState !== 'PLAYING') return;

    let oldScore = game.score;
    let oldPowered = game.player.poweredUp;

    switch(e.key) {
        case 'ArrowUp': game.movePlayer(0, -1); break;
        case 'ArrowDown': game.movePlayer(0, 1); break;
        case 'ArrowLeft': game.movePlayer(-1, 0); break;
        case 'ArrowRight': game.movePlayer(1, 0); break;
    }
    
    if (game.score > oldScore) {
        if (!game.player.poweredUp || (game.player.poweredUp && !oldPowered)) {
            if(game.player.poweredUp && !oldPowered) playSound('power');
            else playSound('eat');
        }
    }

    updateUI();
});

spawnBugs();
loop();
