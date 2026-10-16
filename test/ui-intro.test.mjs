import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeLamp} from '../public/lamp.js';
import {toggleTheme} from '../public/theme.js';

function fakeElement(){
 const listeners={},attributes={},classes=new Set();
 return {dataset:{},attributes,listeners,classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value)},
  setAttribute:(key,value)=>{attributes[key]=value;},addEventListener:(name,handler)=>{(listeners[name]??=[]).push(handler);},
  dispatch:(name,event={})=>{for(const handler of listeners[name]||[])handler({preventDefault(){},...event});},
  focus(){this.focused=true;},get classes(){return classes;},inert:false,textContent:''};
}

test('lamp switches off→on→off and keeps the sign-in card inaccessible while dark',()=>{
 const elements={overlay:fakeElement(),cord:fakeElement(),card:fakeElement(),hint:fakeElement()};
 const lamp=initializeLamp(elements);
 assert.equal(lamp.isOn,false);assert.equal(elements.card.inert,true);assert.equal(elements.card.attributes['aria-hidden'],'true');
 elements.cord.dispatch('click');
 assert.equal(lamp.isOn,true);assert.equal(elements.overlay.dataset.lamp,'on');assert.equal(elements.card.inert,false);assert.equal(elements.card.attributes['aria-hidden'],'false');
 elements.cord.dispatch('click');
 assert.equal(lamp.isOn,false);assert.equal(elements.overlay.dataset.lamp,'off');assert.equal(elements.card.inert,true);
});

test('lamp supports pointer pull feedback and Escape keyboard shutoff',()=>{
 const elements={overlay:fakeElement(),cord:fakeElement(),card:fakeElement(),hint:fakeElement()};
 const lamp=initializeLamp(elements);
 elements.cord.dispatch('pointerdown',{pointerType:'touch'});assert.equal(elements.cord.classList.contains('is-pulling'),true);
 elements.cord.dispatch('pointerup');assert.equal(elements.cord.classList.contains('is-pulling'),false);
 elements.cord.dispatch('click');elements.cord.dispatch('keydown',{key:'Escape'});
 assert.equal(lamp.isOn,false);assert.equal(elements.cord.focused,true);
});

test('theme toggle persists Ivory and Midnight choice',()=>{
 const root={dataset:{}};const saved=[];const storage={setItem:(key,value)=>saved.push([key,value])};
 assert.equal(toggleTheme(root,storage),'ivory');assert.equal(root.dataset.theme,'ivory');
 assert.equal(toggleTheme(root,storage),'midnight');assert.equal(root.dataset.theme,undefined);
 assert.deepEqual(saved,[['orbit-theme','ivory'],['orbit-theme','midnight']]);
});

test('login retains validated username/password fields and glass fallbacks stay accessible',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/style.css',import.meta.url),'utf8');
 assert.match(html,/name="handle"[^>]*minlength="3"[^>]*required/);
 assert.match(html,/name="password"[^>]*minlength="12"[^>]*required/);
 assert.match(html,/id="lampCord"[^>]*aria-pressed="false"/);
 assert.match(html,/id="orbitIntroVideo"[^>]*muted playsinline controls/);
 const intro=await readFile(new URL('../public/media/orbit-intro.mp4',import.meta.url));
 assert.ok(intro.length>1000);
 assert.match(css,/@supports not \(\(backdrop-filter/);
 assert.match(css,/prefers-reduced-motion:\s*reduce/);
 assert.match(css,/focus-visible/);
});
