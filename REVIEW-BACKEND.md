# Backend Code Review — epi-manager

**Files reviewed:** 16 (~1.860 linhas em escopo backend)
**Findings:** 9 critical · 12 high · 8 medium · 7 low

Arquivos lidos integralmente: `backend/index.js`, `backend/routes/api.js` (1180 linhas), `backend/routes/baixa.js`, `backend/routes/busca.js`, `backend/routes/historico.js`, `backend/routes/solicitacao.js`, `backend/routes/zapsign.js`, `backend/services/graphql.js`, `backend/services/pdf.js`, `backend/services/file.js`, `backend/services/email.js`, `backend/services/cronSla.js`, `backend/services/zapsign.js`, `backend/config/monday-mapping.js`, `backend/verify.js`, `backend/test-upload.js`, `backend/test-pdf.js`.

---

## CRITICAL

### [C-01] Token de produção do Monday vazado em `backend/.env` (legível em texto claro) — `backend/.env:3`
O arquivo contém um JWT de produção válido do Monday.com (`MONDAY_API_TOKEN='eyJhbGciOiJIUzI1NiJ9...'`) com escopo `me:write`. Embora `backend/.gitignore` exclua o arquivo, **ele está presente no disco em um repositório que também tem o root `.env` versionado** (ver C-02). Qualquer dump, screenshot, log de IDE ou colaborador com acesso ao repositório clonado tem acesso total ao banco operacional do Monday — leitura/mutação irrestrita de TODOS os boards (Gestão de EPIs, Esteira Admissional, Auditoria), incluindo PII de colaboradores (CPF/RG). **Token deve ser rotacionado IMEDIATAMENTE.** Mesmo problema com `ZAPSIGN_API` na linha 4. Como mitigação após a rotação: mover para um secret manager (ou ao menos garantir que nenhum colaborador clone o repo com o `.env` populado), trocar a aspas simples (`'...'`) por variáveis sem aspas e validar a presença do token no boot.

### [C-02] Arquivo `.env` na raiz do repositório está versionado e a `.gitignore` raiz não o exclui — `.env`, `.gitignore`
`git ls-files` confirma que `.env` (raiz) está commitado (commit inicial `56605c3`). O conteúdo atual só carrega URLs (`VITE_API_URL`, etc.), mas a `.gitignore` raiz **não** lista `.env` — apenas `*.local`, `node_modules`, `dist`. Logo, qualquer secret que algum dev coloque ali no futuro (e o root `.env` é o lugar natural para `MONDAY_API_TOKEN` em uma próxima refatoração) será comitado silenciosamente. Adicionar `.env` e `.env.*` na `.gitignore` raiz e remover o `.env` do tracking (`git rm --cached .env`).

### [C-03] Cinco arquivos de rota importam `../services/monday.js` que não existe — `backend/routes/baixa.js:2`, `busca.js:2`, `historico.js:2`, `solicitacao.js:2`, `zapsign.js:2`
Esses cinco routers tentam importar `salvarBaixa`, `buscarPorCpf`, `buscarPorNome`, `buscarHistorico`, `criarSolicitacao` e `uploadArquivo` de `../services/monday.js`, mas só existe `../services/graphql.js`. **Em Node.js ESM, um simples `import` desses módulos lança `ERR_MODULE_NOT_FOUND` no boot** — basta um único `app.use(zapsignRouter)` ou `import "./routes/zapsign.js"` para derrubar o servidor. Hoje o `index.js` só monta `apiRouter`, então o servidor sobe; mas isso significa que o webhook do **ZapSign está inativo na prática** — nenhuma cautela assinada é anexada de volta ao Monday. Os endpoints `/api/buscar-cpf`, `/api/historico`, `/api/criar-solicitacao`, `/api/salvar-baixa` também estão mortos. Se a UI ainda chamar essas rotas, recebe 404. Resolver: criar `services/monday.js` com as funções esperadas, ou apagar/migrar essas rotas para `routes/api.js` e remover os arquivos órfãos.

### [C-04] `COLS_AUDITORIA` e `COLS_ESTOQUE3` referenciados em `api.js` mas nunca importados — `backend/routes/api.js:764, 850, 866-868`
Linha 764 dentro de `POST /api/audit-log`: usa `COLS_AUDITORIA.DATA_HORA`. Linhas 850, 866-868 dentro de `GET /api/estoque3`: usam `COLS_ESTOQUE3.TAMANHO/QUANTIDADE/STATUS_ESTOQUE`. Nenhum desses símbolos é importado no topo (`import { BOARDS, COLS_GESTAO, COLS_SUB_GESTAO, COLS_SUB_ADMISSIONAL, COLS_CATALOGO, AS0_PARENT_ITEM_ID }`). **Toda chamada a esses endpoints lança `ReferenceError: COLS_AUDITORIA is not defined` (ou `COLS_ESTOQUE3`)** que vira 500 silencioso para o frontend. O endpoint `/estoque3` é chamado pelo balcão de reaproveitamento — está quebrado. Adicionar os imports.

### [C-05] CronSla com triplo `JSON.stringify` produz mutation inválida — `backend/services/cronSla.js:75-86`
```js
const colorVals = JSON.stringify(JSON.stringify({ color_mm1y93j5: { index: 1 }, color_mm1y6q34: { index: 0 } }));
await gql(`mutation { change_multiple_column_values(... column_values: ${JSON.stringify(colorVals)}) { id } }`);
```
A primeira `stringify` produz a string JSON correta. A segunda transforma em um literal de string com aspas escapadas. A terceira (na interpolação) escapa de novo. A query final terá `column_values: "\"{\\\"color_mm1y93j5\\\":...}\""` — o Monday rejeita ou (pior) aceita como string opaca e não muda nada. Combinado com o fato de o item ser movido para `group_mm1y9na5` em seguida, um EPI poderia ir parar no histórico sem o status correto de "desconto em folha", quebrando o audit trail (CLT art. 462). Felizmente esta função **nunca é chamada** — `initCronSla()` está exportado mas `index.js` jamais o invoca (C-09). Quando alguém ligar o cron, todos os SLAs vencidos serão silenciosamente movidos sem o flag de desconto. Refatorar para usar `gql(query, variables)` com `column_values: $colVals` (JSON variable) como o resto do código.

### [C-06] `reverter-devolucao` casa subitem original por nome — colaboradores com 2 botinas perdem o status de uma — `backend/routes/api.js:631-660`
Após apagar o `[DEV] Botina`, busca o original por `s.name.trim().toLowerCase() === nomeBase.toLowerCase() && !/^\[(DEV|TROCA)\]/.test(s.name)`. Se o colaborador tem **dois subitems chamados "Botina"** (substituição prévia, dois pares iguais, ou erro de cadastro), `Array.find` retorna apenas o **primeiro** — o outro fica órfão em "Aguardando Devolução"/"Não Devolvido" para sempre. Pior: se o colaborador tem `Botina Cano Alto` e `Botina`, e a devolução foi do segundo, o `find` ainda acerta porque exige igualdade exata; mas com **`Botina` e `BOTINA`** (case differ no Monday) ambos casam pois o compare é lowercase. O modelo correto é gravar `_evento_id ↔ subitem_original_id` (por exemplo na coluna JUSTIFICATIVA do `[DEV]` ou em uma coluna dedicada) no momento da criação do `[DEV]`, e usar esse ID na reversão. Hoje o sistema confia em um nome humano que nunca é único — risco real de **status_acao incorreto descontado em folha**.

### [C-07] CPF no path/url e em logs — vazamento de PII — `backend/routes/api.js:205, 274` e múltiplos `console.error`
`GET /api/colaborador/:cpf` e `GET /api/cautela/check/:cpf` colocam o CPF no path. Em qualquer middleware de log (incluso o stack default do Express, o ngrok, e qualquer reverse proxy), o CPF vai parar em access logs em texto claro, indexáveis pela equipe de infra. Pior: `error.message` é devolvido cru no body de respostas 500 (`res.status(500).json({ error: error.message })` em ~25 endpoints) — se o Monday retornar uma mensagem que cite o `column_values` enviado, **o CPF aparece no JSON de erro vazado pra UI** e potencialmente para o Sentry/console do navegador. Mover CPF para body POST ou query string (idealmente body), e sanear toda mensagem de erro antes de devolver: `res.status(500).json({ error: "Erro interno." })` e logar a mensagem completa apenas no servidor. CPF é dado pessoal pela LGPD; uma exposição em log é incidente reportável.

### [C-08] `/api/cautela/upload` aceita qualquer MIME, sem checar tamanho, sem checar autorização — `backend/routes/api.js:882-909`
Recebe `arquivo_base64` (base64 inline no JSON, com limite de body de **25MB** — `index.js:10`), `nome_arquivo` (a extensão é tirada do nome do arquivo enviado pelo cliente — line 894), e `subitem_id` cru. Não há:
1. **Validação de MIME** — `dataUrlToBuffer` aceita qualquer `data:*/*;base64,...`. Um atacante pode anexar um `.exe` ou `.html` ao subitem do Monday, que então será baixado por outros usuários como "Cautela".
2. **Limite de tamanho** — body limit é 25MB, mas após base64 isso são ~18MB de payload binário. Não há rejeição de arquivos óbvios menos válidos.
3. **Verificação de propriedade** — qualquer `subitem_id` válido no Monday é aceito; não se confere se o subitem pertence a um item pai do board GESTAO ou se é um subitem de CAUTELA. Atacante anexa arquivo a qualquer subitem (incluindo `[DEV]` de outros colaboradores).
4. **Sanitização do filename** — `nome_arquivo.split('.').pop()` permite `arquivo.pdf.exe` (ext = `exe`), `arquivo` (ext = `arquivo`), e o filename real é construído como `Cautela_${Date.now()}.${ext}` — extensão atacante-controlada com prefixo controlado. O Monday provavelmente sanitiza isso, mas vale validar antes.

Adicionar: lista branca de MIME (`application/pdf` apenas), limite de tamanho (~10MB), validar que `subitem_id` pertence a `BOARDS.SUB_GESTAO` e que seu `parent_item.board_id === BOARDS.GESTAO`, e idealmente confirmar que o subitem tem nome contendo "CAUTELA".

### [C-09] Webhook do ZapSign sem verificação de assinatura, sem replay protection, sem auth — `backend/routes/zapsign.js:37-75`
O endpoint `POST /api/webhook/zapsign`:
- Aceita qualquer `body` que contenha `event_type:"doc_signed"` + `status:"signed"` + `external_id` + `signed_file`.
- **Não valida HMAC/secret** do webhook ZapSign. Atacante que descobre a URL pública (ngrok!) e o `item_id` de um colaborador pode forjar um POST e fazer o backend baixar **qualquer URL** (`pdfUrl = body.signed_file`) e gravar no Monday como "Cautela Assinada". Isso é simultaneamente:
  - **SSRF** — `globalThis.fetch(pdfUrl)` pode bater em `http://169.254.169.254/...` (metadata cloud), `http://localhost:3001/...` (loopback), ou exfiltrar via redirect.
  - **Falsificação de cautela legalmente válida** — uma cautela falsa anexada ao item do colaborador alimenta o "documento assinado é a única fonte da verdade" do CLAUDE.md. Compliance broken.
- Não há proteção de replay (nonce/timestamp/dedup por `token`). O mesmo evento pode ser entregue N vezes e cada vez baixará e anexará o PDF.
- Acresce-se que o módulo importa `services/monday.js` que não existe (C-03), portanto a rota nem sequer está montada hoje. Ao consertar C-03, os pontos acima precisam estar resolvidos antes do go-live. Validar `req.headers['x-zapsign-signature']` (ou similar) com HMAC-SHA256 do body usando um segredo `ZAPSIGN_WEBHOOK_SECRET`; restringir hosts permitidos para `pdfUrl` (allowlist do domínio S3 do ZapSign); guardar `body.token` num set para deduplicar.

---

## HIGH

### [H-01] `verify.js` e `test-upload.js` na raiz do backend executam `run()` no import — risco de execução acidental — `backend/verify.js:32`, `backend/test-upload.js:50`
Ambos terminam com `run();` no top-level do módulo. Se um dia alguém importar para refatorar (ou se um runner de testes os varrer), eles executam mutations reais contra o Monday de produção. `verify.js` apenas escreve um JSON local, mas `test-upload.js` faz **upload de PDF de teste em um item real do Monday** (`q.data.boards[0].items_page.items[0].id`) — vai poluir o board com `Termo_de_Cautela.pdf` no item de algum colaborador. Mover para `scripts/` e exigir flag (`if (process.argv[2] === '--run')`) ou renomear com sufixo `.example.js`.

### [H-02] Endpoint `/colaborador/:item_id/info` aceita string crua sem validação — pode quebrar telefones e técnico — `backend/routes/api.js:1153-1178`
Recebe `tecnico_responsavel`, `telefone1`, `telefone2` direto do body e grava como **string simples** no `column_values`. Em colunas tipo `text` do Monday isso funciona (Monday aceita string), mas:
- Sem trim/length, atacante grava 100KB de texto numa coluna que a UI exibe inline.
- Sem validação numérica de telefone, alguém grava `"<script>"` que será exibido em `colParent(...)?.text` (text é safe — Monday devolve plain). Se a UI usar `dangerouslySetInnerHTML`, vira XSS persistido (NEEDS_VERIFICATION no frontend, mas o backend deveria sanear independentemente).
- `tecnico_responsavel === ""` passa no `if (... !== undefined)` e apaga o valor existente. Talvez intencional, mas indistinguível de "não enviado".

Adicionar `zod` (já está no `package.json`!): schema com `tecnico_responsavel: z.string().min(1).max(120).optional()`, telefone com regex.

### [H-03] `atualizar` de subitem aceita qualquer `status` sem validar contra o Monday — `backend/routes/api.js:480-504`
`PATCH /api/epi/:subitem_id/atualizar` envia `{ label: status }` direto, qualquer string. Se o frontend envia `"Entregueh"` (typo), o Monday silenciosamente **ignora** porque label não casa com nenhum option do status — a mutation retorna sucesso, mas o status não muda. O frontend mostra "salvo" e o usuário acredita. Mesma armadilha em `/concluir-devolucao` (que tem fallback hard-coded para "Descarte/Dano" — H-04), `/agendar-devolucao` (label hardcoded OK), `/devolver` (tem fallback). Lista branca de labels válidos derivada de `monday-mapping.js` ou enviada pelo Monday em runtime.

### [H-04] `concluir-devolucao` e `devolver` cai em `Descarte/Dano` quando o status enviado é inválido — `backend/routes/api.js:337, 678`
`const labelStatus = statusValidos.includes(statusNorm) ? statusNorm : "Descarte/Dano";` — se o frontend envia um label novo (ex: "Reaproveitavel" sem capitalizar; ou um valor adicionado no Monday mas não no array), o EPI vai pra **Descarte/Dano** (item perdido financeiramente, vai pra lixo) sem aviso. **Em vez do fallback silencioso, retornar 400.** Compliance: um EPI marcado como descarte por erro de digitação não tem como reverter via UI atual.

### [H-05] `/devolver` cria subitem `[DEV]` mesmo se o original já tem `[DEV]` aberto — duplica eventos — `backend/routes/api.js:325-417`
Não há checagem de evento `[DEV]` pendente para o mesmo `nomeBase`. Dois cliques rápidos no botão "Devolver" criam dois subitens `[DEV] Botina`. Idem para `/trocar` (cria `[TROCA]` + novo Pendente — clique duplo gera 4 subitens). Adicionar idempotência: ou aceitar `idempotency_key` no body e cachear, ou listar subitems existentes e abortar se já existe `[DEV] ${nomeBase}` em estado não-final. Race condition real: o frontend usa React Query com `useMutation` que pode disparar duas vezes se o usuário recarrega no meio.

### [H-06] `nomeBase` deduzido por regex de prefixo — colaborador escreve `[DEV] Avental` no nome, sistema entra em loop — `backend/routes/api.js:348, 526, 621`
`original.name.replace(/^\[DEV\]\s*/i, "").replace(/^\[TROCA\]\s*/i, "")`. O usuário do Monday pode renomear um subitem manualmente para `[DEV] Avental` — o sistema então acha que é evento, e operações como `/devolver` produzem `[DEV] Avental` (com prefixo já presente) virando `[DEV] [DEV] Avental` no original (porque o `replace` só remove **um** prefixo). E `/reverter-devolucao` exige que `s.name.startsWith` não tenha `[DEV]` — então um item legitimamente nomeado `[DEV] Verbete` jamais é encontrado. O frontend faz merge filtrando esses prefixos como sinal de "evento" — usuário tipa `[DEV] X` e o EPI some da UI. Validar nomes na criação do subitem (reject se começa com `[DEV]`/`[TROCA]`) e — melhor — usar uma **coluna dedicada de tipo de evento** em vez de derivar do nome.

### [H-07] Erros do Monday devolvidos em texto cru ao cliente — vazam IDs, queries e detalhes internos — `backend/routes/api.js` (todos os `catch`)
Padrão repetido: `res.status(500).json({ error: error.message })`. As mensagens do Monday GraphQL incluem nomes de colunas (`text_mm1yrhrs`), board IDs (`18406415397`), e às vezes trechos do payload enviado. Isso ajuda atacante a mapear o schema. Combinado com C-07 isso vaza CPF se o erro for de validação de CPF. Devolver `{ error: "Falha ao processar solicitação." }` e logar detalhes só no server-side.

### [H-08] `email.js` usa Ethereal (mailbox de testes) e CC fake `colab-${cpf}@empresa.com.br` — `backend/services/email.js:8-30`
O serviço cria um SMTP de teste em runtime (`nodemailer.createTestAccount()`), envia para `rh@empresa.com.br` e `colab-${cpf}@empresa.com.br`. Em produção isso significa: **nenhum email é enviado** (Ethereal só joga em mailbox virtual), e o `cpf` aparece no campo `to:` do email — **se for trocado para SMTP real um dia, o CPF vai pra um endereço inexistente que o servidor SMTP de produção pode logar/quarantenar**. Hoje o `salvarBaixa` está em `routes/baixa.js` (broken por C-03), então isso não é exercitado, mas se for reativado, o impacto é alto. Substituir por SMTP real via env, e usar email do colaborador real (não derivar de CPF), e remover `cpf` do `to:`.

### [H-09] `valor_desconto = "A calcular"` no ZapSign — documento legal vai pro signatário com placeholder — `backend/services/zapsign.js:13`
Default da função `criarDocZapSignCautela` é `"A calcular"` quando o caller não passa. O documento gerado pelo ZapSign será assinado pelo colaborador com **`{{VALOR_DESCONTO}} = "A calcular"`** literalmente — uma cautela **sem valor** que será depois descontada em folha pelo financeiro. Em juízo, o documento perde validade (art. 462 CLT exige discriminação do valor). Validar que `valor_desconto` é numérico e maior que zero **antes** de chamar o ZapSign; rejeitar se `is_admissao === false && !valor_desconto`.

### [H-10] N+1 em `/webhook/admissao` — cada EPI faz GraphQL separado, sem retry — `backend/routes/api.js:74-85`
Loop `for (const epi of epis) await gql(...)` cria subitens um por um. Para um pacote de admissão com 15 EPIs isso é 15 round-trips ao Monday (rate-limited a 60/min/account globalmente). Se a rede falha no EPI 8, **8 subitens já foram criados**, os outros 7 não, e o cliente recebe 500 — fica em estado inconsistente sem rollback. Idem `/cautela/criar-subitem` chamado em loop. Usar `create_subitems` em batch (Monday suporta variáveis) ou pelo menos implementar retry-com-backoff e rollback (delete dos já criados em erro).

### [H-11] `dataUrlToBuffer` confia no MIME do data URL para derivar extensão — `backend/services/file.js:6-16`
`mimeType` vem do header do data URL (que é controlado pelo cliente). Cliente envia `data:image/png;base64,<bytes_de_pdf>` e o sistema vai gravar com extensão `.png` mas conteúdo PDF — corrompe o anexo do Monday. Pior: cliente envia `data:application/octet-stream;base64,...` e ext vira `octet-stream`. Validar com magic bytes (`buffer[0..3] === %PDF` para PDF, `\x89PNG` para PNG) ou aceitar só whitelist explícita por endpoint.

### [H-12] Body limit de 25MB no Express + base64 = ~18MB efetivos, sem rate limit em uploads — `backend/index.js:10`, `backend/routes/api.js`
`app.use(express.json({ limit: "25mb" }))` é global. Endpoints de upload (`/cautela/upload`, `/devolver`, `/trocar`) recebem PDFs/fotos em base64 inline. Não há rate limit para esses POSTs (`buscaLimiter` só protege CPF lookup). Atacante anônimo pode encher o disco do Monday com 25MB × 60 req/s. Adicionar `rateLimit` no router-level ou por rota POST, e diminuir o limite global para 1MB com override pontual em rotas que precisam de PDF.

---

## MEDIUM

### [M-01] Rotas mutating sem autenticação — qualquer um na rede pode mexer em qualquer colaborador — `backend/index.js:10-14`
`app.use(cors())` permite qualquer origem; `app.use("/api", apiRouter)` monta tudo sem middleware de auth. Localmente isso é OK; com ngrok rodando (você tem `ngrok.exe` no repo!) qualquer endpoint vira público. Mesmo que o uso seja interno, qualquer desktop infectado na rede LAN pode `PATCH /api/colaborador/:id/status` e marcar todos como demitidos. Adicionar uma chave estática (`X-API-Key`) ou auth por sessão antes do go-live.

### [M-02] CORS aberto pra qualquer origem — `backend/index.js:11`
`app.use(cors())` com config default é `Access-Control-Allow-Origin: *`. Qualquer site na internet, se um colaborador estiver com a sessão aberta no localhost, pode disparar PATCH cross-origin. Restringir para `origin: ['http://localhost:5173', 'http://localhost:4173']` em dev e a URL do app em prod.

### [M-03] `addBusinessDays` calculado **só no frontend** — backend aceita qualquer data — `backend/routes/api.js:357, 428`
Comentário na linha 356 confirma: "data_limite: prazo de 3 dias úteis (enviado pelo frontend para Não Devolvido)". Cliente malicioso (ou bug de fuso horário do navegador) envia `data_limite = "2099-01-01"` e o EPI fica fora do raio do cron de SLA para sempre — colaborador "ganha" o EPI sem desconto. Calcular `data_limite` no backend usando `moment-business-days` (já está importado em `api.js` mas não usado!). Considerar fuso `America/Sao_Paulo`.

### [M-04] Sem timezone em `new Date().toISOString().split("T")[0]` — pode salvar dia errado próximo da meia-noite — `backend/routes/api.js:764` e `cronSla.js:62`
Servidor em UTC vs eventos em horário de Brasília: às 22:00 de Brasília, `new Date().toISOString()` já retorna o **dia seguinte** UTC. Datas como `data_limite`, `data_devolucao` e o filtro do cron (`hoje = ...`) ficam um dia adiantadas após 21h BRT. Usar `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())` ou um helper `hojeSP()`.

### [M-05] `BOARDS.AUDITORIA` setado em `monday-mapping.js` mas o board nunca foi confirmado existente — `backend/routes/api.js:761`
Endpoint `/audit-log` cria item no board `18409129795`. Se o board não existir ou foi renomeado, retorna erro silencioso (catch genérico). Adicionar `verify.js`-style boot check que confirma a existência dos boards/columns ao subir.

### [M-06] `parseFloat(text.replace(",", "."))` sem fallback robusto — `backend/routes/api.js:259, 729, 1105`
Se o texto for `"R$ 1.500,00"` (mirror do Monday em formato BR), `replace(",", ".")` produz `"R$ 1.500.00"` → `parseFloat` retorna `NaN` → `valorEmAberto += NaN` → KPI fica NaN. Sanear: `String(text).replace(/[^\d,.-]/g, "").replace(",", ".")` ou parsear o `value` (JSON) em vez de `text`.

### [M-07] `verify.js` e `test-upload.js` deveriam estar em `.gitignore` ou em `scripts/` — `backend/verify.js`, `backend/test-upload.js`
Convivem com código de runtime e usam mesma extensão (`.js`). Risco de import acidental via glob e ainda exibem queries que vazam `column_values` em log (`console.log` no upload).

### [M-08] `cors()` global antes de `express.json()` — ordem ok, mas não há `helmet` — `backend/index.js`
Sem `helmet()`, faltam headers básicos (`X-Content-Type-Options`, `Strict-Transport-Security`, etc). Em produção atrás de reverse-proxy isso é default OK; localmente é low-risk; em ngrok exposto é risco real (XSS via Content-Type sniffing em respostas de erro). Adicionar `helmet()`.

---

## LOW / INFO

### [L-01] `import moment from "moment-business-days"` em `api.js` mas nunca usado — `backend/routes/api.js:3`
Dead import. Provavelmente sobra do plano de fazer `addBusinessDays` no backend (M-03).

### [L-02] `console.log` deixado em runtime — vazamento de payload — `backend/services/file.js` (não tem, mas `verify.js` e `test-upload.js` têm), `backend/routes/zapsign.js:43, 47, 52, 58, 65`
Em produção esses logs vão para o stdout do container — incluem `external_id` (item_id) e nomes de campos. Substituir por logger estruturado com níveis (`pino`, `winston`).

### [L-03] `cols.json`, `out_native.json`, `output.json`, `tmp_columns.json` no repo — artefatos de debug — `backend/cols.json` etc.
Comprometem clean checkout. Mover para `.gitignore`.

### [L-04] `ngrok.exe` (32MB binário) no repo raiz — `ngrok.exe`
Binário pesado versionado. `.gitignore` não exclui.

### [L-05] `test.js`, `teste.pdf`, `test_col.js`, `test_cols.js`, `create_col.js`, `fetch_cols.js` na raiz/backend — código exploratório versionado
Idem L-03/L-04. Mover para `scripts/` ou apagar.

### [L-06] `[ZapSign Webhook]` logs sem acentos (linhas 43, 47, 52, 58) — pode indicar encoding errado em arquivo — `backend/routes/zapsign.js`
"nao", "Aguardando demais signatarios", "necessarios" — comparar com `routes/api.js` que tem acentos. Não é bug de runtime mas inconsistência de estilo / sinaliza arquivo gravado em encoding diferente.

### [L-07] Comentário "🦺 Backend EPI Manager rodando em..." no console — UTF-8 + emoji em terminal Windows pode imprimir mojibake — `backend/index.js:21`
Em PowerShell sem UTF-8 acaba virando `?`. Cosmético.

---

## NEEDS_VERIFICATION

1. **C-09 (ZapSign)**: a documentação do ZapSign confirma se há header `X-Zapsign-Webhook-Signature` (ou similar) disponível para verificação? Comando: ler painel ZapSign de webhooks da conta atual e checar settings de "Webhook Secret".
2. **H-02 (XSS via campos de texto)**: o frontend renderiza `tecnico_responsavel`, `telefone1`, `telefone2` com `dangerouslySetInnerHTML`? Comando: `grep -r "dangerouslySetInnerHTML" src/` no repositório do frontend. Se sim, escalar para Critical.
3. **C-08 (cautela upload)**: os subitens com prefixo "📋 CAUTELA" recebem o PDF, mas o N8N processa qualquer arquivo anexado a `file_mkvvbkwx` em qualquer subitem? Verificar trigger do N8N — se sim, o atacante consegue trigar o pipeline com PDF malicioso para colaboradores arbitrários, escalando para "execução remota efetiva".
4. **C-07 (CPF em logs)**: existe winston/morgan/sentry instalado? Comando: `grep -E "morgan|winston|pino|sentry" backend/package.json`. Se sim, o CPF está vazando para o sink de telemetria — incidente LGPD.
5. **H-05 (race em `/devolver`)**: o frontend tem debounce/disable no botão durante a mutation? Verificar `DevolucaoPage.tsx` — se a mutation usa `mutation.isPending` para desabilitar o submit. Se não, o duplo clique é trivial.
6. **C-05 (cron)**: alguém realmente nunca chamou `initCronSla()`? Comando: `grep -rE "initCronSla|require.*cronSla|import.*cronSla" backend/ src/`. Se algum cron externo (PM2, systemd timer) o invoca, C-05 é Critical em produção hoje.
7. **C-06 (reverter por nome)**: existem hoje colaboradores com 2 ou mais subitems de mesmo nome? Comando: query GraphQL listando `subitems { name }` agrupado por nome em todos itens do board GESTAO; se há colisão, C-06 já está afetando dados em produção.

---

## Summary

**Top 3 BLOCKER:**
1. **Token de produção do Monday em texto claro** no `backend/.env` (C-01) e `.env` raiz versionado (C-02) — rotacionar token e endurecer `.gitignore` antes de qualquer outra coisa.
2. **Cinco rotas críticas (incluindo o webhook ZapSign) tentam importar um módulo inexistente** (C-03) — webhook de cautela assinada está silenciosamente desligado, e o webhook em si **não tem verificação de assinatura nem proteção de SSRF** (C-09) — problema legal real, fonte da verdade é falsificável.
3. **`reverter-devolucao` casa o subitem original por nome em vez de por ID** (C-06) — colaboradores com EPIs de mesmo nome (caso comum: dois pares de botina) têm status corrompido, com risco de desconto indevido em folha (CLT 462).

**Biggest wins (esforço baixo, impacto alto):**
- Importar `COLS_AUDITORIA` e `COLS_ESTOQUE3` em `api.js` (C-04) — desbugar `/estoque3` em 1 linha.
- Sanear `error.message` na resposta + tirar CPF do path (C-07/H-07) — endurece LGPD.
- Validar `data_limite` no backend usando `moment-business-days` (M-03/L-01) — elimina bypass do SLA, e ainda dá uso à dependência já importada.
- Adicionar `idempotency_key` em `/devolver` e `/trocar` (H-05) — fim do problema de cliques duplos que duplicam eventos.
- Calcular `nomeBase` por **ID guardado na justificativa do `[DEV]`** em vez de regex de nome (C-06/H-06) — corrige o modelo de evento.

**Maior risco aberto:** todo o módulo ZapSign está dormente (`monday.js` não existe, webhook nunca processa). Quando for ressuscitado, sem fix em C-08/C-09, o sistema aceita PDFs forjados como cautela legalmente assinada — quebra a premissa central "o documento assinado é a única fonte da verdade" do CLAUDE.md.
