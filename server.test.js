import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.js';

async function start() {
  const app=createApp();
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  const addr=app.address();
  return {url:`http://127.0.0.1:${addr.port}`,stop:()=>new Promise(resolve=>app.close(resolve))};
}
test('home page, health, and static paths',async()=>{
  const s=await start();try {
    const health=await fetch(`${s.url}/health`); assert.equal(health.status,200);assert.equal((await health.json()).ok,true);
    const home=await fetch(s.url);assert.equal(home.status,200);assert.match(await home.text(),/TITAN CODE/);
    const bad=await fetch(`${s.url}/%2e%2e/%2e%2e/server.js`);assert.notEqual(bad.status,200);
  }finally{await s.stop();}
});
test('AI errors when not configured and payload protections',async()=>{
  const s=await start();try{
    const status=await (await fetch(`${s.url}/api/status`)).json();assert.equal(typeof status.authenticated,'boolean');
    const resp=await fetch(`${s.url}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'olá'}]})});
    assert.equal(resp.status,503);
    const bad=await fetch(`${s.url}/api/auth/login`,{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
    assert.equal(bad.status,403);
  }finally{await s.stop();}
});
