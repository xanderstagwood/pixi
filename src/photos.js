/** The picture sets Pixi can pull from, one category each. */
export const CATEGORIES = ['lizard', 'crab', 'bird', 'stag', 'bones'];

/**
 * Fetches the snapshot of Unsplash photos (data/photos.json): per photo its image, its page, its artist and their page.
 * @returns {Promise<{id: string, category: string, url: string, link: string, artist: string, artistLink: string}[]>}
 */
export async function loadPhotos() {
  const response = await fetch('data/photos.json');
  if (!response.ok) throw new Error(`photos: ${response.status}`);
  return response.json();
}

/**
 * Picks at random without repeating: a category is shuffled into a bag and drawn from until it is empty, so the
 * fifth click never shows the first click's photo, and a fresh bag never opens with the photo that closed the last.
 * @param {{category: string}[]} photos
 * @param {() => number} random
 * @returns {(category: string) => object} the next photo of the category; throws if it has none
 */
export function createPicker(photos, random = Math.random) {
  const bags = new Map(), last = new Map();
  return (category) => {
    const all = photos.filter((p) => p.category === category);
    if (!all.length) throw new Error(`photos: none in ${category}`);
    let bag = bags.get(category) ?? [];
    if (!bag.length) {
      bag = all.map((p) => [random(), p]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
      if (bag.length > 1 && bag[bag.length - 1] === last.get(category)) bag.unshift(bag.pop());
      bags.set(category, bag);
    }
    last.set(category, bag.pop());
    return last.get(category);
  };
}
