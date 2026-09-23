import {rgbTensor,normalizeEmbedding,indexNorms,retrieve} from './vision-engine.js';
import * as ort from './vendor/vision/ort.wasm.min.mjs';
let session,index,vectors,norms,metadata,ready;
async function checked(url,sha){
 const response=await fetch(sha?url+'?v='+sha:url);if(!response.ok)throw new Error('Scanner download failed. Reconnect and try again.');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(sha&&crypto.subtle){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-224',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==sha)throw new Error('Scanner files are out of sync. Reload after the deployment finishes.');}
 return bytes;
}
async function initialize(){
 ort.env.wasm.numThreads=1; // GitHub Pages does not provide cross-origin isolation.
 ort.env.wasm.wasmPaths=new URL('./vendor/vision/',import.meta.url).href;
 const model=await (await fetch('./vendor/vision/model.json')).json();
 metadata=await (await fetch('./data/vision-v2/index.json')).json();
 if(metadata.modelSha224!==model.sha224)throw new Error('Image model and catalog index do not match.');
 postMessage({progress:'Downloading image scanner…'});
 const pieces=await Promise.all(model.parts.map(p=>checked('./vendor/vision/'+p.file,p.sha224)));
 const bytes=new Uint8Array(pieces.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of pieces){bytes.set(p,offset);offset+=p.length;}
 session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
 vectors=new Int8Array((await checked('./data/vision-v2/'+metadata.file,metadata.sha224)).buffer);index=metadata.ids;
 if(vectors.length!==index.length*384)throw new Error('Incomplete image index.');
 norms=indexNorms(vectors);
 postMessage({progress:'Image scanner ready.'});
 return {count:index.length};
}
async function encode(bitmap){
 const canvas=new OffscreenCanvas(224,224),ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';ctx.drawImage(bitmap,0,0,224,224);bitmap.close();
 const input=rgbTensor(ctx.getImageData(0,0,224,224).data);
 const result=await session.run({pixel_values:new ort.Tensor('float32',input,[1,3,224,224])});
 return normalizeEmbedding(result.last_hidden_state.data.slice(0,384));
}
self.onmessage=async({data})=>{
 try{
  ready??=initialize().catch(e=>{ready=null;throw e;});const info=await ready;
  if(data.type==='init'){postMessage({id:data.id,result:info});return;}
  const features=[];
  for(const bitmap of data.images)features.push(await encode(bitmap));
  postMessage({id:data.id,result:{matches:retrieve(features,index,vectors,norms),features:features.map(v=>Array.from(v))}});
 }catch(error){postMessage({id:data.id,error:error.message||String(error)});}
};
