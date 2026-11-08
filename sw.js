/* CONSELHO · service worker — abre sem internet, sem atrapalhar atualização.
   versao.json nunca é guardado (é o termômetro). A página só entra no cache
   se vier inteira: HTML cortado é pior que nenhum, porque trava pra sempre. */
const VERSAO = '1.0.0';
const CACHE  = 'conselho-v' + VERSAO;
const CASCA = ['./','./index.html','./manifest.webmanifest',
  './icon-192.png','./icon-512.png','./icon-maskable.png'];

async function inteiro(r){
  try{ return /<\/html>\s*$/i.test(await r.clone().text()); }catch(e){ return false; }
}
self.addEventListener('install', ev => ev.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await Promise.all(CASCA.map(async u => {
    try{
      const r = await fetch(u, {cache:'reload'});
      if(!r.ok) return;
      if(/\.html$|\/$/.test(u) && !(await inteiro(r))) return;
      await c.put(u, r);
    }catch(e){}
  }));
  self.skipWaiting();
})()));
self.addEventListener('activate', ev => ev.waitUntil((async () => {
  const ks = await caches.keys();
  await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

const BASE = self.location.pathname.replace(/sw\.js$/, '');
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  if(url.pathname.endsWith('versao.json')){
    ev.respondWith(fetch(req, {cache:'no-store'})); return;
  }
  if(req.mode === 'navigate'){
    if(url.pathname !== BASE && url.pathname !== BASE + 'index.html') return;
    ev.respondWith((async () => {
      const c = await caches.open(CACHE);
      const guardado = await c.match('./index.html', {ignoreSearch:true});
      const rede = fetch(req).then(async r => {
        if(r && r.ok && await inteiro(r)) c.put('./index.html', r.clone());
        return r;
      }).catch(() => null);
      if(guardado && await inteiro(guardado)) return guardado;
      if(guardado) await c.delete('./index.html');
      return (await rede) || new Response(
        '<meta charset="utf-8"><body style="background:#06040E;color:#EDE6FF;font-family:system-ui;'
        + 'padding:40px;text-align:center"><h2>Sem conexão</h2>'
        + '<p>E o conselho ainda não tinha sido guardado inteiro. Abra uma vez com internet.</p>',
        {headers:{'Content-Type':'text/html; charset=utf-8'}});
    })());
    return;
  }
  ev.respondWith((async () => {
    const c = await caches.open(CACHE);
    const g = await c.match(req, {ignoreSearch:true});
    const rede = fetch(req).then(r => { if(r && r.ok) c.put(req, r.clone()); return r; }).catch(()=>null);
    if(g) return g;
    const r = await rede;
    if(r) return r;
    throw new Error('offline e sem cópia');
  })());
});
