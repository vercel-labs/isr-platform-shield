#!/usr/bin/env sh

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CONFIG_DIR="$ROOT/packages/config"
CONFIG="$CONFIG_DIR/validation.json"
EXAMPLE="$CONFIG_DIR/validation.example.json"

if [ ! -f "$CONFIG" ] && [ -f "$EXAMPLE" ]; then
	CONFIG="$EXAMPLE"
fi

cfg() {
	case "$1" in
	rootDomain)
		if [ -n "$NEXT_PUBLIC_ROOT_DOMAIN" ]; then
			echo "$NEXT_PUBLIC_ROOT_DOMAIN"
			return
		fi
		;;
	coreUrl)
		if [ -n "$CORE_HOST" ]; then
			case "$CORE_HOST" in
			http://*|https://*) echo "$CORE_HOST" ;;
			*) echo "https://$CORE_HOST" ;;
			esac
			return
		fi
		;;
	shieldUrl)
		if [ -n "$SHIELD_HOST" ]; then
			case "$SHIELD_HOST" in
			http://*|https://*) echo "$SHIELD_HOST" ;;
			*) echo "https://$SHIELD_HOST" ;;
			esac
			return
		fi
		;;
	altDomain)
		if [ -n "$ALT_DOMAIN" ]; then
			echo "$ALT_DOMAIN"
			return
		fi
		;;
	esac

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
