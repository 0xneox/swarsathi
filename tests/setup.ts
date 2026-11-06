/**
 * Global test setup.
 *
 * The `jest-expo` preset already installs the React Native and Expo mocks. Two things are added
 * here:
 *
 * 1. `expo-sqlite` is replaced with a module that always fails to open. Unit tests exercise the
 *    in-memory repositories, and the failure path is exactly what the app must survive. This also
 *    keeps the test runner independent of native SQLite and of Expo's asset pipeline.
 * 2. Logging is quietened so the deliberately-exercised failure paths do not flood the output.
 */

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() =>
    Promise.reject(new Error('expo-sqlite is not available in unit tests'))
  ),
}));

jest.spyOn(console, 'info').mockImplementation(() => undefined);
jest.spyOn(console, 'warn').mockImplementation(() => undefined);
