# Piano: Estrattore Bilancio PDF (post-imposte)

Obiettivo: caricare un PDF di bilancio "a sezioni contrapposte" (Stato Patrimoniale + Conto Economico, come `POST IMPOSTE.pdf` di TREVI SRL) e popolare automaticamente le sezioni dell'app con dati reali.

La tabella `balance_sheets` esiste già con i campi giusti (`ricavi`, `ebitda`, `utile_netto`, `patrimonio_netto`, `debiti_totali`, `liquidita`, `dipendenti`, `extracted_data` jsonb, `confirmed`, `raw_file_url`). Riutilizzo tutto: nessun cambio schema in questo step.

## Step 1 — Server function di estrazione AI

File nuovo: `src/lib/balance-extraction.functions.ts`
- Pattern identico a `extractVisuraData`: `createServerFn` + `requireSupabaseAuth` + Zod input `{ pdf_base64, filename }`.
- Modello: `google/gemini-2.5-flash` via Lovable AI Gateway (multimodale PDF, già in uso nel progetto).
- Prompt di sistema dedicato al bilancio italiano a sezioni contrapposte: estrae JSON con
  - anagrafica (`legal_name`, `vat`, `period_start`, `period_end`, `year`)
  - aggregati SP: `attivo_totale`, `immobilizzazioni`, `crediti_clienti`, `liquidita`, `patrimonio_netto`, `debiti_banche_breve`, `debiti_banche_lungo`, `debiti_fornitori`, `debiti_tributari`, `tfr`
  - aggregati CE: `ricavi`, `costi_materie`, `costi_servizi`, `costi_personale`, `ammortamenti`, `oneri_finanziari`, `imposte`, `utile_netto`
  - calcolati a valle: `ebitda = ricavi - costi_materie - costi_servizi - costi_personale`, `debiti_totali`, `margine_lordo_pct`
  - elenco `mutui[]` (descrizione + residuo) e `fornitori_top[]` (per Cost Monitor)
- Limite modalità prova: 1 estrazione (riuso `is_demo` + nuova RPC contatore o riuso `increment_ai_extractions`).
- Output: `{ status: "success", data, mapped }` oppure `{ status: "error", message }`.

## Step 2 — UI di upload in Bilanci

File da modificare: `src/routes/_authenticated/_app/balance-sheets.tsx`
- Aggiungere pulsante "Carica bilancio PDF" + `Input type="file" accept="application/pdf"` (max 10 MB, validato lato client e server).
- Dialog di anteprima con i valori estratti raggruppati in 3 tab (Anagrafica / Stato Patrimoniale / Conto Economico), tutti i campi editabili prima della conferma.
- Su "Conferma": `INSERT` in `balance_sheets` con `company_id` attivo, `year`, KPI mappati nelle colonne dedicate, payload completo in `extracted_data`, `confirmed = true`, `source_type = 'pdf_ai'`.
- Toast di successo + invalidate query dashboard/cost-monitor/financing.

## Step 3 — Lettura nei moduli esistenti

Senza creare nuove tabelle, leggo l'ultimo `balance_sheets` confermato per `company_id`:
- **Dashboard** (`dashboard.tsx`): KPI cards mostrano `ricavi`, `utile_netto`, `ebitda`, margine.
- **Cost Monitor** (`cost-monitor.tsx`): breakdown costi da `extracted_data.costi_*` + tabella `fornitori_top`.
- **Business Health** (`business-health.tsx`): score calcolato da rapporti (ROS, leva = debiti/PN, current ratio).
- **Financing** (`financing.tsx`): elenco mutui da `extracted_data.mutui`.
Le pagine restano vuote (con stato attuale) finché non c'è almeno un bilancio confermato — banner "Carica un bilancio per vedere i dati".

## Step 4 — Storage del PDF originale

Riuso bucket esistente `company-documents` (già configurato): upload del PDF originale, salvataggio della URL in `balance_sheets.raw_file_url` per consultazione futura.

## Cosa NON tocco

- Schema DB (nessuna migration).
- RLS, auth, server functions esistenti.
- Onboarding e flusso login.
- Demo mode (l'estrazione resta bloccata dopo 1 uso gratuito, come la visura).

## Rischi noti

- **Qualità estrazione**: bilanci con piani dei conti molto custom (come TREVI con 200+ voci) possono richiedere fine-tuning del prompt. Mitigazione: tab editabile prima del salvataggio.
- **PDF >10 MB o >50 pagine**: rifiutati lato server con messaggio chiaro.
- **Token AI**: un bilancio tipico = 1-2 chiamate Gemini, costo coperto da crediti Lovable AI workspace.

## Risultato atteso

Carichi `POST IMPOSTE.pdf` → in ~15 secondi vedi Dashboard con Ricavi 1.739.731 €, Utile 24.260 €, EBITDA stimato, Cost Monitor con costi materie 1.288.939 €, personale 202.421 €, Financing con i 3 mutui (COVID, Intesa, Stellantis).

## Tempi stimati

4 step incrementali, ognuno verificabile separatamente. Posso partire dallo Step 1 (server function + prompt) appena confermi.
