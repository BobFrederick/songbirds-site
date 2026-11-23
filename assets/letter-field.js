// Sample the actual printed strokes on a two-pixel grid, once per layout.
const cell = 2;

function paintLetters(context, element, origin) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const style = getComputedStyle(node.parentElement);
    context.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
    const metrics = context.measureText('Mg');
    let offset = 0;
    for (const character of node.data) {
      range.setStart(node, offset);
      offset += character.length;
      range.setEnd(node, offset);
      if (!character.trim()) continue;
      const box = range.getBoundingClientRect();
      const ascent = metrics.fontBoundingBoxAscent;
      const leading = (box.height - ascent - metrics.fontBoundingBoxDescent) / 2;
      const glyph = style.textTransform === 'uppercase' ? character.toUpperCase() : character;
      context.fillText(glyph, box.left - origin.left, box.top - origin.top + leading + ascent);
    }
  }
}

// Find a nearby pixel of the opposite color. Two passes cache the directions
// so each bird samples the contours in constant time.
function nearestPixels(mask, columns, rows, target) {
  const nearest = new Int32Array(mask.length).fill(-1);
  for (let i = 0; i < mask.length; i++) if (mask[i] === target) nearest[i] = i;
  function pass(reverse) {
    const step = reverse ? -1 : 1;
    for (let y = reverse ? rows - 1 : 0; y >= 0 && y < rows; y += step) {
      for (let x = reverse ? columns - 1 : 0; x >= 0 && x < columns; x += step) {
        const i = y * columns + x;
        if (mask[i] === target) continue;
        let best = nearest[i], distance = best < 0 ? Infinity : (best % columns - x) ** 2 + (Math.floor(best / columns) - y) ** 2;
        function consider(nx, ny) {
          if (nx < 0 || nx >= columns || ny < 0 || ny >= rows) return;
          const seed = nearest[ny * columns + nx];
          if (seed < 0) return;
          const d = (seed % columns - x) ** 2 + (Math.floor(seed / columns) - y) ** 2;
          if (d < distance) { distance = d; best = seed; }
        }
        consider(x - step, y);
        consider(x - 1, y - step); consider(x, y - step); consider(x + 1, y - step);
        nearest[i] = best;
      }
    }
  }
  pass(false); pass(true);
  return nearest;
}

export function measureLetters(layer, elements) {
  const origin = layer.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  const columns = canvas.width = Math.ceil(origin.width / cell);
  const rows = canvas.height = Math.ceil(origin.height / cell);
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.scale(1 / cell, 1 / cell);
  for (const element of elements) paintLetters(ctx, element, origin);
  const rgba = ctx.getImageData(0, 0, columns, rows).data;
  const ink = new Uint8Array(columns * rows);
  for (let i = 0; i < ink.length; i++) ink[i] = rgba[4 * i + 3] > 60 ? 1 : 0;
  const painted = nearestPixels(ink, columns, rows, 1);
  const clear = nearestPixels(ink, columns, rows, 0);
  return {
    near(x, y) {
      const col = Math.floor(x / cell), row = Math.floor(y / cell);
      if (col < 0 || row < 0 || col >= columns || row >= rows) return null;
      const i = row * columns + col, inside = ink[i];
      const seed = inside ? clear[i] : painted[i];
      if (seed < 0) return null;
      const dx = x - (seed % columns + .5) * cell, dy = y - (Math.floor(seed / columns) + .5) * cell;
      if (!inside && dx * dx + dy * dy > 144) return null;
      const length = Math.max(.01, Math.hypot(dx, dy)), sign = inside ? -1 : 1;
      return {x: sign * dx / length, y: sign * dy / length, distance: sign * length};
    }
  };
}
