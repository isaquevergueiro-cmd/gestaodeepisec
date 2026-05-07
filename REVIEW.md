# Code Review Consolidado — epi-manager

**Data:** 2026-04-30
**Escopo:** projeto inteiro — backend (Node/Express/Monday GraphQL) + frontend (React 19/TS/Vite)
**Profundidade:** deep (leitura integral dos hotspots: `api.js` 1180 linhas, `ColaboradorDrawer.tsx` 816, `GestaoEpisPage.tsx` 731, `CautelaPage.tsx` 687, `DevolucaoPage.tsx` 533).
**Arquivos lidos:** 16 backend + 24 frontend (~9.300 linhas)

> Relatórios detalhados em `REVIEW-BACKEND.md` e `REVIEW-FRONTEND.md`. Este documento é a visão executiva consolidada com priorização cruzada.

---

## Mapa de severidade

| | Backend | Frontend | Total |
|---|---|---|---|
| **CRITICAL** | 9 | 7 | **16** |
| **HIGH** | 12 | 14 | **26** |
| **MEDIUM** | 8 | 9 | 17 |
| **LOW / INFO** | 7 | 6 | 13 |

---

## 🔥 Top 5 BLOCKERS (corrigir antes de qualquer outra coisa)

### 1. Token de produção do Monday vazado em `.env` + `.env` raiz versionado
**Refs:** `BE-C-01` (`backend/.env:3`), `BE-C-02` (`.gitignore`)
JWT real do Monday com escopo `me:write` em texto claro no disco; `.gitignore` raiz não exclui `.env`. Quem clonar o repo tem leitura/mutação total de TODOS os boards, incluindo CPF/RG dos colaboradores.
**Ação:** rotacionar token AGORA → `git rm --cached .env` → adicionar `.env` e `.env.*` na `.gitignore` raiz. Idem `ZAPSIGN_API`.

### 2. Cinco rotas críticas importam `services/monday.js` que não existe
**Refs:** `BE-C-03` (`backend/routes/baixa.js:2`, `busca.js:2`, `historico.js:2`, `solicitacao.js:2`, `zapsign.js:2`)
**O webhook do ZapSign está silenciosamente desligado** — nenhuma cautela assinada volta para o Monday. Os endpoints `/api/buscar-cpf`, `/api/historico`, `/api/criar-solicitacao`, `/api/salvar-baixa` retornam 404 se forem chamados.
**Ação:** decidir entre (a) criar `services/monday.js` com as funções esperadas, ou (b) migrar para `routes/api.js` e apagar os arquivos órfãos.

### 3. Timezone + stacking de eventos: deduplicação errada na devolução
**Refs cruzadas:** `FE-C-01` + `FE-C-02` + `FE-C-03` + `BE-C-06`
A combinação produz **falha de compliance CLT art. 462** (3 dias úteis para "Não Devolvido"):
- `diasUteisRestantes()` (`ColaboradorDrawer.tsx:81-94`) parseia `"2026-04-30"` como UTC → em Manaus (UTC-4) o prazo desloca 1 dia para trás. Já vencido aparece como "0 dia(s) restante(s)" em laranja.
- `addBusinessDays()` + `toIso()` (`DevolucaoPage.tsx:54-70`) calcula em local mas serializa em UTC → "Prazo: 03/05/2026" exibido vira `"2026-05-04"` no backend.
- `mergedEpis` (`ColaboradorDrawer.tsx:538-564`) faz `eventos.find(...)` sem ordenar por status → com 2 `[DEV]` para o mesmo EPI, o "Desmarcar" reverte o evento errado.
- `reverter-devolucao` (`api.js:631-660`) busca o original por **nome** (case-insensitive) → 2 botinas iguais = a segunda fica órfã em "Aguardando Devolução" para sempre.
**Ação:** ver "Plano de Ação 1" abaixo. Esta é a falha mais perigosa do projeto.

### 4. Webhook ZapSign sem verificação HMAC + SSRF aberto
**Ref:** `BE-C-09` (`backend/routes/zapsign.js:37-75`)
Atacante que descobre a URL pública (lembrete: `ngrok.exe` está versionado!) forja POST `event_type:"doc_signed"` apontando para qualquer `signed_file` URL — backend baixa via `globalThis.fetch(pdfUrl)` e anexa ao Monday como "Cautela Assinada". Isso simultaneamente:
- **Falsifica documento legalmente assinado** (quebra a premissa "documento é a única fonte da verdade" do CLAUDE.md).
- **SSRF** — pode bater em `http://169.254.169.254/...` (metadata cloud) ou `http://localhost:3001/...`.
- Sem replay protection — mesmo evento entregue N vezes anexa N PDFs.
**Hoje está dormente por causa do BLOCKER #2** — mas precisa estar resolvido **antes** de ressuscitar.

### 5. Cron SLA com mutation inválida (triplo `JSON.stringify`)
**Ref:** `BE-C-05` (`backend/services/cronSla.js:75-86`)
Quando alguém ligar `initCronSla()` (hoje nunca é chamado), todos os EPIs vencidos vão pra histórico **sem** marcar status de desconto. Audit trail corrompido em massa no primeiro tick. Refatorar para `gql(query, variables)` antes de plugar.

---

## ⚠️ Top 10 HIGH (visuais e UX)

| # | Ref | Onde | O que o usuário vê |
|---|---|---|---|
| 1 | `FE-H-08` | `Header.tsx:5-13` | Header das páginas `/gestao` e `/admissao` (as duas mais usadas) com `<h1>` vazio e breadcrumb "Operações" sem sentido — `ROUTE_TITLES` não tem entradas para essas rotas |
| 2 | `FE-H-03` | `StatusBadge.tsx:66` | Status `Reaproveitavel` (sem acento, como o Monday devolve), `Enviado Estoque 3`, `Troca / Desgaste`, `Aguardando Assinatura` caem no fallback cinza "A Definir" — visual diferente da paleta do Drawer |
| 3 | `FE-C-06` | `GestaoEpisPage.tsx:429` (`NovoColaboradorModal`) | Input de CPF sem máscara, sem `validarCpf`, sem `maxLength` — usuário digita `123.456.789-01`, backend grava com pontos, todas as buscas posteriores 404 |
| 4 | `FE-H-01`+`FE-H-02` | `ColaboradorDrawer.tsx:334-347` | `dias < 0` → no dia exato do prazo, banner laranja com "0 dia(s) restante(s)" em vez de vermelho. Combinado com `FE-C-02`, técnico acha que tem 1 dia a mais |
| 5 | `FE-H-05` | `ColaboradorDrawer.tsx:549-559` | EPI com lifecycle Pendente → Entregue → `[DEV] Reaproveitável` continua mostrando como "Entregue" com botões "Devolução"/"Troca" — técnico cria 2ª devolução stackada |
| 6 | `FE-C-04`+`FE-C-05` | `ColaboradorDrawer.tsx:244-247, 580-603` | `EditField` re-grava em loop quando o valor do Monday vem com whitespace (toast spam). Fechar drawer mid-save pode reverter o telefone para o valor antigo |
| 7 | `FE-H-06` | `ToastContext.tsx:36-40` | Burst de erros (rede caindo) empilha 8+ toasts que escapam da viewport |
| 8 | `BE-H-04` | `api.js:337, 678` | Status com label inválido cai silenciosamente em **Descarte/Dano** — EPI vai pro lixo por typo, sem aviso |
| 9 | `BE-H-05`+`BE-H-10` | `api.js:325, 510, 74-85` | Duplo clique em "Devolver"/"Trocar" cria `[DEV]` ou `[TROCA]+novo Pendente` em duplicata. Loop de admissão sem batch (15 EPIs = 15 round-trips, sem rollback no meio) |
| 10 | `BE-H-09` | `services/zapsign.js:13` | `valor_desconto = "A calcular"` default — colaborador assina cautela com placeholder no campo de valor; o documento perde validade jurídica (art. 462 exige discriminar valor) |

---

## 🎯 Bugs cruzados (frontend + backend reforçam o mesmo problema)

### A) Race condition em `/devolver` e `/trocar`
- **Backend:** `BE-H-05` — não há idempotency key, dois POST quase simultâneos criam dois `[DEV]` ou `[TROCA]`
- **Frontend:** `FE-H-13` (decorrência de `FE-C-01`) + `NEEDS_VERIFICATION FE-V-04` — verificar se mutations usam `mutation.isPending` para desabilitar o botão
- **Fix duplo:** desabilitar botão durante `isPending` no front + aceitar `idempotency-key` header no back

### B) `data_limite` calculada só no frontend
- **Backend:** `BE-M-03` — backend confia em qualquer data enviada (`api.js:357, 428`)
- **Frontend:** `FE-C-03` — `addBusinessDays` + `toIso` mistura local e UTC
- **Risco compliance:** colaborador malicioso ou bug de fuso pode mandar `data_limite="2099-01-01"` e fugir do desconto em folha
- **Fix:** mover cálculo pro backend usando `moment-business-days` (já está importado mas nunca usado em `api.js:3`!), com timezone `America/Sao_Paulo`

### C) Validação de upload (PDF)
- **Backend:** `BE-C-08` — `/api/cautela/upload` aceita qualquer MIME, sem validar dono do `subitem_id`, ext atacante-controlada
- **Frontend:** `FE-M-04` — `AdmissaoPage.ModalAnexar` sem MIME check (compare com `CautelaUploadPage` que faz)
- **Fix:** whitelist MIME (`application/pdf` apenas), magic-byte validation no `dataUrlToBuffer`, verificar ownership do subitem

### D) CPF
- **Backend:** `BE-C-07` — CPF no path/url e em logs (`/api/colaborador/:cpf`, `error.message` cru). LGPD reportável.
- **Frontend:** `FE-C-06` — formato inconsistente: `BuscaPage` mostra input formatado, `ColaboradorDrawer` mostra raw, `NovoColaboradorModal` aceita formatado e grava com pontos
- **Fix combinado:** mover CPF para body POST no back + sanear `error.message` + aplicar `formatCpf()` em toda exibição + validar/strip dots no input antes de enviar

---

## 🛡️ Compliance: por que o "documento como fonte da verdade" está em risco

A premissa central do projeto (per CLAUDE.md): **o PDF assinado é a única fonte da verdade**. Hoje essa premissa tem 4 furos:

1. **Ninguém recebe a cautela assinada de volta** (BLOCKER #2 — webhook ZapSign não importa porque o módulo `services/monday.js` não existe).
2. **Cautela assinada pode ser forjada** quando ressuscitarem o webhook (BLOCKER #4 — sem HMAC).
3. **Documento sai com `valor_desconto = "A calcular"`** (`BE-H-09`) — colaborador assina cautela "em branco" no campo de valor, perde validade jurídica.
4. **Status de "Não Devolvido" pode estar com data errada** (BLOCKER #3) — desconto em folha aplicado fora do prazo legal de 3 dias úteis.

Cada um desses individualmente é um problema; juntos invalidam a tese arquitetural.

---

## 📋 Plano de ação sugerido (ordem)

### Sprint 1 — Estancar sangramento (1-2 dias)
1. **Rotacionar token Monday + ZapSign** (`BE-C-01`)
2. **`git rm --cached .env`** + atualizar `.gitignore` raiz (`BE-C-02`)
3. **Importar `COLS_AUDITORIA` e `COLS_ESTOQUE3`** em `api.js` (`BE-C-04`) — fix de 2 linhas, desbuga `/estoque3` e `/audit-log`
4. **Decidir destino dos 5 routers órfãos** (`BE-C-03`) — apagar OU criar `services/monday.js`
5. **Adicionar header titles** para `/gestao` e `/admissao` (`FE-H-08`) — 2 linhas

### Sprint 2 — Compliance (3-5 dias)
6. **Refatorar timezone**: `diasUteisRestantes` + `toIso` + parse local de `YYYY-MM-DD` (`FE-C-02`, `FE-C-03`)
7. **Mover cálculo de `data_limite` para o backend** com `moment-business-days` + tz Brasília (`BE-M-03`)
8. **Refatorar `mergedEpis`**: ordenar eventos por prioridade, projetar status terminal, renderizar órfãos (`FE-C-01`, `FE-H-05`)
9. **Refatorar `reverter-devolucao`**: gravar `subitem_original_id` na justificativa do `[DEV]` no momento da criação, usar ID na reversão (`BE-C-06`)
10. **Adicionar `idempotency-key`** em `/devolver` e `/trocar` + `disabled={mutation.isPending}` nos botões (`BE-H-05`, race A acima)

### Sprint 3 — Segurança e qualidade (3-5 dias)
11. **Validação HMAC do webhook ZapSign** + allowlist de hosts para `signed_file` + dedup por `token` (`BE-C-09`) — antes de ressuscitar a rota
12. **Validação de upload**: MIME whitelist + magic bytes + ownership check de `subitem_id` (`BE-C-08`, `BE-H-11`)
13. **Sanitizar respostas de erro** (`BE-C-07`, `BE-H-07`) — `{ error: "Falha ao processar." }` no body, detalhe só no log
14. **Auth básica em todas as rotas mutating** (`BE-M-01`) — X-API-Key ou sessão
15. **CORS restrito** (`BE-M-02`)
16. **Validação Zod nos endpoints críticos** (`BE-H-02`, `BE-H-03`)
17. **Validar `valor_desconto` numérico > 0** antes de criar doc ZapSign (`BE-H-09`)

### Sprint 4 — Polish visual e UX (2-3 dias)
18. **Expandir `STATUS_CONFIG`** com todos os labels reais do Monday, incluindo sem-acento e prefixos `[DEV]`/`[TROCA]` (`FE-H-03`, `FE-H-04`)
19. **Aplicar `formatCpf()`** em toda exibição (`FE-C-06`)
20. **Máscara + validação CPF** no `NovoColaboradorModal` (`FE-C-06`)
21. **`vencido` usar `dias <= 0`** + label "Hoje é o prazo final" para 0 (`FE-H-02`)
22. **Toast cap** em 5 + dedup por mensagem (`FE-H-06`)
23. **Trim em ambos os lados** no `EditField.commit` (`FE-C-04`)
24. **Fix `mergedEpis` orphan rendering** (incluído no item 8)

### Sprint 5 — Limpeza e dead code (1-2 dias)
25. **Apagar/mover** `verify.js`, `test-upload.js`, `test-pdf.js`, `test_col.js`, `test_cols.js`, `create_col.js`, `fetch_cols.js`, `cols.json`, `out_native.json`, `output.json`, `tmp_columns.json`, `ngrok.exe`, `teste.pdf` (`BE-H-01`, `BE-L-03/04/05`)
26. **Refatorar imports dinâmicos** para estáticos no frontend (`FE-M-01`)
27. **Substituir `console.log/error` por logger estruturado** (`BE-L-02`)

---

## 🔍 Itens que precisam verificação manual

Esses não dá pra confirmar só lendo código:

1. **`FE-V-01`** Build TypeScript: `CriarCautelaModal.tsx:276-278` tem template literal dentro de ternário em `style.border` — CLAUDE.md flag isso como build-breaker do TSC 5.9.3. Rodar `npm run build` e confirmar.
2. **`BE-NV-1`** Dashboard ZapSign: existe Webhook Secret configurado? (necessário para HMAC)
3. **`BE-NV-2`** `grep -r "dangerouslySetInnerHTML" src/` — se sim, `BE-H-02` (texto cru gravado vira XSS persistido) escala para Critical
4. **`BE-NV-7`** Query GraphQL: existem hoje colaboradores com 2+ subitems de mesmo nome no board GESTAO? Se sim, `BE-C-06` já está corrompendo dados em produção
5. **`FE-V-02`** Upload PDF em rede ruim — testar timeout de 15s com arquivo de 10MB em 3G simulado
6. **`FE-V-04`** Reproduzir: clicar Save em drawer A, fechar antes da resposta, abrir drawer B — o `savingField` carrega entre drawers?

---

## Resumo executivo

O projeto tem **9 bugs críticos no backend e 7 no frontend** — mas apenas 5 são bloqueadores reais hoje, e nenhum é bug de "design ruim" — todos são erros concretos com impacto operacional ou jurídico mensurável.

A maior fragilidade arquitetural é a **lógica de eventos `[DEV]`/`[TROCA]` por matching de nome** (backend e frontend cometem o mesmo erro): os subitens de evento referenciam o original por string em vez de ID, e o frontend deduplica eventos sem ordenação. O sistema escala bem com 1 EPI por colaborador; com 2 do mesmo tipo (caso comum: dois pares de botina), começa a corromper. Trocar isso por uma referência por ID é **a melhoria de maior impacto** do plano.

A segunda fragilidade é **timezone**: três pontos diferentes (frontend countdown, frontend toIso, backend acepta data crua) podem se compor para um deslocamento de até 2 dias no prazo de 3 dias úteis — diretamente sobre a base de cálculo de desconto em folha CLT 462. Centralizar o cálculo no backend com timezone explícito resolve.

A terceira é **infosec/compliance**: token vazado, webhook sem HMAC, CPF em logs, MIME não validado, ZapSign com placeholder de valor — cada um isolado é um achado de auditoria; combinados, invalidam a premissa "o documento assinado é a fonte da verdade" do projeto.

**Mais visíveis para o usuário no dia-a-dia:**
- Header vazio em `/gestao` e `/admissao` (`FE-H-08`)
- Status `Reaproveitavel` (sem acento) cinza em `BuscaPage` (`FE-H-03`)
- Toast spam ao editar telefone com whitespace (`FE-C-04`)
- "0 dia(s) restante(s)" em laranja no dia em que já está vencido (`FE-H-02`)
- Burst de toasts saindo da viewport quando rede pisca (`FE-H-06`)

**Maior surpresa positiva:** o stack é coerente e bem decomposto. As mutations React Query estão tipadas, o `monday-mapping.js` centraliza IDs, o backend separa GraphQL via service. As dores estão concentradas em locais identificáveis, não dispersas.
