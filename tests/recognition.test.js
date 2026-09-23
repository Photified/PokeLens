import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {prepare,summarizePrices} from '../matcher.js';import {makeRecognizer} from '../recognition.js';import {sameCardFeatures} from '../visual.js';
const cards=prepare(JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url))).cards),rank=makeRecognizer(cards);
const frame=(title,text,bottom,images)=>({title,text,bottom,visual:new Map(images.map(([id,similarity])=>[id,{id,similarity,view:0}]))});
test('Attack-description words cannot produce Nessa or Energy as title matches',()=>{
 const results=rank([frame("Team Rocket's Moltres ex HP 220",'Flame Screen Evil Incineration discard an Energy attached','031/182',[[630808,.91],[663425,.88]])]);
 assert.equal(results[0].card.id,630808);assert(results.every(x=>x.card._name==='TEAMROCKETSMOLTRESEX'));
});
test('A missing ex logo does not promote regular Lapras over the strong ex image',()=>{
 const results=rank([frame('Lapras','', '',[[684329,.84],[86618,.72]])]);assert.equal(results[0].card.id,684329);
});
test('Image retrieval can identify a card without readable text',()=>{
 assert.equal(rank([frame('','','',[[630808,.91],[663425,.88],[87400,.70]])])[0].card.id,630808);
});
test('Weak unrelated similarities do not become priced suggestions',()=>{
 assert.equal(rank([frame('','','',[[630808,.53],[87400,.55]])]).length,0);
 assert.equal(rank([frame('','','',[[630808,.80],[87400,.79]])]).length,0);
});
test('Strong title and moves recover a foil even when its image is difficult',()=>{
 const results=rank([frame("Team Rocket's Moltres ex HP 220",'Flame Screen Evil Incineration','031/182',[[87400,.88]])]);
 assert.equal(results[0].card.id,630808);
});
test('Printing alternatives retain separate market price types',()=>{
 const c=cards.find(c=>c.prices.length>1),summary=summarizePrices([c]);assert(summary.rows.length>1);assert.equal(summary.rows[0].type,c.prices[0].type);
 assert.equal(summarizePrices([{prices:[{type:'Normal',market:null}]}]),null);
});
test('Different frames do not automatically share OCR evidence',()=>{
 assert.equal(sameCardFeatures([[1,0]],[[0,1]]),false);assert.equal(sameCardFeatures([[1,0]],[[1,0]]),true);
});
