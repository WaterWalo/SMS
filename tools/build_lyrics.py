#!/usr/bin/env python3
"""
build_lyrics.py — Recompile data/lyrics/*.json (un fichier par chanson) en un
fichier combiné data/lyrics.json consommé par le site (search.js).

- Concaténation VERBATIM des objets chanson (aucune transformation de clés/valeurs)
  → la structure lue par la recherche reste identique.
- Robuste : si un fichier par chanson est un JSON invalide ou sans champ "id",
  le script s'arrête en erreur SANS écrire le combiné (jamais de fichier corrompu).
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

    combined = {
        "lastUpdated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
        "songs": songs,
    }

    # Écriture atomique
    tmp = OUTPUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False, indent=4)
        f.write("\n")
    os.replace(tmp, OUTPUT)

    print(f"OK : {len(songs)} chansons -> {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
