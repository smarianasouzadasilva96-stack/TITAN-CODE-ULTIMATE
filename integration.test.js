import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';

async function listen(server) {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return server.address().port;
}
async function freePort() {const temp=createServer();const port=await listen(temp);await new Promise(resolve=>temp.close(resolve));return port;}

// Integration test with a local mock provider; no secrets or paid API calls.
test('production login, authenticated AI relay, and CSRF checks',async t=>{
  let gotAuth='';let gotPrompt='';
  const aiServer=createServer(async(req,res)=>{
    gotAuth=req.headers.authorization;
    let body='';for await (const chunk of req)body+=chunk;
    const json=JSON.parse(body);gotPrompt=json.messages.at(-1).content;
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({choices:[{message:{content:'```js\nconsole.log("Tudo certo!");\n```'}}]}));
  });
  const aiPort=await listen(aiServer);
  t.after(()=>new Promise(resolve=>aiServer.close(resolve)));
  const appPort=await freePort();
  const password='AcessoMuitoForte-2026!';
  const proc=spawn(process.execPath,['server.js'],{
    cwd:new URL('../',import.meta.url),
    env:{...process.env,NODE_ENV:'production',PORT:String(appPort),APP_ACCESS_KEY:password,SESSION_SECRET:'abcdef0123456789'.repeat(4),AI_BASE_URL:`http://127.0.0.1:${aiPort}/v1`,AI_API_KEY:'local-test-secret',AI_MODEL:'local-mock'},
    stdio:['ignore','pipe','pipe']
  });
  t.after(()=>{proc.kill();});
  const base=`http://127.0.0.1:${appPort}`;
  let ready=false;
  for(let i=0;i<60;i++){try{const h=await fetch(base+'/health');if(h.ok){ready=true;break;}}catch{}await sleep(60);}
  assert.equal(ready,true,'server starts in production');
  const status=await (await fetch(base+'/api/status')).json();
  assert.equal(status.authRequired,true);assert.equal(status.authenticated,false);assert.equal(status.aiConfigured,true);
  const input={messages:[{role:'user',content:'Crie um teste de código.'}]};
  const unauthorized=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  assert.equal(unauthorized.status,401);
  const bad=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'incorrect'})});
  assert.equal(bad.status,401);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:password})});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.match(cookie,/^titan_session=/);
  const chat=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json','Cookie':cookie},body:JSON.stringify(input)});
  assert.equal(chat.status,200);const answer=await chat.json();assert.match(answer.content,/Tudo certo/);
  assert.equal(gotAuth,'Bearer local-test-secret');assert.equal(gotPrompt,'Crie um teste de código.');
  const csrf=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://malicioso.invalid','Cookie':cookie},body:JSON.stringify(input)});
  assert.equal(csrf.status,403);
  const contents=await (await fetch(base+'/')).text();assert.doesNotMatch(contents,/local-test-secret/);
});
