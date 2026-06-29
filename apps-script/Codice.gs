/**
 * Bagnature Orto — Google Apps Script (bound a un Foglio Google).
 *
 * - Foglio "Bagnature": Data | Tipo | Pioggia% | mm | Fatto  = memoria condivisa.
 * - aggiornaBagnature(): trigger giornaliero, scarica il meteo di Zurigo
 *   (Open-Meteo) e ricalcola le righe future, preservando le spunte "Fatto".
 * - doGet(): serve la pagina condivisa (Pagina.html). ?format=ics serve il .ics.
 * - getStato()/segnaFatto(): usate dalla pagina per leggere e spuntare.
 *
 * Logica bagnature: Casa ogni giorno; Patricio giorni dispari, Orto giorni pari;
 * Riposo se pioggia >= SOGLIA_MM (le piante all'aperto le bagna la pioggia).
 */

// --- Configurazione ----------------------------------------------------------
var LAT = 47.3769, LON = 8.5417;       // Zurigo
var TZ = 'Europe/Zurich';
var SOGLIA_MM = 4.0;                   // pioggia che "conta" come bagnatura
var GIORNI_AVANTI = 60;                // orizzonte del calendario
var GIORNI_INDIETRO = 5;               // per agganciare le piogge recenti
var SHEET_NAME = 'Bagnature';
var DAY = 86400000;

// --- Foglio ------------------------------------------------------------------
function foglio_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, 5).setValues([['Data', 'Tipo', 'Pioggia%', 'mm', 'Fatto']]);
    sh.setFrozenRows(1);
  }
  sh.getRange('A:A').setNumberFormat('@'); // Data come testo, non come data
  return sh;
}

// --- Meteo (Open-Meteo) ------------------------------------------------------
function caricaMeteo_() {
  var url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + LAT + '&longitude=' + LON
    + '&daily=precipitation_sum,precipitation_probability_max'
    + '&timezone=' + encodeURIComponent(TZ)
    + '&past_days=' + GIORNI_INDIETRO + '&forecast_days=16';
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var d = JSON.parse(resp.getContentText()).daily;
    var out = {};
    for (var i = 0; i < d.time.length; i++) {
      out[d.time[i]] = {
        mm: d.precipitation_sum[i] || 0,
        prob: d.precipitation_probability_max[i],
        previsto: true
      };
    }
    return out;
  } catch (err) {
    return {}; // se l'API e' giu', si calcola senza pioggia
  }
}

// --- Calcolo schedule --------------------------------------------------------
function calcolaSchedule_(meteo) {
  var now = new Date();
  var todayIso = isoTz_(now);
  var start = new Date(now.getTime() - GIORNI_INDIETRO * DAY);
  var startIso = isoTz_(start);
  var ultima = { orto: addGiorni_(startIso, -2), patricio: addGiorni_(startIso, -2) };
  var rows = [];

  for (var i = 0; i <= GIORNI_INDIETRO + GIORNI_AVANTI; i++) {
    var iso = isoTz_(new Date(start.getTime() + i * DAY));
    var w = meteo[iso] || { mm: 0, prob: null, previsto: false };
    var piove = w.mm >= SOGLIA_MM;
    var futuro = iso >= todayIso;

    if (futuro) rows.push({ data: iso, tipo: 'Casa', prob: probVal_(w), mm: round1_(w.mm) });

    if (piove) {
      ultima.orto = iso; ultima.patricio = iso;
      if (futuro) rows.push({ data: iso, tipo: 'Riposo', prob: probVal_(w), mm: round1_(w.mm) });
    } else {
      var dom = parseInt(iso.slice(8, 10), 10);
      var loc = (dom % 2 === 1) ? 'patricio' : 'orto';
      if (diffGiorni_(iso, ultima[loc]) >= 2) {
        ultima[loc] = iso;
        if (futuro) rows.push({
          data: iso, tipo: (loc === 'patricio' ? 'Patricio' : 'Orto'),
          prob: probVal_(w), mm: round1_(w.mm)
        });
      }
    }
  }
  return rows;
}

// --- Aggiornamento Foglio (trigger giornaliero) ------------------------------
function aggiornaBagnature() {
  var rows = calcolaSchedule_(caricaMeteo_());
  var sh = foglio_();
  var last = sh.getLastRow();

  // preserva le spunte gia' esistenti (chiave Data|Tipo)
  var fatto = {};
  if (last >= 2) {
    var old = sh.getRange(2, 1, last - 1, 5).getValues();
    for (var i = 0; i < old.length; i++) fatto[old[i][0] + '|' + old[i][1]] = old[i][4] === true;
    sh.getRange(2, 1, last - 1, 5).clearContent();
  }

  var out = rows.map(function (r) {
    return [r.data, r.tipo, r.prob, r.mm, fatto[r.data + '|' + r.tipo] || false];
  });
  if (out.length) {
    sh.getRange(2, 1, out.length, 5).setValues(out);
    sh.getRange(2, 5, out.length, 1).insertCheckboxes();
  }
  return out.length;
}

// --- API per la pagina -------------------------------------------------------
function getStato() {
  var sh = foglio_();
  if (sh.getLastRow() < 2) aggiornaBagnature();

  var today = isoTz_(new Date());
  var vals = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues() : [];
  var oggi = [], prossimi = {};

  vals.forEach(function (r) {
    var voce = { tipo: r[1], prob: r[2], mm: r[3], fatto: r[4] === true };
    if (r[0] === today) oggi.push(voce);
    else if (r[0] > today) (prossimi[r[0]] = prossimi[r[0]] || []).push(voce);
  });

  var giorni = Object.keys(prossimi).sort().slice(0, 7).map(function (d) {
    return { data: d, voci: prossimi[d] };
  });
  return { oggi: oggi, prossimi: giorni, today: today };
}

function getCalendario() {
  var sh = foglio_();
  if (sh.getLastRow() < 2) aggiornaBagnature();

  var vals = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues() : [];
  var giorni = {}, date = [];
  vals.forEach(function (r) {
    var d = r[0];
    if (!giorni[d]) { giorni[d] = []; date.push(d); }
    giorni[d].push({ tipo: r[1], prob: r[2], mm: r[3], fatto: r[4] === true });
  });
  date.sort();
  return {
    today: isoTz_(new Date()),
    giorni: giorni,
    min: date.length ? date[0] : '',
    max: date.length ? date[date.length - 1] : ''
  };
}

function segnaFatto(data, tipo, valore) {
  var sh = foglio_();
  if (sh.getLastRow() < 2) return false;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === data && vals[i][1] === tipo) {
      sh.getRange(i + 2, 5).setValue(valore === true);
      return true;
    }
  }
  return false;
}

// --- Web app -----------------------------------------------------------------
function doGet(e) {
  if (e && e.parameter && e.parameter.format === 'ics') {
    return ContentService.createTextOutput(generaIcs_())
      .setMimeType(ContentService.MimeType.TEXT);
  }
  return HtmlService.createHtmlOutputFromFile('Pagina')
    .setTitle('Bagnature Orto')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// --- .ics opzionale ----------------------------------------------------------
function generaIcs_() {
  var rows = calcolaSchedule_(caricaMeteo_());
  var stamp = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  var L = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//orto-bagnature//IT',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Bagnature Orto',
    'X-WR-TIMEZONE:Europe/Zurich'
  ];
  var titoli = {
    Casa: 'Bagna piante in CASA', Orto: 'Bagna ORTO',
    Patricio: 'Bagna terrazza di PATRICIO', Riposo: "All'aperto: RIPOSO (piove)"
  };
  rows.forEach(function (r) {
    var dt = r.data.replace(/-/g, '');
    var desc = r.prob === '' ? 'Oltre la finestra di previsione.'
      : 'Probabilita pioggia ' + r.prob + '%, ~' + r.mm + ' mm.';
    L.push('BEGIN:VEVENT', 'UID:' + r.data + '-' + r.tipo + '@orto-bagnature',
      'DTSTAMP:' + stamp,
      'DTSTART;TZID=Europe/Zurich:' + dt + 'T090000',
      'DTEND;TZID=Europe/Zurich:' + dt + 'T093000',
      'SUMMARY:' + titoli[r.tipo], 'DESCRIPTION:' + desc,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M',
      'DESCRIPTION:' + titoli[r.tipo], 'END:VALARM', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

// --- Setup: crea il trigger giornaliero (eseguire una volta) ------------------
function creaTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'aggiornaBagnature') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('aggiornaBagnature').timeBased().everyDays(1).atHour(6).create();
  aggiornaBagnature();
}

// --- Helper date -------------------------------------------------------------
function isoTz_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function addGiorni_(iso, n) { return isoUtc_(new Date(Date.parse(iso) + n * DAY)); }
function isoUtc_(d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); }
function diffGiorni_(a, b) { return Math.round((Date.parse(a) - Date.parse(b)) / DAY); }
function probVal_(w) { return (w.prob === null || w.prob === undefined) ? '' : w.prob; }
function round1_(x) { return Math.round((x || 0) * 10) / 10; }
