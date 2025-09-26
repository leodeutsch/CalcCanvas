/** @type {import('jest').Config} */

import type { Config } from "jest";

module.exports = {
  testPathIgnorePatterns: [
    "/node_modules/",
    "/android/",
    "/ios/",
    "/dist/",
    "/build/",
    "/coverage/",
  ],
  watchPathIgnorePatterns: [
    "<rootDir>/android/",
    "<rootDir>/ios/",
    "<rootDir>/.expo/",
    "<rootDir>/.git/",
    "<rootDir>/dist/",
    "<rootDir>/build/",
    "<rootDir>/coverage/",
    "<rootDir>/node_modules/",
  ],
  moduleNameMapper: {
    "^src/config/env$": "<rootDir>/__mocks__/env.ts",
    "^expo-constants$": "<rootDir>/__mocks__/expo-constants.ts",
    "^expo-modules-core$": "<rootDir>/__mocks__/expo-modules-core.ts",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|expo(nent)?|@expo(nent)?|expo-modules-core)/)",
  ],
};

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/__tests__"],
  testMatch: ["**/__tests__/**/*.spec.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  clearMocks: true,
  verbose: true,
  setupFiles: ["<rootDir>/jest.setup.ts"],
};

export default config;
