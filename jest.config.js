/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', '<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock native modules that cannot run in Node environment
    '^react-native$': '<rootDir>/test/__mocks__/react-native.js',
    '^expo-secure-store$': '<rootDir>/test/__mocks__/expo-secure-store.js',
    '^expo-local-authentication$': '<rootDir>/test/__mocks__/expo-local-authentication.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/test/__mocks__/@react-native-async-storage/async-storage.js',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
  testMatch: ['<rootDir>/test/**/*.test.[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
