const CACHE='tetemaru-shell-native-family-v53';
const base=new URL('./',self.location.href);
const files=['index.html', 'trial.html', 'native-entry.js', 'styles.css', 'child.html', 'child-ui.js', 'child-study.js', 'parent.html', 'parent-screen.js', 'study-log.html', 'zip-log.js', 'zip-records.js', 'store.js', 'pin-kdf.js', 'data.js', 'demo.js', 'voice.js', 'viewer.js', 'greeting.js', 'character-motion.js', 'GLTFLoader.js', 'BufferGeometryUtils.js', 'three.module.js', 'pink-pal.glb', 'pink-light.bin', 'friend-front.png', 'timer.html', 'sample-parent.html', 'sample-log.html', 'trial-data.js'];
files.push('vendor/interaction.js','demo-topics.js','affinity.js','autofill.js','goal-picker.js');
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);await cache.addAll(files.map(f=>new Request(new URL(f,base),{cache:'reload'})));await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('tetemaru-shell-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
 const path=url.pathname.slice(base.pathname.length)||'index.html';
 if(files.includes(path)){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   return await cache.match(new URL(path,base))||fetch(event.request);
  })());
 }
});
