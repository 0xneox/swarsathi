import {
  InMemoryCommunicationHistoryRepository,
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
} from '../../src/services/storage/communication';
import { InMemoryBoardRepository } from '../../src/services/storage/boards';
import {
  InMemoryBoardRecencyRepository,
  RECENT_BOARDS_LIMIT,
  moveToFront,
  parseRecentBoardIds,
} from '../../src/services/storage/boardRecency';
import { InMemoryCaregiverRepository } from '../../src/services/storage/caregiver';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  InMemoryCustomMessageRepository,
  InMemoryFavouriteRepository,
  InMemoryPhraseRepository,
} from '../../src/services/storage/phrases';
import { DEFAULT_PROFILE_ID, setActiveProfileId } from '../../src/services/storage/profileScope';
import { InMemoryProfileRepository } from '../../src/services/storage/profiles';
import {
  DEFAULT_BOARD_DEFINITIONS,
  DEFAULT_BOARD_IDS,
  buildDefaultBoards,
  normalizeBoardTitle,
  resolveBoardCard,
} from '../../src/data/boards';
import { initials } from '../../src/utils/monogram';
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
 * Part 5: context-based communication boards.
 *
 * The boards are where a user's own words live, so these tests cover the whole editing surface -
 * create, rename, delete, duplicate and reorder - and, above all, that a board the user makes keeps
 * its own text rather than being silently re-pointed at the phrase library.
 */

let boards: InMemoryBoardRepository;

function installBackends(): void {
  boards = new InMemoryBoardRepository();
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
  setBoardStorageForTesting(boards);
  setBoardRecencyStorageForTesting(new InMemoryBoardRecencyRepository());
  setCaregiverStorageForTesting(new InMemoryCaregiverRepository());
}

function releaseBackends(): void {
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
  setCommunicationStorageForTesting(null, null, null, null);
  setProfileStorageForTesting(null);
  setBoardStorageForTesting(null);
  setBoardRecencyStorageForTesting(null);
  setCaregiverStorageForTesting(null);
}

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
  installBackends();
  resetStore();
  await useAppStore.getState().refreshProfiles();
  await useAppStore.getState().refreshBoards();
});

afterEach(() => {
  releaseBackends();
});

describe('board lifecycle', () => {
  it('creates a board with the language of the active profile', async () => {
    const created = await useAppStore.getState().createBoard('Shopping');

    expect(created).not.toBeNull();
    expect(created?.isDefault).toBe(false);
    expect(created?.language).toBe(DEFAULT_PREFERENCES.language);
    expect(useAppStore.getState().boards.map((board) => board.title)).toContain('Shopping');
  });

  it('refuses a title that is only whitespace', async () => {
    await expect(useAppStore.getState().createBoard('   ')).resolves.toBeNull();
    expect(useAppStore.getState().boards).toHaveLength(0);
  });

  it('renames a board and trims the new title', async () => {
    const created = await useAppStore.getState().createBoard('Shopping');

    await useAppStore.getState().updateBoard(created!.id, { title: '  Market  ' });

    const renamed = useAppStore.getState().boards.find((board) => board.id === created!.id);
    expect(renamed?.title).toBe('Market');
  });

  it('deletes a board', async () => {
    const created = await useAppStore.getState().createBoard('Shopping');

    await useAppStore.getState().deleteBoard(created!.id);

    expect(useAppStore.getState().boards.some((board) => board.id === created!.id)).toBe(false);
  });

  it('takes a board\u2019s cards with it when the board is deleted', async () => {
    const created = await useAppStore.getState().createBoard('Shopping');
    await useAppStore.getState().addBoardCard(created!.id, { text: 'I need a bag', label: 'Bag' });

    await useAppStore.getState().deleteBoard(created!.id);

    await expect(boards.listCards(created!.id)).resolves.toHaveLength(0);
  });
});

describe('board cards', () => {
  it('adds a card with the user\u2019s own wording', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');

    const card = await useAppStore.getState().addBoardCard(board!.id, {
      text: '  Where is the till  ',
      label: 'Till',
    });

    expect(card).not.toBeNull();
    // A card the user writes carries its own text, so it is never attached to the phrase library.
    expect(card?.phraseId).toBeNull();
    expect(card?.text).toBe('Where is the till');
    expect(card?.label).toBe('Till');
  });

  it('refuses an empty card', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');

    await expect(
      useAppStore.getState().addBoardCard(board!.id, { text: '   ', label: '' })
    ).resolves.toBeNull();
  });

  it('edits a card and detaches a seeded card from the library', async () => {
    const repository = new InMemoryBoardRepository();
    setBoardStorageForTesting(repository);
    const { board, cards } = buildDefaultBoards(0)[0];
    await repository.save(board);
    await repository.saveCard(cards[0]);
    await useAppStore.getState().refreshBoards();

    await useAppStore.getState().updateBoardCard(cards[0].id, {
      text: 'My own words',
      label: '',
    });

    const updated = await repository.getCard(cards[0].id);
    expect(updated?.phraseId).toBeNull();
    expect(updated?.text).toBe('My own words');
  });

  it('deletes a card while leaving the board in place', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');
    const card = await useAppStore.getState().addBoardCard(board!.id, {
      text: 'A bag',
      label: 'Bag',
    });

    await useAppStore.getState().deleteBoardCard(card!.id);

    await expect(boards.listCards(board!.id)).resolves.toHaveLength(0);
    expect(useAppStore.getState().boards.some((entry) => entry.id === board!.id)).toBe(true);
  });

  it('reorders the cards of a board', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');
    const first = await useAppStore.getState().addBoardCard(board!.id, {
      text: 'First',
      label: 'First',
    });
    const second = await useAppStore.getState().addBoardCard(board!.id, {
      text: 'Second',
      label: 'Second',
    });
    const third = await useAppStore.getState().addBoardCard(board!.id, {
      text: 'Third',
      label: 'Third',
    });

    await useAppStore.getState().reorderBoardCards(board!.id, [third!.id, first!.id, second!.id]);

    const ordered = await useAppStore.getState().loadBoardCards(board!.id);
    expect(ordered.map((card) => card.text)).toEqual(['Third', 'First', 'Second']);
  });
});

describe('duplicating a board', () => {
  it('copies the title and every card onto a new board', async () => {
    const source = await useAppStore.getState().createBoard('Hospital');
    await useAppStore.getState().addBoardCard(source!.id, {
      text: 'I need a doctor',
      label: 'Doctor',
    });
    await useAppStore.getState().addBoardCard(source!.id, {
      text: 'I am in pain',
      label: 'Pain',
    });

    const copy = await useAppStore.getState().duplicateBoard(source!.id);

    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe(source!.id);
    expect(copy?.title).toBe('Hospital copy');
    expect(copy?.isDefault).toBe(false);

    const copiedCards = await useAppStore.getState().loadBoardCards(copy!.id);
    expect(copiedCards.map((card) => card.text)).toEqual(['I need a doctor', 'I am in pain']);
    // A copy has its own card rows, so editing it cannot reach back into the original.
    expect(copiedCards.every((card) => card.boardId === copy!.id)).toBe(true);
  });

  it('does nothing when the source board does not exist', async () => {
    await expect(useAppStore.getState().duplicateBoard('board-missing')).resolves.toBeNull();
  });
});

describe('default boards', () => {
  it('ships the eight situations the brief asks for', () => {
    expect(DEFAULT_BOARD_IDS).toEqual([
      'board-medical',
      'board-home',
      'board-hospital',
      'board-food-drink',
      'board-personal-care',
      'board-travel',
      'board-work',
      'board-social',
    ]);
    expect(DEFAULT_BOARD_DEFINITIONS.every((definition) => definition.cards.length > 0)).toBe(true);
  });

  it('seeds deterministically so re-seeding cannot duplicate a card', () => {
    const first = buildDefaultBoards(0);
    const second = buildDefaultBoards(0);

    const firstIds = first.flatMap((entry) => entry.cards.map((card) => card.id));
    const secondIds = second.flatMap((entry) => entry.cards.map((card) => card.id));

    expect(firstIds).toEqual(secondIds);
    expect(new Set(firstIds).size).toBe(firstIds.length);
  });

  it('marks every seeded board and card as a default', () => {
    for (const { board, cards } of buildDefaultBoards(0)) {
      expect(board.isDefault).toBe(true);
      expect(cards.every((card) => card.phraseId !== null)).toBe(true);
    }
  });

  it('trims a title and caps it at sixty characters', () => {
    expect(normalizeBoardTitle('  Travel  ')).toBe('Travel');
    expect(normalizeBoardTitle('x'.repeat(80))).toBe('x'.repeat(60));
  });
});

describe('resolveBoardCard', () => {
  it('resolves a seeded card through the phrase library in the active language', () => {
    const { cards } = buildDefaultBoards(0)[0];
    const entry = resolveBoardCard(cards[0], 'en-IN');

    expect(entry.fromLibrary).toBe(true);
    expect(entry.text.length).toBeGreaterThan(0);
    expect(entry.language).toBe('en-IN');
  });

  it('keeps a personal card in the language it was written in', () => {
    const entry = resolveBoardCard(
      {
        id: 'card-1',
        boardId: 'board-1',
        phraseId: null,
        label: 'Bag',
        text: 'Bag venam',
        language: 'ml-IN',
        sortOrder: 0,
        createdAt: 0,
        updatedAt: 0,
      },
      'en-IN'
    );

    expect(entry.fromLibrary).toBe(false);
    expect(entry.text).toBe('Bag venam');
    expect(entry.language).toBe('ml-IN');
  });
});

describe('InMemoryBoardRepository', () => {
  it('lists boards in sort order', async () => {
    const repository = new InMemoryBoardRepository();
    await repository.save({
      id: 'b-2',
      title: 'Second',
      language: 'en-IN',
      isDefault: false,
      sortOrder: 2,
      createdAt: 0,
      updatedAt: 0,
    });
    await repository.save({
      id: 'b-1',
      title: 'First',
      language: 'en-IN',
      isDefault: false,
      sortOrder: 1,
      createdAt: 0,
      updatedAt: 0,
    });

    const listed = await repository.list();
    expect(listed.map((board) => board.id)).toEqual(['b-1', 'b-2']);
  });

  it('hands out copies so a caller cannot mutate stored state', async () => {
    const repository = new InMemoryBoardRepository();
    await repository.save({
      id: 'b-1',
      title: 'First',
      language: 'en-IN',
      isDefault: false,
      sortOrder: 1,
      createdAt: 0,
      updatedAt: 0,
    });

    const board = await repository.get('b-1');
    board!.title = 'Mutated';

    await expect(repository.get('b-1')).resolves.toMatchObject({ title: 'First' });
  });

  it('applies a new card order and ignores ids it does not hold', async () => {
    const repository = new InMemoryBoardRepository();
    for (const [index, id] of ['c-1', 'c-2', 'c-3'].entries()) {
      await repository.saveCard({
        id,
        boardId: 'b-1',
        phraseId: null,
        label: id,
        text: id,
        language: 'en-IN',
        sortOrder: index,
        createdAt: 0,
        updatedAt: 0,
      });
    }

    await repository.reorderCards(['c-3', 'c-1', 'c-2', 'c-missing']);

    const ordered = await repository.listCards('b-1');
    expect(ordered.map((card) => card.id)).toEqual(['c-3', 'c-1', 'c-2']);
  });
});

describe('board summaries', () => {
  it('counts the cards and previews the first few labels', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');
    for (const label of ['Bag', 'Till', 'Price', 'Change']) {
      await useAppStore.getState().addBoardCard(board!.id, { text: label, label });
    }

    const summary = useAppStore.getState().boardSummaries[board!.id];
    expect(summary.count).toBe(4);
    // Only the first few labels are previewed; the count still tells the whole story.
    expect(summary.preview).toEqual(['Bag', 'Till', 'Price']);
  });

  it('falls back to the card text when it has no label', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');
    await useAppStore.getState().addBoardCard(board!.id, { text: 'Where is the till', label: '' });

    const summary = useAppStore.getState().boardSummaries[board!.id];
    expect(summary.preview).toEqual(['Where is the till']);
  });

  it('recounts after a card is deleted so the tile cannot go stale', async () => {
    const board = await useAppStore.getState().createBoard('Shopping');
    const card = await useAppStore.getState().addBoardCard(board!.id, {
      text: 'Bag',
      label: 'Bag',
    });
    expect(useAppStore.getState().boardSummaries[board!.id].count).toBe(1);

    await useAppStore.getState().deleteBoardCard(card!.id);

    expect(useAppStore.getState().boardSummaries[board!.id].count).toBe(0);
  });

  it('counts a seeded board from its real cards', async () => {
    const repository = new InMemoryBoardRepository();
    setBoardStorageForTesting(repository);
    const { board, cards } = buildDefaultBoards(0)[0];
    await repository.save(board);
    for (const card of cards) {
      await repository.saveCard(card);
    }

    await useAppStore.getState().refreshBoards();

    expect(useAppStore.getState().boardSummaries[board.id].count).toBe(cards.length);
  });
});

describe('recently used boards', () => {
  it('lists the board opened last first', async () => {
    const first = await useAppStore.getState().createBoard('First');
    const second = await useAppStore.getState().createBoard('Second');

    await useAppStore.getState().recordBoardOpened(first!.id);
    await useAppStore.getState().recordBoardOpened(second!.id);

    expect(useAppStore.getState().recentBoardIds).toEqual([second!.id, first!.id]);
  });

  it('moves a board already in the list to the front without duplicating it', async () => {
    const first = await useAppStore.getState().createBoard('First');
    const second = await useAppStore.getState().createBoard('Second');

    await useAppStore.getState().recordBoardOpened(first!.id);
    await useAppStore.getState().recordBoardOpened(second!.id);
    await useAppStore.getState().recordBoardOpened(first!.id);

    expect(useAppStore.getState().recentBoardIds).toEqual([first!.id, second!.id]);
  });

  it('remembers only the newest few boards', async () => {
    const ids: string[] = [];
    for (let index = 0; index <= RECENT_BOARDS_LIMIT; index += 1) {
      const board = await useAppStore.getState().createBoard(`Board ${index}`);
      ids.push(board!.id);
    }

    for (const id of ids) {
      await useAppStore.getState().recordBoardOpened(id);
    }

    expect(useAppStore.getState().recentBoardIds).toHaveLength(RECENT_BOARDS_LIMIT);
    expect(useAppStore.getState().recentBoardIds[0]).toBe(ids[ids.length - 1]);
  });
});

describe('monogram initials', () => {
  it('uses the initials of a two-word title', () => {
    expect(initials('Personal Care')).toBe('PC');
  });

  it('uses the first two letters of a single-word title', () => {
    expect(initials('Medical')).toBe('ME');
  });

  it('never returns nothing, even for a blank title', () => {
    expect(initials('   ')).toBe('?');
  });
});

describe('board recency storage helpers', () => {
  it('reads nothing from an empty or unreadable value', () => {
    expect(parseRecentBoardIds(null)).toEqual([]);
    expect(parseRecentBoardIds('not json')).toEqual([]);
    expect(parseRecentBoardIds('{"a":1}')).toEqual([]);
  });

  it('keeps only the string ids it can use', () => {
    expect(parseRecentBoardIds('["a", 2, "", "b"]')).toEqual(['a', 'b']);
  });

  it('caps the stored list at the limit', () => {
    const ids = Array.from({ length: RECENT_BOARDS_LIMIT + 3 }, (_, index) => `id-${index}`);
    expect(parseRecentBoardIds(JSON.stringify(ids))).toHaveLength(RECENT_BOARDS_LIMIT);
  });

  it('moves an id to the front and drops the oldest', () => {
    expect(moveToFront(['b', 'c'], 'a')).toEqual(['a', 'b', 'c']);
    expect(moveToFront(['a', 'b'], 'b')).toEqual(['b', 'a']);
  });

  it('remembers touches in memory', async () => {
    const repository = new InMemoryBoardRecencyRepository();
    await repository.touch('a');
    await repository.touch('b');
    await repository.touch('a');

    await expect(repository.list()).resolves.toEqual(['a', 'b']);
  });
});
