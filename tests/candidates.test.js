import assert from 'node:assert/strict';
import {prepare,nameCandidates,rankCandidates,mergeEvidence,summarizePrices} from '../matcher.js';
const cards=prepare([
 {id:1,name:'Mew',number:'040',group:1,set:'Promos',hp:'50',attacks:['[1] Psywave (10x)','[P] Devolution Beam'],prices:[{type:'Holofoil',market:12}]},
 {id:2,name:'Mew',number:'01/18',group:2,set:'Other',hp:'30',prices:[{type:'Normal',market:2},{type:'Reverse Holofoil',market:3}]},
 {id:3,name:'Mew ex',number:'158/128',group:3,set:'New',hp:'160',attacks:['Teleportation Burst (30)'],prices:[]},
 {id:4,name:'Mewtwo',number:'15/100',group:4,set:'Old',prices:[]},
]);
assert.equal(nameCandidates('Mew 50 HP',cards).length,3);
assert.equal(nameCandidates('Me w',cards).length,3);
assert.equal(nameCandidates('Meow',cards).length,3);
assert.equal(nameCandidates('Mewtwo',cards).length,1);
assert.equal(rankCandidates('Psywave Devolution Beam 50 HP',cards)[0].card.id,1);
assert.equal(rankCandidates('160 HP',cards).length,0);
assert.equal(rankCandidates('Nothing readable',cards).length,0);
assert.equal(rankCandidates('Mew 158/128',cards)[0].card.id,3);
const ranked=rankCandidates('Mew',cards);
assert.equal(mergeEvidence(ranked,[{card:cards[1],score:.02}])[0].card.id,2);
assert.equal(mergeEvidence(ranked,[]).length,3);
assert.equal(summarizePrices([cards[2]]),null);
assert.equal(summarizePrices([cards[1]]).rows.length,2);
console.log('12 candidate, independent cue, missing-image and variant checks passed');
