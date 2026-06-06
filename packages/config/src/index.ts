import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG_PATH = join(__dirname, "../../../config/validation.json");

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
	if (!existsSync(CONFIG_PATH)) {
		throw new Error(
			`Missing config at ${CONFIG_PATH}. Copy config/validation.example.json to config/validation.json.`,
		);
	}

	return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
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
