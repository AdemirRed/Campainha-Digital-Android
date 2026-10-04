#!/usr/bin/env bash
set -euo pipefail

# Run with the backend stopped: sql.js keeps the database in memory and
# would overwrite changes made by sqlite3 while the server is running.
cd "$(dirname "$0")/.."
database="${DB_PATH:-./data/doorbell.db}"
videos="${VIDEOS_PATH:-./data/storage/videos}"
photos="${PHOTOS_PATH:-./data/storage/photos}"

command -v sqlite3 >/dev/null
command -v ffmpeg >/dev/null
test -f "$database"
test -d "$videos"
mkdir -p "$photos"
cp -p "$database" "$database.bak-photos-$(date +%Y%m%d-%H%M%S)"

sqlite3 -separator '|' "$database" \
  "SELECT v.id, json_extract(e.metadata, '$.videoFile')
   FROM visits v JOIN events e ON e.id = v.event_id
   WHERE v.photo_path IS NULL;" |
while IFS='|' read -r id video_file; do
  [[ "$id" =~ ^[0-9]+$ ]] || continue
  [[ "$video_file" =~ ^[A-Za-z0-9._-]+\.webm$ ]] || continue
  test -f "$videos/$video_file" || continue

  photo_file="visit-backfill-$id.jpg"
  if ! ffmpeg -v error -y -ss 2 -i "$videos/$video_file" -frames:v 1 -q:v 3 "$photos/$photo_file"; then
    ffmpeg -v error -y -ss 0 -i "$videos/$video_file" -frames:v 1 -q:v 3 "$photos/$photo_file" || continue
  fi
  test -s "$photos/$photo_file" || continue
  sqlite3 "$database" "UPDATE visits SET photo_path = '$photo_file' WHERE id = $id AND photo_path IS NULL;"
  echo "Visit $id: $photo_file"
done
