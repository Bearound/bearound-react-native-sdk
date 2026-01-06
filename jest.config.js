/**
 * Jest configuration for Bearound React Native SDK
 */

module.exports = {
  preset: 'react-native',

  // Path ignore patterns
  modulePathIgnorePatterns: [
    '<rootDir>/example/node_modules',
    '<rootDir>/lib/',
  ],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**/*',
  ],

  // Coverage reporting
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 70,
      lines: 80,
      statements: 75,
    },
  },

  // Test environment
  testEnvironment: 'node',

  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.(test|spec).{js,jsx,ts,tsx}',
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/__tests__/testUtils.ts',
  ],

  // Setup files
  setupFilesAfterEnv: [],

  // Verbose output
  verbose: true,
};
