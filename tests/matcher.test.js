import assert from 'node:assert/strict';
import {prepare,identify,summarizePrices} from '../matcher.js';
const cards=prepare([
 {id:1,name:'Lugia VSTAR',number:'139/195',set:'Silver Tempest',setCode:'SWSH12',group:1,prices:[{type:'Holofoil',market:2.25}]},
 {id:2,name:'Lugia VSTAR',number:'211/195',set:'Silver Tempest',setCode:'SWSH12',group:1,prices:[]},
 {id:3,name:'Lugia VSTAR',number:'139/196',set:'Other',setCode:'XYZ',group:2,prices:[]},
 {id:4,name:'Pikachu',number:'025/165',set:'151',setCode:'MEW',group:3,prices:[{type:'Normal',market:.1},{type:'Reverse Holofoil',market:.5}]},
 {id:5,name:'Pikachu',number:'SWSH020',set:'SWSH promos',setCode:'SWP',group:4,prices:[]},
]);
assert.equal(identify('Lugia VSTAR HP280\n139/195',cards).cards[0].id,1);
assert.equal(identify('Lugia VSTAR HP280\nG 139/195',cards).cards[0].id,1);
assert.equal(identify('Lugia VSTAR 211/195',cards).cards[0].id,2);
assert.equal(identify('Lugia VSTAR HP280',cards).kind,'none');
assert.notEqual(identify('Lugia VSTAR 139',cards).kind,'match');
assert.equal(identify('Pikachu 25/165',cards).cards[0].id,4);
assert.equal(identify('Pikachu SWSH020',cards).cards[0].id,5);
assert.equal(identify('Completely unreadable card',cards).kind,'none');
assert.equal(summarizePrices([cards[1]]),null);
assert.deepEqual([summarizePrices([cards[3]]).low,summarizePrices([cards[3]]).high],[.1,.5]);
const duplicated=prepare([...cards,{...cards[0],id:6,group:6,set:'Another set'}]);
assert.equal(identify('Lugia VSTAR 139/195',duplicated).kind,'ambiguous');
console.log('11 matcher/price checks passed');
