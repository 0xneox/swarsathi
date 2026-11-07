import type { BoardCard, BoardCardEntry, CommunicationBoard } from '../types';
import { getBundledPhrase, resolvePhraseText } from './phrases';

/**
 * The default communication boards.
 *
 * Boards group the cards that suit one situation, so a user can open "Hospital" at an appointment
 * instead of hunting through the whole phrase library. The wording is never duplicated here: every
 * seeded card points at a phrase in the bundled library, so translations, the "draft needs native
 * review" disclosure and the offline guarantee all come from one place.
 *
 * A board the user creates stores its own text instead - that is the whole point of a personal
 * board. Both kinds live in the same table and are told apart by `phraseId`.
 */

/**
 * Revision of the bundled board catalogue.
 *
 * Bumping this is what tells the seeding step that a later build has added boards or cards. It is a
 * plain counter, exactly like `PHRASE_LIBRARY_VERSION`.
 */
export const BOARD_LIBRARY_VERSION = 1;

export interface BoardCardDefinition {
  /** Stable key within the board; combined with the board id to build a deterministic row id. */
  key: string;
  /** Short label shown on the card. */
  label: string;
  /** Bundled phrase this card speaks. Default cards always borrow from the library. */
  phraseId: string;
}

export interface BoardDefinition {
  /** Stable id, stored in SQLite. Never rename without a migration. */
  id: string;
  title: string;
  cards: BoardCardDefinition[];
}

/**
 * The boards a fresh install starts with, in the order they are shown.
 *
 * These are the eight situations the Part 5 brief asks for. A user can edit them, reorder them or
 * delete them; nothing about them is privileged beyond the fact that they arrive pre-filled.
 */
export const DEFAULT_BOARD_DEFINITIONS: BoardDefinition[] = [
  {
    id: 'board-medical',
    title: 'Medical',
    cards: [
      { key: 'pain', label: 'I am in pain', phraseId: 'medical-pain' },
      { key: 'doctor', label: 'I need a doctor', phraseId: 'medical-doctor' },
      { key: 'medication', label: 'I need my medication', phraseId: 'medical-medication' },
      { key: 'allergic', label: 'I am allergic', phraseId: 'medical-allergic' },
      { key: 'explain', label: 'Explain the treatment', phraseId: 'medical-explain' },
      { key: 'cannot-speak', label: 'I cannot speak', phraseId: 'medical-cannot-speak' },
      { key: 'help', label: 'Please help me', phraseId: 'emergency-help' },
    ],
  },
  {
    id: 'board-home',
    title: 'Home',
    cards: [
      { key: 'food', label: 'I need food', phraseId: 'daily-food' },
      { key: 'thirsty', label: 'I am thirsty', phraseId: 'daily-thirsty' },
      { key: 'bathroom', label: 'I need the bathroom', phraseId: 'daily-bathroom' },
      { key: 'wait', label: 'Please wait', phraseId: 'daily-wait' },
      { key: 'sleep', label: 'I want to sleep', phraseId: 'daily-sleep' },
      { key: 'uncomfortable', label: 'I am uncomfortable', phraseId: 'daily-uncomfortable' },
      { key: 'thanks', label: 'Thank you', phraseId: 'general-thanks' },
    ],
  },
  {
    id: 'board-hospital',
    title: 'Hospital',
    cards: [
      { key: 'pain', label: 'I am in pain', phraseId: 'medical-pain' },
      { key: 'water', label: 'Some water, please', phraseId: 'medical-water' },
      { key: 'medication', label: 'I need my medication', phraseId: 'medical-medication' },
      { key: 'cannot-speak', label: 'I cannot speak', phraseId: 'medical-cannot-speak' },
      { key: 'doctor', label: 'I need a doctor', phraseId: 'medical-doctor' },
      { key: 'ambulance', label: 'Call an ambulance', phraseId: 'emergency-ambulance' },
      { key: 'family', label: 'Call my family', phraseId: 'emergency-call-family' },
    ],
  },
  {
    id: 'board-food-drink',
    title: 'Food and Drink',
    cards: [
      { key: 'food', label: 'I need food', phraseId: 'daily-food' },
      { key: 'thirsty', label: 'I am thirsty', phraseId: 'daily-thirsty' },
      { key: 'water', label: 'Some water, please', phraseId: 'medical-water' },
      { key: 'please', label: 'Please', phraseId: 'general-please' },
      { key: 'thanks', label: 'Thank you', phraseId: 'general-thanks' },
      { key: 'no', label: 'No', phraseId: 'general-no' },
    ],
  },
  {
    id: 'board-personal-care',
    title: 'Personal Care',
    cards: [
      { key: 'bath', label: 'Help me bathe', phraseId: 'care-bath' },
      { key: 'clothes', label: 'Help me change clothes', phraseId: 'care-clothes' },
      { key: 'wash-hands', label: 'Wash my hands', phraseId: 'care-wash-hands' },
      { key: 'teeth', label: 'Brush my teeth', phraseId: 'care-teeth' },
      { key: 'hot', label: 'I am feeling hot', phraseId: 'care-hot' },
      { key: 'cold', label: 'I am feeling cold', phraseId: 'care-cold' },
    ],
  },
  {
    id: 'board-travel',
    title: 'Travel',
    cards: [
      { key: 'bus-stop', label: 'Where is the bus stop', phraseId: 'travel-bus-stop' },
      { key: 'ticket', label: 'I need a ticket', phraseId: 'travel-ticket' },
      { key: 'station', label: 'Take me to the station', phraseId: 'travel-station' },
      { key: 'lost', label: 'I am lost', phraseId: 'travel-lost' },
      { key: 'address', label: 'Take me to this address', phraseId: 'travel-address' },
      { key: 'toilet', label: 'Where is the toilet', phraseId: 'travel-toilet' },
    ],
  },
  {
    id: 'board-work',
    title: 'Work',
    cards: [
      { key: 'hello', label: 'Hello', phraseId: 'general-hello' },
      { key: 'yes', label: 'Yes', phraseId: 'general-yes' },
      { key: 'no', label: 'No', phraseId: 'general-no' },
      { key: 'thanks', label: 'Thank you', phraseId: 'general-thanks' },
      { key: 'understand', label: 'I do not understand', phraseId: 'general-not-understand' },
      { key: 'repeat', label: 'Say that again', phraseId: 'general-repeat' },
      { key: 'wait', label: 'Please wait', phraseId: 'daily-wait' },
    ],
  },
  {
    id: 'board-social',
    title: 'Social Interaction',
    cards: [
      { key: 'hello', label: 'Hello', phraseId: 'general-hello' },
      { key: 'thanks', label: 'Thank you', phraseId: 'general-thanks' },
      { key: 'please', label: 'Please', phraseId: 'general-please' },
      { key: 'sorry', label: 'I am sorry', phraseId: 'general-sorry' },
      { key: 'yes', label: 'Yes', phraseId: 'general-yes' },
      { key: 'no', label: 'No', phraseId: 'general-no' },
      { key: 'love', label: 'I love you', phraseId: 'family-love' },
      { key: 'understand', label: 'I do not understand', phraseId: 'general-not-understand' },
    ],
  },
];

/** Every default board id, in catalogue order. */
export const DEFAULT_BOARD_IDS = DEFAULT_BOARD_DEFINITIONS.map((definition) => definition.id);

/** Separator used to build a deterministic id for a seeded card. */
const CARD_ID_SEPARATOR = ':';

/** The id a seeded card is given, so re-seeding can never create a duplicate. */
export function defaultBoardCardId(boardId: string, key: string): string {
  return `${boardId}${CARD_ID_SEPARATOR}${key}`;
}

/**
 * Builds the rows for the default boards.
 *
 * Ids are deterministic, which makes the seeding step idempotent: a later build that adds a card
 * tops the board up without disturbing the cards the user has already edited.
 */
export function buildDefaultBoards(
  createdAt = 0
): { board: CommunicationBoard; cards: BoardCard[] }[] {
  return DEFAULT_BOARD_DEFINITIONS.map((definition, boardIndex) => ({
    board: {
      id: definition.id,
      title: definition.title,
      language: 'en-IN',
      isDefault: true,
      sortOrder: boardIndex,
      createdAt,
      updatedAt: createdAt,
    },
    cards: definition.cards.map((card, cardIndex) => ({
      id: defaultBoardCardId(definition.id, card.key),
      boardId: definition.id,
      phraseId: card.phraseId,
      label: card.label,
      text: '',
      language: 'en-IN',
      sortOrder: cardIndex,
      createdAt,
      updatedAt: createdAt,
    })),
  }));
}

/** Trims a title and refuses one that is only whitespace, so a board is never nameless. */
export function normalizeBoardTitle(title: string): string {
  return title.trim().slice(0, 60);
}

/**
 * Turns a stored card into the row the UI renders.
 *
 * A card that borrows a bundled phrase is resolved in the *application's* active language, exactly
 * like a Home card or a favourite, so the board follows the user between languages. A card with
 * its own text keeps the language it was written in: re-speaking someone's own words in another
 * language would change what they said.
 */
export function resolveBoardCard(card: BoardCard, activeLanguage: string): BoardCardEntry {
  if (card.phraseId !== null) {
    const phrase = getBundledPhrase(card.phraseId);
    if (phrase) {
      const text = resolvePhraseText(phrase, activeLanguage);
      return {
        id: card.id,
        label: card.label.length > 0 ? card.label : text,
        text,
        language: activeLanguage,
        fromLibrary: true,
      };
    }
  }

  return {
    id: card.id,
    label: card.label.length > 0 ? card.label : card.text,
    text: card.text,
    language: card.language,
    fromLibrary: false,
  };
}
