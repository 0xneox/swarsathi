import React, { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getSpeechController, useAppStore } from '../store/appStore';
import { logger } from '../utils/logger';
import { ThemeProvider } from './ThemeProvider';

const SCOPE = 'AppProviders';

/**
 * Wires application-level concerns that are not specific to any screen:
 * start-up (storage + speech engine) and the lifecycle rule that speech stops when the app leaves
 * the foreground.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const teardown = useAppStore((state) => state.teardown);
  const highContrast = useAppStore((state) => state.preferences.highContrast);
  const fontScale = useAppStore((state) => state.preferences.fontScale);

  useEffect(() => {
    void bootstrap();
    return () => {
      void teardown();
    };
  }, [bootstrap, teardown]);

  useEffect(() => {
    const controller = getSpeechController();
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        logger.info(SCOPE, 'Application left the foreground; stopping speech if active');
        void controller.handleAppBackgrounded();
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider highContrast={highContrast} fontScale={fontScale}>
        {children}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
