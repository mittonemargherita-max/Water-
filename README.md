# Bagnature orto (Zurigo)

Sistema per organizzare le bagnature in base al meteo reale di Zurigo.

## Cosa fa
- **Casa** (piante interne): **ogni giorno**.
- **Orto** e **terrazza di Patricio**: un giorno sì e uno no, **alternati**
  (Patricio i giorni dispari, Orto i pari) così vai in un solo posto al giorno.
- Se è prevista **pioggia** (≥ 4 mm) le piante all'aperto vanno in **riposo**.
- Mostra sempre la **probabilità di pioggia** prevista.

Meteo: [Open-Meteo](https://open-meteo.com) (gratis, senza chiavi).

## Sistema attivo: pagina condivisa (Google) — consigliato
Cartella **`apps-script/`**: una pagina web condivisibile dove **chiunque** col
link può segnare "fatto" e tutti vedono lo stato **in tempo reale**. Si aggiorna
da sola ogni mattina col meteo. Istruzioni in **`apps-script/SETUP.md`**.

## Backup: calendario .ics (GitHub)
La parte sotto (`generate.py` + GitHub Action) genera un calendario `.ics` di
sola lettura. La Action automatica è **disattivata** (resta avviabile a mano):
il sistema principale è ora quello Google qui sopra.

## Come pubblicarlo (una volta sola)
1. Crea un repository **pubblico** su GitHub, es. `orto-bagnature`.
2. Carica questi file (`generate.py`, cartella `.github/`, `README.md`).
3. Vai su **Settings → Actions → General → Workflow permissions** e scegli
   **Read and write permissions**, salva.
4. Apri la scheda **Actions**, avvia "Aggiorna calendario bagnature"
   (pulsante *Run workflow*). Genererà `bagnature.ics`.

## Come abbonarsi dal telefono
Il link del calendario è:

```
https://raw.githubusercontent.com/mittonemargherita-max/Water-/main/bagnature.ics
```

### iPhone
Impostazioni → Calendario → Account → Aggiungi account → **Altro** →
**Aggiungi calendario con sottoscrizione** → incolla il link (in versione
`webcal://raw.githubusercontent.com/...`). Attiva gli **avvisi**.

### Android / Google Calendar (da computer)
Google Calendar → *Altri calendari* → **Da URL** → incolla il link.
Nota: Google aggiorna i calendari da URL ogni 8–24 h.

## Cambiare le impostazioni
In `generate.py`, sezione *Configurazione*:
- `SOGLIA_MM` – quanta pioggia conta come bagnatura.
- `ORA_REMINDER` – ora del promemoria.
- `GIORNI_AVANTI` – quanti giorni mostra il calendario.

Le previsioni coprono ~16 giorni: oltre quella finestra il calendario assume
"niente pioggia" e si corregge da solo ogni giorno.
