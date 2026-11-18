# usage: bash poll_location.sh <email> <run_id> <minutes>   read-only: logs each new stored location of one account
Q="$(dirname "$0")/../tools/q.sh"; out="$(dirname "$0")/raw/$2_cg_posts.tsv"; last=""; end=$(( $(date +%s) + $3*60 ))
while [ "$(date +%s)" -lt "$end" ]; do
  r=$(bash "$Q" "select updated_at, latitude, longitude, accuracy, mocked from care_location l join accounts_user u on u.id=l.user_id where u.email='$1';" "-At" 2>/dev/null | tr -d "" | sed -n 1p)
  [ -n "$r" ] && [ "$r" != "$last" ] && { echo "$r" >> "$out"; last="$r"; }
  sleep 2
done
