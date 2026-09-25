function assert(condition, message) {
    if (typeof document !== 'undefined') {
        const resultsDiv = document.getElementById('results');
        const p = document.createElement('p');
        if (condition) {
            p.textContent = '✅ PASS: ' + message;
            p.className = 'pass';
        } else {
            p.textContent = '❌ FAIL: ' + message;
            p.className = 'fail';
        }
        resultsDiv.appendChild(p);
    } else {
        if (condition) {
            console.log('✅ PASS: ' + message);
        } else {
            console.error('❌ FAIL: ' + message);
        }
    }
}

function runTests() {
    console.log("Iniciando testes...");
    
    try {
        const game = new GameLogic();
        assert(game !== undefined, "GameLogic instanciado");
        
        assert(game.grid[0][0] === 1, "Posição 0,0 deve ser parede (1)");
        assert(game.player.x === 1 && game.player.y === 1, "Jogador deve começar na posição 1,1");
        
        game.movePlayer(1, 0); 
        assert(game.player.x === 2 && game.player.y === 1, "Jogador moveu para direita (2,1)");
        
        game.movePlayer(0, -1);
        assert(game.player.x === 2 && game.player.y === 1, "Jogador NÃO moveu para cima devido à parede");

        // Testa consumo de item na posição (3,1)
        game.movePlayer(1, 0); // x=3, y=1
        assert(game.grid[1][3] === 0, "Item na posição 3,1 foi consumido");
        assert(game.score === 20, "Score incrementou para 20 (pegou em 2,1 e 3,1)");

        // Testa Reset
        game.reset();
        assert(game.player.x === 1 && game.player.y === 1, "Reset colocou jogador na posição original");
        assert(game.score === 0, "Reset zerou o score");
        assert(game.grid[1][3] === 2, "Reset restaurou o item na posição 3,1");
        
        // Testa Vitória (vamos simular coletando tudo)
        assert(game.isWin() === false, "isWin deve ser falso no início");
        for(let y=0; y<game.grid.length; y++) {
            for(let x=0; x<game.grid[y].length; x++) {
                if(game.grid[y][x] === 2) game.grid[y][x] = 0;
            }
        }
        assert(game.isWin() === true, "isWin deve ser verdadeiro quando acabar as bolinhas");

        // Testa Avanço de Nível
        let lvlInicial = game.level;
        game.score = 500;
        game.nextLevel();
        assert(game.level === lvlInicial + 1, "nextLevel incrementou o nível");
        assert(game.score === 500, "nextLevel não deve zerar a pontuação global");
        assert(game.grid[1][3] === 2, "nextLevel restaurou o mapa");

        // Testa Túnel
        game.reset();
        game.grid[1][0] = 0; // Abre túnel na esquerda
        game.grid[1][9] = 0; // Abre túnel na direita
        game.player.x = 0; // Coloca na borda esquerda
        game.player.y = 1;
        game.movePlayer(-1, 0); // Move pra esquerda
        assert(game.player.x === 9, "Túnel: Saiu pela esquerda e voltou na direita (x=9)");
        
        game.movePlayer(1, 0); // Move pra direita
        assert(game.player.x === 0, "Túnel: Saiu pela direita e voltou na esquerda (x=0)");

        // Testa PowerUp (Café)
        game.reset();
        game.grid[1][2] = 3; // Coloca café em (2,1)
        game.movePlayer(1, 0); // Vai para (2,1)
        assert(game.player.poweredUp === true, "Pegou café: Player deve estar poweredUp");
        assert(game.player.powerTimer > 0, "Timer de poder deve ser maior que 0");
        assert(game.score === 50, "Pegou café: Score incrementou 50 pontos");

        // Simula tick para decrementar o poder
        let initialTimer = game.player.powerTimer;
        game.tick();
        assert(game.player.powerTimer === initialTimer - 1, "Tick diminui o timer do powerUp");

    } catch (e) {
        assert(false, "Erro ao executar os testes: " + e.stack);
    }
}

if (typeof window !== 'undefined') {
    window.onload = runTests;
}
