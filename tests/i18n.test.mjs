import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALE_KEY, initialLocale, saveLocale, t, translateError } from '../lib/i18n.js';

test('language preference overrides browser locale and survives unavailable storage', () => {
  let saved;
  const storage = { getItem: () => saved, setItem: (key, value) => { assert.equal(key, LOCALE_KEY); saved = value; } };
  assert.equal(initialLocale(storage, 'zh-TW'), 'zh-CN');
  assert.equal(initialLocale(storage, 'fr-FR'), 'en');
  saveLocale('zh-CN', storage);
  assert.equal(initialLocale(storage, 'en-US'), 'zh-CN');
  saveLocale('en', storage);
  assert.equal(initialLocale(storage, 'zh-CN'), 'en');
  saved = 'invalid';
  assert.equal(initialLocale(storage, 'zh-CN'), 'zh-CN');
  const blocked = { getItem() { throw new Error('Storage denied'); }, setItem() { throw new Error('Storage denied'); } };
  assert.equal(initialLocale(blocked, 'zh-CN'), 'zh-CN');
  assert.doesNotThrow(() => saveLocale('zh-CN', blocked));
});

test('dynamic messages retain parameters and can switch back to English', () => {
  assert.equal(t('zh-CN', '{n} frames', { n: 7 }), '7 帧');
  assert.equal(t('en', '{n} frames', { n: 7 }), '7 frames');
  assert.equal(t('zh-CN', 'Ready · Save {name} again', { name: 'glasses-frame.png' }), '已就绪 · 再次保存 glasses-frame.png');
  assert.equal(translateError('zh-CN', 'Node IDs must be unique'), '容器 ID 必须唯一');
  assert.equal(translateError('zh-CN', 'Unknown internal detail'), '发生未知错误。');
});
