#!/bin/sh
# Builds the ZIP that platform.openai.com/plugins accepts.
#   ./build.sh                      -> varosity-openai-plugin.zip (upload validation only)
#   DEMO_URL=https://... ./build.sh -> adds review.demo_recording_url (required before "Submit for review")
set -eu
cd "$(dirname "$0")"
OUT="${OUT:-$PWD/varosity-openai-plugin.zip}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R plugin.json mcp.json assets "$TMP/"
if [ -n "${DEMO_URL:-}" ]; then
  DEMO_URL="$DEMO_URL" python3 - "$TMP/plugin.json" <<'PY'
import json, os, sys
p = sys.argv[1]
d = json.load(open(p))
d["extensions"]["com.openai"]["review"]["demo_recording_url"] = os.environ["DEMO_URL"]
json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)
PY
fi
rm -f "$OUT"
(cd "$TMP" && zip -q -r "$OUT" plugin.json mcp.json assets)
echo "wrote $OUT"
