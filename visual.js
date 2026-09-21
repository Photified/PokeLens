// Compare aligned card artwork after OCR has restricted the card number.
// A conservative fallback for decorated names/logos that OCR cannot read.
import {numberCandidates,cardName} from './matcher.js';
export function signature(image){
 const c=document.createElement('canvas');c.width=24;c.height=34;
 const ctx=c.getContext('2d',{willReadFrequently:true});
 const w=image.width||image.naturalWidth,h=image.height||image.naturalHeight;
 ctx.drawImage(image,w*.025,h*.025,w*.95,h*.95,0,0,c.width,c.height);
 const data=ctx.getImageData(0,0,c.width,c.height).data;
 let average=0;for(let i=0;i<data.length;i+=4)average+=(data[i]+data[i+1]+data[i+2])/3;
 average=Math.max(30,average/(data.length/4));const out=[];
 for(let i=0;i<data.length;i+=4)for(let j=0;j<3;j++)out.push(Math.min(2,data[i+j]/average)/2);
 return out;
}
export async function remoteSignature(url){
 let cache;try{cache=await caches.open('pokelens-images-v1');}catch{}
 let response=await cache?.match(url);
 if(!response){
  response=await fetch(url,{mode:'cors',signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw new Error('Image unavailable');
  if(cache){await cache.put(url,response.clone());const keys=await cache.keys();if(keys.length>120)await cache.delete(keys[0]);}
 }
 const blob=await response.blob();const image=await createImageBitmap(blob);
 try{return signature(image);}finally{image.close();}
}
export async function visualMatch(canvas,text,cards){
 const candidates=numberCandidates(text,cards).filter(c=>c.image?.startsWith('https://'));
 if(!candidates.length||candidates.length>30)return null;
 const source=signature(canvas),ranked=[];
 let cursor=0;const failed=[];
 const workers=Array.from({length:Math.min(4,candidates.length)},async()=>{
  while(cursor<candidates.length){const card=candidates[cursor++];try{
   const ref=await remoteSignature(card.image);
   const score=source.reduce((s,v,i)=>s+Math.abs(v-ref[i]),0)/source.length;
   ranked.push({card,score});
  }catch{failed.push(card);}}
 });
 await Promise.all(workers);if(!ranked.length)return null;
 ranked.sort((a,b)=>a.score-b.score);
 // These are similarity thresholds, not calibrated confidence percentages.
 if(ranked[0].score>.09)return null;
 const tolerance=ranked[0].score<.03?.006:.03;
 const near=ranked.filter(r=>r.score-ranked[0].score<tolerance);
 const best=near[0].card;
 if(near.some(r=>cardName(r.card.name)!==cardName(best.name)))return null;
 if(failed.some(c=>cardName(c.name)!==cardName(best.name)))return null;
 // Unavailable reference images with the same identity remain possible printings.
 return {kind:'match',cards:[...near.map(r=>r.card),...failed]};
}
