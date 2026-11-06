import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { AppProviders } from '../providers/AppProviders';

/**
 * Root layout.
 *
 * The Home screen is the first screen and stays uncluttered; the other destinations are reached
 * from it. Navigation is kept to a flat list on purpose: a non-speaking user should not have to
 * learn a hierarchy to be understood. Part 4 adds Emergency, the Home-card chooser and the history
 * of recent and frequent messages alongside the existing screens.
 */
export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTitleAlign: 'center', headerBackTitle: 'Back' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="emergency" options={{ title: 'Emergency' }} />
        <Stack.Screen name="home-cards" options={{ title: 'Home cards' }} />
        <Stack.Screen name="history" options={{ title: 'Recent and Most Used' }} />
        <Stack.Screen name="phrases" options={{ title: 'Quick Phrases' }} />
        <Stack.Screen name="favourites" options={{ title: 'Favourites' }} />
        <Stack.Screen name="messages" options={{ title: 'Saved Messages' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="voices" options={{ title: 'Offline Voices' }} />
      </Stack>
    </AppProviders>
  );
}
