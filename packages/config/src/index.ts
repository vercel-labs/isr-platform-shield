import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import defaultConfig from "../validation.example.json";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDE_PATH = join(PACKAGE_ROOT, "validation.json");

export interface PlatformConfig {
	rootDomain: string;
	altDomain: string;
	subdomains: {
		primary: string;
		secondary: string;
	};
	coreUrl: string;
	shieldUrl: string;
}

export function getConfig(): PlatformConfig {
	if (existsSync(OVERRIDE_PATH)) {
		return JSON.parse(readFileSync(OVERRIDE_PATH, "utf8"));
	}

	return defaultConfig as PlatformConfig;
}

export function tryGetConfig(): PlatformConfig | undefined {
	try {
		return getConfig();
	} catch {
		return undefined;
	}
}

function wwwHost(config: PlatformConfig) {
	return `www.${config.rootDomain}`;
}

function subdomainHost(config: PlatformConfig, subdomain: string) {
	return `${subdomain}.${config.rootDomain}`;
}

function altWwwHost(config: PlatformConfig) {
	return `www.${config.altDomain}`;
}

function altSubdomainHost(config: PlatformConfig, subdomain: string) {
	return `${subdomain}.${config.altDomain}`;
}

function pageUrl(host: string, path = "") {
	const normalizedPath = path
		? path.startsWith("/")
			? path
			: `/${path}`
		: "";
	return `https://${host}${normalizedPath}`;
}

export function getUrls(config: PlatformConfig) {
	return {
		homepage: pageUrl(wwwHost(config)),
		admin: pageUrl(wwwHost(config), "/admin"),
		primarySubdomain: pageUrl(
			subdomainHost(config, config.subdomains.primary),
		),
		primaryPost: pageUrl(
			subdomainHost(config, config.subdomains.primary),
			"/1",
		),
		secondarySubdomain: pageUrl(
			subdomainHost(config, config.subdomains.secondary),
		),
		altWww: pageUrl(altWwwHost(config)),
		altPrimarySubdomain: pageUrl(
			altSubdomainHost(config, config.subdomains.primary),
		),
		altPrimaryPost: pageUrl(
			altSubdomainHost(config, config.subdomains.primary),
			"/1",
		),
		altPrimaryMissingPost: pageUrl(
			altSubdomainHost(config, config.subdomains.primary),
			"/99999",
		),
		altPrimaryInvalidPost: pageUrl(
			altSubdomainHost(config, config.subdomains.primary),
			"/abc",
		),
		nonexistentSubdomain: pageUrl(
			`nonexistent-xyz-12345.${config.altDomain}`,
		),
	};
}

export const config = getConfig();
export const urls = getUrls(config);
