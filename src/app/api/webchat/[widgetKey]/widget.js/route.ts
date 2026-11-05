import { channelDisabledResponse, isChannelEnabled } from "@/server/channels/enabled";
import { findWebchatByKey } from "@/server/webchat/config";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ widgetKey: string }> }) {
  if (!isChannelEnabled("webchat")) return channelDisabledResponse();
  const { widgetKey } = await params;
  const found = await findWebchatByKey(widgetKey);
  if (!found) return new Response("/* widget no encontrado */", { status: 404 });
  const config = JSON.stringify({ key: widgetKey, name: found.config.name, greeting: found.config.greeting, color: found.config.color });
  const source = `(() => {
    const config = ${config};
    const api = new URL('/api/webchat/' + encodeURIComponent(config.key) + '/messages', document.currentScript.src).toString();
    const storageKey = 'vocero-webchat-' + config.key;
    let visitorId = crypto.randomUUID();
    try { visitorId = localStorage.getItem(storageKey) || visitorId; localStorage.setItem(storageKey, visitorId); } catch (_) {}
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
    const style = document.createElement('style');
    style.textContent = ':host{all:initial;font-family:Inter,system-ui,sans-serif;color:#17211d}*{box-sizing:border-box}.launch{position:fixed;z-index:2147483000;right:22px;bottom:22px;border:0;border-radius:999px;background:'+config.color+';color:#fff;padding:14px 19px;font-size:15px;font-weight:650;box-shadow:0 8px 28px #0003;cursor:pointer}.panel{position:fixed;z-index:2147483000;right:22px;bottom:82px;width:min(360px,calc(100vw - 28px));height:min(500px,calc(100dvh - 112px));display:none;overflow:hidden;border:1px solid #e5e9e7;border-radius:18px;background:#fff;box-shadow:0 16px 55px #0003}.panel.open{display:flex;flex-direction:column}.head{padding:17px 18px;background:'+config.color+';color:white;font-weight:700}.close{float:right;border:0;background:transparent;color:white;font-size:22px;cursor:pointer}.messages{flex:1;overflow:auto;padding:14px;background:#f7f9f8}.bubble{max-width:85%;width:max-content;padding:10px 12px;margin:7px 0;border-radius:13px;background:white;font-size:14px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.out{margin-left:auto;background:#e8f4ed}.form{display:flex;gap:8px;padding:12px;border-top:1px solid #edf0ee}.form textarea{flex:1;resize:none;border:1px solid #d8dfdb;border-radius:11px;padding:10px;font:inherit;font-size:14px}.send{border:0;border-radius:11px;background:'+config.color+';color:white;padding:0 14px;font-weight:650;cursor:pointer}.send:disabled{opacity:.55}';
    shadow.appendChild(style);
    const button = document.createElement('button'); button.className='launch'; button.textContent='Chatear'; button.setAttribute('aria-label','Abrir chat');
    const panel = document.createElement('section'); panel.className='panel';
    const head = document.createElement('div'); head.className='head'; head.textContent=config.name;
    const close = document.createElement('button'); close.className='close'; close.textContent='×'; close.setAttribute('aria-label','Cerrar chat'); head.appendChild(close);
    const messages = document.createElement('div'); messages.className='messages';
    const notice = document.createElement('p'); notice.setAttribute('role','status'); notice.style.cssText='margin:0;padding:0 12px 8px;color:#a52828;font:12px system-ui,sans-serif';
    const form = document.createElement('form'); form.className='form';
    const input = document.createElement('textarea'); input.rows=1; input.maxLength=4000; input.placeholder='Escribe tu mensaje…'; input.setAttribute('aria-label','Escribe tu mensaje');
    const send = document.createElement('button'); send.className='send'; send.textContent='Enviar';
    form.append(input,send); panel.append(head,messages,notice,form); shadow.append(button,panel);
    let seen = new Set(); let greeted = false;
    function paint(items) { for (const item of items) { if(seen.has(item.id)) continue; seen.add(item.id); const bubble=document.createElement('div'); bubble.className='bubble '+(item.direction==='out'?'out':'in'); bubble.textContent=item.text||''; messages.appendChild(bubble); } messages.scrollTop=messages.scrollHeight; }
    async function refresh() { try { const r=await fetch(api+'?visitorId='+encodeURIComponent(visitorId)); if(r.ok){const d=await r.json(); paint(d.messages||[]);} } catch (_) {} }
    let timer;
    button.onclick=()=>{panel.classList.add('open');button.style.display='none';if(!greeted){greeted=true;const b=document.createElement('div');b.className='bubble';b.textContent=config.greeting;messages.appendChild(b);} void refresh();timer=setInterval(refresh,2500);input.focus();};
    close.onclick=()=>{panel.classList.remove('open');button.style.display='block';clearInterval(timer);};
    form.onsubmit=async e=>{e.preventDefault();const text=input.value.trim();if(!text)return;send.disabled=true;notice.textContent='';const clientMessageId=crypto.randomUUID();input.value='';try{const r=await fetch(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({visitorId,text,clientMessageId})});if(!r.ok)throw new Error();await refresh();}catch(_){input.value=text;notice.textContent='No se pudo enviar. Intenta de nuevo.';}finally{send.disabled=false;input.focus();}};
  })();`;
  return new Response(source, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300" } });
}
