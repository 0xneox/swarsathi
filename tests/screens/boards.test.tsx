import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => {
  const Screen = () => null;
  return {
    Stack: { Screen },
    Link: ({ children }: { children: React.ReactNode }) => children,
    router: { push: (...args: unknown[]) => mockRouterPush(...args) },
  };
});

import BoardsScreen from '../../src/app/boards';
import { initials } from '../../src/utils/monogram';
import { InMemoryBoardRepository } from '../../src/services/storage/boards';
import { InMemoryBoardRecencyRepository } from '../../src/services/storage/boardRecency';
import { InMemoryCaregiverRepository } from '../../src/services/storage/caregiver';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  InMemoryCommunicationHistoryRepository,
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
} from '../../src/services/storage/communication';
import {
  InMemoryCustomMessageRepository,
  InMemoryFavouriteRepository,
  InMemoryPhraseRepository,
} from '../../src/services/storage/phrases';
import { DEFAULT_PROFILE_ID, setActiveProfileId } from '../../src/services/storage/profileScope';
import { InMemoryProfileRepository } from '../../src/services/storage/profiles';
import {
  setBoardRecencyStorageForTesting,
  setBoardStorageForTesting,
  setCaregiverStorageForTesting,
  setCommunicationStorageForTesting,
  setPhraseStorageForTesting,
  setProfileStorageForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { DEFAULT_PREFERENCES } from '../../src/types';

/**
 * The boards screen: choosing a board quickly.
 *
 * These cover the four things a person needs before opening anything - how many cards a board
 * holds, what the first few of them say, which boards they used last, and a layout they can scan.
 */

function resetStore(): void {
  setActiveProfileId(DEFAULT_PROFILE_ID);
  useAppStore.setState({
    profiles: [],
    activeProfileId: DEFAULT_PROFILE_ID,
    boards: [],
    boardSummaries: {},
    recentBoardIds: [],
    caregiver: { enabled: false, pinSet: false },
    caregiverUnlocked: true,
    preferences: { ...DEFAULT_PREFERENCES },
  });
}

beforeEach(async () => {
  mockRouterPush.mockClear();
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  setPhraseStorageForTesting(
    new InMemoryPhraseRepository(),
    new InMemoryFavouriteRepository(),
    new InMemoryCustomMessageRepository()
  );
  setCommunicationStorageForTesting(
    new InMemoryHomeCardRepository(),
    new InMemoryCommunicationHistoryRepository(),
    new InMemoryFrequencyRepository(),
    new InMemoryEmergencyMessageRepository()
  );
  setProfileStorageForTesting(new InMemoryProfileRepository());
  setBoardStorageForTesting(new InMemoryBoardRepository());
  setBoardRecencyStorageForTesting(new InMemoryBoardRecencyRepository());
  setCaregiverStorageForTesting(new InMemoryCaregiverRepository());
  resetStore();
  await useAppStore.getState().refreshProfiles();
  await useAppStore.getState().refreshBoards();
  await useAppStore.getState().refreshBoardRecency();
});

afterEach(() => {
  jest.restoreAllMocks();
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
  setCommunicationStorageForTesting(null, null, null, null);
  setProfileStorageForTesting(null);
  setBoardStorageForTesting(null);
  setBoardRecencyStorageForTesting(null);
  setCaregiverStorageForTesting(null);
});

describe('board preview', () => {
  it('says how many cards a board holds without opening it', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');
    await useAppStore.getState().addBoardCard(board!.id, { text: 'Bag', label: 'Bag' });
    await useAppStore.getState().addBoardCard(board!.id, { text: 'Till', label: 'Till' });

    await render(<BoardsScreen />);

    expect(screen.getByText(/2 cards/)).toBeTruthy();
  });

  it('previews the first few card labels on the tile', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');
    await useAppStore.getState().addBoardCard(board!.id, { text: 'Bag', label: 'Bag' });
    await useAppStore.getState().addBoardCard(board!.id, { text: 'Till', label: 'Till' });

    await render(<BoardsScreen />);

    expect(screen.getByText('Bag \u00b7 Till')).toBeTruthy();
  });

  it('says a board is empty rather than leaving the tile blank', async () => {
    await useAppStore.getState().createBoard('Shopping');

    await render(<BoardsScreen />);

    expect(screen.getByText('No cards yet. Open it to add some.')).toBeTruthy();
  });
});

describe('board monogram', () => {
  it('shows the board\u2019s initials beside its name', async () => {
    const board = await useAppStore.getState().createBoard('Personal Care');

    await render(<BoardsScreen />);

    const tile = screen.getByTestId(`board-monogram-${board!.id}`, { includeHiddenElements: true });
    expect(
      within(tile).getByText(initials('Personal Care'), { includeHiddenElements: true })
    ).toBeTruthy();
  });
});

describe('list and grid layouts', () => {
  it('starts in the list layout and marks which one is in use', async () => {
    await render(<BoardsScreen />);

    expect(screen.getByTestId('boards-view-list').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('boards-view-grid').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('switches the boards into a two-column grid', async () => {
    // A phone-width window keeps the grid at two columns; a wider one would use three.
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: 400, height: 800, scale: 2, fontScale: 1 });
    const board = await useAppStore.getState().createBoard('Shopping');
    await render(<BoardsScreen />);

    expect(StyleSheet.flatten(screen.getByTestId(`board-${board!.id}`).props.style).width).toBe(
      '100%'
    );

    await fireEvent.press(screen.getByTestId('boards-view-grid'));

    expect(screen.getByTestId('boards-view-grid').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('boards-view-list').props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(StyleSheet.flatten(screen.getByTestId(`board-${board!.id}`).props.style).width).toBe(
      '48%'
    );
  });
});

describe('recently used boards', () => {
  it('stays hidden until a board has been opened', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');
    await render(<BoardsScreen />);

    expect(screen.queryByTestId('recent-boards')).toBeNull();

    await act(async () => {
      await useAppStore.getState().recordBoardOpened(board!.id);
    });

    expect(screen.getByTestId('recent-boards')).toBeTruthy();
    expect(screen.getByTestId(`recent-board-${board!.id}`)).toBeTruthy();
  });

  it('lists the most recently used board first', async () => {
    const first = await useAppStore.getState().createBoard('First');
    const second = await useAppStore.getState().createBoard('Second');
    await act(async () => {
      await useAppStore.getState().recordBoardOpened(first!.id);
      await useAppStore.getState().recordBoardOpened(second!.id);
    });

    await render(<BoardsScreen />);

    const listed = screen.getAllByTestId(/^recent-board-/);
    expect(listed[0].props.testID).toBe(`recent-board-${second!.id}`);
    expect(listed[1].props.testID).toBe(`recent-board-${first!.id}`);
  });

  it('drops a deleted board from the row', async () => {
    const kept = await useAppStore.getState().createBoard('Kept');
    const removed = await useAppStore.getState().createBoard('Removed');
    await act(async () => {
      await useAppStore.getState().recordBoardOpened(kept!.id);
      await useAppStore.getState().recordBoardOpened(removed!.id);
    });
    await useAppStore.getState().deleteBoard(removed!.id);

    await render(<BoardsScreen />);

    expect(screen.getByTestId(`recent-board-${kept!.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`recent-board-${removed!.id}`)).toBeNull();
  });

  it('remembers a board opened from the list', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');
    await render(<BoardsScreen />);

    await fireEvent.press(screen.getByTestId(`board-open-${board!.id}`));

    await waitFor(() => expect(useAppStore.getState().recentBoardIds).toEqual([board!.id]));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/board',
      params: { id: board!.id },
    });
  });

  it('opens a board straight from the recently used row', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');
    await act(async () => {
      await useAppStore.getState().recordBoardOpened(board!.id);
    });
    await render(<BoardsScreen />);

    await fireEvent.press(screen.getByTestId(`recent-board-${board!.id}`));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/board',
      params: { id: board!.id },
    });
  });
});
