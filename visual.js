// Compare aligned card artwork after OCR has restricted the card number.
// A conservative fallback for decorated names/logos that OCR cannot read.
import {numberCandidates,nameCandidates,cardName} from './matcher.js';
export function signature(image){
 const c=document.createElement('canvas');c.width=24;c.height=34;
 const ctx=c.getContext('2d',{willReadFrequently:true});
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const w=image.width||image.naturalWidth,h=image.height||image.naturalHeight;
 ctx.drawImage(image,w*.025,h*.025,w*.95,h*.95,0,0,c.width,c.height);
 const data=ctx.getImageData(0,0,c.width,c.height).data;
 let average=0;for(let i=0;i<data.length;i+=4)average+=(data[i]+data[i+1]+data[i+2])/3;
 average=Math.max(30,average/(data.length/4));const out=[];
 for(let i=0;i<data.length;i+=4)for(let j=0;j<3;j++)out.push(Math.min(2,data[i+j]/average)/2);
 out.gray=[];
 for(let i=0;i<data.length;i+=4)out.gray.push(.299*data[i]+.587*data[i+1]+.114*data[i+2]);
 const mean=out.gray.reduce((a,b)=>a+b,0)/out.gray.length;
 const std=Math.sqrt(out.gray.reduce((a,b)=>a+(b-mean)**2,0)/out.gray.length);
 out.gray=out.gray.map(v=>(v-mean)/Math.max(8,std));
 out.art=[];
 for(let y=5;y<18;y++)for(let x=2;x<22;x++){const i=(y*24+x)*4;out.art.push(.299*data[i]+.587*data[i+1]+.114*data[i+2]);}
 const am=out.art.reduce((a,b)=>a+b,0)/out.art.length;
 const ast=Math.sqrt(out.art.reduce((a,b)=>a+(b-am)**2,0)/out.art.length);
 out.art=out.art.map(v=>(v-am)/Math.max(8,ast));
 return out;
}
function difference(a,b){
 const color=a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/a.length;
 const corr=a.gray.reduce((s,v,i)=>s+v*b.gray[i],0)/a.gray.length;
 const artCorr=a.art.reduce((s,v,i)=>s+v*b.art[i],0)/a.art.length;
 return .25*color+.20*Math.max(0,1-corr)/2+.55*Math.max(0,1-artCorr)/2;
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
export async function visualMatch(canvas,text,cards,title="",views=[canvas]){
 let pool=numberCandidates(text,cards);
 if(!pool.length)pool=nameCandidates(title,cards);
 const candidates=pool.filter(c=>c.image?.startsWith('https://'));
 if(!candidates.length||candidates.length>120)return null;
 const sources=views.map(signature),ranked=[];
 let cursor=0;const failed=[];
 const workers=Array.from({length:Math.min(4,candidates.length)},async()=>{
  while(cursor<candidates.length){const card=candidates[cursor++];try{
   const ref=await remoteSignature(card.image);
   const score=Math.min(...sources.map(source=>difference(source,ref)));
   ranked.push({card,score});
  }catch{failed.push(card);}}
 });
 await Promise.all(workers);if(!ranked.length)return null;
 ranked.sort((a,b)=>a.score-b.score);
 // These are similarity thresholds, not calibrated confidence percentages.
 if(ranked[0].score>.23)return null;
 const distinct=ranked.find(r=>r.card._num!==ranked[0].card._num||r.card._total!==ranked[0].card._total||cardName(r.card.name)!==cardName(ranked[0].card.name));
 if(distinct&&distinct.score-ranked[0].score<(ranked[0].score>.12?.045:.025))return null;
 const tolerance=ranked[0].score<.03?.006:.025;
 const near=ranked.filter(r=>r.score-ranked[0].score<tolerance);
 const best=near[0].card;
 if(near.some(r=>cardName(r.card.name)!==cardName(best.name)||r.card._num!==best._num||r.card._total!==best._total))return null;
 // Missing references are never silently substituted. Require text evidence for their identity.
 if(failed.length&&!numberCandidates(text,cards).length)return null;
 if(failed.some(c=>cardName(c.name)!==cardName(best.name)||c._num!==best._num||c._total!==best._total))return null;
 // Unavailable reference images with the same identity remain possible printings.
 return {kind:'match',cards:[...near.map(r=>r.card),...failed]};
}
