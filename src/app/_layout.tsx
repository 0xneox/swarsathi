import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { AppProviders } from '../providers/AppProviders';
import { SoundAlertOverlay } from '../components/SoundAlertOverlay';

/**
 * Root layout.
 *
 * The Home screen is the first screen and stays uncluttered; the other destinations are reached
 * from it. Navigation is kept to a flat list on purpose: a non-speaking user should not have to
 * learn a hierarchy to be understood. Part 4 adds Emergency, the Home-card chooser and the history
 * of recent and frequent messages alongside the existing screens. Part 5 adds the setup screens -
 * profiles, communication boards, the optional caregiver lock and local backup.
 */
export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTitleAlign: 'center', headerBackTitle: 'Back' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="compose" options={{ title: 'Compose' }} />
        <Stack.Screen name="translate" options={{ title: 'Language Centre' }} />
        <Stack.Screen name="isl" options={{ title: 'Indian Sign Language' }} />
        <Stack.Screen name="conversation" options={{ title: 'Conversation' }} />
        <Stack.Screen name="aac" options={{ title: 'Symbol board' }} />
        <Stack.Screen name="emergency" options={{ title: 'Emergency' }} />
        <Stack.Screen name="home-cards" options={{ title: 'Home cards' }} />
        <Stack.Screen name="history" options={{ title: 'Recent and Most Used' }} />
        <Stack.Screen name="phrases" options={{ title: 'Quick Phrases' }} />
        <Stack.Screen name="favourites" options={{ title: 'Favourites' }} />
        <Stack.Screen name="messages" options={{ title: 'Saved Messages' }} />
        <Stack.Screen name="profiles" options={{ title: 'Profiles' }} />
        <Stack.Screen name="boards" options={{ title: 'Communication boards' }} />
        <Stack.Screen name="board" options={{ title: 'Board' }} />
        <Stack.Screen name="caregiver" options={{ title: 'Caregiver access' }} />
        <Stack.Screen name="backup" options={{ title: 'Backup and restore' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="voices" options={{ title: 'Offline Voices' }} />
        <Stack.Screen name="credits" options={{ title: 'Credits and licences' }} />
        <Stack.Screen name="sounds" options={{ title: 'Sound awareness' }} />
      </Stack>
      {/* Sound Awareness alerts float above every screen (vision.md §2D). */}
      <SoundAlertOverlay />
    </AppProviders>
  );
}
