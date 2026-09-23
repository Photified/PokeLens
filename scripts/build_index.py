"""Incrementally build the independent whole-catalog DINOv2 image index.
Run after sync_catalog.py. Existing indexed rows are reused; only new images are fetched.
Dependencies: numpy, pillow, onnxruntime. No per-scan service or API key.
"""
import argparse, concurrent.futures, hashlib, io, json, pathlib, time, urllib.request
import numpy as np
from PIL import Image, ImageOps
import onnxruntime as ort
ort.disable_telemetry_events()
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--images',type=pathlib.Path);parser.add_argument('--watch',action='store_true');args=parser.parse_args()
 out=ROOT/'data/vision-v2';out.mkdir(parents=True,exist_ok=True)
 modelmeta=json.loads((ROOT/'vendor/vision/model.json').read_text());dim=modelmeta['dimensions'];size=modelmeta['size']
 cache=ROOT/'.cache/vision'/modelmeta['sha256'];cache.mkdir(parents=True,exist_ok=True)
 cards=json.loads((ROOT/'data/catalog.json').read_text())['cards']; ids={c['id']:c for c in cards}
 old={}
 if (out/'index.json').exists():
  meta=json.loads((out/'index.json').read_text());assert meta['modelSha256']==modelmeta['sha256'];raw=np.frombuffer((out/meta['file']).read_bytes(),np.int8).reshape(-1,dim)
  old={int(k):raw[i].copy() for i,k in enumerate(meta['ids']) if int(k) in ids}
 modelmeta=json.loads((ROOT/'vendor/vision/model.json').read_text());model=b''.join((ROOT/'vendor/vision'/p['file']).read_bytes() for p in modelmeta['parts'])
 if hashlib.sha256(model).hexdigest()!=modelmeta['sha256']:raise ValueError('Model checksum mismatch')
 so=ort.SessionOptions();so.intra_op_num_threads=1;so.inter_op_num_threads=1
 session=ort.InferenceSession(model,so,providers=['CPUExecutionProvider']);del model
 def embed(c):
  key=c['id'];p=cache/(str(key)+'.npy')
  if p.exists():return key,np.load(p)
  try:
   if args.images:
    f=args.images/(str(key)+'.jpg')
    if not f.exists():return key,None
    data=f.read_bytes()
   else:
    for attempt in range(3):
     try:
      req=urllib.request.Request(c['image'],headers={'User-Agent':'PokeLens/2.0 catalog-index'})
      with urllib.request.urlopen(req,timeout=30) as response:data=response.read()
      break
     except Exception:
      if attempt==2:raise
      time.sleep(2*(attempt+1))
   im=ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB').resize((size,size),Image.Resampling.BILINEAR)
   a=np.array(im,dtype=np.float32)/255
   a=(a-np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)
   x=a.transpose(2,0,1)[None]
   v=session.run(None,{'pixel_values':x})[0][0,0]
   if not np.all(np.isfinite(v)) or np.linalg.norm(v)==0:raise ValueError('Invalid embedding')
   q=np.clip(np.round(v*127/np.max(np.abs(v))),-127,127).astype('int8');np.save(p,q)
   return key,q
  except Exception as e:
   print('Unavailable image',key,type(e).__name__,flush=True);return key,None
 def save():
  keys=sorted(old);b=np.stack([old[k] for k in keys]).astype('int8').tobytes() if keys else b''
  tmp=out/'embeddings.tmp';tmp.write_bytes(b);tmp.replace(out/'embeddings.bin')
  meta={'version':1,'modelSha256':modelmeta['sha256'],'dimensions':dim,'encoding':'int8-per-row-normalized','file':'embeddings.bin','sha256':hashlib.sha256(b).hexdigest(),'count':len(keys),'catalogCount':len(cards),'ids':keys,'missing':[k for k in ids if k not in old]}
  tmp=out/'index.tmp';tmp.write_text(json.dumps(meta,separators=(',',':')));tmp.replace(out/'index.json')
 started=time.time()
 while True:
  pending=[c for k,c in ids.items() if k not in old and (not args.images or (args.images/(str(k)+'.jpg')).exists())]
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
   for n,(key,q) in enumerate(pool.map(embed,pending),1):
    if q is not None:old[key]=q
    if n%250==0:save();print('Indexed',len(old),'/',len(cards),'seconds',round(time.time()-started),flush=True)
  save();print('Saved',len(old),'of',len(cards),'references',flush=True)
  if not args.watch or len(old)==len(cards):break
  time.sleep(10)
 if len(old)<len(cards)*.95:raise RuntimeError('Image index incomplete: fewer than 95% of catalog listings indexed')
if __name__=='__main__':main()
