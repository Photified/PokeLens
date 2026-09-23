// Pure retrieval math shared by the browser worker and the offline regression runner.
export function rgbTensor(rgba,size=224){
 const pixels=size*size,input=new Float32Array(3*pixels);
 for(let i=0;i<pixels;i++){input[i]=(rgba[i*4]/255-.485)/.229;input[pixels+i]=(rgba[i*4+1]/255-.456)/.224;input[2*pixels+i]=(rgba[i*4+2]/255-.406)/.225;}return input;
}
export function normalizeEmbedding(v){const n=Math.hypot(...v);if(!Number.isFinite(n)||n===0)throw new Error('Invalid image embedding');return Float32Array.from(v,x=>x/n);}
export function indexNorms(vectors){
 const norms=new Float32Array(vectors.length/384);for(let i=0;i<norms.length;i++){let n=0;for(let d=0;d<384;d++)n+=vectors[i*384+d]**2;norms[i]=n?1/Math.sqrt(n):0;}return norms;
}
export function retrieve(features,ids,vectors,norms,limit=80){
 const best=new Float32Array(ids.length),viewIndex=new Uint8Array(ids.length);
 for(let q=0;q<features.length;q++)for(let i=0;i<ids.length;i++){
  let dot=0;const start=i*384,v=features[q];for(let d=0;d<384;d++)dot+=v[d]*vectors[start+d];dot*=norms[i];
  if(dot>best[i]){best[i]=dot;viewIndex[i]=q;}
 }
 return Array.from(ids,(_,i)=>i).sort((a,b)=>best[b]-best[a]).slice(0,limit).map(i=>({id:ids[i],similarity:best[i],view:viewIndex[i]}));
}
