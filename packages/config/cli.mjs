#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), ".");
const DEFAULT_CONFIG_PATH = join(PACKAGE_ROOT, "validation.json");

function loadValidationConfig(
	configPath = process.env.VALIDATION_CONFIG ?? DEFAULT_CONFIG_PATH,
) {
	if (!existsSync(configPath)) {
		console.error(
			`Missing validation config at ${configPath}. Copy packages/config/validation.example.json to packages/config/validation.json.`,
		);
		process.exit(1);
	}

	const fileConfig = JSON.parse(readFileSync(configPath, "utf8"));

	return {
		rootDomain:
			process.env.VALIDATION_ROOT_DOMAIN ?? fileConfig.rootDomain,
		altDomain: process.env.VALIDATION_ALT_DOMAIN ?? fileConfig.altDomain,
		subdomains: {
			primary:
				process.env.VALIDATION_SUBDOMAIN_PRIMARY ??
				fileConfig.subdomains.primary,
			secondary:
				process.env.VALIDATION_SUBDOMAIN_SECONDARY ??
				fileConfig.subdomains.secondary,
		},
		coreUrl: process.env.VALIDATION_CORE_URL ?? fileConfig.coreUrl,
		shieldUrl: process.env.VALIDATION_SHIELD_URL ?? fileConfig.shieldUrl,
	};
}

const key = process.argv[2];

if (!key) {
	console.error("Usage: platform-config <key>");
	console.error(
		"Keys: rootDomain, altDomain, subdomainPrimary, subdomainSecondary, coreUrl, shieldUrl",
	);
	process.exit(1);
}

const config = loadValidationConfig();

const values = {
	rootDomain: config.rootDomain,
	altDomain: config.altDomain,
	subdomainPrimary: config.subdomains.primary,
	subdomainSecondary: config.subdomains.secondary,
	coreUrl: config.coreUrl,
	shieldUrl: config.shieldUrl,
};

if (!(key in values)) {
	console.error(`Unknown config key: ${key}`);
	process.exit(1);
}

console.log(values[key]);
