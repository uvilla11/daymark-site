#!/bin/zsh
# Website captures from one simulator build of the Daymark app. See SCREENSHOTS.md.
#
# usage: AD=<agent-device command from T3 device_open> APP=<Daymark.app> [ONLY=tag-regex] [WAIT=s] \
#        scripts/capture.sh <udid> phone|ipad [outdir]
# Shots are <outdir>/<site asset name>.png at device resolution. outdir defaults to the
# Drive folder Website/<date>-recapture. A folder that already holds shots of a
# different binary is refused, so one folder is always one build.
set -u
U=$1; KIND=$2; B=com.uriah.daymark
DRIVE="$HOME/Library/CloudStorage/GoogleDrive-uvilla11@gmail.com/My Drive/Daymark UI review screenshots/Website"
OUT=${3:-$DRIVE/${DATE:-$(date +%F)}-recapture}
: ${AD:?set AD to the agent-device command bound to $U}
: ${APP:?set APP to the Daymark.app that was installed}
mkdir -p $OUT

HASH=$({ shasum -a 256 "$APP/Daymark"; [[ -f $APP/Daymark.debug.dylib ]] && shasum -a 256 "$APP/Daymark.debug.dylib"; } | shasum -a 256 | awk '{print $1}')
if [[ -f $OUT/build.txt ]]; then
  PREV=$(awk -F' *: *' '/^sha256:/{print $2}' $OUT/build.txt)
  [[ $PREV != $HASH ]] && { echo "refusing: $OUT holds shots of $PREV, this app is $HASH" >&2; exit 1 }
else
  REPO=${APP%%/.build/*}
  { echo "commit: $(git -C $REPO rev-parse --short HEAD)$(git -C $REPO diff --quiet HEAD -- Daymark DaymarkShared || echo ' + uncommitted changes')"
    echo "binary: $APP"; echo "sha256: $HASH"; echo "captured: $(date -u +%FT%TZ)"; } > $OUT/build.txt
fi
xcrun simctl status_bar $U override --time "9:41" --batteryState charged --batteryLevel 100 \
  --operatorName "" --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3

# The data: the app's built-in sample day, seeded once on this run's day, then
# kept as ordinary data (its isSample flags off, its sample manifests removed) so
# no "Sample day" banner shows. Every shot restores this copy first.
BASE=(-DaymarkSkipWelcome -DaymarkDisableNotifications -DaymarkDisableSystemSync -DaymarkDisableSpotlight
      -DaymarkDisableShareImport -DaymarkQuietAutomation -DaymarkTimelineTime 10:20 -DaymarkHour 10)
launch() { local a=(); for x in "$@"; do a+=("--launch-args=$x"); done; $AD open $B --relaunch "${a[@]}" >/dev/null; }
data() { print -r -- "$(xcrun simctl get_app_container $U $B data)/Library/Application Support/Daymark"; }
FIX=$(mktemp -d)
launch -DaymarkResetForTesting -DaymarkSampleData $BASE; sleep 6; $AD close $B >/dev/null 2>&1
( cd "$(data)" && cp daybook.json focus.json rituals.json $FIX/ )
sed -i '' 's/"isSample" : true/"isSample" : false/' $FIX/*.json
grep -q '"isSample" : true' $FIX/*.json && { echo "sample flag still set" >&2; exit 1 }
restore() { $AD close $B >/dev/null 2>&1; local d=$(data); rm -f "$d"/sample-shelf.json "$d"/focus-sample.json; cp $FIX/*.json "$d"/; }
wanted() { [[ -z ${ONLY:-} || $1 =~ ${ONLY:-} ]]; }
# shot <name> <launch args...>: args before BASE win, since the app reads the first of each flag.
shot() {
  local name=$1; shift; wanted $name || return 0
  restore; launch "$@" -DaymarkAppearance light $BASE
  [[ $KIND == ipad ]] && $AD orientation landscape-left >/dev/null
  sleep ${WAIT:-6}
  # THEN: one agent-device action after launch, for states a launch argument can't open.
  [[ -n ${THEN:-} ]] && { eval "$AD $THEN" >/dev/null; sleep 2 }
  $AD screenshot $OUT/$name.png --pixel-density ${DENSITY:-3} >/dev/null && echo $name
}
S=(-DaymarkOpenSettings -DaymarkSettingsScroll)

if [[ $KIND == phone ]]; then
  shot today
  shot today-brief          -DaymarkOpenBrief
  shot today-weather        -DaymarkScrollTo weather
  shot today-timeline       -DaymarkScrollTo day
  shot today-month          -DaymarkOpenMonth
  shot today-tasks          -DaymarkScrollTo tasks
  shot today-event          -DaymarkOpenEventDetail
  THEN='find text "Today layout"' shot today-layout $S today
  shot rituals              -DaymarkTab rituals
  shot focus                -DaymarkTab focus
  shot focus-timers         -DaymarkTab focus -DaymarkScrollTo timers
  shot focus-history        -DaymarkTab focus -DaymarkScrollTo ledger
  shot review               -DaymarkTab review
  shot shelf                -DaymarkTab shelf
  shot shelf-entry          -DaymarkTab shelf -DaymarkOpenShelfEntry
  THEN='type walk' shot search -DaymarkOpenSearch
  THEN='find text "Brief me"' shot ask-brief -DaymarkOpenAssistant
  shot welcome              -DaymarkShowWelcome
  shot appearance           $S look
  shot notifications        $S notifications
  shot calendar             $S calendar
  shot data                 $S data
  # Each tone with the greeting it gets at that hour (site name, app appearance, hour).
  for n m h in predawn predawn 5 dawn dawn 7 parchment light 13 dusk dusk 18 nightfall nightfall 20 night dark 23; do
    shot $n -DaymarkAppearance $m -DaymarkHour $h
  done
else
  DENSITY=${DENSITY:-2}
  for t in today rituals focus review shelf; do shot ipad-$t -DaymarkTab $t; done
fi
