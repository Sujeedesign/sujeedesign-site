const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "public", "assets", "img");
const WIDTHS = [480, 960, 1600];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

(async () => {
  const files = walk(ROOT).filter((f) => /\.jpe?g$/i.test(f));
  let made = 0, before = 0, after = 0;
  for (const file of files) {
    const meta = await sharp(file).metadata();
    before += fs.statSync(file).size;
    const base = file.replace(/\.jpe?g$/i, "");
    for (const w of WIDTHS) {
      if (meta.width && w > meta.width) continue;
      const out = `${base}-${w}.webp`;
      await sharp(file).resize({ width: w }).webp({ quality: 78, effort: 5 }).toFile(out);
      after += fs.statSync(out).size;
      made++;
    }
  }
  // Poids de la seule variante 1600 pour comparer au JPEG d'origine
  console.log(JSON.stringify({ jpgFiles: files.length, variants: made, jpgMB: +(before / 1048576).toFixed(1), webpAllMB: +(after / 1048576).toFixed(1) }));
})();
