import { createPreviewBridge } from '/client.js';
import { initialLocale, normalizeLocale, t, applyTranslations, translateError } from '/i18n.js';
const bridge = createPreviewBridge(), $ = id => document.getElementById(id);
const defaultKey = 'Look up.\nThere is room for a fresh perspective.';
let locale = initialLocale(), edited = false, statusKey = 'Preview bridge ready', statusParams = {};
function status(key, params = {}) { statusKey = key; statusParams = params; $('status').textContent = t(locale, key, params); }
function localize() { document.documentElement.lang = locale; applyTranslations(document, locale); $('status').textContent = t(locale, statusKey, statusParams.gestureCode === undefined ? statusParams : { gesture: t(locale, gestureNames[statusParams.gestureCode] || String(statusParams.gestureCode)) }); }
$('message').value = t(locale, defaultKey);
$('message').addEventListener('input', () => { edited = true; });
localize();
const icon = [];
for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) icon.push((Math.abs(x - 11.5) + Math.abs(y - 11.5) > 5 && Math.abs(x - 11.5) + Math.abs(y - 11.5) < 8) ? 13 : 0);
function page() { return { textObject: [{ containerID: 1, xPosition: 16, yPosition: 56, width: 544, height: 216, isEventCapture: 1, content: $('text').checked ? $('message').value : '' }], imageObject: $('icon').checked ? [{ containerID: 2, xPosition: 16, yPosition: 12, width: 24, height: 24 }] : [] }; }
let queue = Promise.resolve();
function update() { queue = queue.then(async () => { await bridge.rebuildPageContainer(page()); if ($('icon').checked) await bridge.updateImageRawData({ containerID: 2, imageData: icon }); status('Glasses layout updated'); }).catch(error => { statusKey = 'An unexpected error occurred.'; $('status').textContent = translateError(locale, error.message); }); }
$('send').onclick = update;
for (const id of ['icon', 'text']) $(id).onchange = update;
$('reset').onclick = () => { edited = false; $('message').value = t(locale, defaultKey); $('icon').checked = true; $('text').checked = true; update(); };
const gestureNames = { 0:'Tap', 1:'Swipe up', 2:'Swipe down', 3:'Double tap', 9:'Hold', 10:'Release' };
bridge.onEvenHubEvent(event => { const code = event.textEvent?.eventType ?? event.listEvent?.eventType; statusKey = 'Gesture received: {gesture}'; statusParams = { gestureCode: code }; localize(); });
const studioOrigin = new URL(location.href).searchParams.get('__hub_studio_origin');
window.addEventListener('message', event => { if (event.source !== window.parent || event.origin !== studioOrigin || event.data?.channel !== 'hub-preview-studio/v1' || event.data.type !== 'locale' || !['en','zh-CN'].includes(event.data.locale)) return; const next = normalizeLocale(event.data.locale); if (locale === next) return; locale = next; if (!edited) { $('message').value = t(locale, defaultKey); update(); } localize(); });
await bridge.createStartUpPageContainer(page());
if ($('icon').checked) await bridge.updateImageRawData({ containerID: 2, imageData: icon });
