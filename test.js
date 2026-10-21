// Testes da lógica do Bug Buster.
// Navegador: abra test.html | Node: node test.js
if (typeof module !== 'undefined' && module.exports) {
    ({ GameLogic, TILE, MAPS } = require('./logic.js'));
}

let failures = 0;

function assert(condition, message) {
    if (!condition) failures++;
    if (typeof document !== 'undefined') {
        const resultsDiv = document.getElementById('results');
        const p = document.createElement('p');
        p.textContent = (condition ? '✅ PASS: ' : '❌ FAIL: ') + message;
        p.className = condition ? 'pass' : 'fail';
        resultsDiv.appendChild(p);
    } else if (condition) {
        console.log('✅ PASS: ' + message);
    } else {
        console.error('❌ FAIL: ' + message);
    }
}

// Avança a simulação até o jogador dar N passos
function stepPlayer(game, n = 1) {
    for (let i = 0; i < n * game.playerStepTicks; i++) game.tick();
}

function runTests() {
    console.log('Iniciando testes...');

    try {
        // ---------- Mapas ----------
        MAPS.forEach((map, i) => {
            const widths = new Set(map.rows.map(r => r.length));
            assert(widths.size === 1 && map.rows.length === 15, `Mapa ${i + 1} (${map.name}) é retangular 19x15`);
            const g = new GameLogic();
            g.level = i + 1;
            g.loadLevel();
            const dist = g.distanceMap(g.playerStart.x, g.playerStart.y);
            let unreachable = 0;
            g.grid.forEach((row, y) => row.forEach((t, x) => {
                if ((t === TILE.DOT || t === TILE.COFFEE) && dist[y][x] === Infinity) unreachable++;
            }));
            assert(unreachable === 0, `Mapa ${i + 1}: todas as linhas de código são alcançáveis`);
            assert(g.spawns.every(s => dist[s.y][s.x] !== Infinity), `Mapa ${i + 1}: bugs conseguem sair do spawn`);
        });

        // ---------- Estado inicial ----------
        const game = new GameLogic(() => 0.5);
        assert(game.grid[0][0] === TILE.WALL, 'Posição 0,0 deve ser parede');
        assert(game.player.x === 9 && game.player.y === 11, 'Jogador começa no ponto P do mapa (9,11)');
        assert(game.lives === 3, 'Jogador começa com 3 vidas');
        assert(game.enemies.length === 2, 'Fase 1 tem 2 bugs (Ransomware e Spyware)');

        // ---------- RN001 - Paredes ----------
        game.movePlayer(0, 1); // (9,12) é parede
        assert(game.player.x === 9 && game.player.y === 11, 'RN001: jogador NÃO atravessa parede');

        // ---------- Coleta ----------
        game.movePlayer(1, 0); // (10,11) tem ponto
        assert(game.player.x === 10, 'Jogador moveu para a direita');
        assert(game.grid[11][10] === TILE.EMPTY, 'Linha de código foi consumida');
        assert(game.score === 10, 'Score incrementou 10 pontos');

        // ---------- Movimento contínuo com buffer ----------
        game.reset();
        game.setDirection('left');
        stepPlayer(game, 2);
        assert(game.player.x === 7 && game.player.y === 11, 'Movimento contínuo: andou 2 casas para a esquerda');
        game.setDirection('up'); // (7,10) é parede: fica guardado no buffer
        stepPlayer(game, 1);
        assert(game.player.x === 6 && game.player.dir === 'left', 'Buffer: direção bloqueada não interrompe o movimento');
        stepPlayer(game, 3); // (5,10) é parede, (4,10) está livre
        assert(game.player.dir === 'up' && game.player.x === 4 && game.player.y === 10, 'Buffer: vira para cima assim que possível');

        // ---------- Reset ----------
        game.reset();
        assert(game.score === 0 && game.level === 1, 'Reset zera score e volta para a fase 1');
        assert(game.grid[11][10] === TILE.DOT, 'Reset restaura o mapa');

        // ---------- Vitória e próxima fase (RF05) ----------
        assert(game.isWin() === false, 'isWin é falso no início');
        game.grid.forEach(row => row.forEach((t, x) => { if (t === TILE.DOT) row[x] = TILE.EMPTY; }));
        assert(game.isWin() === true, 'isWin é verdadeiro quando acabam as linhas de código');
        game.score = 500;
        game.nextLevel();
        assert(game.level === 2, 'nextLevel incrementa o nível');
        assert(game.score === 500, 'nextLevel não zera a pontuação');
        assert(game.map.name === 'staging', 'Fase 2 usa o mapa staging');
        assert(game.enemies.length === 3, 'Fase 2 adiciona o Trojan');
        const lvl1 = new GameLogic();
        assert(game.enemyStepTicks(game.enemies[0]) < lvl1.enemyStepTicks(lvl1.enemies[0]), 'Bugs ficam mais rápidos a cada fase');

        // ---------- RN005 - Túnel ----------
        game.reset();
        game.player.x = 0;
        game.player.y = 7;
        game.movePlayer(-1, 0);
        assert(game.player.x === 18, 'Túnel: saiu pela esquerda e apareceu na direita');
        game.movePlayer(1, 0);
        assert(game.player.x === 0, 'Túnel: saiu pela direita e apareceu na esquerda');

        // ---------- RF04 - Café ----------
        game.reset();
        game.grid[11][10] = TILE.COFFEE;
        game.movePlayer(1, 0);
        assert(game.player.poweredUp === true, 'Café: jogador fica PoweredUp');
        assert(game.score === 50, 'Café: +50 pontos');
        const t0 = game.player.powerTimer;
        game.tick();
        assert(game.player.powerTimer === t0 - 1, 'Tick diminui o timer do café');

        // ---------- RN003 - Comer bugs com combo ----------
        const [bugA, bugB] = game.enemies;
        bugA.x = game.player.x; bugA.y = game.player.y; bugA.waitTicks = 999;
        game.checkCollisions();
        assert(game.score === 150, 'RN003: primeiro bug comido vale +100');
        assert(bugA.x === bugA.spawnX && bugA.y === bugA.spawnY, 'RN003: bug comido volta para o spawn');
        bugB.x = game.player.x; bugB.y = game.player.y; bugB.waitTicks = 999;
        game.checkCollisions();
        assert(game.score === 350, 'Combo: segundo bug vale +200');

        // ---------- RN002 - Perder vida ----------
        game.reset();
        const bug = game.enemies[0];
        bug.x = game.player.x; bug.y = game.player.y; bug.waitTicks = 999;
        game.checkCollisions();
        assert(game.lives === 2, 'RN002: tocar num bug sem café tira 1 vida');
        assert(game.player.invulnerable > 0, 'Após renascer o jogador fica invulnerável por um instante');
        game.player.invulnerable = 0;
        game.lives = 1;
        bug.x = game.player.x; bug.y = game.player.y;
        game.checkCollisions();
        assert(game.gameOver === true, 'RN002: sem vidas a partida é encerrada');

        // ---------- Breakpoint ----------
        game.reset();
        game.grid[11][10] = TILE.FREEZE;
        game.movePlayer(1, 0);
        assert(game.frozenTimer > 0, 'Breakpoint congela os bugs');
        const frozen = game.enemies[0];
        frozen.waitTicks = 0;
        const fx = frozen.x, fy = frozen.y;
        for (let i = 0; i < 30; i++) game.tick();
        assert(frozen.x === fx && frozen.y === fy, 'Bugs congelados não se movem');

        // ---------- Vida extra ----------
        game.reset();
        game.addScore(5000);
        assert(game.lives === 4, 'Vida extra a cada 5000 pontos');

        // ---------- IA ----------
        game.reset();
        const chaser = game.enemies[0];
        chaser.waitTicks = 0;
        const before = game.distanceMap(game.player.x, game.player.y)[chaser.y][chaser.x];
        for (let i = 0; i < 5; i++) game.moveEnemy(chaser);
        const after = game.distanceMap(game.player.x, game.player.y)[chaser.y][chaser.x];
        assert(after < before, 'Ransomware se aproxima do jogador (BFS)');
    } catch (e) {
        assert(false, 'Erro ao executar os testes: ' + e.stack);
    }

    console.log(failures === 0 ? '\nTodos os testes passaram!' : `\n${failures} teste(s) falharam.`);
    if (typeof process !== 'undefined' && process.exitCode !== undefined) process.exitCode = failures ? 1 : 0;
}

if (typeof window !== 'undefined') {
    window.onload = runTests;
} else {
    runTests();
}
