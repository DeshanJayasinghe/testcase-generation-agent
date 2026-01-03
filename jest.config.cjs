module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.(test|spec).ts',
    '**/temp/**/*.test.*.ts'  // Allow tests in temp directory
  ],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  coverageDirectory: 'coverage',
  collectCoverage: false,  // Disable coverage by default for temp tests
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/index.ts',
    '!src/**/*.d.ts',
  ],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};