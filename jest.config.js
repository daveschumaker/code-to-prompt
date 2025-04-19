// jest.config.js
module.exports = {
  preset: 'ts-jest', // Use the ts-jest preset
  testEnvironment: 'node', // Specify the testing environment (Node.js for CLI)
  roots: ['<rootDir>/src', '<rootDir>/tests'], // Look for tests in src and a new tests directory
  testMatch: [
    // Patterns Jest uses to detect test files
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest' // Use ts-jest to transform TypeScript files
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
  // Optional: Setup files, coverage reporting, etc.
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'], // If you need setup before each test suite
  // collectCoverage: true, // Enable coverage reporting
  // coverageDirectory: 'coverage',
  // coverageReporters: ['text', 'lcov'],
};
