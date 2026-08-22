import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface LegacyConfig {
	rootDomain: string;
	altDomain?: string;
	subdomains: { primary: string; secondary: string };
	coreUrl: string;
	shieldUrl: string;
}

const configDirectory = join(__dirname, "../config");
const overridePath = join(configDirectory, "validation.json");
const examplePath = join(configDirectory, "validation.example.json");
const fileConfig = JSON.parse(
	readFileSync(existsSync(overridePath) ? overridePath : examplePath, "utf8"),
) as LegacyConfig;

function hostToUrl(value: string): string {
	const host = value.trim().replace(/\/$/, "");
	return host.startsWith("http://") || host.startsWith("https://")
		? host
		: `https://${host}`;
}

export const config = {
	...fileConfig,
	rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? fileConfig.rootDomain,
	altDomain:
		process.env.ALT_DOMAIN ?? fileConfig.altDomain ?? fileConfig.rootDomain,
	coreUrl: process.env.CORE_HOST
		? hostToUrl(process.env.CORE_HOST)
		: fileConfig.coreUrl,
	shieldUrl: process.env.SHIELD_HOST
		? hostToUrl(process.env.SHIELD_HOST)
		: fileConfig.shieldUrl,
};

function pageUrl(host: string, path = ""): string {
	return `https://${host}${path}`;
}

export const urls = {
	homepage: pageUrl(`www.${config.rootDomain}`),
	admin: pageUrl(`www.${config.rootDomain}`, "/admin"),
	primarySubdomain: pageUrl(
		`${config.subdomains.primary}.${config.rootDomain}`,
	),
	primaryPost: pageUrl(
		`${config.subdomains.primary}.${config.rootDomain}`,
		"/1",
	),
	secondarySubdomain: pageUrl(
		`${config.subdomains.secondary}.${config.rootDomain}`,
	),
	altWww: pageUrl(`www.${config.altDomain}`),
	altPrimarySubdomain: pageUrl(
		`${config.subdomains.primary}.${config.altDomain}`,
	),
	altPrimaryPost: pageUrl(
		`${config.subdomains.primary}.${config.altDomain}`,
		"/1",
	),
	altPrimaryMissingPost: pageUrl(
		`${config.subdomains.primary}.${config.altDomain}`,
		"/99999",
	),
	altPrimaryInvalidPost: pageUrl(
		`${config.subdomains.primary}.${config.altDomain}`,
		"/abc",
	),
	nonexistentSubdomain: pageUrl(`nonexistent-xyz-12345.${config.altDomain}`),
};
