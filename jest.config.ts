import type { Config } from "@jest/types";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config.InitialOptions = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
  collectCoverageFrom: [
    "components/studio/postprod/**/*.{ts,tsx}",
    "app/project/[id]/postprod/**/*.{ts,tsx}",
    "lib/types/postprod.ts",
  ],
};

export default createJestConfig(config);
