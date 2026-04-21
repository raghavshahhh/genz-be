const catalog = require('../data/menuCatalog.json');

/** Maps catalog keys to display category + diet flag */
const SECTION_META = {
  tandoor_starter_veg: { category: 'Tandoor Starter (Veg)', veg: true },
  chaap: { category: 'Chaap', veg: true },
  starter_non_veg: { category: 'Starter (Non Veg)', veg: false },
  chinese_starter_non_veg: { category: 'Chinese Starter (Non Veg)', veg: false },
  noodle_veg: { category: 'Noodle (Veg)', veg: true },
  noodle_non_veg: { category: 'Noodle (Non Veg)', veg: false },
  biryani_veg: { category: 'Biryani (Veg)', veg: true },
  biryani_non_veg: { category: 'Biryani (Non Veg)', veg: false },
  soup_veg: { category: 'Soup (Veg)', veg: true },
  soup_non_veg: { category: 'Soup (Non Veg)', veg: false },
  main_course_veg: { category: 'Main Course (Veg)', veg: true },
  main_course_non_veg: { category: 'Main Course (Non Veg)', veg: false },
};

function priceArrayToHalfFull(price) {
  if (!Array.isArray(price) || price.length === 0) {
    throw new Error('Each dish needs a non-empty price array');
  }
  if (price.length === 1) {
    const p = price[0];
    if (p == null || Number.isNaN(Number(p))) {
      throw new Error('Single price must be a number');
    }
    const n = Number(p);
    return { halfPrice: n, fullPrice: n };
  }
  const [rawHalf, rawFull] = price;
  const fullNum = rawFull != null ? Number(rawFull) : null;
  const halfNum = rawHalf != null ? Number(rawHalf) : null;
  if (fullNum != null && !Number.isNaN(fullNum)) {
    const halfPrice = halfNum != null && !Number.isNaN(halfNum) ? halfNum : fullNum;
    return { halfPrice, fullPrice: fullNum };
  }
  if (halfNum != null && !Number.isNaN(halfNum)) {
    return { halfPrice: halfNum, fullPrice: halfNum };
  }
  throw new Error('Could not resolve half/full prices');
}

/**
 * @returns {Array<{ name: string, category: string, veg: boolean, halfPrice: number, fullPrice: number, available: boolean, isSpecial: boolean }>}
 */
function getMenuSeedDocuments() {
  const out = [];
  for (const [key, rows] of Object.entries(catalog)) {
    const meta = SECTION_META[key];
    if (!meta || !Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row.name !== 'string' || !row.name.trim()) continue;
      const { halfPrice, fullPrice } = priceArrayToHalfFull(row.price);
      out.push({
        name: row.name.trim(),
        category: meta.category,
        veg: meta.veg,
        halfPrice,
        fullPrice,
        available: true,
        isSpecial: false,
      });
    }
  }
  console.log(out);
  return out;
}

module.exports = { getMenuSeedDocuments };
