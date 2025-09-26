jest.mock("expo-constants", () => ({ default: {} }), { virtual: true });
jest.mock(
  "expo-modules-core",
  () => ({
    CodedError: class extends Error {},
    requireOptionalNativeModule: () => null,
  }),
  { virtual: true }
);
