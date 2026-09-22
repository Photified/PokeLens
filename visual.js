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
  response=await fetch(url,{mode:'cors',signal:AbortSignal.timeout(2500)});
  if(!response.ok)throw new Error('Image unavailable');
  if(cache){await cache.put(url,response.clone());const keys=await cache.keys();if(keys.length>120)await cache.delete(keys[0]);}
 }
 const blob=await response.blob();const image=await createImageBitmap(blob);
 try{return signature(image);}finally{image.close();}
}
// Rank plausible images, retaining close reprints instead of rejecting the entire scan.
const memo=new Map();
export async function visualRank(views,candidates){
 const sources=views.map(signature),ranked=[];
 let cursor=0;const deadline=Date.now()+10000;
 const workers=Array.from({length:Math.min(6,candidates.length)},async()=>{
  while(cursor<candidates.length&&Date.now()<deadline){const card=candidates[cursor++];try{
   let promise=memo.get(card.image);
   if(!promise){promise=remoteSignature(card.image);memo.set(card.image,promise);promise.catch(()=>memo.delete(card.image));}
   const ref=await promise;
   const score=Math.min(...sources.map(source=>difference(source,ref)));
   ranked.push({card,score});
  }catch{ /* Text-backed alternatives remain available when an image is offline. */ }}
 });
 await Promise.all(workers);
 while(memo.size>240)memo.delete(memo.keys().next().value);
 return ranked.sort((a,b)=>a.score-b.score);
}
export function sameFrame(a,b){return difference(signature(a),signature(b))<.10;}
