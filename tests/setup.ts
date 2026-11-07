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

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props: any) => React.createElement(Text, props, props.name || '');
  return {
    Ionicons: MockIcon,
    MaterialIcons: MockIcon,
    MaterialCommunityIcons: MockIcon,
    Feather: MockIcon,
    FontAwesome5: MockIcon,
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, style, testID }: any) =>
      React.createElement(View, { style, testID }, children),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaConsumer: ({ children }: any) => children(insets),
    SafeAreaView: ({ children, style }: any) => {
      const { View } = require('react-native');
      return React.createElement(View, { style }, children);
    },
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.spyOn(console, 'info').mockImplementation(() => undefined);
jest.spyOn(console, 'warn').mockImplementation(() => undefined);
