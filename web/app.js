import { CHANNEL, normalizeFrame, validAppURL } from '/protocol.js';
const $ = id => document.getElementById(id);
const iframe = $('phone'), canvas = $('glass');
let current = null, expectedOrigin = '', sourceURL = '', frames = 0, connected = false, paintRevision = 0;
const error = message => { $('error').textContent = message || ''; };
function clearFrame() {
  current = null; frames = 0; connected = false; ++paintRevision;
  $('download-result').hidden = true; $('download-result').removeAttribute('href');
  canvas.getContext('2d').clearRect(0, 0, 576, 288);
  $('waiting').hidden = false; $('bridge-state').textContent = 'Adapter not connected';
  $('bridge-dot').classList.remove('live'); $('frame-count').textContent = '0 frames';
  $('node-count').textContent = '0 containers'; $('nodes').replaceChildren();
  for (const id of ['export', 'export-json']) $(id).disabled = true;
}
function connect(value) {
  try {
    const target = validAppURL(value, location.origin);
    if (target.origin === location.origin && target.pathname !== '/example/') throw new Error('Use a project dev server URL or the built-in example.');
    sourceURL = target.href; expectedOrigin = target.origin;
    target.searchParams.set('__hub_studio_origin', location.origin);
    clearFrame(); error(''); $('project-url').value = sourceURL;
    $('phone-state').textContent = 'Loading project…';
    $('connection-note').textContent = 'Phone loads directly. Glasses output appears when the adapter connects.';
    $('open-app').href = sourceURL; iframe.src = target.href;
  } catch (e) { error(e.message); }
}
function send(type, payload = {}) {
  if (expectedOrigin) iframe.contentWindow?.postMessage({ channel: CHANNEL, type, ...payload }, expectedOrigin);
}
iframe.addEventListener('load', () => { $('phone-state').textContent = 'Iframe loaded · project server'; send('hello'); });
window.addEventListener('message', event => {
  if (event.source !== iframe.contentWindow || event.origin !== expectedOrigin || event.data?.channel !== CHANNEL) return;
  try {
    if (event.data.type === 'disconnect') { clearFrame(); return; }
    if (event.data.type === 'ready') { connected = true; $('bridge-state').textContent = 'Preview adapter connected'; $('bridge-dot').classList.add('live'); error(''); }
    if (event.data.type !== 'frame') return;
    current = normalizeFrame(event.data.frame); connected = true; frames++;
    $('waiting').hidden = true; $('bridge-state').textContent = 'Preview adapter connected'; $('bridge-dot').classList.add('live');
    $('frame-count').textContent = frames + ' frames'; $('node-count').textContent = current.nodes.length + ' containers';
    $('nodes').replaceChildren(...current.nodes.map(n => {
      const row = document.createElement('div'); row.className = 'node';
      const title = document.createElement('b'); title.textContent = n.type + ' · ' + n.id;
      const bounds = document.createElement('span'); bounds.textContent = `${n.x}, ${n.y} · ${n.width} × ${n.height}`;
      row.append(title, bounds); return row;
    }));
    for (const id of ['export', 'export-json']) $(id).disabled = false;
    void repaint();
  } catch (e) { error('Frame rejected: ' + e.message); }
});
const timer = setInterval(() => { if (!connected) send('hello'); }, 1000);
window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
function wrapped(ctx, text, x, y, width, lineHeight) {
  let line = '';
  for (const char of text) {
    if (char === '\n') { ctx.fillText(line, x, y); y += lineHeight; line = ''; continue; }
    if (ctx.measureText(line + char).width > width && line) { ctx.fillText(line, x, y); y += lineHeight; line = ''; }
    line += char;
  }
  if (line) ctx.fillText(line, x, y);
}
async function render(target, frame, debug = false) {
  const ctx = target.getContext('2d'); ctx.clearRect(0, 0, 576, 288);
  for (const n of [...frame.nodes].sort((a, b) => a.z - b.z)) {
    ctx.save(); ctx.beginPath(); ctx.rect(n.x, n.y, n.width, n.height); ctx.clip();
    const color = `rgba(155,221,128,${n.gray / 15})`;
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = n.border;
    if (n.border) { ctx.beginPath(); ctx.roundRect(n.x + n.border / 2, n.y + n.border / 2, n.width - n.border, n.height - n.border, n.radius); ctx.stroke(); }
    ctx.font = '21px "PingFang SC", sans-serif'; ctx.textBaseline = 'top';
    if (n.type === 'text') wrapped(ctx, n.text, n.x + n.padding, n.y + n.padding, Math.max(1, n.width - 2 * n.padding), 31);
    if (n.type === 'list') {
      n.items.forEach((item, i) => {
        const y = n.y + n.padding + i * 31;
        if (i === n.selected) { ctx.globalAlpha = .15; ctx.fillRect(n.x, y, n.width, 30); ctx.globalAlpha = 1; }
        ctx.fillText(item, n.x + n.padding + 7, y + 3);
      });
    }
    if (n.type === 'image' && n.pixels) {
      const image = document.createElement('canvas'); image.width = n.width; image.height = n.height;
      const ic = image.getContext('2d'), pixels = ic.createImageData(n.width, n.height);
      n.pixels.forEach((gray, i) => pixels.data.set([155, 221, 128, Math.round(gray / 15 * 255)], i * 4));
      ic.putImageData(pixels, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(image, n.x, n.y);
    }
    if (n.type === 'image' && n.data) {
      try { const image = new Image(); image.src = n.data; await image.decode(); ctx.drawImage(image, n.x, n.y, n.width, n.height); }
      catch { error('Could not decode an inline PNG. Other containers still render.'); }
    }
    ctx.restore();
    if (debug) { ctx.strokeStyle = '#f3e198'; ctx.lineWidth = 1; ctx.strokeRect(n.x + .5, n.y + .5, n.width - 1, n.height - 1); }
  }
}
async function repaint() {
  if (!current) return;
  const revision = ++paintRevision, temp = document.createElement('canvas'); temp.width = 576; temp.height = 288;
  await render(temp, current, $('bounds').checked);
  if (revision !== paintRevision) return;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 576, 288); ctx.drawImage(temp, 0, 0);
}
$('connect-form').addEventListener('submit', event => { event.preventDefault(); connect($('project-url').value); });
$('example').onclick = () => connect('/example/');
$('reload').onclick = () => { if (sourceURL) connect(sourceURL); };
$('device').onchange = () => { const [w, h] = $('device').value.split(',').map(Number); $('phone-frame').style.width = (w + 2) + 'px'; $('phone-frame').style.setProperty('--phone-height', h + 'px'); };
$('theme').onclick = $('theme-mobile').onclick = () => document.body.classList.toggle('dark');
$('grid').onchange = () => canvas.parentElement.classList.toggle('grid', $('grid').checked);
$('bounds').onchange = () => void repaint();
$('guide').onclick = () => $('help').showModal();
for (const id of ['close-help', 'done-help']) $(id).onclick = () => $('help').close();
for (const button of document.querySelectorAll('[data-event]')) button.onclick = () => {
  if (!connected) { error('Connect a preview adapter before sending gestures.'); return; }
  const target = current?.nodes.find(n => n.capture) || current?.nodes.find(n => n.type !== 'image');
  const payload = { eventType: Number(button.dataset.event), containerID: target ? Number(target.id) : 1 };
  send('input', { event: target?.type === 'list' ? { listEvent: payload } : { textEvent: payload } });
};
function download(blob, name) {
  const reader = new FileReader();
  reader.onload = () => {
    const link = $('download-result'); link.href = reader.result; link.download = name;
    link.textContent = 'Ready · Save ' + name + ' again'; link.hidden = false; link.click();
  };
  reader.onerror = () => error('Could not prepare the export. Try again.');
  reader.readAsDataURL(blob);
}
$('export-json').onclick = () => { if (current) download(new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' }), 'glasses-frame.json'); };
$('export').onclick = async () => {
  if (!current) return;
  const output = document.createElement('canvas'); output.width = 576; output.height = 288;
  await render(output, current); output.toBlob(blob => { if (blob) download(blob, 'glasses-frame.png'); });
};
try { const config = await (await fetch('/config.json')).json(); connect(config.app || '/example/'); }
catch (e) { error(e.message); }
