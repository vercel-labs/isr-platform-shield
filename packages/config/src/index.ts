import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_ROOT = join(__dirname, "..");
const DEFAULT_CONFIG_PATH = join(PACKAGE_ROOT, "validation.json");

export interface ValidationConfig {
	rootDomain: string;
	altDomain: string;
	subdomains: {
		primary: string;
		secondary: string;
	};
	coreUrl: string;
	shieldUrl: string;
}

function readConfigFile(configPath: string) {
	if (!existsSync(configPath)) {
		throw new Error(
			`Missing validation config at ${configPath}. Copy packages/config/validation.example.json to packages/config/validation.json.`,
		);
	}

	return JSON.parse(readFileSync(configPath, "utf8"));
}

export function loadValidationConfig(
	configPath = process.env.VALIDATION_CONFIG ?? DEFAULT_CONFIG_PATH,
): ValidationConfig {
	const fileConfig = readConfigFile(configPath);

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

function wwwHost(config: ValidationConfig) {
	return `www.${config.rootDomain}`;
}

function subdomainHost(config: ValidationConfig, subdomain: string) {
	return `${subdomain}.${config.rootDomain}`;
}

function altWwwHost(config: ValidationConfig) {
	return `www.${config.altDomain}`;
}

function altSubdomainHost(config: ValidationConfig, subdomain: string) {
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

export function getValidationUrls(config: ValidationConfig) {
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

export const config = loadValidationConfig();
export const urls = getValidationUrls(config);
