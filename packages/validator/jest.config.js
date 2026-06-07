module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testTimeout: 10000,
  moduleNameMapper: {
    '^@platform/config$': '<rootDir>/../config/src/index.ts',
  },
};