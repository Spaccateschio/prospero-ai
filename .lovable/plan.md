## Obiettivo

Integrazione **OpenAPI.it** per: digitando una P.IVA, l'app recupera automaticamente i dati anagrafici dell'azienda, la visura camerale (incluso n. dipendenti) e, se disponibili, gli ultimi bilanci depositati — compilando i contenitori già presenti in app.

---

## Funzionalità utente

1. Nei moduli **Impostazioni Azienda** e **Onboarding** aggiungiamo un campo "Cerca per P.IVA" con pulsante **Recupera dati**.
2. L'utente inserisce la P.IVA (11 cifre) → spinner → i campi del form si auto-compilano:
   - Ragione sociale, forma giuridica, codice fiscale, sede legale (via, città, CAP, provincia), PEC, REA, data costituzione, ATECO, capitale sociale, stato attività, n. dipendenti.
3. Pulsante secondario **Scarica Visura** → genera/scarica il PDF della visura camerale (endpoint `IT-full`).
4. Se l'azienda ha bilanci depositati, viene mostrato un riquadro "Bilanci disponibili" con anni selezionabili → pulsante **Importa bilancio** → popola la tabella `balance_sheets` con ricavi, EBITDA, utile, totale attivo, patrimonio netto, debiti.

---

## Endpoint OpenAPI usati

| Scopo | Endpoint OpenAPI |
|---|---|
| Anagrafica base | `IT-start` |
| Anagrafica avanzata + dipendenti | `IT-advanced` |
| Visura completa PDF | `IT-full` |
| Bilanci | `IT-financial-statements` (o equivalente del pacchetto Azienda) |

Confermerò i nomi esatti leggendo la documentazione OpenAPI prima dell'implementazione.

---

## Architettura tecnica

- **Secret**: salvo la chiave come `OPENAPI_COMPANY_TOKEN` (runtime secret, mai esposto al browser).
- **Server functions** in `src/lib/openapi-company.functions.ts` (TanStack `createServerFn`, metodo POST, validazione Zod sulla P.IVA):
  - `lookupCompanyByVat({ vat })` → restituisce DTO normalizzato verso le colonne di `companies`.
  - `getCompanyVisuraUrl({ vat })` → restituisce URL temporaneo del PDF visura.
  - `listAvailableBalanceSheets({ vat })` → elenco anni disponibili.
  - `importBalanceSheet({ vat, year })` → scrive su `balance_sheets` (con `company_id` dell'utente, rispettando RLS).
- **Mapping** dei campi OpenAPI → colonne `companies` in un file `src/lib/openapi-company.mapper.ts` (puro, testabile).
- **UI**: nuovo componente `<CompanyVatLookup />` (input + bottone + toast esiti) integrato nei form esistenti, **senza eliminare** i campi attuali (li compila soltanto).
- **Sicurezza**: validazione P.IVA italiana (11 cifre + checksum) lato client e server; gestione errori OpenAPI (404 P.IVA inesistente, 402 credito esaurito, 401 token invalido) con messaggi chiari all'utente.

---

## File toccati / creati

**Creati**
- `src/lib/openapi-company.functions.ts` — server functions
- `src/lib/openapi-company.mapper.ts` — mapping risposta → schema DB
- `src/lib/vat-validator.ts` — validazione P.IVA italiana
- `src/components/company/CompanyVatLookup.tsx` — UI di ricerca + autofill

**Modificati (solo per integrare il nuovo componente, niente rimozioni)**
- `src/routes/_authenticated/_app/settings.tsx` (o file equivalente form azienda) — inserisce `<CompanyVatLookup />` in cima al form.
- `src/routes/_authenticated/_app/balance-sheets.tsx` — sezione "Importa da visura" con elenco anni.

---

## Cosa serve da te prima di iniziare

1. **Conferma il piano** (sì/no o modifiche).
2. **Salveremo la chiave** tramite `add_secret` come `OPENAPI_COMPANY_TOKEN` (te lo apro subito dopo l'approvazione — non incollarla in chat).
3. **Domanda**: il tuo abbonamento OpenAPI include il pacchetto **bilanci** (`IT-financial-statements`)? Se non sei sicuro, parto con anagrafica + visura + dipendenti, e i bilanci li aggiungo in un secondo step verificando dalle credenziali.

---

## Cosa NON viene toccato

- Flusso auth/login/signup.
- Modalità demo (`/demo/*`) — l'integrazione è solo per utenti reali autenticati.
- Schema DB esistente (uso le colonne già presenti in `companies` e `balance_sheets`).
