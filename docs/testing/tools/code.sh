# usage: bash code.sh <email>  -> latest sign-in code sent to that address (console email backend log)
grep -a -A1 "^Subject: Your MzaziCare code" "$(dirname "$0")/../logs/backend.log" >/dev/null
awk -v e="$1" '/^Subject: Your MzaziCare code:/ {c=$NF} /^To: / {if ($2==e) last=c} END {print last}' "$(dirname "$0")/../logs/backend.log"
