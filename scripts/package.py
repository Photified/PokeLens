"""Create the downloadable source ZIP and a clean GitHub Pages directory."""
import pathlib, shutil, zipfile
root=pathlib.Path(__file__).resolve().parents[1]
source=root/'PokeLens-source.zip'
files=[p for p in root.rglob('*') if p.is_file() and not any(x in ('.git','site-dist','__pycache__','node_modules') for x in p.relative_to(root).parts) and p.suffix!='.zip']
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as z:
 for p in files:z.write(p,p.relative_to(root))
out=root/'site-dist'
if out.exists():shutil.rmtree(out)
out.mkdir()
for name in ('index.html','style.css','app.js','matcher.js','visual.js','manifest.json','sw.js','assets','vendor','data','PokeLens-source.zip'):
 p=root/name
 if p.is_dir():shutil.copytree(p,out/name)
 else:shutil.copy2(p,out/name)
(out/'.nojekyll').touch()
print('Packaged source download and site-dist')
