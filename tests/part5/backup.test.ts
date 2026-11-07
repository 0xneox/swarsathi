import {
  InMemoryCommunicationHistoryRepository,
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
} from '../../src/services/storage/communication';
import { InMemoryBoardRepository } from '../../src/services/storage/boards';
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
  InMemoryBackupDataSource,
  applyBackup,
  buildBackup,
  parseBackupText,
  serializeBackup,
  type BackupDataSource,
  type BackupSnapshot,
} from '../../src/services/backup/backup';
import { DEFAULT_BOARD_IDS, buildDefaultBoards } from '../../src/data/boards';
import {
  setBackupDataSourceForTesting,
  setBoardStorageForTesting,
  setCaregiverStorageForTesting,
  setCommunicationStorageForTesting,
  setPhraseStorageForTesting,
  setProfileStorageForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  DEFAULT_PREFERENCES,
  type BackupFile,
} from '../../src/types';

/**
 * Part 5: local backup and restore.
 *
 * A backup is the only way a user's setup leaves the device, so the tests below pin down both the
 * happy path and every way a file can be wrong: unreadable, the wrong file, from the future, or
 * damaged. Nothing is ever changed until the file has been trusted, and a failed import must leave
 * the device exactly as it was.
 */

function validProfile(id = DEFAULT_PROFILE_ID, name = 'Default', isDefault = true) {
  return {
    id,
    name,
    description: '',
    isDefault,
    preferences: { ...DEFAULT_PREFERENCES },
    lastUsedAt: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

function validBoard(id = 'board-custom') {
  return {
    id,
    title: 'Custom',
    language: 'en-IN',
    isDefault: false,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    cards: [
      {
        id: 'card-1',
        boardId: id,
        phraseId: null,
        label: 'Bag',
        text: 'I need a bag',
        language: 'en-IN',
        sortOrder: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  };
}

/** A complete, valid backup document as it would look on disk. */
function validDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: 'test',
    exportedAt: 1_700_000_000_000,
    profiles: [validProfile()],
    boards: [validBoard()],
    customMessages: [],
    favourites: [],
    homeCards: [],
    emergencyMessages: [],
    caregiver: { enabled: false, pinHash: null, pinSalt: null },
    ...overrides,
  };
}

describe('parseBackupText', () => {
  it('refuses text that is not JSON', () => {
    expect(parseBackupText('not json at all')).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('refuses JSON that is not a SwarSathi backup', () => {
    expect(parseBackupText(JSON.stringify({ hello: 'world' }))).toEqual({
      ok: false,
      reason: 'not-a-backup',
    });
  });

  it('refuses a backup written by a newer build', () => {
    const document = validDocument({ version: BACKUP_VERSION + 1 });
    expect(parseBackupText(JSON.stringify(document))).toEqual({
      ok: false,
      reason: 'unsupported-version',
    });
  });

  it('refuses a backup with a missing collection', () => {
    const document = validDocument();
    delete document.favourites;
    expect(parseBackupText(JSON.stringify(document))).toEqual({ ok: false, reason: 'damaged' });
  });

  it('refuses a backup with no usable profile', () => {
    const document = validDocument({ profiles: [] });
    expect(parseBackupText(JSON.stringify(document))).toEqual({ ok: false, reason: 'damaged' });
  });

  it('refuses a backup whose version is missing', () => {
    const document = validDocument({ version: 0 });
    expect(parseBackupText(JSON.stringify(document))).toEqual({ ok: false, reason: 'damaged' });
  });

  it('accepts a valid backup and summarises what it holds', () => {
    const result = parseBackupText(JSON.stringify(validDocument()));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.summary).toMatchObject({
      version: BACKUP_VERSION,
      profileCount: 1,
      boardCount: 1,
      cardCount: 1,
    });
    expect(result.backup.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
  });

  it('carries a profile note and its last-used time, defaulting a missing note to empty', () => {
    const document = validDocument({
      profiles: [
        { ...validProfile(), description: 'Hospital visits', lastUsedAt: 1_700_000_000_000 },
        { ...validProfile('profile-2', 'Amma', false) },
      ],
    });

    const result = parseBackupText(JSON.stringify(document));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.backup.profiles[0]).toMatchObject({
      description: 'Hospital visits',
      lastUsedAt: 1_700_000_000_000,
    });
    expect(result.backup.profiles[1]).toMatchObject({ description: '', lastUsedAt: null });
  });

  it('drops a favourite that points at both a phrase and a message', () => {
    const document = validDocument({
      favourites: [
        {
          id: 'fav-1',
          profileId: DEFAULT_PROFILE_ID,
          phraseId: 'general-hello',
          customMessageId: 'message-1',
          sortOrder: 0,
          createdAt: 0,
        },
        {
          id: 'fav-2',
          profileId: DEFAULT_PROFILE_ID,
          phraseId: 'general-hello',
          customMessageId: null,
          sortOrder: 1,
          createdAt: 0,
        },
      ],
    });

    const result = parseBackupText(JSON.stringify(document));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.backup.favourites.map((favourite) => favourite.id)).toEqual(['fav-2']);
  });

  it('drops a board card that has no id rather than failing the whole file', () => {
    const document = validDocument({
      boards: [
        {
          ...validBoard(),
          cards: [
            { label: 'no id', text: 'x' },
            {
              id: 'card-ok',
              phraseId: null,
              label: 'ok',
              text: 'ok',
              language: 'en-IN',
              sortOrder: 1,
              createdAt: 0,
              updatedAt: 0,
            },
          ],
        },
      ],
    });

    const result = parseBackupText(JSON.stringify(document));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.backup.boards[0].cards.map((card) => card.id)).toEqual(['card-ok']);
    // The containing board is forced onto the card, so a hand-edited file cannot orphan a card.
    expect(result.backup.boards[0].cards[0].boardId).toBe('board-custom');
  });

  it('keeps a caregiver lock only when the hash and salt pair is complete', () => {
    const half = parseBackupText(
      JSON.stringify(validDocument({ caregiver: { enabled: true, pinHash: 'abc', pinSalt: null } }))
    );
    expect(half.ok).toBe(true);
    if (half.ok) {
      expect(half.backup.caregiver).toEqual({ enabled: true, pinHash: null, pinSalt: null });
    }
  });
});

describe('buildBackup and serializeBackup', () => {
  it('stamps the format and version and carries the snapshot through', async () => {
    const source = new InMemoryBackupDataSource({
      profiles: [validProfile()],
      boards: [validBoard()],
    });

    const backup = await buildBackup(source, '1.0.0', 1234);

    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.appVersion).toBe('1.0.0');
    expect(backup.exportedAt).toBe(1234);
    expect(backup.boards[0].cards).toHaveLength(1);
  });

  it('writes pretty JSON a person can read', async () => {
    const source = new InMemoryBackupDataSource({ profiles: [validProfile()] });
    const backup = await buildBackup(source, '1.0.0');

    const json = serializeBackup(backup);

    expect(json).toContain('\n');
    expect(JSON.parse(json)).toMatchObject({ format: BACKUP_FORMAT, version: BACKUP_VERSION });
  });

  it('writes the profile note and last-used time into the file', async () => {
    const source = new InMemoryBackupDataSource({
      profiles: [{ ...validProfile(), description: 'Hospital visits', lastUsedAt: 1234 }],
    });

    const json = serializeBackup(await buildBackup(source, '1.0.0'));

    expect(JSON.parse(json).profiles[0]).toMatchObject({
      description: 'Hospital visits',
      lastUsedAt: 1234,
    });
  });

  it('never includes the speech history, the frequency table or any installed voice model', async () => {
    const source = new InMemoryBackupDataSource({ profiles: [validProfile()] });
    const json = serializeBackup(await buildBackup(source, '1.0.0'));

    expect(json).not.toContain('communicationHistory');
    expect(json).not.toContain('message_frequency');
    expect(json).not.toContain('installedModels');
    expect(json).not.toContain('installed_models');
  });
});

describe('InMemoryBackupDataSource merge and replace', () => {
  const initial: Partial<BackupSnapshot> = {
    profiles: [validProfile()],
    customMessages: [
      {
        id: 'message-existing',
        title: null,
        text: 'Existing',
        language: 'en-IN',
        category: 'general',
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  };

  it('merge adds the incoming rows and keeps what the backup does not mention', async () => {
    const source = new InMemoryBackupDataSource(initial);
    const snapshot: BackupSnapshot = {
      profiles: [validProfile('profile-2', 'Amma', false)],
      boards: [validBoard()],
      customMessages: [],
      favourites: [],
      homeCards: [],
      emergencyMessages: [],
      caregiver: { enabled: false, pinHash: null, pinSalt: null },
    };

    await source.importSnapshot(snapshot, 'merge');

    const after = await source.exportSnapshot();
    expect(new Set(after.profiles.map((profile) => profile.id))).toEqual(
      new Set([DEFAULT_PROFILE_ID, 'profile-2'])
    );
    expect(after.customMessages.map((message) => message.id)).toContain('message-existing');
    expect(after.boards.map((board) => board.id)).toContain('board-custom');
  });

  it('replace drops everything the backup does not contain', async () => {
    const source = new InMemoryBackupDataSource(initial);
    const snapshot: BackupSnapshot = {
      profiles: [validProfile('profile-2', 'Amma', false)],
      boards: [],
      customMessages: [],
      favourites: [],
      homeCards: [],
      emergencyMessages: [],
      caregiver: { enabled: false, pinHash: null, pinSalt: null },
    };

    await source.importSnapshot(snapshot, 'replace');

    const after = await source.exportSnapshot();
    expect(after.profiles.map((profile) => profile.id)).toEqual(['profile-2']);
    expect(after.customMessages).toHaveLength(0);
  });

  it('merge never overwrites a caregiver PIN already set on the device', async () => {
    const source = new InMemoryBackupDataSource({
      profiles: [validProfile()],
      caregiver: { enabled: true, pinHash: 'device-hash', pinSalt: 'device-salt' },
    });
    const snapshot: BackupSnapshot = {
      profiles: [validProfile()],
      boards: [],
      customMessages: [],
      favourites: [],
      homeCards: [],
      emergencyMessages: [],
      caregiver: { enabled: true, pinHash: 'backup-hash', pinSalt: 'backup-salt' },
    };

    await source.importSnapshot(snapshot, 'merge');

    const after = await source.exportSnapshot();
    expect(after.caregiver).toEqual({
      enabled: true,
      pinHash: 'device-hash',
      pinSalt: 'device-salt',
    });
  });
});

describe('applyBackup', () => {
  it('reports what a successful import brought in', async () => {
    const source = new InMemoryBackupDataSource({ profiles: [validProfile()] });
    const backup = {
      ...validDocument(),
      profiles: [validProfile(), validProfile('profile-2', 'Amma', false)],
      boards: [validBoard()],
    } as unknown as BackupFile;

    const result = await applyBackup(source, backup, 'merge');

    expect(result).toEqual({ ok: true, mode: 'merge', importedProfiles: 2, importedBoards: 1 });
  });

  it('leaves the existing data untouched when the import fails', async () => {
    const source = new InMemoryBackupDataSource({ profiles: [validProfile()] });
    const failing: BackupDataSource = {
      exportSnapshot: () => source.exportSnapshot(),
      importSnapshot: async () => {
        throw new Error('disk full');
      },
    };

    await expect(
      applyBackup(failing, validDocument() as unknown as BackupFile, 'replace')
    ).resolves.toEqual({ ok: false, reason: 'storage' });
    // Nothing was written, so what the device held is still there.
    expect((await source.exportSnapshot()).profiles).toHaveLength(1);
  });
});

describe('backup through the store', () => {
  function installBackends(): void {
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
    setCaregiverStorageForTesting(new InMemoryCaregiverRepository());
  }

  function releaseBackends(): void {
    setStorageRepositoriesForTesting(null, null);
    setPhraseStorageForTesting(null, null, null);
    setCommunicationStorageForTesting(null, null, null, null);
    setProfileStorageForTesting(null);
    setBoardStorageForTesting(null);
    setCaregiverStorageForTesting(null);
    setBackupDataSourceForTesting(null);
  }

  function resetStore(): void {
    setActiveProfileId(DEFAULT_PROFILE_ID);
    useAppStore.setState({
      profiles: [],
      activeProfileId: DEFAULT_PROFILE_ID,
      boards: [],
      caregiver: { enabled: false, pinSet: false },
      caregiverUnlocked: true,
      preferences: { ...DEFAULT_PREFERENCES },
    });
  }

  let backupSource: InMemoryBackupDataSource;

  beforeEach(async () => {
    installBackends();
    backupSource = new InMemoryBackupDataSource({ profiles: [validProfile()] });
    setBackupDataSourceForTesting(backupSource);
    resetStore();
    await useAppStore.getState().refreshProfiles();
    await useAppStore.getState().refreshBoards();
  });

  afterEach(() => {
    releaseBackends();
  });

  it('exports a backup the user can read back', async () => {
    backupSource = new InMemoryBackupDataSource({
      profiles: [validProfile()],
      boards: buildDefaultBoards(0).map(({ board, cards }) => ({ ...board, cards })),
    });
    setBackupDataSourceForTesting(backupSource);

    const result = await useAppStore.getState().exportBackup();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const reparsed = parseBackupText(result.json);
    expect(reparsed.ok).toBe(true);
    if (reparsed.ok) {
      expect(reparsed.summary.boardCount).toBe(DEFAULT_BOARD_IDS.length);
    }
  });

  it('merges an imported backup without losing what the device already had', async () => {
    const backup = {
      ...validDocument(),
      profiles: [validProfile(), validProfile('profile-2', 'Amma', false)],
      boards: [validBoard()],
    } as unknown as BackupFile;

    const result = await useAppStore.getState().applyBackupFile(backup, 'merge');

    expect(result).toEqual({ ok: true, mode: 'merge', importedProfiles: 2, importedBoards: 1 });
    const snapshot = await backupSource.exportSnapshot();
    expect(snapshot.profiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining([DEFAULT_PROFILE_ID, 'profile-2'])
    );
    expect(snapshot.boards.map((board) => board.id)).toContain('board-custom');
  });

  it('replaces the device contents when replace is chosen', async () => {
    const backup = {
      ...validDocument(),
      profiles: [validProfile('profile-9', 'Only', false)],
      boards: [],
    } as unknown as BackupFile;

    const result = await useAppStore.getState().applyBackupFile(backup, 'replace');

    expect(result).toEqual({ ok: true, mode: 'replace', importedProfiles: 1, importedBoards: 0 });
    const snapshot = await backupSource.exportSnapshot();
    expect(snapshot.profiles.map((profile) => profile.id)).toEqual(['profile-9']);
    // The store re-checked its active profile after the import and landed on one that still exists.
    const remaining = useAppStore.getState().profiles.map((profile) => profile.id);
    expect(remaining).toContain(useAppStore.getState().activeProfileId);
  });
});
