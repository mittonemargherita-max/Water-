# Setup — calendario bagnature condiviso (Google)

Risultato: **un link** che mostra le bagnature di oggi e dei prossimi giorni,
dove **chiunque** può segnare "fatto" e tutti vedono lo stato **in tempo reale**.
Tutto gratis, dentro Google. ~10 minuti, una volta sola.

## 1. Crea il Foglio Google
1. Vai su https://sheets.new (crea un foglio nuovo).
2. Rinominalo in alto, es. **Bagnature Orto**.

## 2. Apri l'editor di codice
1. Nel foglio: menu **Estensioni → Apps Script**.
2. Si apre una nuova scheda con un file `Codice.gs` e dentro `function myFunction(){}`.

## 3. Incolla il codice
1. Cancella tutto il contenuto di `Codice.gs` e incolla il contenuto del file
   **`Codice.gs`** di questo progetto. Salva (icona dischetto).
2. Aggiungi la pagina HTML: in alto a sinistra **+ → HTML**, chiamalo
   esattamente **`Pagina`** (senza `.html`). Cancella il contenuto di default e
   incolla il contenuto del file **`Pagina.html`**. Salva.

## 4. Crea i dati e il trigger giornaliero
1. In alto, nel menu a tendina delle funzioni, scegli **`creaTrigger`**.
2. Clicca **Esegui**.
3. La prima volta Google chiede l'autorizzazione: **Rivedi autorizzazioni** →
   scegli il tuo account → "Avanzate" → **Vai a … (non sicuro)** → **Consenti**.
   (È normale: stai autorizzando il *tuo* script.)
4. Fatto: ha riempito il foglio con le bagnature e attivato l'aggiornamento
   automatico ogni mattina alle 6.

## 5. Pubblica il link (Deploy)
1. In alto a destra: **Esegui il deployment → Nuovo deployment**.
2. Icona ingranaggio → tipo **App web**.
3. Imposta:
   - **Esegui come**: *Io* (il tuo account).
   - **Chi ha accesso**: **Chiunque**.
4. **Esegui il deployment** → autorizza se richiesto → **copia l'URL dell'app web**.

Quello è il link da condividere. Chi lo apre vede lo stato e può segnare "fatto",
senza login.

## 6. (Opzionale) Calendario .ics sul telefono
Allo stesso URL aggiungi in fondo `?format=ics`:
```
https://script.google.com/macros/s/XXXX/exec?format=ics
```
Iscriviti via `webcal://` come promemoria personale. Se il telefono non lo
accetta, resta valido il calendario del repo GitHub.

## Modifiche future
Se cambi `Codice.gs` o `Pagina.html`, ripubblica con
**Esegui il deployment → Gestisci deployment → (matita) → Nuova versione**.

## Impostazioni
In `Codice.gs`, in cima: `SOGLIA_MM` (pioggia che conta), `GIORNI_AVANTI`,
e l'ora del trigger in `creaTrigger` (`atHour(6)`).
