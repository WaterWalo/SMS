#!/usr/bin/env python3
"""
build_lyrics.py — Recompile data/lyrics/*.json (un fichier par chanson) en un
fichier combiné data/lyrics.json consommé par le site (search.js).

- Concaténation VERBATIM des objets chanson (aucune transformation de clés/valeurs)
  → la structure lue par la recherche reste identique.
- Produit AUSSI data/quotes.json : un tableau léger de toutes les références
  (extrait + explication) consommé par la « Quote of the Day » de la page d'accueil,
  pour éviter de charger le lourd lyrics.json sur l'accueil.
- Robuste : si un fichier par chanson est un JSON invalide ou sans champ "id",
  le script s'arrête en erreur SANS écrire les combinés (jamais de fichier corrompu).
- Écriture atomique (temp + os.replace).

Utilisé par la GitHub Action ET exécutable en local :  python tools/build_lyrics.py
"""

import json
import os
import sys
import glob
import datetime

# Racine du repo = parent du dossier tools/
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SONGS_DIR = os.path.join(ROOT, "data", "lyrics")
OUTPUT = os.path.join(ROOT, "data", "lyrics.json")
QUOTES_OUTPUT = os.path.join(ROOT, "data", "quotes.json")


def write_json_atomic(path, data):
    """Écrit `data` en JSON à `path` de façon atomique (temp + os.replace)."""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        f.write("\n")
    os.replace(tmp, path)


# L'accueil n'affiche qu'un court extrait de l'explication ; on tronque ici pour
# garder quotes.json léger (l'explication complète reste dans lyrics.json, lue par
# search.html). Marge confortable au-delà de ce que le client affiche (~160 car).
QUOTE_EXPLANATION_MAX = 280


def _truncate_explanation(text):
    text = " ".join(str(text).split())
    if len(text) <= QUOTE_EXPLANATION_MAX:
        return text
    cut = text[:QUOTE_EXPLANATION_MAX].rsplit(" ", 1)[0]
    return cut + "…"  # …


def build_quotes(songs):
    """Aplatit toutes les références de toutes les chansons en un tableau léger.

    L'ordre suit celui des chansons (déjà triées par id) puis l'ordre d'origine
    des références → sélection quotidienne stable côté client et diffs propres.
    """
    quotes = []
    for song in songs:
        for ref in song.get("references", []):
            ref_id = ref.get("id")
            excerpt = ref.get("excerpt")
            explanation = ref.get("explanation")
            if not (ref_id and excerpt and explanation):
                continue
            quotes.append({
                "songId": song["id"],
                "songTitle": song.get("title", song["id"]),
                "refId": ref_id,
                "excerpt": excerpt,
                "explanation": _truncate_explanation(explanation),
            })
    return quotes


def main():
    paths = sorted(glob.glob(os.path.join(SONGS_DIR, "*.json")))
    if not paths:
        print(f"ERREUR : aucun fichier trouvé dans {SONGS_DIR}", file=sys.stderr)
        return 1

    songs = []
    seen_ids = set()
    for p in paths:
        try:
            with open(p, encoding="utf-8") as f:
                song = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"ERREUR : JSON invalide dans {p} : {e}", file=sys.stderr)
            return 1

        song_id = song.get("id")
        if not song_id:
            print(f"ERREUR : champ 'id' manquant dans {p}", file=sys.stderr)
            return 1
        if song_id in seen_ids:
            print(f"ERREUR : id en double '{song_id}' ({p})", file=sys.stderr)
            return 1
        seen_ids.add(song_id)
        songs.append(song)

    # Tri déterministe par id → diffs propres, ordre stable.
    songs.sort(key=lambda s: s["id"])

    last_updated = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

    combined = {
        "lastUpdated": last_updated,
        "songs": songs,
    }
    write_json_atomic(OUTPUT, combined)

    quotes = build_quotes(songs)
    write_json_atomic(QUOTES_OUTPUT, {
        "lastUpdated": last_updated,
        "quotes": quotes,
    })

    print(f"OK : {len(songs)} chansons -> {OUTPUT}")
    print(f"OK : {len(quotes)} citations -> {QUOTES_OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
