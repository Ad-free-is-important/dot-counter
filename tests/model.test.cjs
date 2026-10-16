const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../assets/model.js');

test('single counts, negative integers, direct edits and reversible reset', () => {
  const store = new M.Store();
  store.change(1); assert.equal(store.current.value,1);
  store.change(-1); store.change(-1); assert.equal(store.current.value,-1);
  store.set(1234); store.set(0,'归零');
  store.undo(); assert.equal(store.current.value,1234);
  store.undo(); assert.equal(store.current.value,-1);
  store.redo(); assert.equal(store.current.value,1234);
  store.change(1); assert.equal(store.current.redo.length,0);
});
test('long presses are one undo action, with a durable merged log', () => {
  let saved;
  const store = new M.Store(undefined, json => { saved = json; return true; });
  for (let i=0;i<18;i++) store.change(1,'held-press');
  assert.equal(store.current.value,18);
  assert.equal(store.current.undo.length,1);
  assert.equal(store.current.log.length,1);
  assert.equal(store.current.log[0].before,0);
  assert.equal(store.current.log[0].after,18);
  const restored = new M.Store(JSON.parse(saved));
  restored.undo(); assert.equal(restored.current.value,0);
  restored.redo(); assert.equal(restored.current.value,18);
});
test('counter isolation, settings, copy, delete and backup round trip', () => {
  const store = new M.Store(); const firstId=store.current.id;
  store.set(49); store.current.step=5; store.current.goal=100;
  const second = store.add({name:'游戏回合',value:-20,step:7,color:'mint',goal:null});
  store.change(1); assert.equal(store.current.value,-13);
  store.select(firstId); assert.equal(store.current.value,49); assert.equal(store.current.step,5);
  const copy=store.copy(firstId); assert.equal(copy.value,49); assert.equal(copy.undo.length,0);
  assert.notEqual(copy.id,firstId);
  store.remove(copy.id); assert.equal(store.current.id,firstId);
  store.data.settings.theme='dark'; store.data.settings.keepAwake=true;
  const restored = new M.Store(JSON.parse(store.backup()));
  assert.deepEqual(restored.data,store.data);
  restored.select(second.id); restored.undo(); assert.equal(restored.current.value,-20);
  restored.remove(second.id); assert.throws(()=>restored.remove(firstId));
});
test('bounded integers and configuration validation cannot corrupt history', () => {
  const store = new M.Store(); store.set(M.LIMIT);
  assert.throws(()=>store.change(1)); assert.equal(store.current.value,M.LIMIT);
  assert.throws(()=>store.set(1.5)); assert.throws(()=>store.set(Infinity));
  const old = JSON.stringify(store.data);
  assert.throws(()=>store.configure({name:'changed',color:'mint',step:1,goal:null,value:NaN}));
  assert.equal(JSON.stringify(store.data),old);
  store.set(-M.LIMIT); assert.throws(()=>store.change(-1));
});
test('invalid imports, duplicate IDs and incompatible versions are rejected', () => {
  const original = M.initial();
  for (const invalid of [{},null,{...original,version:2},{...original,counters:[]},{...original,counters:[original.counters[0],original.counters[0]]}]) assert.throws(()=>M.validate(invalid));
  const bad = JSON.parse(JSON.stringify(original)); bad.counters[0].step=0;
  assert.throws(()=>M.validate(bad)); bad.counters[0].step=1; bad.counters[0].goal=-1;
  assert.throws(()=>M.validate(bad));
  const store=new M.Store(); const before=JSON.stringify(store.data);
  assert.throws(()=>store.replace(bad)); assert.equal(JSON.stringify(store.data),before);
});
test('histories are bounded and data persistence failures are reported', () => {
  const store = new M.Store();
  for(let i=0;i<200;i++) store.change(1);
  assert.equal(store.current.undo.length,50); assert.equal(store.current.log.length,80);
  for(let i=0;i<50;i++) assert.equal(store.undo(),true);
  assert.equal(store.undo(),false); assert.equal(store.current.value,150);
  for(let i=0;i<50;i++) assert.equal(store.redo(),true);
  assert.equal(store.current.value,200);
  const failing = new M.Store(undefined,()=>false);
  assert.throws(()=>failing.change(1),/保存失败/);
});
