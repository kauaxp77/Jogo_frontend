class GameLogic {
    constructor() {
        this.initialGrid = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [0, 0, 2, 2, 1, 2, 2, 2, 3, 0],
            [1, 2, 1, 2, 1, 2, 1, 1, 2, 1],
            [1, 2, 1, 3, 2, 2, 2, 2, 2, 1],
            [1, 2, 1, 1, 1, 1, 2, 1, 2, 1],
            [1, 2, 2, 2, 2, 1, 2, 1, 2, 1],
            [1, 1, 1, 1, 2, 1, 2, 1, 2, 1],
            [1, 3, 2, 2, 2, 2, 2, 2, 3, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ];

        this.totalDots = 0;
        for (let y = 0; y < this.initialGrid.length; y++) {
            for (let x = 0; x < this.initialGrid[y].length; x++) {
                if (this.initialGrid[y][x] === 2) {
                    this.totalDots++;
                }
            }
        }
        
        this.level = 1;
        this.reset();
    }

    reset() {
        this.grid = this.initialGrid.map(row => [...row]);
        this.player = {
            x: 1,
            y: 1,
            poweredUp: false,
            powerTimer: 0
        };
        this.score = 0;
        this.level = 1;
        if (this.grid[this.player.y][this.player.x] === 2) {
             this.grid[this.player.y][this.player.x] = 0;
        }
    }

    nextLevel() {
        this.grid = this.initialGrid.map(row => [...row]);
        this.player = {
            x: 1,
            y: 1,
            poweredUp: false,
            powerTimer: 0
        };
        this.level++;
        if (this.grid[this.player.y][this.player.x] === 2) {
             this.grid[this.player.y][this.player.x] = 0;
        }
    }

    isWin() {
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                if (this.grid[y][x] === 2) {
                    return false;
                }
            }
        }
        return true;
    }

    tick() {
        if (this.player.poweredUp) {
            this.player.powerTimer--;
            if (this.player.powerTimer <= 0) {
                this.player.poweredUp = false;
                this.player.powerTimer = 0;
            }
        }
    }

    movePlayer(dx, dy) {
        let newX = this.player.x + dx;
        let newY = this.player.y + dy;

        if (newX < 0) {
            newX = this.grid[0].length - 1;
        } else if (newX >= this.grid[0].length) {
            newX = 0;
        }

        if (this.grid[newY] && this.grid[newY][newX] !== 1) {
            this.player.x = newX;
            this.player.y = newY;

            if (this.grid[this.player.y][this.player.x] === 2) {
                this.score += 10;
                this.grid[this.player.y][this.player.x] = 0;
            }
            else if (this.grid[this.player.y][this.player.x] === 3) {
                this.score += 50;
                this.grid[this.player.y][this.player.x] = 0;
                this.player.poweredUp = true;
                this.player.powerTimer = 300;
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameLogic };
}
