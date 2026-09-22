/* Preserve native capture detail; produce alternative views without inventing pixels. */
export function crop(source,x,y,w,h,scale=1){
 const out=document.createElement('canvas');out.width=Math.max(1,Math.round(w*scale));out.height=Math.max(1,Math.round(h*scale));
 const ctx=out.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(source,x,y,w,h,0,0,out.width,out.height);return out;
}
export function cardViews(source){
 const probe=crop(source,0,0,source.width,source.height,240/source.width),w=probe.width,h=probe.height;
 const d=probe.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
 const diff=(a,b)=>Math.max(Math.abs(d[a]-d[b]),Math.abs(d[a+1]-d[b+1]),Math.abs(d[a+2]-d[b+2]));
 const vx=new Array(w).fill(0),hy=new Array(h).fill(0);
 for(let x=2;x<w-2;x++){for(let y=Math.floor(h*.18);y<h*.8;y++)vx[x]+=diff((y*w+x-2)*4,(y*w+x+2)*4);vx[x]/=h*.62;}
 for(let y=2;y<h-2;y++){for(let x=Math.floor(w*.18);x<w*.82;x++)hy[y]+=diff(((y-2)*w+x)*4,((y+2)*w+x)*4);hy[y]/=w*.64;}
 function peaks(arr,from,to,fallback){const values=[];for(let i=from;i<to;i++)values.push(i);values.sort((a,b)=>arr[b]-arr[a]);const out=[];for(const i of values){if(out.every(j=>Math.abs(i-j)>5))out.push(i);if(out.length===3)break;}return [...out,fallback];}
 const left=peaks(vx,2,Math.floor(w*.21),0),right=peaks(vx,Math.floor(w*.79),w-2,w);
 const top=peaks(hy,2,Math.floor(h*.18),0),bottom=peaks(hy,Math.floor(h*.78),h-2,h);
 const boxes=[];
 for(const l of left)for(const r of right)for(const t of top)for(const b of bottom){
  const bw=r-l,bh=b-t,ratio=bw/bh,area=bw*bh/(w*h);
  if(ratio<.66||ratio>.78||area<.55)continue;
  const edge=(vx[l]||0)+(vx[r]||0)+(hy[t]||0)+(hy[b]||0);
  boxes.push({l,r,t,b,score:edge*(1-Math.abs(ratio-.714)*4)+area*15});
 }
 boxes.sort((a,b)=>b.score-a.score);
 const views=[];for(const box of boxes){
  if(views.some(v=>Math.abs(v.box.l-box.l)+Math.abs(v.box.t-box.t)+Math.abs(v.box.r-box.r)+Math.abs(v.box.b-box.b)<14))continue;
  const s=source.width/w;
  views.push({box,canvas:crop(source,box.l*s,box.t*s,(box.r-box.l)*s,(box.b-box.t)*s)});
  if(views.length===3)break;
 }
 const result=views.map(v=>v.canvas);
 // Small framing errors must not force an exact corner fit. Search bounded, card-shaped windows.
 for(const scale of [.80,.86,.92,1]){
  const ch=source.height*scale,cw=ch*.714;
  if(cw>source.width)continue;
  for(const ax of [0,.25,.5,.75,1])for(const ay of [0,.25,.5,.75,1]){
   result.push(crop(source,(source.width-cw)*ax,(source.height-ch)*ay,cw,ch,Math.min(1,160/cw)));
  }
 }
 return [...result,source];
}
export function textRegion(source,area='full',mode='gray'){
 const regions={title:[.12,0,.68,.08],bottom:[0,.78,1,.22],full:[0,0,1,1]};
 const [x,y,w,h]=regions[area],target=area==='bottom'?1800:area==='full'?1100:1300;
 const c=crop(source,x*source.width,y*source.height,w*source.width,h*source.height,target/(source.width*w));
 if(mode==='color')return c;
 const ctx=c.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,c.width,c.height),data=img.data;
 const levels=[];for(let i=0;i<data.length;i+=16)levels.push(.299*data[i]+.587*data[i+1]+.114*data[i+2]);levels.sort((a,b)=>a-b);
 const lo=levels[Math.floor(levels.length*.04)]||0,hi=levels[Math.floor(levels.length*.96)]||255;
 for(let i=0;i<data.length;i+=4){let v=.299*data[i]+.587*data[i+1]+.114*data[i+2];v=mode==='legacy'?Math.max(0,Math.min(255,(v-128)*1.35+128)):Math.max(0,Math.min(255,(v-lo)*255/Math.max(30,hi-lo)));if(mode==='invert')v=255-v;data[i]=data[i+1]=data[i+2]=v;}
 ctx.putImageData(img,0,0);return c;
}
