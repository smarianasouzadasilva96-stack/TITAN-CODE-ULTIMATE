const CACHE='titan-ultimate-v3-20261117';
const ROOT=new URL('./',self.location.href).pathname;
const FILES=['','index.html','styles.css','app.js','icon.svg','manifest.webmanifest'].map(path=>ROOT+path);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname==='/health')return;event.respondWith(fetch(request).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return resp;}).catch(()=>caches.match(request).then(r=>r||caches.match(ROOT+'index.html'))));});
