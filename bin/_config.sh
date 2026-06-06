#!/usr/bin/env sh

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CLI="$ROOT/packages/config/cli.mjs"

cfg() {
	node "$CLI" "$1"
}
