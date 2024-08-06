class PerlinNoise {
    constructor() {
        this.permutation = new Array(256);
        for (let i = 0; i < 256; i++) {
            this.permutation[i] = Math.floor(Math.random() * 256);
        }
        for (let i = 0; i < 256; i++) {
            this.permutation[i + 256] = this.permutation[i];
        }
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y,
              v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const A = this.permutation[X] + Y;
        const B = this.permutation[X + 1] + Y;

        return this.lerp(v, 
            this.lerp(u, 
                this.grad(this.permutation[A], x, y),
                this.grad(this.permutation[B], x - 1, y)
            ),
            this.lerp(u,
                this.grad(this.permutation[A + 1], x, y - 1),
                this.grad(this.permutation[B + 1], x - 1, y - 1)
            )
        );
    }
}


module.exports = PerlinNoise;

// Kullanım örneği
// const perlin = new PerlinNoise();
// const value = perlin.noise(x, y);  // x ve y, gürültü değeri istenen koordinatlardır