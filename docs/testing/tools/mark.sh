# usage: bash mark.sh "<text>"   timestamped session marker in logs/ui_actions.log (task start/end, observations)
echo "$(date +%Y-%m-%dT%H:%M:%S) MARK $1" >> "$(dirname "$0")/../logs/ui_actions.log"
