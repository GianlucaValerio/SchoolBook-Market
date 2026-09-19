"""
LibroScambio — MIM Data Sync
Scarica adozioni libri (anno corrente + precedente) e anagrafica scuole
dal portale dati.istruzione.it e li carica su Supabase.

Scheduling consigliato: GitHub Action il 1° di ogni mese alle 3:00
"""

import os
import io
import time
import logging
import requests
import pandas as pd
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor, as_completed
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Configurazione
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

BASE_URL = "https://dati.istruzione.it/opendata/opendata/catalogo/elements1"
BATCH_SIZE = 500
MAX_WORKERS = 6  # download paralleli

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Anni scolastici — calcolo automatico
# ---------------------------------------------------------------------------
def anni_scolastici() -> list[dict]:
    """
    Restituisce anno corrente e precedente con i metadati per costruire gli URL.
    Esempio output:
      [
        {"label": "2026/27", "code": "202627", "url_date": "20260901"},
        {"label": "2025/26", "code": "202526", "url_date": "20250901"},
      ]
    """
    oggi = date.today()
    anno_inizio = oggi.year if oggi.month >= 9 else oggi.year - 1

    anni = []
    for delta in [0, 1]:  # corrente e precedente
        a = anno_inizio - delta
        b = a + 1
        anni.append({
            "label": f"{a}/{str(b)[-2:]}",
            "code": f"{a}{str(b)[-2:]}",
            "url_date": f"{a}0901",
        })
    return anni

# ---------------------------------------------------------------------------
# Regioni — lista completa
# ---------------------------------------------------------------------------
REGIONI = [
    "ABRUZZO", "BASILICATA", "CALABRIA", "CAMPANIA", "EMILIAROMAGNA",
    "FRIULIVENEZIAGIULIA", "LAZIO", "LIGURIA", "LOMBARDIA", "MARCHE",
    "MOLISE", "PIEMONTE", "PUGLIA", "SARDEGNA", "SICILIA", "TOSCANA",
    "UMBRIA", "VALLEDAOSTA", "VENETO",
]

# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------
def _get_csv(url: str, encoding: str = "latin-1") -> pd.DataFrame | None:
    try:
        r = requests.get(url, timeout=90)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        r.encoding = encoding
        return pd.read_csv(io.StringIO(r.text), sep=";", dtype=str, on_bad_lines="skip")
    except Exception as e:
        log.warning(f"Errore download {url}: {e}")
        return None


def _find_adozioni_url(regione: str, anno: dict) -> str | None:
    """
    Il portale usa date variabili nel nome file (es. 20260909, 20260901).
    Prova le varianti più comuni.
    """
    candidates = [
        f"{BASE_URL}/ALT{regione}0000{anno['code']}{anno['url_date'].replace('0901', '0909')}.csv",
        f"{BASE_URL}/ALT{regione}0000{anno['code']}{anno['url_date']}.csv",
        f"{BASE_URL}/ALT{regione}0000{anno['code']}{anno['url_date'].replace('0901', '0831')}.csv",
    ]
    for url in candidates:
        try:
            r = requests.head(url, timeout=15)
            if r.status_code == 200:
                return url
        except Exception:
            continue
    return None


def download_regione(regione: str, anno: dict) -> pd.DataFrame | None:
    url = _find_adozioni_url(regione, anno)
    if not url:
        log.warning(f"  URL non trovato: {regione} {anno['label']}")
        return None
    df = _get_csv(url)
    if df is None or df.empty:
        return None
    df["regione"] = regione
    df["anno_scolastico"] = anno["label"]
    log.info(f"  ✓ {regione} {anno['label']}: {len(df)} righe")
    return df


def download_anagrafica() -> pd.DataFrame:
    """Anagrafica scuole statali — refresh annuale."""
    anni = anni_scolastici()
    url = f"{BASE_URL}/SCUANAGRAFESTAT{anni[0]['code']}{anni[0]['url_date']}.csv"
    log.info(f"Scaricando anagrafica: {url}")
    df = _get_csv(url)
    if df is None:
        raise RuntimeError("Impossibile scaricare anagrafica scuole")

    col_map = {
        "CODICESCUOLA": "codice_istituto",
        "DENOMINAZIONESCUOLA": "nome",
        "INDIRIZZOSCUOLA": "indirizzo",
        "CAPSCUOLA": "cap",
        "CODICECOMUNESCUOLA": "codice_comune",
        "DESCRIZIONECOMUNE": "comune",
        "SIGLAPROVINCIA": "provincia",
        "REGIONE": "regione",
        "CODICETIPOLOGIASCOLASTICA": "tipo_codice",
        "DESCRIZIONETIPOLOGIASCOLASTICA": "tipo",
        "INDIRIZZOEMAILSCUOLA": "email",
        "INDIRIZZOPECSCUOLA": "pec",
        "SITOWEBSCUOLA": "sito",
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
    keep = [v for v in col_map.values() if v in df.columns]
    df = df[keep].drop_duplicates(subset=["codice_istituto"])
    log.info(f"Anagrafica: {len(df)} scuole")
    return df


def download_adozioni(anni: list[dict]) -> pd.DataFrame:
    """Download parallelo di tutte le regioni per tutti gli anni richiesti."""
    tasks = [(r, a) for a in anni for r in REGIONI]
    frames = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(download_regione, r, a): (r, a) for r, a in tasks}
        for future in as_completed(futures):
            df = future.result()
            if df is not None:
                frames.append(df)

    if not frames:
        raise RuntimeError("Nessun dato adozioni scaricato")

    merged = pd.concat(frames, ignore_index=True)

    # Normalizza colonne principali
    col_map = {
        "CODICESCUOLA": "codice_istituto",
        "ANNOSCOLASTICO": "anno_scolastico_src",
        "ANNOCORSO": "anno_classe",
        "SEZIONECLASSE": "sezione",
        "CODICEISBN": "isbn",
        "TITOLO": "titolo",
        "AUTORE": "autore",
        "EDITORE": "editore",
        "PREZZO": "prezzo",
        "ACQUISTARE": "da_acquistare",
        "UTILIZZARE": "da_utilizzare",
        "CONSIGLIARE": "consigliato",
    }
    merged = merged.rename(columns={k: v for k, v in col_map.items() if k in merged.columns})

    # Pulizia ISBN
    if "isbn" in merged.columns:
        merged["isbn"] = merged["isbn"].str.strip().str.replace("-", "", regex=False)

    # Prezzo come float
    if "prezzo" in merged.columns:
        merged["prezzo"] = (
            merged["prezzo"]
            .str.replace(",", ".", regex=False)
            .str.extract(r"([\d.]+)")[0]
            .astype(float, errors="ignore")
        )

    merged["updated_at"] = datetime.utcnow().isoformat()
    log.info(f"Adozioni totali: {len(merged)} righe")
    return merged

# ---------------------------------------------------------------------------
# Supabase upsert
# ---------------------------------------------------------------------------
def upsert_table(client: Client, table: str, df: pd.DataFrame, conflict_col: str):
    """Upsert in batch con gestione errori per riga."""
    records = df.where(pd.notna(df), None).to_dict(orient="records")
    total = len(records)
    errors = 0

    for i in range(0, total, BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        try:
            client.table(table).upsert(batch, on_conflict=conflict_col).execute()
            log.info(f"  [{table}] {min(i + BATCH_SIZE, total)}/{total}")
        except Exception as e:
            log.error(f"  [{table}] batch {i}: {e}")
            errors += 1
            time.sleep(2)

    log.info(f"  [{table}] completato — {total} righe, {errors} batch falliti")

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    log.info("=== LibroScambio MIM Sync ===")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    anni = anni_scolastici()
    log.info(f"Anni da sincronizzare: {[a['label'] for a in anni]}")

    # 1. Anagrafica scuole (una volta l'anno ma sempre aggiornata)
    log.info("\n--- Anagrafica scuole ---")
    scuole = download_anagrafica()
    upsert_table(client, "schools", scuole, "codice_istituto")

    # 2. Adozioni anno corrente + precedente in parallelo
    log.info("\n--- Adozioni libri ---")
    adozioni = download_adozioni(anni)
    upsert_table(client, "adoptions", adozioni, "codice_istituto,isbn,anno_classe,anno_scolastico")

    log.info("\n=== Sync completato ===")


if __name__ == "__main__":
    main()
