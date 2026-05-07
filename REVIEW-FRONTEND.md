# Frontend Code Review — epi-manager

**Files reviewed:** 24 (~7,500 lines)
**Findings:** 7 critical · 14 high · 9 medium · 6 low · 4 needs_verification

Reviewed: 2026-04-30
Stance: adversarial — every finding assumes the bug exists until proven otherwise.

---

## CRITICAL

### [C-01] `mergedEpis` collapses multiple `[DEV]`/`[TROCA]` events into one — race condition with stacked events — `src/app/pages/ColaboradorDrawer.tsx:538-564`

`mergedEpis` matches each non-event subitem with `eventos.find(...)` (first match wins). The lookup compares only the cleaned name (case-insensitive) — there is no ordering, no `created_at` tiebreak, no status priority.

Concrete failure modes:
1. **Two `[DEV]` for the same EPI exist simultaneously** (e.g. one from a past devolução that was later concluded as `Reaproveitável`, plus a new active `[DEV] Aguardando Devolução`). `find` returns whatever Monday returned first — could be the historical one. The condition `event.status === MON_NAO_DEV || event.status === MON_AG_DEV` filters out the inactive one, but if BOTH happen to be active (`[DEV] Aguardando Devolução` followed by `[DEV] Não Devolvido` for a re-attempt), only one wins. The user sees the wrong banner color, wrong `data_limite`, wrong `_evento_id` — and the "Desmarcar" button reverts the wrong event subitem.
2. **`[DEV]` exists but the original is already `[TROCA]`'d.** Filter on line 539 (`!/^\[(DEV|TROCA)\]/i.test(s.nome)`) excludes the `[TROCA]`'d original from `normais`, so `[DEV]` becomes orphaned and never renders. The user sees the EPI vanish from the drawer entirely — no banner, no card, no audit. Compliance gap: the "Não Devolvido" countdown for a now-replaced item silently disappears.
3. **The `[TROCA]` event is filtered into `eventos` but never used.** The `find` block at line 545 will still match a `[TROCA]` subitem because `/^\[(DEV|TROCA)\]/` covers both — but the status `Pendente de Receber` (or whatever the new troca generates) is NOT in the `isAtivo` whitelist on line 550, so the code silently drops back to the original. Behaviorally this hides recently-issued trocas from view.

**Fix:**
```ts
// Sort eventos by status priority (active > não_dev > resolved), then by id desc as tiebreak
const eventos = colab.subitens
  .filter(s => /^\[(DEV|TROCA)\]/i.test(s.nome))
  .sort((a, b) => {
    const prio = (s: string) => s === MON_AG_DEV ? 0 : s === MON_NAO_DEV ? 1 : 99;
    return prio(a.status) - prio(b.status) || Number(b.id) - Number(a.id);
  });

// Match also against [TROCA]'d originals so they still show up
const merged = normais.map(epi => {
  const nomeLimpo = epi.nome.trim().toLowerCase();
  const event = eventos.find(e =>
    e.nome.replace(/^\[(DEV|TROCA)\]\s*/i, '').trim().toLowerCase() === nomeLimpo,
  );
  // ...
});

// Render orphan [DEV]/[TROCA] events whose original was filtered out
const orphanEventos = eventos.filter(e => {
  const base = e.nome.replace(/^\[(DEV|TROCA)\]\s*/i, '').trim().toLowerCase();
  return !normais.some(n => n.nome.trim().toLowerCase() === base);
}).map(e => ({ ...e, nome: e.nome.replace(/^\[(DEV|TROCA)\]\s*/i, '') }));
return [...merged, ...orphanEventos, ...cautelas] as MergedEpi[];
```

---

### [C-02] `diasUteisRestantes` returns the COMPLEMENT of expected sign for already-passed dates — `src/app/pages/ColaboradorDrawer.tsx:81-94`

The function is the pivot of the CLT art. 462 deduction. It is wrong.

When `cursor >= limite` (today is already past the deadline), the loop is `while (cursor > limite)` — but `cursor` was just set to today, and `limite` is in the past. The `cursor.setDate(cursor.getDate() - 1)` walks BACKWARD; each business-day step subtracts 1 from `count`. Result: a deadline that passed 2 business days ago returns `-2`. So far so good — except when `cursor === limite` exactly (deadline is today, but condition `cursor >= limite` is true), the inner loop's condition `cursor > limite` is false on entry, so the function returns `0`. The "vencido" banner check on line 337 is `dias < 0` — meaning a deadline that expires TODAY shows "0 dia(s) restante(s)" in orange, not red, and is NOT considered overdue.

**Why this matters:** the backend (per CLAUDE.md) treats day 3 as the cutoff for art. 462 deduction. The frontend will show "0 dias restantes" with the orange (FF7575) banner color, while payroll already considers the deduction valid. The technician thinks they have one more day to "Desmarcar" — they do not.

Additionally: timezone bug. `new Date(dataLimite)` parses `"2026-04-30"` as UTC midnight. `setHours(0,0,0,0)` then sets local-midnight. In Manaus (UTC-4), the limite becomes April 29 20:00 local, then setHours pushes it back to April 29 00:00 — **shifting the deadline by a full day backward**. So a colaborador whose backend `data_limite` is "2026-04-30" sees "Vencido há 1 dia" on the morning of April 30 in Manaus.

**Fix:**
```ts
function diasUteisRestantes(dataLimite: string | null): number | null {
  if (!dataLimite) return null;
  // Parse YYYY-MM-DD as LOCAL date, not UTC
  const [yy, mm, dd] = dataLimite.slice(0, 10).split('-').map(Number);
  if (!yy || !mm || !dd) return null;
  const limite = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  if (hoje.getTime() === limite.getTime()) return 0;

  let count = 0;
  const cursor = new Date(hoje);
  const dir = cursor < limite ? 1 : -1;
  while (cursor.getTime() !== limite.getTime()) {
    cursor.setDate(cursor.getDate() + dir);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) count += dir;
  }
  return count;
}
```
And consider `dias <= 0` for the red/vencido state, since "0 days left" is operationally already past the deduction-eligible threshold.

---

### [C-03] `addBusinessDays` uses today's local date but emits an ISO via `toISOString` — date shifts back by 1 in Brazil — `src/app/pages/DevolucaoPage.tsx:54-70, 306`

```ts
function addBusinessDays(days: number): Date {
  let d = new Date();           // local "now"
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);  // increments local
    ...
  }
  return d;
}
function toIso(d: Date): string {
  return d.toISOString().split('T')[0];  // UTC slice
}
// ...
data_limite: prazo ? toIso(prazo) : undefined,
```

In Manaus (UTC-4), at 21:00 local on a Monday, `new Date()` is Tuesday 01:00 UTC. After `+3 dias úteis` of local arithmetic the local result is Thursday. `toISOString()` returns Friday-something but `.split('T')[0]` is **Thursday's UTC slice = same date as local**. Now run the same code at 02:00 local Tuesday — local is Tuesday but UTC is Tuesday 06:00 → fine. Run at 22:00 Monday local: local is Monday, UTC is Tuesday 02:00 → after `+3` local = Thursday but `toISOString` is Thursday 02:00 UTC = Thursday → still fine.

**The actual breakage:** when the technician operates at 21:00–23:59 in Manaus on a Friday with `+3 business days` expected to land on Wednesday, the date arithmetic is local but ISO conversion can flip the date forward. Combined with **C-02**'s reverse-direction parsing in `diasUteisRestantes`, the rendered countdown may be off by one or even two days.

There is also a more direct hazard: the "Prazo final" displayed in `Regra3DiasPanel` (`fmtDate(prazo)`) is calculated from `addBusinessDays(3)` rendered via `toLocaleDateString('pt-BR')` — local time. The payload sent to the backend uses `toIso(prazo) = prazo.toISOString().split('T')[0]` — UTC. **The user sees one date, the backend stores another.** Whenever a technician works in the late evening in Manaus (UTC-4) or São Paulo (UTC-3), the displayed "Prazo: 03/05/2026" can be saved as "2026-05-04" on the backend.

**Fix:**
```ts
function toIso(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
```

---

### [C-04] `EditField` commit comparison strips whitespace from `val` but not from `value` — invisible save loop / lost edits — `src/app/pages/ColaboradorDrawer.tsx:244-247`

```ts
const commit = useCallback(function() {
  setEditing(false);
  if (val.trim() !== value) onSave(val.trim());
}, [val, value, onSave]);
```

If Monday returns telefone1 with trailing whitespace (`"92999999999 "`), every edit-blur cycle re-fires `onSave` because `val.trim() !== "92999999999 "` is always true. This causes:
- Toast spam on every blur
- Optimistic update flickers in the cache
- Eventually backend sees a phantom write each time the field is touched

Conversely, if user types `" 9299"` and blurs, `val.trim() = "9299"`, comparison vs `value = ""` says "different" → save fires correctly. But on a second edit where the user re-types EXACTLY what's in Monday, the trim discrepancy fires another save.

**Fix:** trim both sides:
```ts
if (val.trim() !== value.trim()) onSave(val.trim());
```

Also: `EditField` re-syncs `val` from `value` only when `!editing` (line 242). If the user is editing and the React Query refetch returns new data for the same field, `val` stays stale — the user pastes their new number, blurs, save sends, then the optimistic cache is overwritten by the in-flight stale refetch (the `onSettled` invalidate races with the user). Combine with **C-05** below.

---

### [C-05] Optimistic update in `updateInfo` mutation can lose writes when user closes drawer mid-save — `src/app/pages/ColaboradorDrawer.tsx:580-603`

The mutation lifecycle:
1. `onMutate`: cancels in-flight queries, writes optimistic patch to cache, returns `prev` for rollback.
2. `onError`: restores `prev` cache.
3. `onSettled`: invalidates `gestao-epis`.

Problem 1 — drawer unmount mid-save: closing the drawer (user clicks backdrop or ESC) does not cancel the mutation. The mutation finishes, `onSettled` invalidates the query, and React Query refetches `gestao-epis` from Monday. But Monday is eventually-consistent — the freshly written telefone1 may not yet be reflected (the GraphQL read can return stale-by-300ms). The refetch overwrites the local cache with the OLD value, the user closes the drawer thinking the save succeeded, reopens 5 seconds later, and sees the old value. Then THEY save again.

Problem 2 — `setSavingField` is set in `mutationFn`, not `onMutate`. The spinner only appears AFTER `onMutate` finishes (which awaits `cancelQueries`). For 50–500ms, `EditField` shows the pencil icon, not the spinner — the user might click and edit again, racing with the in-flight save.

Problem 3 — line 583: `setSavingField(opts.field)` runs inside `mutationFn`. If `mutationFn` is called synchronously and the mutation succeeds in cache-only mode (it can't here, but the structure is wrong), `setSavingField` would never be cleared except on `onSettled`. Acceptable, but `setSavingField` should be in `onMutate` to be in sync with the optimistic UI.

Problem 4 — `onSettled` always invalidates, even after error. After `onError` rolls back, the invalidate refetches and *might* overwrite the rollback with whatever Monday currently has (which could be different again if a separate write happened). Race-prone.

**Fix:** In `ColaboradorDrawer.tsx:526` ColaboradorDrawer's parent (`GestaoEpisPage.tsx:511-515`), `useEffect` already mirrors `data` into local `sel`. That helps with stale display but does not fix the unmount-mid-save case. Recommended:
- Move `setSavingField` to `onMutate`/`onSuccess`/`onError`.
- Wrap mutation in `useMutation({ ... })` at a parent that survives drawer close (the page level), or use `mutationKey` so `useMutation`'s cache is shared and the spinner persists.
- Add a brief delay in `onSettled` before invalidating (Monday eventual-consistency tolerance), or skip invalidate on success entirely and trust the optimistic value (`onSettled: undefined`).

---

### [C-06] CPF mismatch: backend expects digits only but `BuscaPage` renders the formatted CPF inside the result card without re-fetching — and `ColaboradorDrawer` shows `colab.cpf` straight from the API which can be raw OR formatted depending on Monday config — `src/app/pages/BuscaPage.tsx:332`, `src/app/pages/ColaboradorDrawer.tsx:686, 502`

`BuscaPage.tsx:332`: `<InfoChip label="CPF" value={cpfDisplay} />` — `cpfDisplay` is the **input string** (formatted). If Monday returns `cpf` in `data` it is ignored. Visual: not a bug. But:

`GestaoEpisPage.tsx:502`: search filter does `c.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, ''))`. Fine.

`ColaboradorDrawer.tsx:686`: `<div>{cpfDisplay}</div>` where `cpfDisplay = colab.cpf ? colab.cpf : '-'`. **Whatever raw value Monday stored**. If Monday stores `12345678901`, the user sees `12345678901` (not formatted). If Monday stores `123.456.789-01`, the user sees that. Inconsistent UX.

`AdmissaoPage.tsx:82`: `{colab.cpf || '—'}` — same.

`ColaboradoresPage.tsx:124`: same.

The `formatCpf` util exists in `src/utils.ts:1` but is never applied to backend-returned CPFs — only to user input. **Fix:** apply `formatCpf(colab.cpf)` everywhere a CPF is displayed.

`NovoColaboradorModal.tsx:429` (inside `GestaoEpisPage`): the CPF input has NO formatting (no `formatCpf` call), no `validarCpf` check, no `maxLength`. The user can type `123.456.789-01` and submit; backend gets `"123.456.789-01"` raw. Then `buscarColaborador("123.456.789-01")` → `cpf.replace(/\D/g, '')` → `"12345678901"` → 404 lookup mismatch later because the stored value has dots. **High impact: corrupt data in Monday.**

**Fix:**
```tsx
<input style={inp} value={cpf}
  maxLength={14}
  inputMode="numeric"
  onChange={e => setCpf(formatCpf(e.target.value))} />
// In mutation body:
mutationFn: () => criarColaborador({ ..., cpf: cpf.replace(/\D/g, '') }),
```

---

### [C-07] `criarSubitemMutation` uses non-ASCII emoji in label — request body may break in environments without UTF-8 — `src/app/pages/CautelaCheckPage.tsx:67`

```ts
criarSubitemCautela(selectedColaborador!.id, `📋 CAUTELA — ${...}`)
```

The 📋 emoji and the en-dash `—` are encoded fine via JSON over HTTPS. However: Monday's column-name and item-name handling has historically rejected emojis or stripped them silently. If Monday strips the emoji, the next `checkCautela` call won't find the subitem by name match. Not strictly broken, but fragile. **Suggested fix:** drop emoji, use `'CAUTELA - ' + new Date()...`.

Also note `selectedColaborador!.id` — non-null assertion. If `selectedColaborador` is `null` (race: user clicks "Criar e anexar" but a re-render cleared selection), this throws `Cannot read of null`. The disable check on line 404 only guards `criarSubitemMutation.isPending`, not the null-safety of `selectedColaborador`. **Hard fix:** guard at click site:
```tsx
onClick={() => {
  if (!selectedColaborador) return;
  criarSubitemMutation.mutate();
}}
```

---

## HIGH (visual / UX)

### [H-01] `PendingReturnBanner` threshold off-by-one: orange shown when status is `Não Devolvido` if `_status_evento` is missing — `src/app/pages/ColaboradorDrawer.tsx:334-347`

```ts
const statusEvento = sub._status_evento ?? MON_AG_DEV;
const isNaoDevolvido = statusEvento === MON_NAO_DEV;
```

If for any reason `_status_evento` is undefined but the `_is_evento_pendente` flag is true (this can happen if `mergedEpis` runs while `event.status` is somehow falsy — empty string from Monday), `statusEvento` defaults to `MON_AG_DEV` (orange), and `isNaoDevolvido` is `false`. The user sees an "Aguardando Devolução" banner for an EPI that should be "Não Devolvido" (red). The wrong color masks the urgency, and the wrong label shows on the modal.

**Reproduction:** any time Monday's column returns an empty status string — happens during Monday's GraphQL eventually-consistent reads after a status mutation. Race window: 0–500ms after `concluir-devolucao` invalidates the query.

**Fix:**
```ts
const statusEvento = sub._status_evento || sub.status;  // fall through to merged status
```

### [H-02] `vencido` UI logic uses `dias < 0` — exactly-0 days renders incorrectly — `src/app/pages/ColaboradorDrawer.tsx:337`

```ts
const vencido = dias !== null && dias < 0;
```
Combined with [C-02]'s `count = 0` for "deadline is today": the prazo expires today → `vencido = false` → orange banner with `prazoColor = '#FDAB3D'` and label "0 dia(s) restante(s)" on what is operationally a hard deadline day. User sees no urgency on the day they MUST act.

**Fix:** `const vencido = dias !== null && dias <= 0;` (and also display "Hoje é o prazo final" for `dias === 0`).

### [H-03] `StatusBadge` does not cover Monday-exact statuses with accents — defaults to gray "A Definir" — `src/app/components/StatusBadge.tsx:66`

`STATUS_CONFIG` keys are typed as `EpiStatus` (defined in `types.ts:5`) — but the actual Monday API returns labels like `"Reaproveitavel"` (no accent on `á` per a Monday config quirk), `"Enviado Estoque 3"`, `"Troca / Desgaste"`, `"Aguardando Assinatura"`. None of these are mapped — they fall back to the gray "A Definir" pill via `STATUS_CONFIG[status] ?? STATUS_CONFIG['A Definir']`.

You can see the project's own evidence in `ColaboradorDrawer.tsx:38-54` where the `SS` palette explicitly lists `[ST_ESTOQUE3]: 'Enviado Estoque 3'` and `'Reaproveitavel'` (no accent) as separate keys. The Drawer's `Chip` component handles them; `StatusBadge` does not. Wherever `StatusBadge` is used (e.g. `BuscaPage:453`, `EntregaPage:173`), an EPI in `Reaproveitavel` (no accent) renders as a gray "A Definir" pill — visual bug + breaks the user's mental model.

**Fix:** add the missing keys, including the un-accented alias and event prefixes.

### [H-04] `StatusBadge` only handles 7 enums — does not show event prefixes `[DEV]`/`[TROCA]` — by design, but tested usage in `EntregaPage:173` will pass through Monday strings that may not match — `src/app/components/StatusBadge.tsx`

`EntregaPage:173` does `<StatusBadge status={epi.status} />` where `epi: EpiSubitem` (not `EpiSubitemGestao`). The `EpiStatus` typing implies safety, but `BuscaPage`'s API call (`buscarColaborador`) returns `ColaboradorData` whose `subitens` are typed as `EpiSubitem` with `status: EpiStatus` — yet the backend can return any Monday string (e.g. `"Enviado Estoque 3"`). TypeScript happily accepts the runtime mismatch because the type is asserted at API boundary, not validated.

Falls into the "default gray pill" trap.

### [H-05] `mergedEpis` shows the original EPI as `Entregue` for resolved devolutions — but `data_devolucao` is from the original (`null`) not the resolved event — `src/app/pages/ColaboradorDrawer.tsx:549-559`

For resolved devolutions (event status is `Reaproveitável` or `Descarte/Dano`), the `if (isAtivo)` branch at line 551 is false — so the code returns the ORIGINAL `epi` unchanged. The original's `status` is still `Entregue`, `data_devolucao` is null. **The user sees `Entregue` for an EPI that has actually been concluded as Reaproveitável.** The Reaproveitável "card" only renders if it appears as its own row in the list — which it does NOT, because the prefix filter on line 539 excludes it.

So: an EPI with full lifecycle Pendente → Entregue → [DEV] Aguardando → [DEV] Reaproveitável shows up in the drawer as an `Entregue` EPI with active "Devolução"/"Troca" buttons. The technician can click "Devolução" again and create a stacked second devolução. **Compliance failure: rastreabilidade por empilhamento becomes audit chaos.**

**Fix:** when an event exists with a terminal status (`Reaproveitável`, `Descarte/Dano`), project that status onto the original instead of dropping it:
```ts
if (event) {
  return {
    ...epi,
    status: event.status,
    data_devolucao: event.data_devolucao || epi.data_devolucao,
    data_limite: event.data_limite || epi.data_limite,
    _evento_id: event.id,
    _is_evento_pendente: event.status === MON_AG_DEV || event.status === MON_NAO_DEV,
    _status_evento: event.status,
  };
}
```
And gate the "Devolução"/"Troca" buttons in `EpiCard:411` on `!isHistorico` AND on `sub.status === ST_ENTREGUE` (which won't be true once the projection is fixed).

### [H-06] Toast stack overflow: 4.5s auto-dismiss but no max stack — burst of failed mutations puts dozens of toasts on screen — `src/app/contexts/ToastContext.tsx:36-40`

`push` always appends. If a network blip causes 8 retries on `gestao-epis` failed actions (each toasting), the user gets 8 toasts stacked at the bottom right. There is `maxWidth: 380, width: '90vw'` but no `maxHeight` and no max-count — they simply stack and overflow off-screen.

**Fix:**
```ts
const push = useCallback((type, message) => {
  const id = ++toastId;
  setToasts(prev => [...prev.slice(-4), { id, type, message }]); // cap at 5
  setTimeout(() => dismiss(id), 4500);
}, [dismiss]);
```

Also: deduplicate identical messages within a short window (debounce by message+type within 1s).

### [H-07] `ToastContext`'s module-level `let toastId = 0` — survives HMR but resets on full reload; not a bug, but causes id collisions if multiple Provider instances mount — module-level state

Unlikely in production, but in development with React StrictMode + HMR this can cause the same numeric id to dispatch twice. Use `useRef` or a closure-scoped counter inside the Provider.

### [H-08] `Header.tsx:5-13` — `ROUTE_TITLES` missing `/gestao` and `/admissao` — the two routes actually exposed in the sidebar — `src/app/components/Header.tsx`

`/gestao` and `/admissao` are the visible routes (per `Sidebar.tsx:17-20`), but the `ROUTE_TITLES` map has neither. Result: `route = { title: '', crumbs: ['Operações'] }` → header renders an empty `<h1>` and a meaningless "Operações" breadcrumb. Visual bug on the most-visited screens. The user sees the page-level `<h2>` ("Gestão de EPIs", "Admissão") inside each page, but the header shell is bare.

**Fix:** add entries:
```ts
'/gestao':   { title: 'Gestão de EPIs',  crumbs: ['Operações', 'Gestão'] },
'/admissao': { title: 'Admissão (AS0)',  crumbs: ['Cadastro', 'Admissão'] },
```

### [H-09] `validarCpf` reads `parseInt(digits[i])` without radix — returns NaN for unexpected chars after strip — `src/utils.ts:17, 19`

`parseInt` without radix is fine for `0-9`, but `digits` came from `cpf.replace(/\D/g, '')` so only digits remain. Style nit. **Real issue:** the algorithm has no edge-case handling for empty string after replace (`digits.length === 0` returns true → false branch on line 12). OK. Lower severity.

### [H-10] `LoginPage` "Quick Select" sets email but does NOT auto-submit — UX dead end — `src/app/pages/LoginPage.tsx:34-37`

Clicking a tecnico card just fills the email; the user must then click "Entrar". Most users (especially mobile) expect a single tap. Visual cue is a highlighted tecnico card with no indicator that another action is required. Not a bug, but degrades flow.

**Fix:** auto-submit after `setEmail`:
```ts
function handleQuickSelect(tec: Tecnico) {
  setEmail(tec.email);
  setError('');
  setLoading(true);
  setTimeout(() => {
    localStorage.setItem('epi_tecnico', JSON.stringify(tec));
    navigate('/');
  }, 350);
}
```

### [H-11] `Root.tsx` inactivity timer fires `navigate('/login')` even if already on `/login` — and the timer is initialized on `LoginPage` mount via the Root effect — wait, Root is not used on `/login` — fine. But: any focus/scroll in a *modal* outside Root tree (some toasts? unlikely) won't reset the timer. — `src/app/Root.tsx:8-32`

Lower priority. The bigger issue: `INACTIVITY_MS = 15 * 60 * 1000` resets on `mousemove` — virtually any cursor twitch keeps the session alive. That's intended behavior, just noting that the "auto-logout" is largely cosmetic.

### [H-12] `Sidebar` `isActive` matches `path + '/'` — `/admissao` would match `/admissao/anything`, but `path === '/'` would match every route — defensive but the condition is `location.pathname.startsWith(path + '/')` so `/` would check `startsWith('//')` — fine. — `src/app/components/Sidebar.tsx:27-29`

No real bug. But for a future `path: '/'` it would silently fail; flag as defensive.

### [H-13] `EpiCard` shows the "Devolução"/"Troca" actions when `sub.status === ST_ENTREGUE` — but for an EPI that is the ORIGINAL of a `[DEV] Aguardando Devolução` event (per [C-01]/[H-05]), the original's status is still `Entregue` — and we render the buttons even though `isPendente` should hide them — `src/app/pages/ColaboradorDrawer.tsx:490`

The condition `!isPendente && mostrarBotoes && sub.status === ST_ENTREGUE` correctly hides the buttons when `_is_evento_pendente` is true. But because of [C-01], a stacked-event scenario can yield `_is_evento_pendente = false` for an EPI that DOES have an active `[DEV]` (the algorithm just couldn't match it). User clicks "Devolução" → backend creates a SECOND `[DEV]` subitem → audit nightmare.

The fix is C-01.

### [H-14] No empty state for `epis.length === 0` filtered list in `GestaoEpisPage` — only "Nenhum colaborador encontrado" — `src/app/pages/GestaoEpisPage.tsx:676-693`

Covered. But: when API returns `colaboradores: []` (real empty state, not search-filtered), the same "Nenhum colaborador encontrado" message shows with "ajuste filtros" subtitle — misleading. **Fix:** branch on whether filters are active.

---

## MEDIUM

### [M-01] Direct `import('../../api')` inside `mutationFn` — `src/app/pages/DevolucaoPage.tsx:287`, `src/app/pages/TrocaPage.tsx:163`

```ts
mutationFn: async () => {
  const { apiClient } = await import('../../api');
  ...
}
```
Dynamic import inside a mutation = a network round-trip's worth of latency on first invocation in production builds (Vite chunks `api.ts` separately). Also bypasses the typed wrapper functions (`devolverEpi`, `trocarEpi`) that already exist in `api.ts:65-88`. The page-level `apiClient.patch(...)` calls are inconsistent with the rest of the codebase.

**Fix:** statically import `apiClient` at top of file (or better: add `concluirDevolucao(eventId, payload)` to `api.ts` and use the typed function).

### [M-02] `entregarEpi` calls `apiClient.patch('/epi/.../entregar')` but `EntregaPage` still invalidates `['colaborador']` only — the new entrega does NOT refresh `gestao-epis` — `src/app/pages/EntregaPage.tsx:61`

```ts
queryClient.invalidateQueries({ queryKey: ['colaborador'] });
```
After entrega, the user navigates back to `/busca` (line 63) which uses `['colaborador', cpfSearch]` — this works. **But** if the user later opens `/gestao`, the cached `gestao-epis` query is up to 30s stale and still shows `Pendente de Receber`. Inconsistency until the next `refetchInterval`.

**Fix:** invalidate both:
```ts
queryClient.invalidateQueries({ queryKey: ['colaborador'] });
queryClient.invalidateQueries({ queryKey: ['gestao-epis'] });
```

### [M-03] `BuscaPage` calls `setColaborador(result)` inside `queryFn` — side effect during a query function — `src/app/pages/BuscaPage.tsx:38-42`

This is React Query anti-pattern: side effects in `queryFn` fire on every fetch including retries and background refetches. Better: use `useEffect` on `data`. As-is, opening BuscaPage with cached data does NOT update the context (queryFn isn't called); navigating away and back triggers a sync only if the cache miss/refetch happens.

### [M-04] No file-type validation on `AdmissaoPage.ModalAnexar` — only size — `src/app/pages/AdmissaoPage.tsx:16-22`

```ts
function handleFile(f: File) {
  setErr('');
  if (f.size > 10 * 1024 * 1024) { setErr('Máx. 10 MB.'); return; }
  // no MIME check!
}
```
User can select a `.exe` and upload it as a "cautela." Backend should validate, but the frontend should not allow it. Compare with `CautelaUploadPage.tsx:68-73` which DOES check MIME.

**Fix:**
```ts
const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
if (!allowed.includes(f.type)) { setErr('Apenas PDF, JPEG, PNG ou WebP.'); return; }
```

### [M-05] `CautelaPage` `uploadMutation` passes empty string as subitem_id — backend behavior unclear — `src/app/pages/CautelaPage.tsx:74-75`

```ts
mutationFn: () => uploadCautela(pdfFile!.base64, pdfFile!.nome, ''),
```
The comment says "sem subitem_id no modo manual+anexar" but `uploadCautela` (api.ts:150) always sends `subitem_id` in the body. Backend behavior with `subitem_id: ""` is undefined — best case it errors out; worst case it attaches the PDF to a random item. **Verify against backend; ideally use `null` or omit.**

### [M-06] `CriarCautelaModal` — `gerarPDF` `try/catch(_)` swallows `addImage` errors silently — bad signature data produces unsigned PDF — `src/app/pages/CriarCautelaModal.tsx:98, 104`

```ts
if (sigColab){try{doc.addImage(sigColab,'PNG',M,y-18,64,18);}catch(_){}}
```
If `sigColab` is malformed (e.g. canvas threw a security error), the signature is silently dropped and a blank line is drawn. Operator believes the PDF was signed; auditor finds it wasn't. **Fix:** rethrow or surface a toast on `catch`.

### [M-07] `CriarCautelaModal:122` — JSON.parse of `localStorage.getItem('epi_tecnico') || '{}'` swallows errors but the IIFE wraps another try/catch — convoluted — `src/app/pages/CriarCautelaModal.tsx:122`

```ts
const tecnico = (()=>{ try { return JSON.parse(localStorage.getItem('epi_tecnico')||'{}').nome||'Tecnico SESMT'; } catch { return 'Tecnico SESMT'; } })();
```
Use the existing `getTecnicoFromStorage()` helper from `src/utils.ts:31`.

### [M-08] `CautelaPage` — `let rowId = 0` at module level — survives across navigation but means after enough adds the id is huge but unique — not really a bug, but can collide across instances of the page if module is HMR'd

Lower-priority; consider `useRef`/`useState` instead.

### [M-09] `LocationState` typing in CautelaUploadPage (`subitem_id?: string`) — but the page hard-fails if missing — should use a non-optional type — `src/app/pages/CautelaUploadPage.tsx:19-22, 40-53`

Type erodes safety. The early return does the runtime check; type should reflect the contract more strictly.

---

## LOW / INFO

### [L-01] Hardcoded color literals everywhere — inconsistent palette
There are at least 6 different "red" colors (`#EF4444`, `#E2445C`, `#FCA5A5`, `#FF7575`, `#F87171`, `#dc2626`), 4 oranges, 5 grays. Maintenance pain. Centralize in a palette token file.

### [L-02] `Sidebar.tsx:17-20` only has 2 nav items but the codebase has many more pages (`/entrega`, `/devolucao`, `/troca`, `/busca`, `/cautela/upload`) — these are reachable only via deep links. Intentional? If yes, fine. If no, expose them.

### [L-03] No `aria-label` on icon-only buttons (X close, Save pencil, RotateCcw "Desmarcar"). Screen-reader users hear "button" with no context.

### [L-04] `let toastId = 0;` (`ToastContext.tsx:27`) — already flagged in H-07.

### [L-05] `extractErrorMessage` typecast `as AxiosError<...>` — doesn't actually verify the shape, just trusts it. Low risk.

### [L-06] `useRef<HTMLInputElement>(null)` patterns everywhere repeat the file-upload boilerplate (CautelaPage, CautelaUploadPage, EntregaPage, DevolucaoPage, AdmissaoPage). A `useFileUpload` custom hook would dedupe ~150 lines. Quality nit.

---

## NEEDS_VERIFICATION

These need a browser check to confirm:

### [V-01] TS17008 regression check — all `style={{ ... }}` with ternaries and template literals
A grep across `src/app/pages/*.tsx` shows several instances that LOOK like they could trigger TS17008, including:
- `DevolucaoPage.tsx:165` — `'#EF4444'` vs `'#FBBF24'` ternary inside a JSX attribute, but with single-quote concat — should be safe.
- `ColaboradoresPage.tsx:227-228` — `${border}` template literal in `boxShadow` set directly inside a ternary callback. **Possible regression vector.**
- `CriarCautelaModal.tsx:276-278` — `border: sel ? \`2px solid ${accent}\` : '...'` — INLINE TEMPLATE LITERAL IN TERNARY. CLAUDE.md flags this as a build-breaker.

I cannot tell from static read alone whether the TSC build is currently passing. Run `npm run build` to confirm. If it fails, refactor lines 276-278 of CriarCautelaModal to use string concat or extract to a variable.

### [V-02] PDF upload over weak network — does the spinner stay stuck if connection drops mid-upload?
Axios timeout is 15s (`api.ts:20`). 10MB file on slow 3G can exceed that. Behavior on timeout: rejects → toastError → spinner clears. Acceptable, but verify the toast actually shows. No retry logic in `uploadCautela`.

### [V-03] `colaboradores: data?.colaboradores ?? []` consistency — if the API returns `data` as `undefined` (cold start, error), the empty array prevents crashes. Confirm no path crashes on undefined.

### [V-04] Drawer reopen with prior data — `GestaoEpisPage.tsx:511-515` syncs `sel` with refreshed `data?.colaboradores`. If you close drawer A and immediately reopen B before refetch completes, the spinner-stuck `savingField` from drawer A may carry into drawer B's component because the mutation continues in flight. Verify by manually clicking Save in drawer A, closing, opening drawer B before the request resolves.

---

## Summary

The most damaging issues are concentrated around the **3-business-day countdown logic** ([C-02], [C-03]) and the **`mergedEpis` event-projection algorithm** ([C-01], [H-05]). Both are timezone- and stacking-sensitive and can produce silent compliance failures (wrong CLT 462 deduction date, wrong audit trail, hidden EPIs). Fix these before anything else.

The **CPF formatting drift** ([C-06]) is a slow data corruption: every manual `NovoColaboradorModal` submission with formatted input writes `123.456.789-01` into Monday, which then breaks every downstream lookup using digits-only.

Visually, the **`StatusBadge` mapping gaps** ([H-03], [H-04]) and the **missing header titles for `/gestao` and `/admissao`** ([H-08]) are the most visible day-to-day eyesores. **Optimistic update lifecycle** in `ColaboradorDrawer` ([C-04], [C-05]) is the source of "I edited the phone but it reverted" complaints.

Top wins for a single PR: fix `diasUteisRestantes` + `toIso` (timezone), fix `mergedEpis` (stacking), apply `formatCpf` everywhere CPFs render, add the missing header titles, cap toast stack at 5.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer, FORCE stance)_
_Depth: deep_
