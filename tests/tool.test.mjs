import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createStudioServer } from '../lib/server.mjs';
import { normalizeFrame, applyTextUpdate, validAppURL } from '../lib/protocol.js';
import { createStudioClient, createPreviewBridge } from '../lib/client.js';
const win = () => {
  const sent = [], listeners = new Set();
  const parent = { postMessage(message, target) { sent.push({ message, target }); } };
  return { location:{ href:'http://localhost:9999/?__hub_studio_origin=http://127.0.0.1:4177' }, parent, sent,
    addEventListener(_, fn) { listeners.add(fn); }, removeEventListener(_, fn) { listeners.delete(fn); },
    receive(data, origin='http://127.0.0.1:4177', source=parent) { for (const fn of listeners) fn({ data, origin, source }); }, listeners,
  };
};
test('frame boundary rejects remote images, oversized text and duplicate IDs', () => {
  assert.throws(() => normalizeFrame({ nodes:[{type:'image',id:1,data:'https://example.com/pixel.png'}] }));
  assert.throws(() => normalizeFrame({ nodes:[{type:'text',text:'x'.repeat(2001)}] }));
  assert.throws(() => normalizeFrame({ nodes:[{type:'text',id:1,text:''},{type:'text',id:1,text:''}] }));
  assert.throws(() => validAppURL('javascript:alert(1)'));
  assert.throws(() => validAppURL('https://user:pass@example.com'));
});
test('text replacement clears old trailing content without replacing another node', () => {
  const nodes = normalizeFrame({nodes:[{type:'text',id:2,text:'A long old frame'},{type:'text',id:3,text:'Keep'}]}).nodes;
  const next = applyTextUpdate(nodes,{containerID:2,content:'New',contentOffset:0,contentLength:100});
  assert.equal(next[0].text,'New'); assert.equal(next[1].text,'Keep'); assert.equal(nodes[0].text,'A long old frame');
});
test('messages are pinned to the parent and explicit local studio origin', () => {
  const window = win(), client = createStudioClient({window}); let calls = 0;
  client.onInput(() => calls++);
  const data={channel:'hub-preview-studio/v1',type:'input',event:{textEvent:{eventType:0}}};
  window.receive(data,'https://untrusted.example'); window.receive(data,undefined,{}); assert.equal(calls,0);
  window.receive(data); assert.equal(calls,1);
  assert.equal(window.sent[0].target,'http://127.0.0.1:4177'); client.dispose(); assert.equal(window.listeners.size,0);
  assert.throws(() => createStudioClient({window,origin:'https://untrusted.example'}));
});
test('preview bridge models containers, volatile storage, image subarrays and events; audio is unsupported', async () => {
  const window = win(), bridge=createPreviewBridge({window});
  const page={textObject:[{containerID:7,width:100,height:40,content:'Initial',isEventCapture:1}],imageObject:[{containerID:8,width:2,height:2}]};
  assert.equal(await bridge.createStartUpPageContainer(page),0); assert.equal(await bridge.createStartUpPageContainer(page),1);
  await bridge.textContainerUpgrade({containerID:7,content:'Latest',contentLength:100});
  const raw=new Uint8Array([99,1,2,3,4,99]); await bridge.updateImageRawData({containerID:8,imageData:raw.subarray(1,5)});
  const frame=window.sent.at(-1).message.frame; assert.equal(frame.nodes[0].text,'Latest'); assert.equal(frame.nodes[0].capture,true); assert.deepEqual(frame.nodes[1].pixels,[1,2,3,4]);
  await bridge.updateImageRawData({containerID:8,imageData:[0x1f,0xa0]}); assert.deepEqual(window.sent.at(-1).message.frame.nodes[1].pixels,[1,15,10,0]);
  await bridge.setLocalStorage('key','preview'); assert.equal(await bridge.getLocalStorage('key'),'preview'); assert.equal(await bridge.getDeviceInfo(),null);
  assert.throws(() => bridge.audioControl(true),/Not supported/);
  let event; bridge.onEvenHubEvent(value=>event=value); window.receive({channel:'hub-preview-studio/v1',type:'input',event:{textEvent:{containerID:7,eventType:9}}}); assert.equal(event.textEvent.eventType,9);
  bridge.dispose();
});
test('CLI server serves only tool assets and does not expose workspace files', async t => {
  const server=createStudioServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve))); const base='http://127.0.0.1:'+server.address().port;
  const home=await fetch(base); assert.equal(home.status,200); assert.match(await home.text(),/Hub Preview Studio/);
  for (const path of ['/package.json','/.env','/exports','/../README.md','/@fs/etc/passwd']) assert.equal((await fetch(base+path)).status,404,path);
  const languageModule = await fetch(base+'/i18n.js'); assert.equal(languageModule.status,200); assert.match(await languageModule.text(),/LOCALE_KEY/);
  assert.equal((await fetch(base,{method:'POST'})).status,405);
  const hostile = await new Promise((resolve,reject) => { const request=http.get(base,{headers:{Host:'untrusted.example'}},response=>{response.resume();resolve(response.statusCode);}); request.on('error',reject); });
  assert.equal(hostile,403);
  assert.deepEqual(await (await fetch(base+'/health')).json(),{tool:'hub-preview-studio',version:'0.1.1'});
});
