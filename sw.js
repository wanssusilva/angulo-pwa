const CACHE='angulo-v1.1.1';
const APP=['./','./index.html','./style.css','./app.js','./analysis.js','./manifest.webmanifest','./icons/icon-192.svg','./icons/icon-512.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('angulo-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!APP.includes(url.pathname.replace(/^.*\//,'./')))return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
