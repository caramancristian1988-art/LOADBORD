/** Small seeded PRNG (mulberry32) with helpers. */
export interface Rng {
  (): number;
  int(min: number, max: number): number;
  float(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
  weighted<T>(arr: readonly T[], weight: (x: T) => number): T;
  shuffle<T>(arr: readonly T[]): T[];
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const rng = (() => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  rng.int = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
  rng.float = (min, max) => rng() * (max - min) + min;
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.weighted = (arr, weight) => {
    let total = 0;
    for (const x of arr) total += weight(x);
    let r = rng() * total;
    for (const x of arr) {
      r -= weight(x);
      if (r <= 0) return x;
    }
    return arr[arr.length - 1];
  };
  rng.shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return rng;
}

/** Non-reproducible RNG for live interactions (negotiation phrasing, new postings). */
export function liveRng(): Rng {
  return makeRng((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
}
