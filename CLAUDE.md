# epi-manager — Contexto do Projeto

## Visão Geral

Sistema de gestão de EPIs e fardamentos ponta a ponta. Composto por:

1. **Frontend**: React 19 + TypeScript + Vite (este repositório — `epi-manager`)
2. **Backend**: Node.js + Express (`backend/routes/api.js`)
3. **Automação**: n8n (fluxos separados, não neste repo)
4. **Banco de dados operacional**: Monday.com (GraphQL API)
5. **IA de extração**: Google Gemini (usado nos fluxos n8n)

---

## Arquitetura do Monday.com

### Boards principais
| Board | ID | Descrição |
|---|---|---|
| Gestão de EPIs (pai) | `18406415397` | Item pai = colaborador |
| Sub-gestão (subitens EPIs) | `18406605109` | Subitem = cada EPI/fardamento |
| Esteira Admissional v2 | — | Colaboradores admitidos (destino da automação n8n) |

### Estrutura Pai-Filho
- **Item pai** = identidade do colaborador (CPF, função, status_acao, motivo_acao, técnico, telefones)
- **Subitens** = inventário de EPIs (nome, tamanho, quantidade, status, datas, preço, foto, cautela)

### Ciclo de vida dos subitems de EPI
```
Pendente de Receber
  → Entregue
    → [DEV] Aguardando Devolução   (subitem de evento — invisível ao usuário)
    → [DEV] Não Devolvido           (com data_limite = +3 dias úteis)
      → Reaproveitável              (conclusão da devolução)
      → Descarte/Dano               (conclusão da devolução)
    → [TROCA] ...                   (subitem de troca — invisível ao usuário)
      → novo item Pendente de Receber gerado
```

### Convenção dos subitems de evento
- Prefixo `[DEV]` → subitem de devolução (não renderizado no frontend)
- Prefixo `[TROCA]` → subitem de troca (não renderizado no frontend)
- O frontend faz merge: o status do evento é projetado no item original, mantendo UI limpa

---

## Automação n8n (contexto — pode estar desatualizado)

### Filosofia central
> **"O Documento Assinado é a Única Fonte da Verdade"**
> Dados preenchidos manualmente são ignorados. Apenas o PDF legal conta.

### Fluxo resumido
1. **Trigger**: Webhook do Monday dispara quando PDF de Cautela é anexado
2. **Travas**: If/Else para filtrar falsos positivos
3. **Extração com Gemini**: Prompt estrito extrai CPF (limpo), Função, lista de EPIs (nome, tamanho, quantidade) com fallbacks (sem tamanho → vazio, sem quantidade → "1"). Ignora valores R$ e CAs.
4. **Fan-out**: JavaScript + nós `Split Out` / `Aggregate` quebram array de EPIs
5. **Criação Item Pai**: Mutação GraphQL insere colaborador no board Esteira Admissional v2 (motivo_acao = "Admissão", status = "Concluído")
6. **Loop de Subitems**: Para cada EPI, cria subitem com quantidade, tamanho, data de entrega (hoje), status "Entregue"
7. **Upload Multipart**: Requisição `multipart/form-data` separada anexa o PDF ao item pai ("Dossiê Digital")

### Regras de compliance
- **Imutabilidade**: Registro de admissão nunca é sobrescrito (snapshot permanente)
- **Rastreabilidade por empilhamento**: Devolução/troca cria cópias dos subitems originais — nunca apaga o histórico
- **Audit trail**: Toda ação gera novo subitem com prefixo `[DEV]` ou `[TROCA]`

---

## Frontend (`epi-manager`)

### Stack
- React 19 + TypeScript 5.9.3 + Vite
- TanStack React Query (useMutation, useQueryClient, invalidateQueries)
- Zustand + React Context
- React Router v7
- Lucide React (ícones)

### ⚠️ Bug conhecido: TSC 5.9.3 e template literals em JSX
O compilador TypeScript 5.9.3 tem um bug de parsing: ternários com template literals dentro de props `style` JSX causam `TS17008: JSX element has no corresponding closing tag`.

**Workarounds obrigatórios:**
- Extrair styles dinâmicos para variáveis `React.CSSProperties` **antes** do `return`
- Usar concatenação de string em vez de template literals: `'1px solid ' + color` em vez de `` `1px solid ${color}` ``
- Usar `<React.Fragment>` em vez de `<>` dentro de ternários no JSX
- Nunca usar ternários dentro de props `border`, `boxShadow`, `background` inline no JSX

### Páginas principais
| Arquivo | Descrição |
|---|---|
| `ColaboradorDrawer.tsx` | Drawer lateral do colaborador — lista EPIs, edição inline, banner de devolução pendente |
| `DevolucaoPage.tsx` | Registra devolução — destinos: Reaproveitável, Descarte/Dano, Não Devolvido |
| `TrocaPage.tsx` | Registra troca por desgaste/avaria — cria novo subitem Pendente de Receber |
| `GestaoPage.tsx` | Listagem geral de colaboradores + KPIs |
| `AdmissaoPage.tsx` | Cadastro manual de admissão (alternativa ao n8n) |
| `CautelaPage.tsx` | Upload e geração de cautela PDF |

### Componentes-chave em ColaboradorDrawer
- `MergedEpi`: tipo que inclui `_is_evento_pendente`, `_status_evento`, `_data_limite_evento`, `_evento_id`
- `PendingReturnBanner`: banner laranja/vermelho com contador de dias úteis + botão "Desmarcar"
- `diasUteisRestantes()`: calcula dias úteis entre hoje e `data_limite`
- `mergedEpis`: useMemo que filtra `[DEV]`/`[TROCA]` e projeta seu status no item original
- `EditField`: campo inline com `saving?: boolean` (spinner por campo durante sync com Monday)
- `updateInfo` mutation: salva phone/técnico no Monday em tempo real

---

## Backend (`backend/routes/api.js`)

### Endpoints relevantes
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/colaborador/:cpf` | Busca colaborador por CPF |
| PATCH | `/api/epi/:id/entregar` | Confirma entrega física |
| PATCH | `/api/epi/:id/devolver` | Cria subitem `[DEV]` com status/destino |
| PATCH | `/api/epi/:id/trocar` | Cria subitem `[TROCA]`, novo item Pendente de Receber |
| PATCH | `/api/epi/:id/reverter-devolucao` | Deleta `[DEV]`, reverte original para "Entregue" |
| PATCH | `/api/epi/:id/concluir-devolucao` | Atualiza `[DEV]` existente com destino final + foto |
| PATCH | `/api/epi/:id/agendar-devolucao` | Muda status para "Aguardando Devolução" |
| PATCH | `/api/colaborador/:id/status` | Atualiza status_acao / motivo_acao do item pai |
| PATCH | `/api/colaborador/:id/info` | Atualiza telefone / técnico responsável (sync Monday) |
| PATCH | `/api/epi/:id/atualizar` | Atualiza tamanho, quantidade, status do subitem |
| GET | `/api/gestao/epis` | Lista todos colaboradores + subitens + KPIs |
| GET | `/api/estoque3` | SKUs do Estoque 3 (balcão de reaproveitamento) |
| POST | `/api/cautela/upload` | Upload multipart do PDF de cautela |
| POST | `/api/webhook/admissao` | Cadastro manual de admissão |

### Regra dos 3 dias úteis (Não Devolvido)
- Frontend calcula `data_limite = addBusinessDays(3)` e envia no payload de `/devolver`
- Backend salva em `COLS_SUB_GESTAO.DATA_LIMITE`
- Frontend exibe countdown no `PendingReturnBanner`
- Durante o prazo: botão "Desmarcar" chama `/reverter-devolucao`
- Após o prazo: valor pode ser descontado em folha (CLT art. 462)

---

## Webhook ZapSign (NÃO IMPLEMENTADO — contrato para reimplementação futura)

> Implementação anterior (`backend/routes/zapsign.js`) foi removida em 2026-04-30 por estar quebrada (importava `services/monday.js` inexistente) e insegura. Esta seção preserva o contrato para a reimplementação correta.

### Propósito
Quando o ZapSign confirma que todos os signatários assinaram a cautela, o webhook recebe a URL temporária do PDF assinado e anexa o arquivo ao item pai do colaborador no Monday (coluna `COLS_GESTAO.CAUTELA_ASSINADA` = `file_mm1z1gbf`). Sem esse webhook, a premissa "documento assinado é a única fonte da verdade" não fecha.

### Contrato do payload (`POST /api/webhook/zapsign`)
```json
{
  "event_type": "doc_signed",
  "status": "signed",                  // "pending" enquanto faltam signatários
  "external_id": "<monday_item_id>",   // gravado quando o doc foi criado no ZapSign
  "signed_file": "<url_s3_temp_60min>",
  "token": "<doc_token>"
}
```
Processar somente quando `event_type === "doc_signed"` E `status === "signed"`. Responder `200 OK` imediatamente e processar de forma assíncrona (ZapSign tem timeout curto).

### Requisitos OBRIGATÓRIOS antes de plugar em produção
1. **Verificação HMAC** — header `X-Zapsign-Signature` com HMAC-SHA256 do body, segredo em `ZAPSIGN_WEBHOOK_SECRET`. Sem isso, atacante forja cautela "legalmente assinada".
2. **Allowlist de hosts para `signed_file`** — restringir o `fetch` ao domínio S3 do ZapSign. Sem isso, é SSRF aberto (atacante força backend a baixar `http://169.254.169.254/...` ou `http://localhost:3001/...`).
3. **Dedup por `token`** — guardar tokens processados (em Monday ou Redis) e ignorar repetidos. ZapSign reenvia em caso de falha — sem dedup, anexa o mesmo PDF N vezes.
4. **Validação de magic bytes** — confirmar que o buffer começa com `%PDF` antes de subir ao Monday. Cliente de S3 pode ter sido comprometido.
5. **Limite de tamanho** — rejeitar `>= 10MB` antes de baixar (header `Content-Length`).

### Upload ao Monday
Usar `add_file_to_column` mutation com `multipart/form-data` (texto + binário simultâneos). A função antiga `uploadArquivo(itemId, columnId, buffer, mime, filename)` deve ser implementada em `services/graphql.js` (ou novo `services/monday-files.js`) — não criar um novo `services/monday.js` paralelo.

---

## Variáveis de ambiente
```
VITE_API_URL=http://localhost:3001/api   # frontend (.env raiz)
MONDAY_API_TOKEN=...                     # backend (backend/.env)
ZAPSIGN_API=...                          # backend (backend/.env)
ZAPSIGN_WEBHOOK_SECRET=...               # backend (a configurar quando webhook for reimplementado)
```

**Importante:** `.env` e `.env.*` estão no `.gitignore` (raiz e `backend/`). Use `.env.example` como template. Tokens reais NUNCA devem ser commitados.
