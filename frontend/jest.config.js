module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["**/*.spec.ts", "**/*.test.ts"],
  verbose: true,
  clearMocks: true,
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/__mocks__/styleMock.js"
  }
};
