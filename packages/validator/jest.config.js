module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["**/*.test.ts"],
	testTimeout: 10_000,
	moduleNameMapper: {
		"^@platform/config$": "<rootDir>/legacy-config.ts",
	},
};
