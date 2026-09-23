"""Produce a clean Pages deployment, an in-app download and GitHub upload ZIP."""
import pathlib,shutil,zipfile,json,hashlib
root=pathlib.Path(__file__).resolve().parents[1]
modules=('index.html','style.css','app.js','matcher.js','visual.js','vision-worker.js','vision-engine.js','recognition.js','scanner.js','imaging.js','manifest.json','sw.js')
folders=('assets','vendor','data')
files=[p for p in root.rglob('*') if p.is_file() and not any(x in ('.git','.cache','site-dist','__pycache__','node_modules') for x in p.relative_to(root).parts) and p.suffix!='.zip' and not p.relative_to(root).as_posix().startswith('data/vision/')]
model=json.loads((root/'vendor/vision/model.json').read_text())
index=json.loads((root/'data/vision-v2/index.json').read_text())
if index['modelSha256']!=model['sha256'] or index['count']<index['catalogCount']*.95:raise RuntimeError('Cannot package an incomplete or mismatched image index')
for item in model['parts']:
 if hashlib.sha256((root/'vendor/vision'/item['file']).read_bytes()).hexdigest()!=item['sha256']:raise RuntimeError('Model checksum mismatch')
if hashlib.sha256((root/'data/vision-v2'/index['file']).read_bytes()).hexdigest()!=index['sha256']:raise RuntimeError('Index checksum mismatch')
parts={p['file'] for p in model['parts']}
files=[p for p in files if not p.name.startswith('MOBILECLIP') and not (p.name.startswith('model-') and p.suffix=='.bin' and p.name not in parts) and not (p.relative_to(root).parts[0]=='tests' and p.name!='recognition.test.js')]
source=root/'PokeLens-source.zip' 
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files:z.write(p,p.relative_to(root))
out=root/'site-dist'
if out.exists():shutil.rmtree(out)
out.mkdir()
for p in files:
 rel=p.relative_to(root)
 if str(rel) in modules or rel.parts[0] in folders:
  target=out/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
shutil.copy2(source,out/source.name);(out/'.nojekyll').touch()
print('Packaged Pages site and source ZIP. Upload source ZIP contents, not the ZIP itself.')
