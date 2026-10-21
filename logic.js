// Bug Buster - Lógica pura do jogo (sem DOM, sem Canvas).
// Pode ser executada no navegador ou no Node (testes).

const TILE = { EMPTY: 0, WALL: 1, DOT: 2, COFFEE: 3, FREEZE: 4, PIZZA: 5 };

const DIRS = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// Legenda dos mapas: '#' parede | '.' linha de código | 'o' café | 'P' jogador | 'E' spawn dos bugs | ' ' vazio
const MAPS = [
    {
        name: 'localhost',
        subtitle: 'Ambiente de desenvolvimento. Tudo funciona... por enquanto.',
        rows: [
            '###################',
            '#o.......#.......o#',
            '#.##.###.#.###.##.#',
            '#.................#',
            '#.##.#.#####.#.##.#',
            '#....#...#...#....#',
            '####.### # ###.####',
            '    .#  EEE  #.    ',
            '####.# ##### #.####',
            '#........#........#',
            '#.##.###.#.###.##.#',
            '#o.#.....P.....#.o#',
            '##.#.#..###..#.#.##',
            '#....#...#...#....#',
            '###################'
        ]
    },
    {
        name: 'staging',
        subtitle: 'Os testes começaram a falhar. Os bugs estão se multiplicando!',
        rows: [
            '###################',
            '#o...#.......#...o#',
            '#.##.#.#####.#.##.#',
            '#.................#',
            '###.#.###.###.#.###',
            '#...#...#.#...#...#',
            '#.#####.#.#.#####.#',
            ' ...... EEE ...... ',
            '#.###.#######.###.#',
            '#.....#..P..#.....#',
            '#.###.#.###.#.###.#',
            '#o..#.........#..o#',
            '###.#.#.###.#.#.###',
            '#.....#.....#.....#',
            '###################'
        ]
    },
    {
        name: 'PRODUÇÃO',
        subtitle: 'Sexta-feira, 17h59. Deploy em andamento. Boa sorte.',
        rows: [
            '###################',
            '#o.......#.......o#',
            '#.#.###.###.###.#.#',
            '#.#...#.....#...#.#',
            '#.###.#.###.#.###.#',
            '#.....#.#E#.#.....#',
            '###.#...#E#...#.###',
            '  ..#.###E###.#..  ',
            '###.#.........#.###',
            '#...#.###.###.#...#',
            '#.#.#...#.#...#.#.#',
            '#o#.###.#P#.###.#o#',
            '#.#.....#.#.....#.#',
            '#...###.....###...#',
            '###################'
        ]
    }
];

const ENEMY_TYPES = {
    ransomware: { name: 'Ransomware', color: '#ff3355', behavior: 'chase' },
    spyware: { name: 'Spyware', color: '#b04dff', behavior: 'random' },
    trojan: { name: 'Trojan', color: '#ff4fd8', behavior: 'ambush' },
    worm: { name: 'Worm', color: '#00e5ff', behavior: 'patrol' }
};

const EXTRA_LIFE_EVERY = 5000;
const MAX_LIVES = 5;

class GameLogic {
    constructor(rng = Math.random) {
        this.rng = rng;
        this.reset();
    }

    // Reinicia a partida inteira (pontuação, vidas e fase 1)
    reset() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.nextExtraLife = EXTRA_LIFE_EVERY;
        this.gameOver = false;
        this.loadLevel();
    }

    // Avança de fase mantendo pontuação e vidas
    nextLevel() {
        this.level++;
        this.loadLevel();
    }

    get map() {
        return MAPS[(this.level - 1) % MAPS.length];
    }

    get width() {
        return this.grid[0].length;
    }

    get height() {
        return this.grid.length;
    }

    loadLevel() {
        const rows = this.map.rows;
        this.grid = [];
        this.spawns = [];
        for (let y = 0; y < rows.length; y++) {
            const row = [];
            for (let x = 0; x < rows[y].length; x++) {
                const c = rows[y][x];
                if (c === '#') row.push(TILE.WALL);
                else if (c === '.') row.push(TILE.DOT);
                else if (c === 'o') row.push(TILE.COFFEE);
                else {
                    row.push(TILE.EMPTY);
                    if (c === 'P') this.playerStart = { x, y };
                    if (c === 'E') this.spawns.push({ x, y });
                }
            }
            this.grid.push(row);
        }

        this.totalDots = this.countTiles(TILE.DOT);
        this.dotsEaten = 0;
        this.tickCount = 0;
        this.frozenTimer = 0;
        this.combo = 0;
        this.item = null; // pizza / breakpoint temporários
        this.itemsSpawned = { pizza1: false, freeze: false, pizza2: false };
        this.events = [];
        this.placePlayer();
        this.spawnEnemies();
    }

    placePlayer() {
        const { x, y } = this.playerStart;
        this.player = {
            x, y, prevX: x, prevY: y,
            dir: null, nextDir: null, facing: 'right',
            poweredUp: false, powerTimer: 0,
            stepTimer: 0, movedAt: -1, wrapped: false,
            invulnerable: 0
        };
    }

    spawnEnemies() {
        const types = ['ransomware', 'spyware'];
        if (this.level >= 2) types.push('trojan');
        if (this.level >= 3) types.push('worm');

        this.enemies = types.map((type, i) => {
            const spawn = this.spawns[i % this.spawns.length];
            return {
                type,
                ...ENEMY_TYPES[type],
                x: spawn.x, y: spawn.y, prevX: spawn.x, prevY: spawn.y,
                spawnX: spawn.x, spawnY: spawn.y,
                dir: null, stepTimer: 0, movedAt: -1, wrapped: false,
                waitTicks: 60 + i * 150
            };
        });
    }

    countTiles(tile) {
        let n = 0;
        for (const row of this.grid) for (const t of row) if (t === tile) n++;
        return n;
    }

    isWin() {
        return this.countTiles(TILE.DOT) === 0;
    }

    isWalkable(x, y) {
        if (y < 0 || y >= this.height) return false;
        x = this.wrapX(x);
        return this.grid[y][x] !== TILE.WALL;
    }

    // RN005 - Wrap-around pelas laterais
    wrapX(x) {
        const w = this.width;
        return ((x % w) + w) % w;
    }

    canMove(entity, dirName) {
        const d = DIRS[dirName];
        return this.isWalkable(entity.x + d.dx, entity.y + d.dy);
    }

    // Velocidades em "ticks por casa" (60 ticks = 1 segundo)
    get playerStepTicks() {
        return this.player.poweredUp ? 7 : 9;
    }

    enemyStepTicks(enemy) {
        let ticks = Math.max(7, 15 - (this.level - 1) * 1.5);
        if (enemy.behavior === 'random') ticks += 2;
        if (this.player.poweredUp) ticks = Math.round(ticks * 1.6);
        return Math.round(ticks);
    }

    get powerDuration() {
        return Math.max(180, 420 - (this.level - 1) * 40);
    }

    emit(type, data = {}) {
        this.events.push({ type, ...data });
    }

    setDirection(dirName) {
        if (!DIRS[dirName]) return;
        this.player.nextDir = dirName;
        if (!this.player.dir) this.player.dir = dirName;
    }

    // Move o jogador uma casa imediatamente (RN001 + RN005)
    movePlayer(dx, dy) {
        const p = this.player;
        let newX = p.x + dx;
        const newY = p.y + dy;
        const wrapped = newX < 0 || newX >= this.width;
        newX = this.wrapX(newX);

        if (!this.grid[newY] || this.grid[newY][newX] === TILE.WALL) return false;

        p.prevX = p.x;
        p.prevY = p.y;
        p.x = newX;
        p.y = newY;
        p.wrapped = wrapped;
        p.movedAt = this.tickCount;
        if (dx > 0) p.facing = 'right';
        else if (dx < 0) p.facing = 'left';
        else if (dy > 0) p.facing = 'down';
        else if (dy < 0) p.facing = 'up';

        this.collect(p.x, p.y);
        return true;
    }

    collect(x, y) {
        const tile = this.grid[y][x];
        if (tile === TILE.DOT) {
            this.grid[y][x] = TILE.EMPTY;
            this.dotsEaten++;
            this.addScore(10);
            this.emit('dot', { x, y });
        } else if (tile === TILE.COFFEE) {
            this.grid[y][x] = TILE.EMPTY;
            this.addScore(50);
            this.player.poweredUp = true;
            this.player.powerTimer = this.powerDuration;
            this.combo = 0;
            this.enemies.forEach(e => { if (e.dir) e.dir = OPPOSITE[e.dir]; });
            this.emit('power', { x, y });
        } else if (tile === TILE.FREEZE) {
            this.grid[y][x] = TILE.EMPTY;
            this.item = null;
            this.frozenTimer = 240;
            this.addScore(100);
            this.emit('freeze', { x, y });
        } else if (tile === TILE.PIZZA) {
            this.grid[y][x] = TILE.EMPTY;
            this.item = null;
            this.addScore(500);
            this.emit('pizza', { x, y, points: 500 });
        }
    }

    addScore(points) {
        this.score += points;
        if (this.score >= this.nextExtraLife) {
            this.nextExtraLife += EXTRA_LIFE_EVERY;
            if (this.lives < MAX_LIVES) {
                this.lives++;
                this.emit('extraLife');
            }
        }
    }

    // Avança a simulação em 1 quadro (chamado 60x por segundo)
    tick() {
        this.events = [];
        if (this.gameOver) return this.events;
        this.tickCount++;
        const p = this.player;

        if (p.poweredUp) {
            p.powerTimer--;
            if (p.powerTimer <= 0) {
                p.poweredUp = false;
                p.powerTimer = 0;
                this.combo = 0;
                this.emit('powerEnd');
            }
        }
        if (p.invulnerable > 0) p.invulnerable--;
        if (this.frozenTimer > 0) {
            this.frozenTimer--;
            if (this.frozenTimer === 0) this.emit('unfreeze');
        }

        // Movimento contínuo do jogador com "buffer" de direção
        p.stepTimer++;
        if (p.stepTimer >= this.playerStepTicks) {
            p.stepTimer = 0;
            if (p.nextDir && this.canMove(p, p.nextDir)) p.dir = p.nextDir;
            if (p.dir && this.canMove(p, p.dir)) {
                const d = DIRS[p.dir];
                this.movePlayer(d.dx, d.dy);
            } else {
                p.prevX = p.x;
                p.prevY = p.y;
            }
            this.checkCollisions();
        }

        // Movimento dos bugs
        for (const e of this.enemies) {
            if (e.waitTicks > 0) { e.waitTicks--; continue; }
            if (this.frozenTimer > 0) continue;
            e.stepTimer++;
            if (e.stepTimer >= this.enemyStepTicks(e)) {
                e.stepTimer = 0;
                this.moveEnemy(e);
            }
        }
        this.checkCollisions();
        this.updateItems();

        if (!this.gameOver && this.isWin()) this.emit('win');
        return this.events;
    }

    updateItems() {
        const progress = this.dotsEaten / this.totalDots;
        if (!this.item) {
            if (progress >= 0.25 && !this.itemsSpawned.pizza1) {
                this.itemsSpawned.pizza1 = true;
                this.spawnItem(TILE.PIZZA, 540);
            } else if (progress >= 0.5 && !this.itemsSpawned.freeze) {
                this.itemsSpawned.freeze = true;
                this.spawnItem(TILE.FREEZE, 600);
            } else if (progress >= 0.75 && !this.itemsSpawned.pizza2) {
                this.itemsSpawned.pizza2 = true;
                this.spawnItem(TILE.PIZZA, 540);
            }
        } else {
            this.item.timer--;
            if (this.item.timer <= 0) {
                if (this.grid[this.item.y][this.item.x] === this.item.tile) {
                    this.grid[this.item.y][this.item.x] = TILE.EMPTY;
                }
                this.item = null;
            }
        }
    }

    spawnItem(tile, duration) {
        if (this.item) return; // apenas um item temporário por vez
        const free = [];
        const p = this.player;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const far = Math.abs(x - p.x) + Math.abs(y - p.y) > 4;
                if (this.grid[y][x] === TILE.EMPTY && far && !this.spawns.some(s => s.x === x && s.y === y)) {
                    free.push({ x, y });
                }
            }
        }
        if (free.length === 0) return;
        const spot = free[Math.floor(this.rng() * free.length)];
        this.grid[spot.y][spot.x] = tile;
        this.item = { tile, x: spot.x, y: spot.y, timer: duration };
        this.emit('itemSpawn', { tile, x: spot.x, y: spot.y });
    }

    // Mapa de distâncias (BFS) a partir de um alvo, respeitando paredes e túneis
    distanceMap(tx, ty) {
        const dist = this.grid.map(row => row.map(() => Infinity));
        if (!this.isWalkable(tx, ty)) return dist;
        const queue = [[tx, ty]];
        dist[ty][tx] = 0;
        while (queue.length) {
            const [x, y] = queue.shift();
            for (const d of Object.values(DIRS)) {
                const nx = this.wrapX(x + d.dx);
                const ny = y + d.dy;
                if (this.isWalkable(nx, ny) && dist[ny][nx] === Infinity) {
                    dist[ny][nx] = dist[y][x] + 1;
                    queue.push([nx, ny]);
                }
            }
        }
        return dist;
    }

    enemyTarget(e) {
        const p = this.player;
        if (e.behavior === 'ambush' && p.dir) {
            // Trojan tenta chegar 4 casas à frente do jogador
            for (let k = 4; k > 0; k--) {
                const tx = this.wrapX(p.x + DIRS[p.dir].dx * k);
                const ty = p.y + DIRS[p.dir].dy * k;
                if (this.isWalkable(tx, ty)) return { x: tx, y: ty };
            }
        }
        return { x: p.x, y: p.y };
    }

    // RF03 - IA dos inimigos
    moveEnemy(e) {
        let options = Object.keys(DIRS).filter(name => this.canMove(e, name));
        if (options.length === 0) return;
        if (options.length > 1 && e.dir) {
            options = options.filter(name => name !== OPPOSITE[e.dir]);
        }

        const p = this.player;
        const manhattan = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
        let mode = 'chase';
        if (p.poweredUp) mode = 'flee';
        else if (e.behavior === 'random') mode = this.rng() < 0.25 ? 'chase' : 'random';
        else if (e.behavior === 'patrol') mode = manhattan <= 6 ? 'chase' : 'random';

        let choice;
        if (mode === 'random' || (mode === 'flee' && this.rng() < 0.2)) {
            choice = options[Math.floor(this.rng() * options.length)];
        } else {
            const target = mode === 'flee' ? { x: p.x, y: p.y } : this.enemyTarget(e);
            const dist = this.distanceMap(target.x, target.y);
            let best = mode === 'flee' ? -Infinity : Infinity;
            for (const name of options) {
                const d = DIRS[name];
                const value = dist[e.y + d.dy][this.wrapX(e.x + d.dx)];
                const better = mode === 'flee' ? value > best : value < best;
                if (better || (value === best && this.rng() < 0.5)) {
                    best = value;
                    choice = name;
                }
            }
        }

        const d = DIRS[choice];
        const nx = e.x + d.dx;
        e.wrapped = nx < 0 || nx >= this.width;
        e.prevX = e.x;
        e.prevY = e.y;
        e.x = this.wrapX(nx);
        e.y = e.y + d.dy;
        e.dir = choice;
        e.movedAt = this.tickCount;
    }

    // RN002 / RN003 - colisão jogador x bug
    checkCollisions() {
        const p = this.player;
        for (const e of this.enemies) {
            const sameCell = e.x === p.x && e.y === p.y;
            const crossed = e.movedAt === this.tickCount && p.movedAt === this.tickCount &&
                e.prevX === p.x && e.prevY === p.y && p.prevX === e.x && p.prevY === e.y;
            if (!sameCell && !crossed) continue;

            if (p.poweredUp) {
                this.combo++;
                const points = Math.min(1600, 100 * Math.pow(2, this.combo - 1));
                this.addScore(points);
                this.emit('eatEnemy', { x: e.x, y: e.y, points, name: e.name, color: e.color });
                this.sendToSpawn(e, 120);
            } else if (this.frozenTimer > 0 || p.invulnerable > 0) {
                continue; // bugs congelados (Breakpoint) ou jogador recém-renascido não causam dano
            } else {
                this.loseLife(e);
                return;
            }
        }
    }

    sendToSpawn(e, wait) {
        e.x = e.prevX = e.spawnX;
        e.y = e.prevY = e.spawnY;
        e.dir = null;
        e.stepTimer = 0;
        e.wrapped = false;
        e.waitTicks = wait;
    }

    loseLife(killer) {
        const at = { x: this.player.x, y: this.player.y };
        this.lives--;
        if (this.lives <= 0) {
            this.lives = 0;
            this.gameOver = true;
            this.emit('gameover', { ...at, killer: killer.name });
            return;
        }
        this.emit('die', { ...at, killer: killer.name });
        this.placePlayer();
        this.player.invulnerable = 90;
        this.frozenTimer = 0;
        this.enemies.forEach((e, i) => this.sendToSpawn(e, 60 + i * 90));
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic, TILE, DIRS, MAPS, ENEMY_TYPES };
}
