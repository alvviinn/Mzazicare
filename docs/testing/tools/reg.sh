# usage: bash reg.sh <serial> "<Full name>" <email>   (Create account through the app's own form)
U="python -I $(dirname "$0")/ui.py $1"
$U tap "Create an account" >/dev/null; sleep 5
f(){ $U tapxy $1 $2; sleep 1; $U type "$3"; sleep 1; $U key BACK; sleep 2; }
f 595 960 "$2"; f 595 1205 "$3"; f 525 1450 "MzTest2026"; f 525 1695 "MzTest2026"
s=$($U screen); echo "$s" | grep -q "Open debugger" && { $U tapxy 996 2159; sleep 2; }
echo "$s" | grep "EditText" | cut -c1-70
$U tapxy 540 1875; sleep 12
