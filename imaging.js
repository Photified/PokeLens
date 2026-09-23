// Card geometry is found independently of text, then flattened before recognition.
let cvPromise;
export function getCV(){
 if(!cvPromise)cvPromise=new Promise((resolve,reject)=>{
  if(window.cv){Promise.resolve(window.cv).then(resolve,reject);return;}
  const script=document.createElement('script');script.src=new URL('./vendor/vision/opencv.js',import.meta.url).href;
  script.onload=()=>Promise.resolve(window.cv).then(resolve,reject);script.onerror=()=>reject(new Error('Card detector could not load. Reconnect and retry.'));document.head.append(script);
 }).catch(e=>{cvPromise=null;throw e;});return cvPromise;
}
export function crop(source,x,y,w,h,scale=1){
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));
 const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(source,x,y,w,h,0,0,c.width,c.height);return c;
}
function ordered(points){const sum=p=>p.x+p.y,diff=p=>p.y-p.x;return [points.reduce((a,b)=>sum(a)<sum(b)?a:b),points.reduce((a,b)=>diff(a)<diff(b)?a:b),points.reduce((a,b)=>sum(a)>sum(b)?a:b),points.reduce((a,b)=>diff(a)>diff(b)?a:b)];}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export async function cardViews(source){
 if(Math.max(source.width,source.height)>2000)source=crop(source,0,0,source.width,source.height,2000/Math.max(source.width,source.height));
 const cv=await getCV(),scale=Math.min(1,640/Math.max(source.width,source.height)),probe=crop(source,0,0,source.width,source.height,scale);
 const src=cv.imread(probe),gray=new cv.Mat(),rgb=new cv.Mat(),hsv=new cv.Mat(),sat=new cv.Mat(),blur=new cv.Mat(),mask=new cv.Mat(),closed=new cv.Mat(),kernel=cv.Mat.ones(5,5,cv.CV_8U),quads=[];
 try{
  cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);
  cv.cvtColor(src,rgb,cv.COLOR_RGBA2RGB);cv.cvtColor(rgb,hsv,cv.COLOR_RGB2HSV);const channels=new cv.MatVector();cv.split(hsv,channels);const saturation=channels.get(1);saturation.copyTo(sat);saturation.delete();channels.delete();
  const collect=()=>{
   const contours=new cv.MatVector(),hierarchy=new cv.Mat();
   try{cv.morphologyEx(mask,closed,cv.MORPH_CLOSE,kernel);cv.findContours(closed,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    for(let i=0;i<contours.size();i++){const contour=contours.get(i),poly=new cv.Mat();
     try{cv.approxPolyDP(contour,poly,.025*cv.arcLength(contour,true),true);if(poly.rows!==4||!cv.isContourConvex(poly))continue;
      const area=Math.abs(cv.contourArea(poly))/(probe.width*probe.height);if(area<.18||area>.97)continue;
      const pts=[];for(let j=0;j<4;j++)pts.push({x:poly.data32S[j*2],y:poly.data32S[j*2+1]});const q=ordered(pts);
      if(new Set(q).size!==4)continue;
      const width=(dist(q[0],q[1])+dist(q[3],q[2]))/2,height=(dist(q[0],q[3])+dist(q[1],q[2]))/2,ratio=width/height;
      if(ratio<.55||ratio>.88||quads.some(p=>q.reduce((n,v,j)=>n+dist(v,p.q[j]),0)/4<9))continue;
      quads.push({q,score:area*(1-Math.abs(ratio-5/7))});
     }finally{contour.delete();poly.delete();}
    }
   }finally{contours.delete();hierarchy.delete();}
  };
  for(const [lo,hi] of [[30,90],[70,180]]){cv.Canny(blur,mask,lo,hi);collect();}
  for(const channel of [blur,sat])for(const threshold of [40,80,120,160,200]){cv.threshold(channel,mask,threshold,255,cv.THRESH_BINARY);collect();}
  quads.sort((a,b)=>b.score-a.score);
  const views=[],original=cv.imread(source);
  try{for(const {q} of quads.slice(0,3)){
   const points=q.map(p=>({x:p.x/scale,y:p.y/scale})),h=Math.min(1600,Math.round(Math.max(dist(points[0],points[3]),dist(points[1],points[2])))),w=Math.round(h*5/7);
   const a=cv.matFromArray(4,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y])),b=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,w-1,0,w-1,h-1,0,h-1]),matrix=cv.getPerspectiveTransform(a,b),warped=new cv.Mat();
   try{cv.warpPerspective(original,warped,matrix,new cv.Size(w,h),cv.INTER_LINEAR,cv.BORDER_REPLICATE);const c=document.createElement('canvas');cv.imshow(c,warped);views.push(c);}finally{a.delete();b.delete();matrix.delete();warped.delete();}
  }}finally{original.delete();}
  // Bounded framing alternatives recover clear cards whose sleeve merges with the background.
  // All views retain source detail; they are not tiny thumbnails fed to OCR.
  for(const size of [.80,.92]){
   const h=Math.min(source.height,source.width*7/5)*size,w=h*5/7;
   for(const anchor of [.18,.65])views.push(crop(source,(source.width-w)/2,(source.height-h)*anchor,w,h));
  }
  views.push(source);return views;
 }finally{for(const m of [src,gray,rgb,hsv,sat,blur,mask,closed,kernel])m.delete();}
}
export function textRegion(source,area='full',mode='color'){
 const regions={title:[.10,.005,.72,.10],header:[0,0,1,.19],bottom:[0,.77,1,.23],full:[0,0,1,1]};const [x,y,w,h]=regions[area];
 const target=area==='full'?Math.min(1300,Math.max(800,source.width)):area==='title'?850:1100;
 const c=crop(source,x*source.width,y*source.height,w*source.width,h*source.height,target/(source.width*w));
 if(mode==='color')return pad(c);
 const ctx=c.getContext('2d',{willReadFrequently:true}),im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
 for(let i=0;i<d.length;i+=4){const v=.299*d[i]+.587*d[i+1]+.114*d[i+2];d[i]=d[i+1]=d[i+2]=Math.max(0,Math.min(255,(v-128)*1.4+128));}ctx.putImageData(im,0,0);return pad(c);
}

function pad(source){const c=document.createElement('canvas');c.width=source.width+32;c.height=source.height+32;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,16,16);return c;}
