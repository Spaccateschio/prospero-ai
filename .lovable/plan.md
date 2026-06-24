## Obiettivo

Modalità demo completamente client-side: `/demo/*` è un'app parallela accessibile senza login, con sidebar identica a quella reale, dati seed + utente in `localStorage`, KPI e grafici calcolati al volo. Zero chiamate a Supabase, zero `signInAnonymously`.

## Nota sul menu (da confermare)

Nella tua specifica elenchi `demo.invoices/payments/reports/clients/suppliers/settings`, ma la sidebar attuale dell'app autenticata espone voci diverse: Dashboard, Cash Flow, Contabilità, Bilanci Storici, Finanziamenti, Fiscalità, Simulazioni, Monitoraggio Costi, Centro Opportunità, Contratti, Consulente AI, Salute Aziendale, Impostazioni.

Hai scritto "menu identico alla versione autenticata" → procedo specchiando **esattamente** le voci reali (quindi `/demo/dashboard`, `/demo/cash-flow`, `/demo/accounting`, …). Le fatture e i pagamenti del seed alimentano la sezione **Contabilità** (dove vivono oggi fatture attive/passive) e la sezione **Cash Flow** (entrate/uscite). Se invece volevi davvero `invoices/payments/reports/clients/suppliers`, dimmelo e cambio l'elenco file. Fermo questa decisione prima di proseguire.

## Architettura

### Store demo — `src/lib/demo-store.ts`
Zustand + `persist` (storage `localStorage`, key `cfo-demo-v1`, versione `1` per future migrazioni).

Stato:
- `company`: { id, name: "ACME Srl", vat: "01234567890", city: "Roma", region: "Lazio", … }
- `invoices`: 5 attive + 4 passive (importi realistici, mix paid/sent/overdue, mesi correnti e ±3)
- `payments`: 4 ricevuti + 3 da fare (collegati ad alcune fatture via `invoice_id`)
- `clients`: 4 anagrafiche cliente coerenti con le fatture attive
- `suppliers`: 3 anagrafiche fornitore coerenti con le fatture passive
- `categories`, `transactions`: minimi per popolare cash flow chart

Azioni: `addInvoice`, `updateInvoice`, `deleteInvoice`, `addPayment`, `addClient`, `addSupplier`, `addTransaction`, `reset()`.

Selector helper `useDemoKPIs()` calcola in memoria: fatturato MTD/YTD, incassato, da incassare, scaduto, top fornitori, serie 12 mesi entrate/uscite. Stesso output shape che oggi restituiscono `getDashboardKPIs` / `getCashflowSummary`, così i componenti UI restano identici.

### Layout demo — `src/routes/demo.tsx`
Pathless? No, è una vera route pubblica con figli. Struttura:
- `src/routes/demo.tsx` → layout: `SidebarProvider` + `<DemoSidebar/>` + `<TopBar mode="demo"/>` + `<DemoModeBanner/>` + `<Outlet/>`
- Figli (uno per voce di menu reale): `demo.dashboard.tsx`, `demo.cash-flow.tsx`, `demo.accounting.tsx`, `demo.balance-sheets.tsx`, `demo.financing.tsx`, `demo.tax-calendar.tsx`, `demo.simulations.tsx`, `demo.cost-monitor.tsx`, `demo.opportunities.tsx`, `demo.contracts.tsx`, `demo.ai-consultant.tsx`, `demo.business-health.tsx`, `demo.settings.tsx`

`createFileRoute("/demo/dashboard")` etc., tutto fuori da `_authenticated`.

### Sidebar — `src/components/app-sidebar.tsx`
Refactor minimo: accetta prop opzionale `basePath?: "" | "/demo"` (default `""`). Le `url` diventano `${basePath}${url}`. Così riuso lo stesso componente per autenticato (`""`) e demo (`"/demo"`), zero duplicazione e le voci restano sincronizzate per sempre. Anche `Link` di apertura logo punta a `${basePath}/dashboard`.

### Banner — `src/components/demo/demo-mode-banner.tsx`
Barra fissa sticky in alto del layout `/demo`:
- Testo: *"Sei in modalità demo — i dati non vengono salvati nel cloud. Se esci senza registrarti, perdi tutto."*
- CTA primaria "Crea account gratuito" → `<Link to="/auth">`
- Variant `bg-amber-500/15` con bordo, icona `AlertTriangle`

Il vecchio `src/components/demo-banner.tsx` viene rimosso dal layout `_authenticated/_app.tsx` (non più necessario: gli utenti reali non sono mai più "demo"). Il file lo lascio se referenziato altrove, lo cancello solo se orfano.

### Pulsante in `/auth`
In `src/routes/auth.tsx`:
- Rimuovo `startDemo`, `lastError`, il blocco rosso di errore, l'import di `seedDemoCompany` e di `signInAnonymously`.
- Pulsante "Prova senza registrarti" diventa `<Button variant="outline" onClick={() => navigate({ to: "/demo/dashboard" })}>`.

### Componenti condivisi prop-driven
Strategia: NON riscrivo le pagine reali, NON le accoppio al demo-store. Per ogni pagina `/demo/*` creo un wrapper sottile che:
1. Legge dati dal demo-store con i selector.
2. Passa i dati ai **sotto-componenti di presentazione già esistenti** (`KpiCard`, `CashflowDualLineChart`, `TransactionFormDialog` in modalità controlled, le tabelle fatture in `components/invoices/`, ecc.) che oggi accettano già props.

Dove un sotto-componente oggi chiama internamente Supabase (es. il dialog "Nuovo movimento" che salva via server fn), creo una variante "demo" che chiama `addTransaction` dello store. Stesso markup, callback diversa. Eseguo questo solo per i dialog/form di add/edit, non per le viste.

Per le pagine grosse (`accounting.tsx`, `cash-flow.tsx`) e per le pagine "coming soon" (le 8 da 22 righe), la pagina demo è un file nuovo costruito assemblando gli stessi sotto-componenti UI. Niente duplicazione di Card/Chart, solo wrapping diverso del data layer. Mantengo la regola "non modificare codice non menzionato": tocco solo `app-sidebar.tsx` per il `basePath` e `auth.tsx` per il pulsante.

### Refresh & reset
- Refresh: Zustand `persist` ricarica da `localStorage` → dati intatti.
- Reset: nella pagina `/demo/settings` un pulsante "Reimposta dati demo" chiama `useDemoStore.getState().reset()` che riporta al seed.
- Cambio dispositivo / pulizia storage → riparte dal seed (atteso).

## File toccati

**Nuovi**
- `src/lib/demo-store.ts`
- `src/lib/demo-seed.ts` (separato per leggibilità)
- `src/lib/demo-selectors.ts` (KPI/aggregazioni)
- `src/components/demo/demo-mode-banner.tsx`
- `src/routes/demo.tsx`
- `src/routes/demo.dashboard.tsx`
- `src/routes/demo.cash-flow.tsx`
- `src/routes/demo.accounting.tsx`
- `src/routes/demo.balance-sheets.tsx`
- `src/routes/demo.financing.tsx`
- `src/routes/demo.tax-calendar.tsx`
- `src/routes/demo.simulations.tsx`
- `src/routes/demo.cost-monitor.tsx`
- `src/routes/demo.opportunities.tsx`
- `src/routes/demo.contracts.tsx`
- `src/routes/demo.ai-consultant.tsx`
- `src/routes/demo.business-health.tsx`
- `src/routes/demo.settings.tsx`

**Modificati**
- `src/components/app-sidebar.tsx` — prop `basePath`
- `src/routes/auth.tsx` — pulsante demo → semplice navigate
- `src/routes/_authenticated/_app.tsx` — rimuovo `<DemoBanner/>`

**Non toccati**
- Schema DB, RLS, server functions, hook Supabase, dashboard/contabilità/cashflow reali, onboarding, flusso login/signup.

## Dipendenze nuove
- `zustand` (se non già presente). Controllo prima di installare.

## Conferma da te prima di passare in build

1. Confermi di mirrorare le **voci reali della sidebar** (Dashboard, Cash Flow, Contabilità, …, 13 voci) anziché l'elenco `invoices/payments/reports/clients/suppliers`?
2. OK ad aggiungere `zustand` se manca?
