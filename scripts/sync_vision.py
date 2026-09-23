"""Download only new public card references, then index with all networking denied."""
import concurrent.futures,json,pathlib,subprocess,sys,time,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
catalog=json.loads((ROOT/'data/catalog.json').read_text())['cards']
meta=json.loads((ROOT/'data/vision-v2/index.json').read_text())
indexed=set(meta['ids']);missing=[c for c in catalog if c['id'] not in indexed]
folder=ROOT/'.cache/reference-images';folder.mkdir(parents=True,exist_ok=True)
def download(card):
 target=folder/(str(card['id'])+'.jpg')
 if target.exists():return
 for attempt in range(3):
  try:
   request=urllib.request.Request(card['image'],headers={'User-Agent':'PokeLens/2.0 incremental-card-index'})
   with urllib.request.urlopen(request,timeout=30) as response:data=response.read()
   if len(data)>100:target.write_bytes(data)
   return
  except urllib.error.HTTPError as e:
   if e.code in (403,404):return
   delay=min(60,int(e.headers.get('Retry-After','5'))) if e.code==429 else 2**attempt
   time.sleep(delay)
  except Exception:time.sleep(2**attempt)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(download,missing))
subprocess.run([sys.executable,str(ROOT/'scripts/offline_runtime.py'),str(ROOT/'scripts/build_index.py'),'--images',str(folder)],check=True)
