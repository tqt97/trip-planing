const CACHE='dalat-planner-v2.9.8';
const PREFIX='dalat-planner-';
const CORE=['/','/index.html','/styles.css','/app.js','/favicon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(async keys=>{
  const upgrading=keys.some(key=>key.startsWith(PREFIX)&&key!==CACHE);
  await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
  if(upgrading){const clients=await self.clients.matchAll({type:'window'});await Promise.all(clients.map(client=>client.navigate(client.url)));}
})));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  const url=new URL(req.url);
  if(url.pathname.startsWith('/api/')){event.respondWith(fetch(req).catch(()=>caches.match(req)));return;}
  event.respondWith(fetch(req).then(res=>{
    if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}
    return res;
  }).catch(async()=>{
    const cached=await caches.match(req);
    if(cached)return cached;
    if(req.mode==='navigate')return caches.match('/index.html');
    throw new Error('offline-cache-miss');
  }));
});
