#!/usr/bin/env sh

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/config/validation.json"

cfg() {
	node -e "
		const c = JSON.parse(require('fs').readFileSync('$CONFIG', 'utf8'));
		const keys = '$1'.split('.');
		let v = c;
		for (const k of keys) v = v?.[k];
		if (v === undefined) {
			console.error('Unknown config key: $1');
			process.exit(1);
		}
		console.log(v);
	"
}
