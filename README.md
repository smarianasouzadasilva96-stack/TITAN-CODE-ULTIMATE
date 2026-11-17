# ⚡ TITAN CODE ULTIMATE V3

Estúdio de código mobile-first, feito do zero com **HTML, CSS, JavaScript e Node.js nativo** (nenhuma dependência NPM obrigatória). Visual moderno, editor de múltiplos arquivos, prévia web isolada e integração com modelos de IA via API compatível com OpenAI, incluindo Ollama.

## Funcionalidades implementadas

- Interface responsiva para desktop e Android; modo claro/escuro.
- Gerenciar vários projetos locais e seus arquivos; adicionar, renomear, excluir ou importar arquivos de código.
- Editor com destaque de sintaxe básico, numeração de linhas, tabs, atalhos `Ctrl+S`, `Ctrl+Enter`, `Ctrl+K`.
- Pré-visualização HTML/CSS/JavaScript em iframe isolado (`sandbox="allow-scripts"` sem acesso à origem do site).
- Modelos iniciais web, landing page, Luau (Roblox Studio) e Python.
- Exportar projeto como `.zip` direto no navegador (sem serviços externos), e backup de todos os projetos em JSON.
- Titan AI: assistente de geração/refatoração/explicação, usando arquivo ativo como contexto. Copia ou insere código **somente após a confirmação do usuário**.
- Backend Node com sessão segura em cookie, login por senha configurável, limitação de requisições, limite de tamanho, timeout e chave de provedor escondida no servidor.
- Health check (`/health`), diagnóstico integrado, PWA e cache offline de assets.
- GitHub Actions para testar o código e publicar a **versão editor offline** no GitHub Pages.
- `render.yaml` para criar o serviço **completo com IA** no Render a partir do repositório GitHub.

**Limitações atuais:** não executa Python, Luau, Java ou C++ no servidor; só HTML/CSS/JavaScript têm pré-visualização local. O armazenamento dos projetos é local (`localStorage`), não sincroniza automaticamente com outras contas/dispositivos. O editor usa realce de sintaxe básico, não compilador/LSP. A IA só funciona após configurar um modelo, uma chave válida e um servidor acessível; eventuais limites/custos são determinados pelo provedor.

## Rodar localmente

Necessário **Node.js 20+**.

```bash
npm start
```

Acesse `http://localhost:3000` (modo de desenvolvimento sem senha). O editor funciona **sem nenhuma chave**; Titan AI precisará de credenciais. O processo não lê `.env.example` nem `.env` automaticamente; são exemplos para variáveis do **ambiente de execução**.

Execute os testes:

```bash
npm test
```

## Subir no ar: GitHub + Render (recomendado)

1. Crie um repositório GitHub, por exemplo `titan-code-ultimate`. **Extraia o ZIP e envie todos os arquivos e diretórios** para a raiz do repositório (não envie somente o ZIP).
2. No Render, vincule a conta GitHub e escolha **New > Blueprint**. Selecione seu repositório e confirme o `render.yaml`. Alternativamente, crie Web Service: `npm install --omit=dev` / `npm start`.
3. Nas variáveis de ambiente do Render defina:
   - `APP_ACCESS_KEY`: senha de acesso **forte, exclusiva, com 12+ caracteres** (não use chaves curtas ou conhecidas).
   - `SESSION_SECRET`: secreto aleatório com 24+ caracteres (gerado automaticamente em Blueprints).
   - `AI_BASE_URL`: `https://ollama.com/v1` (padrão).
   - `AI_API_KEY`: chave privada da API Ollama Cloud, **somente no Render**.
   - `AI_MODEL`: nome de modelo aceito por sua conta. Para Ollama Cloud experimente `gemma4:31b-cloud` (confirme disponibilidade no provedor).
   - `NODE_ENV`: `production` (padrão no Blueprint).
4. Após deploy concluído, abra a URL `https://<seu-servico>.onrender.com` que o Render lhe fornecer. Acesse **Diagnóstico** para verificar servidor e IA.

**Nunca publique segredos no GitHub**, em `.env.example`, no JavaScript do navegador, screenshots ou em commits. `.env.example` contém somente valores fictícios. Arquivos `.env` reais são ignorados pelo Git. Se você publicou uma chave, revogue e gere outra.

### GitHub Pages — alternativa só de interface

O workflow `.github/workflows/pages.yml` publica a pasta `public/` quando GitHub Pages está ativado em **Settings > Pages > Build and deployment > Source > GitHub Actions**. Isso entrega o editor, templates e ZIP sem servidor. **Titan AI, login e health check não funcionam no GitHub Pages.** Para a versão completa, prefira Render.

## Estrutura

```
titan-code-ultimate/
├── .github/workflows/test.yml   # Testes automáticos
├── .github/workflows/pages.yml  # Editor estático no GitHub Pages
├── public/
│   ├── index.html               # Interface principal
│   ├── styles.css               # Design responsivo
│   ├── app.js                   # Editor, projetos, preview, ZIP, IA
│   ├── sw.js                    # Cache offline
│   ├── manifest.webmanifest     # PWA
│   └── icon.svg
├── tests/server.test.js         # Testes do backend
├── server.js                    # API e arquivos estáticos
├── render.yaml                  # Deploy como Web Service
├── .env.example                 # Template sem segredos
└── package.json
```

## Segurança e funcionamento

- Não inclua sua chave Ollama em `.env.example`; o template serve apenas para documentar os nomes das variáveis. Configure via **Render > Environment**.
- O navegador não recebe a chave do provedor. A sessão usa cookies `HttpOnly` e `SameSite=Strict`; em produção, `Secure` exige HTTPS.
- O código do usuário renderiza dentro de iframe isolado. Como toda prévia executa código do próprio projeto, **revise scripts desconhecidos** antes de executar.
- No GitHub Pages, os projetos ficam armazenados somente no navegador/mesmo domínio. Faça backups por precaução.

## Evoluções futuras

Editor com LSP/Monaco, versões Git integradas via OAuth, compilação APK via pipeline Android, sincronização cloud, histórico de alterações e console do preview. Essas funcionalidades não são prometidas como existentes nesta versão.
