import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(root, 'public');
const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const accessKey = process.env.APP_ACCESS_KEY || '';
const secret = process.env.SESSION_SECRET || (production ? '' : randomBytes(32).toString('hex'));
const providerUrl = (process.env.AI_BASE_URL || 'https://ollama.com/v1').replace(/\/+$/, '');
const providerKey = process.env.AI_API_KEY || process.env.OLLAMA_API_KEY || '';
const model = process.env.AI_MODEL || 'gemma4:31b-cloud';
const ttl = 7 * 24 * 60 * 60 * 1000;
const limits = new Map();

if (production && (accessKey.length < 12 || !secret || secret.length < 24)) {
  console.error('APP_ACCESS_KEY (at least 12 chars) and SESSION_SECRET (at least 24 chars) are required in production.');
  if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(1);
}

const mimeTypes = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'
};

function send(res, status, payload, more = {}) {
  const isText = typeof payload === 'string';
  const data = isText ? payload : JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...more });
  res.end(data);
}

function secureEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
function sign(payload) { return createHmac('sha256', secret).update(payload).digest('base64url'); }
function cookie(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').map(s => s.trim()).find(s => s.startsWith('titan_session='))?.slice(14) || '';
}
function auth(req) {
  if (!accessKey) return !production;
  const [expiry, nonce, signature] = cookie(req).split('.');
  if (!expiry || !nonce || !signature || !/^\d+$/.test(expiry)) return false;
  if (Number(expiry) < Date.now() || Number(expiry) > Date.now() + ttl) return false;
  return secureEqual(sign(`${expiry}.${nonce}`), signature);
}
function setSession(res) {
  const expiry = String(Date.now()+ttl);
  const payload = `${expiry}.${randomBytes(16).toString('base64url')}`;
  const cookieOptions = `HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttl/1000}${production?'; Secure':''}`;
  res.setHeader('Set-Cookie', `titan_session=${payload}.${sign(payload)}; ${cookieOptions}`);
}
function rateLimit(req, scope, max, interval) {
  const ip = String(req.socket.remoteAddress || 'unknown');
  const key = `${scope}:${ip}`;
  const now = Date.now();
  let entry = limits.get(key);
  if (!entry || entry.until < now) { entry = { count:0,until:now+interval }; limits.set(key, entry); }
  entry.count += 1;
  if (limits.size > 8000) for (const [k,v] of limits) if(v.until < now) limits.delete(k);
  return entry.count <= max;
}
async function bodyJson(req, max=100000) {
  let size = 0; const parts=[];
  for await (const chunk of req) { size += chunk.length; if(size > max) { const e=new Error('Payload muito grande');e.status=413;throw e; }parts.push(chunk); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { const e = new Error('JSON inválido'); e.status=400; throw e; }
}
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host && ['http:','https:'].includes(new URL(origin).protocol); }
  catch { return false; }
}
function headers(res) {
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}
async function staticFile(req, res, pathname) {
  const urlPath = pathname === '/' ? '/index.html' : pathname;
  let decoded;
  try { decoded = decodeURIComponent(urlPath); }
  catch { return send(res,400,{error:'URL inválida'}); }
  const file = resolve(publicRoot, '.'+decoded);
  if (!file.startsWith(publicRoot + sep)) return send(res,403,{error:'Acesso negado'});
  try {
    const s = await stat(file); if(!s.isFile()) return send(res,404,{error:'Não encontrado'});
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream',
      'Cache-Control': extname(file)==='.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(content);
  } catch { send(res,404,{error:'Não encontrado'}); }
}

export function createApp() {
  return http.createServer(async (req,res) => {
    headers(res);
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { return send(res,400,{error:'URL inválida'}); }
    if(req.method === 'OPTIONS') return send(res,405,{error:'Método não permitido'});
    if(req.method === 'POST' && !checkOrigin(req)) return send(res,403,{error:'Origem não autorizada'});
    try {
      if(pathname === '/health' && req.method === 'GET') return send(res,200,{ok:true,service:'TITAN CODE Ultimate'});
      if(pathname === '/api/status' && req.method === 'GET') return send(res,200,{
        authenticated:auth(req),authRequired:!!accessKey||production,aiConfigured:!!providerKey || providerUrl.startsWith('http://localhost:'),
        provider: providerUrl.includes('ollama')?'Ollama / OpenAI-compatible':'OpenAI-compatible',model
      });
      if(pathname === '/api/auth/login' && req.method === 'POST') {
        if(!rateLimit(req,'login',8,15*60*1000)) return send(res,429,{error:'Muitas tentativas. Tente mais tarde.'});
        if(!accessKey && !production) {setSession(res);return send(res,200,{ok:true});}
        const data = await bodyJson(req,1000);
        if(!secureEqual(data.key || '',accessKey)) return send(res,401,{error:'Chave de acesso incorreta.'});
        setSession(res); return send(res,200,{ok:true});
      }
      if(pathname === '/api/auth/logout' && req.method === 'POST') {
        res.setHeader('Set-Cookie',`titan_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict${production?'; Secure':''}`);
        return send(res,200,{ok:true});
      }
      if(pathname === '/api/chat' && req.method === 'POST') {
        if(!auth(req)) return send(res,401,{error:'Faça login para usar a IA.'});
        if(!rateLimit(req,'chat',20,60*1000)) return send(res,429,{error:'Muitas solicitações. Aguarde um minuto.'});
        if(!providerKey && !providerUrl.startsWith('http://localhost:')) return send(res,503,{error:'IA não configurada. Adicione AI_API_KEY ao ambiente do servidor.'});
        const data = await bodyJson(req,220000);
        const messages = data?.messages;
        if (!Array.isArray(messages) || !messages.length || messages.length > 24 || !messages.every(m=>['user','assistant','system'].includes(m.role) && typeof m.content === 'string' && m.content.length <= 30000)) return send(res,400,{error:'Mensagens inválidas ou muito grandes.'});
        if(JSON.stringify(messages).length>125000) return send(res,413,{error:'Contexto muito extenso.'});
        const controller = new AbortController(); const timeout=setTimeout(()=>controller.abort(),45000);
        try {
          const response = await fetch(`${providerUrl}/chat/completions`, {
            method:'POST', signal:controller.signal,
            headers:{'Content-Type':'application/json',...(providerKey?{'Authorization':`Bearer ${providerKey}`}:{})},
            body: JSON.stringify({model,messages:[{role:'system',content:'Você é o TITAN AI, assistente técnico de programação. Responda em português do Brasil, de forma precisa, prática e segura. Quando fornecer código, use blocos Markdown. Não afirme ter executado testes que não realizou.'},...messages],stream:false,temperature:0.3})
          });
          const raw=await response.text(); let json={};try{json=JSON.parse(raw);}catch{}
          if(!response.ok) {
            const upstreamMessage = response.status === 401 ? 'Chave da IA inválida ou sem permissão.' : response.status === 429 ? 'Limite da IA atingido. Verifique seu plano ou tente mais tarde.' : `Provedor indisponível (HTTP ${response.status}).`;
            return send(res,502,{error:upstreamMessage});
          }
          const content=json?.choices?.[0]?.message?.content;
          if(typeof content !== 'string') return send(res,502,{error:'Resposta inesperada do provedor.'});
          return send(res,200,{content,model});
        } catch(e) { return send(res,502,{error:e.name === 'AbortError' ? 'A IA demorou demais para responder.' : 'Não foi possível alcançar o provedor de IA.'}); }
        finally {clearTimeout(timeout);}
      }
      if(pathname.startsWith('/api/')) return send(res,404,{error:'API não encontrada'});
      if(req.method !== 'GET' && req.method !== 'HEAD') return send(res,405,{error:'Método não permitido'});
      return staticFile(req,res,pathname);
    }catch(e) { return send(res,e.status || 500,{error:e.status?e.message:'Erro interno do servidor'}); }
  });
}
if(process.argv[1] === fileURLToPath(import.meta.url)) createApp().listen(port,'0.0.0.0',()=>console.log(`TITAN CODE em http://localhost:${port}`));
