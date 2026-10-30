export const CHANNEL = 'hub-preview-studio/v1';
export const WIDTH = 576;
export const HEIGHT = 288;
const numeric = (v, fallback, min, max) => {
  const n = v === undefined ? fallback : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('Invalid canvas geometry');
  return n;
};
export function normalizeFrame(value) {
  if (!value || !Array.isArray(value.nodes) || value.nodes.length > 12) throw new Error('Frame needs up to 12 nodes');
  const ids = new Set();
  return { width: WIDTH, height: HEIGHT, nodes: value.nodes.map((n, index) => {
    if (!n || !['text', 'image', 'list'].includes(n.type)) throw new Error('Unknown node type');
    const id = String(n.id ?? index);
    if (id.length > 100 || ids.has(id)) throw new Error('Node IDs must be unique');
    ids.add(id);
    const node = {
      id, type: n.type, capture: n.capture === true, x: numeric(n.x, 0, 0, WIDTH), y: numeric(n.y, 0, 0, HEIGHT),
      width: numeric(n.width, WIDTH, 1, WIDTH), height: numeric(n.height, HEIGHT, 1, HEIGHT),
      padding: numeric(n.padding, 0, 0, 32), gray: numeric(n.gray, 15, 0, 15),
      border: numeric(n.border, 0, 0, 5), radius: numeric(n.radius, 0, 0, 10),
      z: numeric(n.z, index, 0, 1000),
    };
    if (n.type === 'text') {
      if (typeof n.text !== 'string' || n.text.length > 2000) throw new Error('Text limit: 2000 characters per container');
      node.text = n.text;
    }
    if (n.type === 'list') {
      if (!Array.isArray(n.items) || n.items.length > 20 || n.items.some(s => typeof s !== 'string' || s.length > 64)) throw new Error('List limit: 20 short items');
      node.items = [...n.items];
      node.selected = numeric(n.selected, 0, 0, Math.max(0, node.items.length - 1));
    }
    if (n.type === 'image') {
      if (n.data !== undefined) {
        if (typeof n.data !== 'string' || n.data.length > 350000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(n.data)) throw new Error('Images must be inline PNG data');
        node.data = n.data;
      } else if (n.pixels !== undefined) {
        if (!Array.isArray(n.pixels) || n.pixels.length !== node.width * node.height || n.pixels.some(v => !Number.isInteger(v) || v < 0 || v > 15)) throw new Error('Pixels must be one gray4 value per pixel');
        node.pixels = [...n.pixels];
      }
    }
    return node;
  }) };
}
export function validAppURL(value, base) {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) project URL without embedded credentials');
  return url;
}
export function applyTextUpdate(nodes, update) {
  const id = String(update.containerID);
  const index = nodes.findIndex(n => String(n.id) === id && n.type === 'text');
  if (index < 0) throw new Error('Text container does not exist');
  const text = nodes[index].text;
  const offset = numeric(update.contentOffset, 0, 0, 2000);
  const length = numeric(update.contentLength, text.length, 0, 2000);
  if (typeof update.content !== 'string') throw new Error('Text update needs content');
  const next = text.slice(0, offset) + update.content + text.slice(offset + length);
  const result = nodes.map(n => ({ ...n }));
  result[index].text = next;
  return normalizeFrame({ nodes: result }).nodes;
}
export function nodesFromPage(page) {
  if (!page || typeof page !== 'object') throw new Error('Invalid page');
  const nodes = [];
  for (const [key, type] of [['textObject', 'text'], ['listObject', 'list'], ['imageObject', 'image']]) {
    if (page[key] !== undefined && !Array.isArray(page[key])) throw new Error('Invalid containers');
    for (const c of page[key] || []) nodes.push({
      id: c.containerID, type, x: c.xPosition, y: c.yPosition, width: c.width, height: c.height,
      capture: c.isEventCapture === 1, padding: c.paddingLength, border: c.borderWidth, radius: c.borderRadius, z: c.zOrderIndex,
      text: c.content || '', items: c.itemContainer?.itemName || [], selected: 0,
    });
  }
  return normalizeFrame({ nodes }).nodes;
}
