#!/usr/bin/env python3
"""
Genera bagnature.ics: calendario delle bagnature per Zurigo.

Logica:
- Casa (interno): bagnata ogni giorno.
- Orto e Patricio: un giorno sì e uno no, alternati tra loro
  (Patricio i giorni dispari, Orto i giorni pari).
- Se piove sul serio (>= SOGLIA_MM), le piante all'aperto sono già
  bagnate dalla pioggia -> riposo (e il conteggio riparte da quel giorno).

Il meteo arriva da Open-Meteo (gratis, niente chiavi). Le previsioni
coprono ~16 giorni: oltre quella finestra il calendario assume "nessuna
pioggia" e viene corretto ogni giorno quando arrivano nuove previsioni.
"""

import json
import urllib.request
from datetime import date, datetime, timedelta, timezone

# --- Configurazione ----------------------------------------------------------
LAT, LON = 47.3769, 8.5417          # Zurigo
TZID = "Europe/Zurich"
SOGLIA_MM = 4.0                     # pioggia che "conta" come bagnatura
ORA_REMINDER = 9                    # ora locale del promemoria
GIORNI_AVANTI = 60                  # orizzonte del calendario
GIORNI_INDIETRO = 5                 # per agganciare le piogge recenti

API = (
    "https://api.open-meteo.com/v1/forecast"
    f"?latitude={LAT}&longitude={LON}"
    "&daily=precipitation_sum,precipitation_probability_max"
    f"&timezone={TZID.replace('/', '%2F')}"
    f"&past_days={GIORNI_INDIETRO}&forecast_days=16"
)


def carica_meteo():
    """Ritorna {date: (mm_pioggia, prob_%)} dalle previsioni disponibili."""
    with urllib.request.urlopen(API, timeout=30) as r:
        data = json.load(r)
    d = data["daily"]
    out = {}
    for i, g in enumerate(d["time"]):
        giorno = date.fromisoformat(g)
        mm = d["precipitation_sum"][i] or 0.0
        prob = d["precipitation_probability_max"][i]
        out[giorno] = (mm, prob if prob is not None else None)
    return out


def costruisci_eventi(meteo):
    oggi = date.today()
    inizio = oggi - timedelta(days=GIORNI_INDIETRO)
    fine = oggi + timedelta(days=GIORNI_AVANTI)

    ultima = {"orto": inizio - timedelta(days=2),
              "patricio": inizio - timedelta(days=2)}

    eventi = []  # (data, titolo, descrizione)
    g = inizio
    while g <= fine:
        mm, prob = meteo.get(g, (0.0, None))
        previsto = g in meteo
        piove = mm >= SOGLIA_MM
        info_pioggia = descrizione_pioggia(mm, prob, previsto)

        # Casa: ogni giorno
        if g >= oggi:
            eventi.append((g, "Bagna piante in CASA",
                           f"Tutti i giorni (non esposte alla pioggia).\n{info_pioggia}"))

        if piove:
            ultima["orto"] = g
            ultima["patricio"] = g
            if g >= oggi:
                eventi.append((g, "All'aperto: RIPOSO (piove)",
                               f"Orto e terrazza di Patricio bagnati dalla pioggia.\n{info_pioggia}"))
        else:
            loc = "patricio" if g.day % 2 == 1 else "orto"
            if (g - ultima[loc]).days >= 2:
                ultima[loc] = g
                if g >= oggi:
                    nome = ("Terrazza di PATRICIO" if loc == "patricio"
                            else "ORTO")
                    eventi.append((g, f"Bagna {nome}",
                                   f"Un giorno sì e uno no.\n{info_pioggia}"))
        g += timedelta(days=1)
    return eventi


def descrizione_pioggia(mm, prob, previsto):
    if not previsto:
        return "Meteo: oltre la finestra di previsione (ipotesi: assenza di pioggia)."
    p = f"{prob}%" if prob is not None else "n/d"
    return f"Meteo: probabilità pioggia {p}, ~{mm:.1f} mm previsti."


# --- Generazione file .ics ---------------------------------------------------
VTIMEZONE = """BEGIN:VTIMEZONE
TZID:Europe/Zurich
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE"""


def esc(s):
    return (s.replace("\\", "\\\\").replace(",", "\\,")
             .replace(";", "\\;").replace("\n", "\\n"))


def scrivi_ics(eventi, path="bagnature.ics"):
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//orto-bagnature//IT",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Bagnature Orto",
        "X-WR-TIMEZONE:Europe/Zurich",
        "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
        "X-PUBLISHED-TTL:PT6H",
        VTIMEZONE,
    ]
    for g, titolo, desc in eventi:
        start = f"{g.strftime('%Y%m%d')}T{ORA_REMINDER:02d}0000"
        uid = f"{g.isoformat()}-{slug(titolo)}@orto-bagnature"
        out += [
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now}",
            f"DTSTART;TZID=Europe/Zurich:{start}",
            f"DTEND;TZID=Europe/Zurich:{start[:9]}{ORA_REMINDER:02d}3000",
            f"SUMMARY:{esc(titolo)}",
            f"DESCRIPTION:{esc(desc)}",
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            "TRIGGER:PT0M",
            f"DESCRIPTION:{esc(titolo)}",
            "END:VALARM",
            "END:VEVENT",
        ]
    out.append("END:VCALENDAR")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\r\n".join(out) + "\r\n")
    print(f"Scritti {len(eventi)} eventi in {path}")


def slug(s):
    keep = "abcdefghijklmnopqrstuvwxyz0123456789"
    return "".join(c for c in s.lower() if c in keep) or "evt"


if __name__ == "__main__":
    try:
        meteo = carica_meteo()
    except Exception as e:  # se l'API è giù, genera comunque senza pioggia
        print(f"Meteo non disponibile ({e}); genero senza dati pioggia.")
        meteo = {}
    scrivi_ics(costruisci_eventi(meteo))
