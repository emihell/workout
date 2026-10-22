# req-231 — shared by the server scripts (sourced, not run). Defaults are the LIVE server's
# (BACKEND §Where things live); every one can be overridden for a throwaway instance:
#   WORKOUT_LIVE_DIR   ~/dev/workout/workout-live   the `git archive main` copy the server runs from
#   WORKOUT_DATA_DIR   ~/dev/workout/workout-data   the DB, secret, backups/, logs/
#   WORKOUT_PORT       8100                          bound on 127.0.0.1 only
#   WORKOUT_LABEL      com.workout.server            the launchd agent (+ <label>.nightly)
#   WORKOUT_NODE       `command -v node`             the node launchd runs (it has no PATH of yours)
LIVE_DIR="${WORKOUT_LIVE_DIR:-$HOME/dev/workout/workout-live}"
DATA_DIR="${WORKOUT_DATA_DIR:-$HOME/dev/workout/workout-data}"
PORT="${WORKOUT_PORT:-8100}"
LABEL="${WORKOUT_LABEL:-com.workout.server}"
AGENTS="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"
export WORKOUT_DATA_DIR="$DATA_DIR" WORKOUT_PORT="$PORT" WORKOUT_LABEL="$LABEL" WORKOUT_LIVE_DIR="$LIVE_DIR"

say() { echo "$(basename "$0"): $*"; }
die() { echo "$(basename "$0"): $*" >&2; exit 1; }

loaded() { launchctl print "$DOMAIN/$1" >/dev/null 2>&1; }

healthy() { curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; }

# start/stop act only from the live copy (like White Sleeve's ./start): from a worktree they would
# point the live agent at code that changes with every branch checkout.
require_live_copy() {
  local root="$1" live_real
  live_real="$(cd "$LIVE_DIR" 2>/dev/null && pwd -P)" || die "refusing: no live copy at $LIVE_DIR (run ./server/deploy from the repo)"
  [ "$root" = "$live_real" ] || die "refusing: run this from the live copy ($live_real/server/$(basename "$0")), not $root"
  [ ! -e "$root/.git" ] || die "refusing: $root is a git checkout, not the deployed copy"
}
