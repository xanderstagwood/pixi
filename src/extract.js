import { rgbToHex } from './color.js';

/**
 * The picture's own colors: k-means over its RGB pixels, each color the average of the pixels it
 * covers, so a palette reads as the picture does (its big areas stay big, its tones stay true).
 * This is the selection the owner preferred over a research-driven one that boosted vividness,
 * spread colors apart and blended toward the most common shade; ordering is where the perceptual
 * work lives now (arrange.js). Returns `k` clusters, each with its centroid hex and the
 * position (0-1 fractions of the image) of the pixel nearest that centroid, so a scanner
 * has a real place to land. Seeding starts from a random pixel and then takes the pixel farthest from every
 * centroid so far, so the same image can come out slightly different each time, and a small vivid patch
 * still earns its own color because it is far from everything else.
 * @param {{data: Uint8ClampedArray, width: number, height: number}} img
 * @returns {{hex: string, x: number, y: number, share: number}[]} `share` is the fraction of the opaque pixels each color covers
 */
export function extractColors({ data, width, height }, k = 7, iterations = 12, random = Math.random) {
  const px = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] >= 128) px.push(i);
  if (!px.length) return [];
  const at = (p) => [data[p], data[p + 1], data[p + 2]];
  const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  // Seed: a random pixel, then repeatedly the pixel farthest from every chosen centroid. Each pixel's
  // distance to its nearest centroid so far is kept and only checked against the newest one.
  const cents = [at(px[Math.floor(random() * px.length)])];
  const nearest = px.map((p) => dist(at(p), cents[0]));
  while (cents.length < k) {
    let best = 0;
    nearest.forEach((d, i) => { if (d > nearest[best]) best = i; });
    cents.push(at(px[best]));
    const newest = cents[cents.length - 1];
    px.forEach((p, i) => { nearest[i] = Math.min(nearest[i], dist(at(p), newest)); });
  }

  const owner = new Int16Array(px.length).fill(-1);
  for (let it = 0; it < iterations; it++) {
    const sums = cents.map(() => [0, 0, 0, 0]);
    let moved = false;
    for (let i = 0; i < px.length; i++) {
      const p = px[i], r = data[p], g = data[p + 1], b = data[p + 2];
      let bi = 0, bd = Infinity;
      for (let j = 0; j < cents.length; j++) {
        const m = cents[j], d = (r - m[0]) ** 2 + (g - m[1]) ** 2 + (b - m[2]) ** 2;
        if (d < bd) { bd = d; bi = j; }
      }
      if (owner[i] !== bi) { owner[i] = bi; moved = true; }
      const s = sums[bi]; s[0] += r; s[1] += g; s[2] += b; s[3]++;
    }
    if (!moved) break; // nobody changed sides, so the centroids would come out the same again
    sums.forEach((s, j) => { if (s[3]) cents[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }

  const covered = new Array(cents.length).fill(0);
  owner.forEach((j) => { covered[j]++; });

  return cents.map((c, j) => {
    let bestP = px[0], bestD = Infinity;
    px.forEach((p, i) => {
      if (owner[i] !== j) return;
      const d = dist(at(p), c);
      if (d < bestD) { bestD = d; bestP = p; }
    });
    const idx = bestP / 4;
    return {
      hex: rgbToHex({ r: c[0], g: c[1], b: c[2] }),
      x: ((idx % width) + 0.5) / width,
      y: (Math.floor(idx / width) + 0.5) / height,
      share: covered[j] / px.length,
    };
  });
}
