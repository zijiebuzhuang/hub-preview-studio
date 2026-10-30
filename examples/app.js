import { createPreviewBridge } from '/client.js';
const bridge = createPreviewBridge(), $ = id => document.getElementById(id);
$('message').value = 'Look up.\nThere is room for a fresh perspective.';
const icon = [];
for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) icon.push((Math.abs(x - 11.5) + Math.abs(y - 11.5) > 5 && Math.abs(x - 11.5) + Math.abs(y - 11.5) < 8) ? 13 : 0);
function page() {
  return {
    textObject: [{ containerID: 1, xPosition: 16, yPosition: 56, width: 544, height: 216, isEventCapture: 1, content: $('text').checked ? $('message').value : '' }],
    imageObject: $('icon').checked ? [{ containerID: 2, xPosition: 16, yPosition: 12, width: 24, height: 24 }] : [],
  };
}
let queue = Promise.resolve();
function update() {
  queue = queue.then(async () => { await bridge.rebuildPageContainer(page()); if ($('icon').checked) await bridge.updateImageRawData({ containerID: 2, imageData: icon }); $('status').textContent = 'Glasses layout updated'; }).catch(error => { $('status').textContent = error.message; });
}
$('send').onclick = update;
for (const id of ['icon', 'text']) $(id).onchange = update;
$('reset').onclick = () => { $('message').value = 'Look up.\nThere is room for a fresh perspective.'; $('text').checked = true; $('icon').checked = true; update(); };
bridge.onEvenHubEvent(event => { const code = event.textEvent?.eventType ?? event.listEvent?.eventType; $('status').textContent = 'Gesture received: ' + ({ 0:'Tap', 1:'Swipe up', 2:'Swipe down', 3:'Double tap', 9:'Hold', 10:'Release' }[code] || code); });
await bridge.createStartUpPageContainer(page());
if ($('icon').checked) await bridge.updateImageRawData({ containerID: 2, imageData: icon });
