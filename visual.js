// Image retrieval searches every indexed reference, without an OCR shortlist.
let worker,sequence=0;const pending=new Map();let onProgress=()=>{};
function request(type,images=[]){
 if(!worker){worker=new Worker(new URL('./vision-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{if(data.progress){onProgress(data.progress);return;}const p=pending.get(data.id);if(!p)return;pending.delete(data.id);if(data.error){const error=new Error(data.error);p.reject(error);for(const other of pending.values())other.reject(error);pending.clear();worker.terminate();worker=null;}else p.resolve(data.result);};
  worker.onerror=e=>{for(const p of pending.values())p.reject(new Error(e.message||'Image scanner unavailable'));pending.clear();worker.terminate();worker=null;};
 }
 const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,type,images},images);});
}
export function prepareVision(progress=()=>{}){onProgress=progress;return request('init');}
export async function searchImages(views){const bitmaps=await Promise.all(views.map(c=>createImageBitmap(c)));return request('search',bitmaps);}
export function sameCardFeatures(a,b){if(!a||!b)return false;let best=-1;for(const x of a)for(const y of b){let dot=0;for(let i=0;i<x.length;i++)dot+=x[i]*y[i];best=Math.max(best,dot);}return best>.94;}
export function resetVision(){if(worker){worker.terminate();worker=null;}for(const p of pending.values())p.reject(new Error('Scanner refreshed'));pending.clear();}
