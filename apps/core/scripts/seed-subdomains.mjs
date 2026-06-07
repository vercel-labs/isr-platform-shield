#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";

const CORE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(CORE_ROOT, "../..");
const ENV_FILE = join(CORE_ROOT, ".env.local");
const CONFIG_DIR = join(REPO_ROOT, "packages/config");
const CONFIG_PATH = join(CONFIG_DIR, "validation.json");
const EXAMPLE_CONFIG_PATH = join(CONFIG_DIR, "validation.example.json");

const EXAMPLES = [
	{ subdomain: "demo", emoji: "🚀" },
	{ subdomain: "acme", emoji: "🏢" },
];

function loadEnvFile(path) {
	if (!existsSync(path)) {
		return;
	}

	for (const line of readFileSync(path, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		const eq = trimmed.indexOf("=");
		if (eq === -1) {
			continue;
		}

		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		process.env[key] ??= value;
	}
}

function loadValidationSubdomains() {
	const path = existsSync(CONFIG_PATH)
		? CONFIG_PATH
		: existsSync(EXAMPLE_CONFIG_PATH)
			? EXAMPLE_CONFIG_PATH
			: null;

	if (!path) {
		return [
			{ subdomain: "cool", emoji: "🧊" },
			{ subdomain: "test", emoji: "🧪" },
		];
	}

	const config = JSON.parse(readFileSync(path, "utf8"));
	return [
		{ subdomain: config.subdomains.primary, emoji: "🧊" },
		{ subdomain: config.subdomains.secondary, emoji: "🧪" },
	];
}

function usage() {
	console.error(`Usage: seed-subdomains [--force]

Seeds example subdomains in Upstash Redis for local/dev use.

Options:
  --force   Overwrite existing subdomain entries

Requires apps/core/.env.local with KV_REST_API_URL and KV_REST_API_TOKEN.`);
}

async function main() {
	const force = process.argv.includes("--force");
	if (process.argv.includes("--help") || process.argv.includes("-h")) {
		usage();
		process.exit(0);
	}

	loadEnvFile(ENV_FILE);

	const url = process.env.KV_REST_API_URL;
	const token = process.env.KV_REST_API_TOKEN;

	if (!url || !token) {
		console.error(
			`Missing KV_REST_API_URL or KV_REST_API_TOKEN. Copy apps/core/env.example to apps/core/.env.local and set your Upstash credentials.`,
		);
		process.exit(1);
	}

	const redis = new Redis({ url, token });
	const seeds = [...loadValidationSubdomains(), ...EXAMPLES];

	for (const { subdomain, emoji } of seeds) {
		const key = `subdomain:${subdomain}`;
		const existing = await redis.get(key);

		if (existing && !force) {
			console.log(`skip ${subdomain} (already exists)`);
			continue;
		}

		await redis.set(key, {
			emoji,
			createdAt: existing?.createdAt ?? Date.now(),
		});

		console.log(`${existing && force ? "update" : "create"} ${subdomain} ${emoji}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
