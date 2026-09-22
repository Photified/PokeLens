const CACHE='pokelens-v1.2.0';
const BASE=new URL('./',self.location.href).href;
const FILES=['./','./index.html','./style.css','./app.js','./matcher.js','./visual.js','./imaging.js','./manifest.json','./assets/icon-192.png','./assets/icon-512.png','./vendor/tesseract.min.js','./vendor/worker.min.js','./vendor/tesseract-core-lstm.wasm.js','./vendor/tesseract-core-simd-lstm.wasm.js','./vendor/best/eng.traineddata.gz','./data/catalog.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pokelens-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||!u.href.startsWith(BASE)||u.pathname.endsWith('.zip'))return;
 const immutable=u.pathname.includes('/vendor/')||u.pathname.includes('/assets/');
 e.respondWith((async()=>{
   const cache=await caches.open(CACHE),old=await cache.match(e.request);
   if(immutable&&old)return old;
   try{const response=await fetch(e.request);if(response.ok)await cache.put(e.request,response.clone());return response.ok||!old?response:old;}catch{if(old)return old;throw new Error('Offline file unavailable');}
 })());
});
