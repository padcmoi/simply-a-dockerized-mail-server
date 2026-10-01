#!/usr/bin/env bash
# Renders the PlantUML sources found under /docs, at any depth, to a JPEG
# sitting next to each of them. PlantUML writes PNG, its default format; the
# PNG stays inside the container, where it is converted to JPEG then deleted:
# only the JPEG ever reaches /docs.
#
#   watch  render what is missing or out of date, then every source that changes
#   once   render what is missing or out of date, then leave
#   all    render every source again, then leave
set -uo pipefail

DOCS_DIR=/docs
WORK_DIR=$(mktemp -d /tmp/diagrams.XXXXXX)
TAG="diagrams"

log() { printf "%s %s\n" "$TAG" "$*"; }

is_source() {
	case "$1" in
	*.plantuml | *.puml) return 0 ;;
	*) return 1 ;;
	esac
}

jpeg_of() {
	printf "%s.jpg" "${1%.*}"
}

render() {
	local source="$1" jpg png tmp
	[ -f "$source" ] || return 0
	jpg=$(jpeg_of "$source")
	png="$WORK_DIR/diagram.png"
	tmp="$WORK_DIR/diagram.jpg"
	rm -f "$png" "$tmp"
	if ! plantuml -pipe -tpng -charset UTF-8 -failfast2 <"$source" >"$png" 2>"$WORK_DIR/plantuml.err" || [ ! -s "$png" ]; then
		rm -f "$png"
		log "FAILED ${source#"$DOCS_DIR"/}: $(tr '\n' ' ' <"$WORK_DIR/plantuml.err" | cut -c1-300)"
		return 1
	fi
	if ! magick "$png" -background white -alpha remove -alpha off -quality "$JPEG_QUALITY" "$tmp"; then
		rm -f "$png" "$tmp"
		log "FAILED ${source#"$DOCS_DIR"/}: the PNG could not be converted to JPEG"
		return 1
	fi
	rm -f "$png"
	cat "$tmp" >"$jpg"
	rm -f "$tmp"
	chown --reference="$source" "$jpg"
	chmod --reference="$source" "$jpg"
	touch -r "$source" "$jpg"
	log "rendered ${jpg#"$DOCS_DIR"/}"
}

outdated() {
	local source="$1" jpg
	jpg=$(jpeg_of "$source")
	[ ! -s "$jpg" ] || [ "$source" -nt "$jpg" ] || [ "$source" -ot "$jpg" ]
}

sweep() {
	local force="$1" source failed=0
	while IFS= read -r -d '' source; do
		if [ "$force" = "all" ] || outdated "$source"; then
			render "$source" || failed=1
		fi
	done < <(find "$DOCS_DIR" -type f \( -name "*.plantuml" -o -name "*.puml" \) -print0 | sort -z)
	return "$failed"
}

watch() {
	sweep outdated
	log "watching $DOCS_DIR for .plantuml and .puml files"
	inotifywait -m -r -q -e close_write,moved_to --format "%w%f" "$DOCS_DIR" | while IFS= read -r path; do
		is_source "$path" || continue
		outdated "$path" && render "$path"
	done
}

[ -d "$DOCS_DIR" ] || {
	log "nothing is mounted on $DOCS_DIR"
	exit 2
}

case "${1:-watch}" in
watch) watch ;;
once) sweep outdated ;;
all) sweep all ;;
*)
	sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
	exit 2
	;;
esac
