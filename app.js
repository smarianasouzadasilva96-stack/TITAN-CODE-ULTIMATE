(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const storageKey = 'titan-code:projects:v3';
  const settingsKey = 'titan-code:settings:v3';
  const encoder = new TextEncoder();
  let projects = [], activeId = '', status = null, currentPage = 'studio';
  let savingTimer = null, previewTimer = null, chatBusy = false, chatHistory = [];
  let dialogCallback = null;
  let settings = { theme:'dark', autoPreview:true };

  const templates = {
    web: {
      'index.html': `<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Meu projeto TITAN</title>\n</head>\n<body>\n  <main class="container">\n    <div class="badge">✦ Feito no TITAN CODE</div>\n    <h1>Seu próximo grande projeto começa aqui.</h1>\n    <p>Edite o HTML, o CSS e o JavaScript para criar algo único.</p>\n    <button id="hello">Começar agora →</button>\n    <p id="feedback"></p>\n  </main>\n  <script src="script.js"><\/script>\n</body>\n</html>`,
      'style.css': `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');\n:root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, #28215c, #080d1b 68%); color: white; }\n.container { padding: 38px; width: min(580px, 100%); text-align: center; }\n.badge { display: inline-block; padding: 9px 15px; border: 1px solid #7259bf; background: #2e225f; color: #d6c7ff; border-radius: 99px; font-size: 12px; }\nh1 { font-size: clamp(29px, 5vw, 48px); line-height: 1.1; letter-spacing: -2px; }\np { color: #b0bad1; line-height: 1.75; }\nbutton { padding: 14px 21px; background: #9069f5; border: 0; border-radius: 9px; color: white; font-weight: 750; cursor: pointer; }\n#feedback { color: #a6efcd; }`,
      'script.js': `const button = document.querySelector('#hello');\nbutton?.addEventListener('click', () => {\n  document.querySelector('#feedback').textContent = 'Pronto! Agora é com você. 🚀';\n});`
    },
    landing: {
      'index.html': `<!doctype html>\n<html lang="pt-BR">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nova marca</title></head>\n<body>\n<nav><strong>ORBIT ✦</strong><a href="#sobre">Sobre</a><a href="#contato">Contato</a></nav>\n<section class="hero"><span class="label">IDEIAS QUE VIRAM REALIDADE</span><h1>Crie o futuro.<br><em>Hoje.</em></h1><p>Um espaço para seus próximos grandes projetos e ideias.</p><a class="cta" href="#contato">Vamos começar →</a></section>\n<section id="sobre"><h2>Feito para impressionar.</h2><p>Personalize esta página com suas cores, textos e imagens.</p></section>\n<footer id="contato">Feito com TITAN CODE · 2026</footer>\n</body></html>`,
      'style.css': `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:system-ui,Arial,sans-serif;background:#0a1021;color:#fff}nav{display:flex;align-items:center;gap:21px;padding:23px 7%;border-bottom:1px solid #273149}nav strong{font-size:22px;margin-right:auto;color:#aa8aff}nav a{color:#b2bad0;text-decoration:none;font-size:13px}.hero{padding:110px 7% 120px;background:radial-gradient(circle at 85% 5%,#46357b,transparent 55%)}.label{color:#b2a3ff;font-size:11px;letter-spacing:3px}.hero h1{font-size:clamp(50px,9vw,104px);line-height:1;letter-spacing:-4px;margin:23px 0}.hero em{color:#9c83ff;font-style:normal}.hero p{color:#aebbd2;font-size:18px;line-height:1.6}.cta{display:inline-block;margin-top:23px;padding:15px 23px;color:white;background:#7e61e5;text-decoration:none;border-radius:9px;font-weight:700}#sobre{padding:95px 7%;background:#111a31}#sobre h2{font-size:33px}#sobre p,footer{color:#a8b4cb}footer{padding:28px 7%;font-size:12px}`
    },
    luau: {
      'main.luau': `-- Script inicial de Luau para Roblox Studio\n-- Cole em um Script no Roblox Studio para testar.\n\nlocal Players = game:GetService("Players")\n\nlocal function cumprimentar(jogador)\n    print("Bem-vindo(a), " .. jogador.Name .. "!")\nend\n\nPlayers.PlayerAdded:Connect(cumprimentar)\n\n-- Dica: Luau é editado aqui, mas executado no Roblox Studio.`,
      'README.md': `# Meu projeto Luau\n\nUse o TITAN CODE para escrever seu script e exportar os arquivos.\nPara executar Luau, abra o Roblox Studio; a prévia web não o executa.`
    },
    python: {
      'main.py': `# Projeto Python criado com TITAN CODE\n\ndef saudacao(nome: str) -> str:\n    return f"Olá, {nome}! Seu projeto está pronto."\n\nif __name__ == "__main__":\n    print(saudacao("desenvolvedor"))\n`,
      'README.md': `# Projeto Python\n\nEdite aqui e exporte os arquivos.\nPara executar Python, use um ambiente com Python instalado.`
    }
  };

  function uid(){ return 'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8); }
  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function makeProject(name='Meu primeiro projeto',type='web') {
    const files=clone(templates[type]||templates.web);
    return {id:uid(),name,files,active:Object.keys(files)[0],updated:Date.now()};
  }
  function validateProject(obj) {
    return !!(obj && typeof obj.id==='string' && typeof obj.name==='string' && obj.name.length<=80 && obj.files && typeof obj.files==='object' && !Array.isArray(obj.files) && Object.entries(obj.files).length<=250 && Object.entries(obj.files).every(([name,code])=>validFilename(name) && typeof code==='string' && code.length<1500000));
  }
  function validFilename(name) {return typeof name==='string' && /^[\w./ -]{1,130}$/.test(name) && !name.startsWith('/') && !name.includes('..') && !name.includes('\\') && !name.endsWith('/');}
  function safeLocalGet(key){try{return localStorage.getItem(key);}catch{return null;}}
  function safeLocalSet(key,data){try{localStorage.setItem(key,data);return true;}catch{toast('O armazenamento está indisponível ou cheio. Exporte seu projeto.','error');return false;}}
  function initialize() {
    try { const stored=JSON.parse(safeLocalGet(storageKey)||'[]'); projects=Array.isArray(stored)?stored.filter(validateProject).slice(0,100):[]; } catch { projects=[]; }
    if(!projects.length) projects=[makeProject()];
    try { const saved=JSON.parse(safeLocalGet(settingsKey)||'{}'); settings={...settings,...(saved && typeof saved==='object'?saved:{})}; } catch{}
    const last=safeLocalGet('titan-code:active:v3');activeId=projects.some(p=>p.id===last)?last:projects[0].id;
    document.body.classList.toggle('light',settings.theme==='light');$('autoPreviewCheck').checked=!!settings.autoPreview;
    save(true); bindEvents(); renderAll(); refreshStatus(); registerOffline();
  }
  const activeProject = () => projects.find(p=>p.id===activeId) || projects[0];
  const activeName = () => activeProject()?.active || '';
  function save(silent=false) {
    clearTimeout(savingTimer);
    const p=activeProject(); if(p) p.updated=Date.now();
    const ok=safeLocalSet(storageKey,JSON.stringify(projects));
    safeLocalSet('titan-code:active:v3',activeId);
    if($('saveStatus'))$('saveStatus').textContent=ok?'Salvo automaticamente':'Erro ao salvar';
    if(!silent && $('editorStatus')) $('editorStatus').textContent=ok?'Tudo salvo':'Armazenamento indisponível';
  }
  function scheduleSave() {
    $('saveStatus').textContent='Salvando...'; $('editorStatus').textContent='Editando';
    clearTimeout(savingTimer); savingTimer=setTimeout(()=>save(),420);
  }
  function ext(name){return (name.split('.').pop()||'txt').toLowerCase();}
  const langNames={html:'HTML',css:'CSS',js:'JavaScript',ts:'TypeScript',json:'JSON',md:'Markdown',py:'Python',lua:'Lua',luau:'Luau',txt:'Texto',sql:'SQL',java:'Java',cpp:'C++',c:'C',cs:'C#',sh:'Shell',xml:'XML',svg:'SVG'};
  function fileIcon(name){const e=ext(name);return {html:'◇',css:'#',js:'JS',ts:'TS',json:'{}',py:'Py',lua:'Lu',luau:'Lu',md:'M↓',sql:'DB'}[e]||'<> '}
  function renderAll(){renderProjectHeader();renderFiles();renderEditor();renderProjects();runPreview();updateChatContext();}
  function renderProjectHeader(){const p=activeProject();$('projectHeading').textContent=p.name;$('folderName').textContent=p.name.toUpperCase();$('fileCount').textContent=`${Object.keys(p.files).length} arquivos`;}
  function renderFiles(){
    const p=activeProject(),list=$('fileList'),tabs=$('codeTabs');list.replaceChildren();tabs.replaceChildren();
    for(const name of Object.keys(p.files)) {
      const f=document.createElement('button');f.className='file-entry'+(name===p.active?' selected':'');f.type='button'; f.title=name;
      const i=document.createElement('span');i.className='file-symbol '+ext(name);i.textContent=fileIcon(name);
      const text=document.createElement('span');text.className='file-name';text.textContent=name;f.append(i,text);f.addEventListener('click',()=>selectFile(name));list.append(f);
      const tab=document.createElement('button');tab.className='file-tab'+(name===p.active?' active':'');tab.type='button';const s=document.createElement('span');s.className='file-symbol '+ext(name);s.textContent=fileIcon(name);const label=document.createElement('span');label.textContent=name;tab.append(s,label);tab.addEventListener('click',()=>selectFile(name));tabs.append(tab);
    }
  }
  function selectFile(name){const p=activeProject();if(!(name in p.files))return;saveEditor();p.active=name;renderFiles();renderEditor();updateChatContext();save(true);}
  function saveEditor(){const p=activeProject();if(p?.active && Object.hasOwn(p.files,p.active))p.files[p.active]=$('codeEditor').value;}
  function renderEditor(){const p=activeProject();$('codeEditor').value=p.files[p.active]||'';$('languageName').textContent=langNames[ext(p.active)]||'Texto';$('chatFileName').textContent=p.active;highlight();updateCursor();}
  function escapeHTML(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function highlight(){
    const src=$('codeEditor').value;const pre=$('syntaxView');
    const keyword=/\b(?:const|let|var|function|return|if|else|for|while|class|import|from|export|default|new|true|false|null|undefined|async|await|try|catch|finally|throw|print|local|then|end|repeat|until|do|def|None|True|False|self|public|private|static|void|int|string|echo|SELECT|FROM|WHERE|INSERT|INTO|CREATE|TABLE)\b/;
    const rx=/(<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[A-Za-z][\w:-]*|\b(?:const|let|var|function|return|if|else|for|while|class|import|from|export|default|new|true|false|null|undefined|async|await|try|catch|finally|throw|print|local|then|end|repeat|until|do|def|None|True|False|self|public|private|static|void|int|string|echo|SELECT|FROM|WHERE|INSERT|INTO|CREATE|TABLE)\b|\b\d+(?:\.\d+)?\b)/g;
    let result='',i=0,m;let tokens=0;
    while((m=rx.exec(src))!==null && tokens++<4500){ result+=escapeHTML(src.slice(i,m.index));const x=m[0];let cls='tok-num';if(x.startsWith('/*')||x.startsWith('//')||x.startsWith('#')||x.startsWith('<!--'))cls='tok-comment';else if(['"',"'",'`'].includes(x[0]))cls='tok-string';else if(x.startsWith('<'))cls='tok-tag';else if(keyword.test(x))cls='tok-key';result+=`<span class="${cls}">${escapeHTML(x)}</span>`;i=rx.lastIndex; }
    result+=escapeHTML(src.slice(i));pre.innerHTML=result+'\n';
    const lines=src.split('\n').length;$('lineNumbers').textContent=Array.from({length:Math.min(20000,lines)},(_,j)=>j+1).join('\n');$('lineCount').textContent=`${lines} linha${lines===1?'':'s'}`;
    pre.scrollTop=$('codeEditor').scrollTop;pre.scrollLeft=$('codeEditor').scrollLeft;
  }
  function updateCursor(){const editor=$('codeEditor'),index=editor.selectionStart;const before=editor.value.slice(0,index),lines=before.split('\n');$('cursorPos').textContent=`Ln ${lines.length}, Col ${lines.at(-1).length+1}`;}
  function onEditorChange(){const p=activeProject();p.files[p.active]=$('codeEditor').value;highlight();updateCursor();scheduleSave();if(settings.autoPreview){clearTimeout(previewTimer);previewTimer=setTimeout(runPreview,620);}}
  function onEditorKeydown(e){
    if(e.key==='Tab'){e.preventDefault();const ed=$('codeEditor'),start=ed.selectionStart,end=ed.selectionEnd;
      if(e.shiftKey){const prefix=ed.value.slice(0,start);const lineStart=prefix.lastIndexOf('\n')+1;if(ed.value.slice(lineStart,lineStart+2)==='  '){ed.setRangeText('',lineStart,lineStart+2,'end');}}else{ed.setRangeText('  ',start,end,'end');}onEditorChange();}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();toast('Projeto salvo.');}
    if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();runPreview();toast('Prévia atualizada.');}
  }
  function runPreview(){
    const p=activeProject(),files=p.files;
    const names=Object.keys(files);const htmlName=names.find(f=>ext(f)==='html');
    const css=names.filter(f=>ext(f)==='css').map(f=>`/* ${f} */\n${files[f]}`).join('\n');
    const js=names.filter(f=>ext(f)==='js').map(f=>`// ${f}\n${files[f]}`).join('\n');
    const canPreview=!!(htmlName||css||js);
    $('previewEmpty').hidden=canPreview;
    $('previewFrame').hidden=!canPreview;
    if(!canPreview){$('previewFrame').removeAttribute('srcdoc');$('previewMeta').textContent='Somente edição';return;}
    let html=htmlName?files[htmlName]:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>';
    const cssSafe=css.replace(/<\/style/gi,'<\\/style');
    const jsSafe=js.replace(/<\/script/gi,'<\\/script');
    const style=`<style>${cssSafe}</style>`;
    const script=`<script>${jsSafe}<\/script>`;
    if(/<\/head\s*>/i.test(html))html=html.replace(/<\/head\s*>/i,style+'</head>');else html=style+html;
    if(/<\/body\s*>/i.test(html))html=html.replace(/<\/body\s*>/i,script+'</body>');else html+=script;
    $('previewFrame').srcdoc=html;
    $('previewMeta').textContent=[htmlName?'HTML':null,css?'CSS':null,js?'JS':null].filter(Boolean).join(' · ');
    $('editorStatus').textContent='Prévia pronta';
  }
  function toast(message,type='info'){const node=document.createElement('div');node.className='toast'+(type==='error'?' error':'');node.textContent=message;$('toastStack').append(node);setTimeout(()=>node.remove(),3500);}
  function setPage(page){currentPage=page;document.querySelectorAll('.page').forEach(e=>e.classList.toggle('active',e.id===page+'Page'));document.querySelectorAll('.nav-link').forEach(e=>e.classList.toggle('active',e.dataset.page===page));$('breadcrumb').textContent={studio:'Estúdio',projects:'Meus projetos',ai:'Titan AI',diagnostics:'Diagnóstico',settings:'Configurações'}[page]||'Estúdio';$('sidebar').classList.remove('open');if(page==='projects')renderProjects();if(page==='diagnostics')runDiagnostics();if(page==='ai')refreshStatus();}
  function renderProjects(){const grid=$('projectsGrid');grid.replaceChildren();for(const p of projects){const card=document.createElement('article');card.className='project-card';const icon=document.createElement('div');icon.className='project-card-icon';icon.textContent='◫';const h=document.createElement('h3');h.textContent=p.name;const info=document.createElement('p');info.textContent=`${Object.keys(p.files).length} arquivo(s) · Atualizado ${new Date(p.updated).toLocaleDateString('pt-BR')}`;const actions=document.createElement('div');actions.className='project-card-actions';const open=document.createElement('button');open.textContent='Abrir projeto';open.addEventListener('click',()=>{activeId=p.id;save(true);renderAll();setPage('studio');});const download=document.createElement('button');download.textContent='ZIP';download.addEventListener('click',()=>exportZip(p));const remove=document.createElement('button');remove.textContent='Excluir';remove.className='danger';remove.addEventListener('click',()=>{if(projects.length===1){toast('Crie outro projeto antes de excluir o último.','error');return;}if(!window.confirm(`Excluir o projeto "${p.name}" deste navegador?`))return;projects=projects.filter(x=>x.id!==p.id);if(activeId===p.id)activeId=projects[0].id;save();renderAll();toast('Projeto excluído.');});actions.append(open,download,remove);card.append(icon,h,info,actions);grid.append(card);}}
  function askDialog({title,description,label='Nome',placeholder='',value='',button='Criar',secret=false},callback){dialogCallback=callback;$('dialogTitle').textContent=title;$('dialogDescription').textContent=description;$('dialogLabel').textContent=label;$('dialogInput').value=value;$('dialogInput').type=secret?'password':'text';$('dialogInput').placeholder=placeholder;$('dialogSubmit').textContent=button;$('genericDialog').showModal();setTimeout(()=>$('dialogInput').focus(),30);}
  function createProject(){askDialog({title:'Criar novo projeto',description:'Dê um nome ao seu novo workspace. Você poderá escolher um modelo depois.',label:'Nome do projeto',placeholder:'Ex.: meu-app',button:'Criar projeto'},name=>{if(!name.trim())return;const p=makeProject(name.trim());projects.unshift(p);activeId=p.id;save();renderAll();setPage('studio');toast('Projeto criado!');});}
  function addFile(){askDialog({title:'Adicionar arquivo',description:'Crie um novo arquivo para o projeto. Exemplos: main.py, style.css, app.js, README.md.',label:'Nome e extensão',placeholder:'main.py',button:'Criar arquivo'},name=>{name=name.trim();if(!validFilename(name)){toast('Use um nome de arquivo válido, sem caminhos suspeitos.','error');return;}const p=activeProject();if(name in p.files){toast('Já existe um arquivo com esse nome.','error');return;}p.files[name]='';p.active=name;save();renderAll();toast('Arquivo criado.');});}
  function renameFile(){const p=activeProject(),old=p.active;askDialog({title:'Renomear arquivo',description:'Informe o novo nome do arquivo, mantendo a extensão desejada.',label:'Novo nome',value:old,button:'Renomear'},name=>{name=name.trim();if(!validFilename(name)|| (name!==old && name in p.files)){toast('Nome inválido ou já utilizado.','error');return;}const updated={};for(const [k,v] of Object.entries(p.files))updated[k===old?name:k]=v;p.files=updated;p.active=name;save();renderAll();});}
  function removeFile(){const p=activeProject();if(Object.keys(p.files).length===1){toast('O projeto deve ter pelo menos um arquivo.','error');return;}if(!window.confirm(`Excluir ${p.active}?`))return;delete p.files[p.active];p.active=Object.keys(p.files)[0];save();renderAll();toast('Arquivo excluído.');}
  function applyTemplate(type){if(!templates[type])return;if(!window.confirm('Substituir todos os arquivos do projeto atual pelo modelo escolhido? Exporte um backup antes, se necessário.'))return;const p=activeProject();p.files=clone(templates[type]);p.active=Object.keys(p.files)[0];save();renderAll();$('templateDialog').close();setPage('studio');toast('Modelo aplicado com sucesso.');}
  function downloadBlob(content,filename,type){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function slug(s){return (s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,52)||'titan-projeto');}
  function crc32(bytes){let crc=0xFFFFFFFF;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1) ^ (0xEDB88320&(-(crc&1)));}return(crc^0xFFFFFFFF)>>>0;}
  function write16(d,at,v){d.setUint16(at,v,true);}function write32(d,at,v){d.setUint32(at,v>>>0,true);}
  function zipFiles(files){
    const local=[],central=[];let offset=0;
    const entries=Object.entries(files);
    for(const [name,content] of entries){const fileName=encoder.encode(name),bytes=encoder.encode(content),crc=crc32(bytes);
      const lh=new Uint8Array(30+fileName.length),lv=new DataView(lh.buffer);write32(lv,0,0x04034b50);write16(lv,4,20);write16(lv,6,0x800);write16(lv,8,0);write32(lv,14,crc);write32(lv,18,bytes.length);write32(lv,22,bytes.length);write16(lv,26,fileName.length);lh.set(fileName,30);local.push(lh,bytes);
      const ch=new Uint8Array(46+fileName.length),cv=new DataView(ch.buffer);write32(cv,0,0x02014b50);write16(cv,4,20);write16(cv,6,20);write16(cv,8,0x800);write32(cv,16,crc);write32(cv,20,bytes.length);write32(cv,24,bytes.length);write16(cv,28,fileName.length);write32(cv,42,offset);ch.set(fileName,46);central.push(ch);
      offset+=lh.length+bytes.length;
    }
    const cdSize=central.reduce((x,b)=>x+b.length,0);const end=new Uint8Array(22),v=new DataView(end.buffer);write32(v,0,0x06054b50);write16(v,8,entries.length);write16(v,10,entries.length);write32(v,12,cdSize);write32(v,16,offset);return new Blob([...local,...central,end],{type:'application/zip'});
  }
  function exportZip(p=activeProject()){saveEditor();try{downloadBlob(zipFiles(p.files),slug(p.name)+'.zip','application/zip');toast('ZIP exportado!');}catch(e){toast('Não foi possível criar o ZIP: '+e.message,'error');}}
  function exportBackup(){saveEditor();downloadBlob(JSON.stringify({version:3,exportedAt:new Date().toISOString(),projects},null,2),'titan-code-backup.json','application/json');toast('Backup exportado.');}
  function importFiles(event){const files=Array.from(event.target.files||[]);if(!files.length)return;const p=activeProject();Promise.all(files.map(async file=>({name:file.name,text:await file.text()}))).then(items=>{let count=0;for(const {name,text} of items){if(!validFilename(name) || text.length>1500000)continue;p.files[name]=text;count++;}if(count){p.active=items.find(x=>validFilename(x.name))?.name||p.active;save();renderAll();toast(`${count} arquivo(s) importado(s).`);}else toast('Nenhum arquivo válido foi selecionado.','error');}).catch(()=>toast('Falha ao ler os arquivos.','error'));event.target.value='';}
  function toggleTheme(){settings.theme=document.body.classList.contains('light')?'dark':'light';document.body.classList.toggle('light',settings.theme==='light');safeLocalSet(settingsKey,JSON.stringify(settings));}
  async function refreshStatus(){
    let data=null;try{const resp=await fetch('/api/status',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(6000)});if(resp.ok)data=await resp.json();}catch{}
    status=data;const flag=$('cloudStatus');flag.classList.toggle('is-offline',!data);flag.lastElementChild.textContent=data?'Servidor online':'Editor local';$('footerConn').textContent=data?(data.authenticated?'Conectado ao servidor':'Servidor acessível'):'Modo offline';$('aiHeadStatus').textContent=data?.aiConfigured?'Modelo: '+data.model:'IA ainda não configurada';$('settingsAiState').textContent=!data?'Sem conexão com o backend.':data.aiConfigured?`Configurada: ${data.model}`:'Ausente: configure AI_API_KEY no Render.';$('authStateText').textContent=!data?'Servidor não encontrado':data.authenticated?'Sessão autenticada':data.authRequired?'Login necessário para usar a IA':'Acesso local sem senha';$('loginSettingsBtn').textContent=data?.authenticated?'Sair':'Entrar';return data;
  }
  function login(){askDialog({title:'Acessar Titan AI',description:'Digite a chave de acesso definida no ambiente do servidor (APP_ACCESS_KEY). Esta não é sua chave de API do Ollama.',label:'Chave de acesso',button:'Entrar',secret:true},async key=>{try{const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({key})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Não foi possível entrar.');await refreshStatus();toast('Autenticação concluída.');}catch(err){toast(err.message,'error');}});}
  async function logout(){try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});await refreshStatus();toast('Sessão encerrada.');}catch{toast('Não foi possível sair.','error');}}
  function toggleAi(open){$('aiDrawer').classList.toggle('open',open);$('aiDrawer').setAttribute('aria-hidden',String(!open));$('backdrop').hidden=!open; if(open) {$('chatInput').focus();refreshStatus();}}
  function updateChatContext(){$('chatFileName').textContent=activeName();}
  function appendMessage(role,text){const wrap=document.createElement('div');wrap.className='chat-message '+role;const speaker=document.createElement('div');speaker.className='speaker';speaker.textContent=role==='user'?'VOCÊ':'TITAN AI';const bubble=document.createElement('div');bubble.className='chat-bubble';bubble.textContent=text;wrap.append(speaker,bubble);if(role==='assistant'){const match=text.match(/```(?:[\w#+-]+)?\s*\n([\s\S]*?)```/);if(match){const actions=document.createElement('div');actions.className='chat-code-actions';const insert=document.createElement('button');insert.textContent='↧ Inserir no arquivo';insert.addEventListener('click',()=>{if(!window.confirm(`Substituir o conteúdo de ${activeName()} pelo código sugerido pela IA?`))return;$('codeEditor').value=match[1].trimEnd();onEditorChange();runPreview();toast('Código inserido.');});const copy=document.createElement('button');copy.textContent='⧉ Copiar código';copy.addEventListener('click',()=>copyText(match[1]));actions.append(insert,copy);wrap.append(actions);}}$('chatMessages').append(wrap);$('chatMessages').scrollTop=$('chatMessages').scrollHeight;return wrap;}
  function copyText(text){navigator.clipboard?.writeText(text).then(()=>toast('Copiado!')).catch(()=>fallbackCopy(text))||fallbackCopy(text);}
  function fallbackCopy(text){const tmp=document.createElement('textarea');tmp.value=text;document.body.append(tmp);tmp.select();try{document.execCommand('copy');toast('Copiado!');}catch{toast('Copie manualmente.','error');}tmp.remove();}
  async function sendChat(prompt){const message=(prompt||$('chatInput').value).trim();if(!message || chatBusy)return;$('chatInput').value='';if(!status)await refreshStatus();if(!status){toast('IA indisponível sem o servidor. O editor continua funcionando.','error');return;}if(!status.aiConfigured){toast('Configure AI_API_KEY no Render antes de utilizar a IA.','error');return;}if(!status.authenticated){login();toast('Faça login e envie sua pergunta novamente.');return;}
    $('chatMessages').querySelector('.chat-welcome')?.remove();appendMessage('user',message);const p=activeProject();const context=`Projeto: ${p.name}\nArquivo: ${p.active}\nLinguagem: ${langNames[ext(p.active)]||'texto'}\nCódigo atual:\n\`\`\`\n${(p.files[p.active]||'').slice(0,10500)}\n\`\`\`\n\nPedido: ${message}`;
    chatBusy=true;$('sendChatBtn').disabled=true;const pending=appendMessage('assistant','Analisando seu código...');const messages=[...chatHistory.slice(-12),{role:'user',content:context}];
    try{const res=await fetch('/api/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages}),signal:AbortSignal.timeout(55000)});const json=await res.json();if(!res.ok)throw new Error(json.error||'A IA não respondeu.');pending.remove();appendMessage('assistant',json.content);chatHistory.push({role:'user',content:message},{role:'assistant',content:json.content});chatHistory=chatHistory.slice(-12);}catch(err){pending.remove();appendMessage('assistant','Não foi possível concluir: '+(err.name==='TimeoutError'?'Tempo esgotado.':err.message));}finally{chatBusy=false;$('sendChatBtn').disabled=false;}
  }
  async function runDiagnostics(){const list=$('diagnosticList');list.replaceChildren();const checks=[];
    let storageOK=false;try{localStorage.setItem('titan:test','1');storageOK=localStorage.getItem('titan:test')==='1';localStorage.removeItem('titan:test');}catch{}
    checks.push(['Armazenamento do navegador',storageOK,storageOK?'Leitura e gravação disponíveis.':'Dados locais podem não ser salvos.']);
    const s=await refreshStatus();checks.push(['Servidor do TITAN',!!s,s?'API online e respondendo.':'Sem API. O editor continua funcionando localmente.']);
    checks.push(['Autenticação',!s || !s.authRequired || s.authenticated,!s?'Exige conexão para verificar.':s.authenticated?'Sessão autenticada.':s.authRequired?'Entre com a senha definida no servidor.':'Não é necessária no ambiente atual.']);
    checks.push(['Motor de inteligência artificial',!!s?.aiConfigured,s?.aiConfigured?`Modelo configurado: ${s.model}`:'Configure AI_API_KEY e AI_MODEL no provedor de hospedagem.']);
    checks.push(['Integridade do projeto',validateProject(activeProject()),`${Object.keys(activeProject().files).length} arquivo(s) no projeto.`]);
    const hasWeb=Object.keys(activeProject().files).some(x=>['html','css','js'].includes(ext(x)));checks.push(['Prévia web',hasWeb,hasWeb?'HTML/CSS/JS encontrados.':'Somente linguagens externas; prévia web desativada.']);
    for(const [label,ok,description] of checks){const item=document.createElement('div');item.className='diagnostic-item';const icon=document.createElement('span');icon.className='test-icon'+(ok?'':' warn');icon.textContent=ok?'✓':'!';const content=document.createElement('div');const heading=document.createElement('strong');heading.textContent=label;const text=document.createElement('p');text.textContent=description;content.append(heading,text);item.append(icon,content);list.append(item);}
  }
  async function registerOffline(){if('serviceWorker' in navigator && location.protocol==='https:'){try{await navigator.serviceWorker.register('./sw.js');}catch{}}}
  function bindEvents(){
    document.querySelectorAll('[data-page]').forEach(x=>x.addEventListener('click',()=>{const page=x.dataset.page;setPage(page);if(page==='ai')toggleAi(true);}));
    document.querySelectorAll('[data-action="new-project"]').forEach(x=>x.addEventListener('click',createProject));$('newProjectTop').addEventListener('click',createProject);
    $('addFileBtn').addEventListener('click',addFile);$('addFileInlineBtn').addEventListener('click',addFile);$('renameFileBtn').addEventListener('click',renameFile);$('removeFileBtn').addEventListener('click',removeFile);
    $('templateBtn').addEventListener('click',()=>$('templateDialog').showModal());$('templateClose').addEventListener('click',()=>$('templateDialog').close());document.querySelectorAll('[data-template]').forEach(x=>x.addEventListener('click',()=>applyTemplate(x.dataset.template)));
    $('importFilesBtn').addEventListener('click',()=>$('importFilesInput').click());$('importFilesInput').addEventListener('change',importFiles);
    $('codeEditor').addEventListener('input',onEditorChange);$('codeEditor').addEventListener('keydown',onEditorKeydown);$('codeEditor').addEventListener('click',updateCursor);$('codeEditor').addEventListener('keyup',updateCursor);
    $('codeEditor').addEventListener('scroll',()=>{$('syntaxView').scrollTop=$('codeEditor').scrollTop;$('syntaxView').scrollLeft=$('codeEditor').scrollLeft;$('lineNumbers').scrollTop=$('codeEditor').scrollTop;});
    $('runCodeBtn').addEventListener('click',()=>{runPreview();toast('Visualização atualizada.');});$('refreshPreviewBtn').addEventListener('click',runPreview);
    $('expandPreviewBtn').addEventListener('click',()=>{$('workspaceLayout').classList.add('show-preview');$('mobileEditorTab').classList.remove('selected');$('mobilePreviewTab').classList.add('selected');$('previewPane').scrollIntoView({behavior:'smooth',block:'nearest'});});
    $('formatCodeBtn').addEventListener('click',()=>{const e=$('codeEditor'),start=e.selectionStart;const begin=e.value.lastIndexOf('\n',start-1)+1;e.setRangeText('  ',begin,begin,'preserve');onEditorChange();e.focus();});
    $('copyCodeBtn').addEventListener('click',()=>copyText($('codeEditor').value));$('exportBtn').addEventListener('click',()=>exportZip());
    $('mobileEditorTab').addEventListener('click',()=>{$('workspaceLayout').classList.remove('show-preview');$('mobileEditorTab').classList.add('selected');$('mobilePreviewTab').classList.remove('selected');});
    $('mobilePreviewTab').addEventListener('click',()=>{runPreview();$('workspaceLayout').classList.add('show-preview');$('mobilePreviewTab').classList.add('selected');$('mobileEditorTab').classList.remove('selected');});
    $('themeToggle').addEventListener('click',toggleTheme);$('themeSettingsBtn').addEventListener('click',toggleTheme);$('autoPreviewCheck').addEventListener('change',e=>{settings.autoPreview=e.target.checked;safeLocalSet(settingsKey,JSON.stringify(settings));});
    $('runDiagnostics').addEventListener('click',runDiagnostics);$('refreshAiStatus').addEventListener('click',refreshStatus);$('backupAllBtn').addEventListener('click',exportBackup);
    $('loginSettingsBtn').addEventListener('click',()=>status?.authenticated?logout():login());$('accountBtn').addEventListener('click',()=>status?.authenticated?logout():login());
    ['openAiBtn','openChatFull'].forEach(id=>$(id).addEventListener('click',()=>toggleAi(true)));$('closeAiBtn').addEventListener('click',()=>toggleAi(false));$('backdrop').addEventListener('click',()=>{$('sidebar').classList.remove('open');toggleAi(false);});
    $('sendChatBtn').addEventListener('click',()=>sendChat());$('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}});
    document.querySelectorAll('[data-prompt]').forEach(x=>x.addEventListener('click',()=>sendChat(x.dataset.prompt)));
    $('menuToggle').addEventListener('click',()=>{$('sidebar').classList.toggle('open');$('backdrop').hidden=!$('sidebar').classList.contains('open');});
    $('dialogClose').addEventListener('click',()=>$('genericDialog').close());$('dialogCancel').addEventListener('click',()=>$('genericDialog').close());
    $('dialogForm').addEventListener('submit',e=>{e.preventDefault();const value=$('dialogInput').value.trim();const f=dialogCallback;$('genericDialog').close();dialogCallback=null;if(typeof f==='function')f(value);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){toggleAi(false);$('sidebar').classList.remove('open');$('backdrop').hidden=true;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();toggleAi(true);}});
  }
  try{initialize();}catch(err){console.error('Falha ao iniciar TITAN CODE',err);document.body.insertAdjacentHTML('afterbegin','<div style="position:fixed;z-index:999;inset:0;background:#101425;color:white;display:grid;place-items:center;padding:25px;text-align:center;font-family:system-ui"><div><h1>Não foi possível iniciar o TITAN CODE</h1><p>Atualize a página ou limpe o cache deste site. Seus projetos continuam neste navegador.</p><button onclick="location.reload()" style="padding:13px 22px;background:#916bfb;color:#fff;border:0;border-radius:9px">Tentar novamente</button></div></div>');}
})();
