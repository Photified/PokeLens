const CACHE='pokelens-v2.0.0';
const BASE=new URL('./',self.location.href).href;
const FILES=['./','./index.html','./style.css','./app.js','./matcher.js','./visual.js','./vision-worker.js','./vision-engine.js','./recognition.js','./scanner.js','./imaging.js','./manifest.json','./assets/icon-192.png','./assets/icon-512.png','./vendor/tesseract.min.js','./vendor/worker.min.js','./vendor/tesseract-core-lstm.wasm.js','./vendor/tesseract-core-simd-lstm.wasm.js','./vendor/vision/model.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pokelens-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||!url.href.startsWith(BASE)||url.pathname.endsWith('.zip'))return;
 const immutable=url.pathname.includes('/vendor/')||url.pathname.includes('/assets/')||url.searchParams.has('v');
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),old=await cache.match(event.request);
  if(immutable&&old)return old;
  try{const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response.ok||!old?response:old;}
  catch(error){if(old)return old;throw error;}
 })());
});
