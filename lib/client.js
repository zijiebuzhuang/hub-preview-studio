import { CHANNEL, normalizeFrame, nodesFromPage, applyTextUpdate } from './protocol.js';
const allowedStudio = origin => {
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Studio origin must be a local HTTP(S) origin');
  return url.origin;
};
export function isStudioPreview(win = globalThis.window) {
  return !!win && win.parent !== win && !!new URL(win.location.href).searchParams.get('__hub_studio_origin');
}
export function createStudioClient({ origin, window: win = globalThis.window } = {}) {
  if (!win || win.parent === win) throw new Error('Open this project inside Hub Preview Studio');
  const target = allowedStudio(origin || new URL(win.location.href).searchParams.get('__hub_studio_origin'));
  let disposed = false, latest = { nodes: [] };
  const listeners = new Set();
  const post = (type, payload = {}) => {
    if (!disposed) win.parent.postMessage({ channel: CHANNEL, type, ...payload }, target);
  };
  const publish = frame => { latest = normalizeFrame(frame); post('frame', { frame: latest }); };
  const receive = event => {
    if (event.source !== win.parent || event.origin !== target || event.data?.channel !== CHANNEL) return;
    if (event.data.type === 'hello') { post('ready'); post('frame', { frame: latest }); }
    if (event.data.type === 'input' && event.data.event && typeof event.data.event === 'object') {
      for (const fn of listeners) fn(event.data.event);
    }
  };
  win.addEventListener('message', receive);
  post('ready');
  return {
    publish,
    onInput(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose() { post('disconnect'); disposed = true; win.removeEventListener('message', receive); listeners.clear(); },
  };
}
export function createPreviewBridge(options) {
  const client = createStudioClient(options), storage = new Map(), handlers = new Set();
  let nodes = [], started = false;
  const publish = () => client.publish({ nodes });
  const unsub = client.onInput(event => { for (const fn of handlers) fn(event); });
  const unsupported = () => { throw new Error('Not supported by the layout preview; use the official simulator or a physical device'); };
  return {
    async createStartUpPageContainer(page) { if (started) return 1; nodes = nodesFromPage(page); started = true; publish(); return 0; },
    async rebuildPageContainer(page) { nodes = nodesFromPage(page); publish(); return true; },
    async textContainerUpgrade(update) { nodes = applyTextUpdate(nodes, update); publish(); return true; },
    async updateImageRawData(update) {
      const node = nodes.find(n => n.id === String(update.containerID) && n.type === 'image');
      if (!node) throw new Error('Image container does not exist');
      const raw = update.imageData;
      let bytes = null;
      if (raw instanceof ArrayBuffer) bytes = Array.from(new Uint8Array(raw));
      else if (ArrayBuffer.isView(raw)) bytes = Array.from(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
      else if (Array.isArray(raw)) bytes = raw;
      let image;
      if (typeof raw === 'string') image = { data: raw.startsWith('data:') ? raw : 'data:image/png;base64,' + raw };
      else if (bytes?.[0] === 137 && bytes?.[1] === 80 && bytes?.[2] === 78 && bytes?.[3] === 71) {
        if (bytes.length > 250000 || bytes.some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw new Error('Inline PNG is too large or invalid');
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.slice(offset, offset + 8192));
        image = { data: 'data:image/png;base64,' + btoa(binary) };
      } else if (bytes?.length === Math.ceil(node.width * node.height / 2) && bytes.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) {
        image = { pixels: bytes.flatMap(v => [v >> 4, v & 15]).slice(0, node.width * node.height) };
      } else image = { pixels: bytes };
      const next = nodes.map(n => {
        if (n !== node) return n;
        const { pixels, data, ...base } = n;
        return { ...base, ...image };
      });
      nodes = normalizeFrame({ nodes: next }).nodes; publish(); return 'success';
    },
    async shutDownPageContainer(mode = 0) { if (mode === 1) return false; nodes = []; publish(); return true; },
    onEvenHubEvent(fn) { handlers.add(fn); return () => handlers.delete(fn); },
    async getDeviceInfo() { return null; },
    async getLocalStorage(key) { return storage.get(key) || ''; },
    async setLocalStorage(key, value) { storage.set(key, String(value)); return true; },
    audioControl: unsupported, imuControl: unsupported, getAppLocation: unsupported,
    dispose() { unsub(); handlers.clear(); client.dispose(); },
  };
}
