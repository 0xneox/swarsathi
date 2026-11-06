# SwarSathi — Architecture

This document describes the system as built through Part 2: a reliable Android text-to-speech
foundation, plus the AAC communication features layered on top of it (quick phrases, favourites and
the user's own saved messages).

Design rule that overrides every other consideration: **the app must never claim it can speak when
it cannot.** A user who cannot talk does not get a second chance to be understood, so unavailable
voices produce a clear, actionable message — never silence, never a substitute language.

## 1. Layers

Data flows down through these layers and results flow back up as plain, serialisable state:

```
┌──────────────────────────────────────────────────────────────┐
│  UI            src/app/*  +  src/components/*                │  Expo Router screens
│                (never talks to native code directly)         │
├──────────────────────────────────────────────────────────────┤
│  Store         src/store/appStore.ts (Zustand)               │  the only React-aware layer
├──────────────────────────────────────────────────────────────┤
│  Controller    src/services/speech/SpeechController.ts       │  React-free state machine
├──────────────────────────────────────────────────────────────┤
│  Engine        src/services/speech/SpeechEngine.ts           │  SpeechEngine contract
│                src/services/speech/AndroidTTSEngine.ts       │  capability classification
├──────────────────────────────────────────────────────────────┤
│  Bridge        src/services/speech/AndroidTTSBridge.ts       │  typed JS access + events
├──────────────────────────────────────────────────────────────┤
│  Native        modules/swar-tts (Kotlin, Expo Module)        │  android.speech.tts.TextToSpeech
└──────────────────────────────────────────────────────────────┘
```

Each layer only imports from the layer below it. The controller knows nothing about React; the
engine knows nothing about the controller; the native module knows nothing about the app at all.

## 2. Directory map

```
modules/swar-tts/                     Local Expo Module (autolinked from ./modules)
  android/src/main/java/expo/modules/swartts/SwarTtsModule.kt
  android/src/main/AndroidManifest.xml   <queries> for android.intent.action.TTS_SERVICE
  src/SwarTts.ts                         typed surface + requireOptionalNativeModule
  expo-module.config.json

src/
  app/                Expo Router routes: _layout.tsx, index.tsx (home),
                      phrases.tsx (Quick Phrases), favourites.tsx, messages.tsx, settings.tsx
  components/         MessageEditor, SpeakButton, StopButton, QuickPhraseCard,
                      LanguageSelector, LanguageNotice, SpeechStatusBanner,
                      PhraseCard, PhraseEditorModal, CategoryFilter, NavCard
  providers/          ThemeProvider, AppProviders
  services/
    speech/           SpeechEngine, AndroidTTSEngine, AndroidTTSBridge, SpeechController, SpeechError
    storage/          database.ts (SQLite, migrations, saved messages, preferences),
                      phrases.ts (phrase, favourite and custom-message repositories)
  store/appStore.ts   Zustand store, singleton wiring, bootstrap, phrase library
  data/               languages.ts (registry), phrases.ts (bundled phrase library)
  theme/              design tokens (light + high-contrast)
  types/index.ts      the domain contract
  utils/              text.ts, labels.ts, logger.ts, id.ts

tests/                Jest + React Native Testing Library
```

## 3. Why CNG + a local Expo Module

The original brief sketched an `android/app/` folder. This project uses Expo Prebuild / Continuous
Native Generation instead, and that is deliberate:

- `AGENTS.md` (the repository's governing rules) forbids hand-editing `android/` and `ios/`; they
  are generated artefacts and any manual edit is lost on the next prebuild.
- Native speech logic must be *isolated* (a stated requirement). A local Expo Module under
  `modules/swar-tts/` is exactly that: a self-contained Kotlin unit with its own manifest and
  Gradle config, autolinked into the generated app.
- It keeps the native surface testable and swappable. `modules/swar-tts` could be replaced by a
  different implementation without touching `src/`.

The module contributes no runtime permission. It declares only an Android 11+ `<queries>` entry so
the platform can resolve the installed TTS engine. No `INTERNET` permission is requested by this
module: offline voices must keep working in airplane mode.

## 4. Native module — `SwarTtsModule.kt`

Wraps `android.speech.tts.TextToSpeech`. Key decisions:

- **Main-thread confinement.** `TextToSpeech` is only safe to drive from the main thread, so every
  operation is posted through a `Handler(Looper.getMainLooper())`. The JS-facing functions are
  `AsyncFunction`s and resolve on the main thread.
- **One awaited initialisation.** `initialize()` is a one-shot. Concurrent calls are queued in
  `pendingInitialisations` and all resolve (or all reject) together, so JavaScript can never observe
  a half-initialised engine. The `TextToSpeech.OnInitListener` failure path rejects every waiter
  with `ERR_SWAR_TTS_UNAVAILABLE`.
- **Never substitutes a language.** `resolveSelection()` either returns a voice that genuinely
  matches the requested tag or an explicit error. `LANG_MISSING_DATA` / `LANG_NOT_SUPPORTED` become
  `ERR_SWAR_TTS_LANGUAGE_UNAVAILABLE` with instructions to install voice data.
- **No overlapping speech.** Every utterance is submitted with `TextToSpeech.QUEUE_FLUSH`, so
  starting a new utterance cancels the previous one at the platform level as a second line of
  defence behind the controller.
- **Capability catalogue.** `getVoices()` flattens `TextToSpeech.voices` into plain maps carrying
  `networkRequired` (`Voice.isNetworkConnectionRequired`) and `notInstalled`
  (`KEY_FEATURE_NOT_INSTALLED`). These two flags are what let the UI distinguish "the engine
  supports this language" from "a voice exists" from "that voice works offline".
- **Progress events.** An `UtteranceProgressListener` emits `onSpeechStart`, `onSpeechDone`,
  `onSpeechStopped` (with `interrupted`) and `onSpeechError` (with `errorCode`) to JavaScript, each
  carrying the utterance id.
- **Clean teardown.** `release()` allows re-initialisation; `OnDestroy` performs a permanent
  release (`permanentlyReleased = true`) that rejects any pending initialisation and shuts the
  engine down. `speak()` after a permanent release fails with `ERR_SWAR_TTS_NOT_INITIALIZED` /
  `ERR_SWAR_TTS_UNAVAILABLE` rather than touching a dead engine.

Error codes raised here (all `CodedException`):

| Kotlin code | Meaning |
| --- | --- |
| `ERR_SWAR_TTS_UNAVAILABLE` | No engine, engine disabled, or engine released |
| `ERR_SWAR_TTS_NOT_INITIALIZED` | `speak()` before `initialize()` resolved |
| `ERR_SWAR_TTS_LANGUAGE_UNAVAILABLE` | No installed voice for the requested tag |
| `ERR_SWAR_TTS_VOICE_UNAVAILABLE` | Requested `voiceId` is absent or speaks another language |
| `ERR_SWAR_TTS_INVALID_REQUEST` | Empty message |
| `ERR_SWAR_TTS_SPEAK_FAILED` | Engine accepted the queue call but returned `ERROR` |

## 5. Bridge — `AndroidTTSBridge.ts`

The only file that touches the native module object.

- The module is loaded with `requireOptionalNativeModule<SwarTtsNativeModule>('SwarTts')`, so
  `SwarTts` is `SwarTtsNativeModule | null`. This keeps the app launchable in Expo Go and in unit
  tests where the Kotlin code is not compiled in.
- `AndroidTTSBridge.isAvailable()` is a **capability probe** (`SwarTts !== null`), not a platform
  check. A mis-built app therefore fails loudly — it does not offer a Speak button that cannot work.
- `requireModule()` throws `ENGINE_UNAVAILABLE` if the module is missing, so no caller can
  accidentally dereference `null`.
- The four native events are attached through `module.addListener(...)` (from `EventEmitter`) and
  forwarded into the engine's `SpeechEngineListener` callbacks.

## 6. Engine layer

### `SpeechEngine.ts`

Exports the `createSpeechEngine()` factory and the fallback engine.

- `createSpeechEngine()` returns `AndroidTTSEngine` when the bridge is available, and
  `UnavailableSpeechEngine` otherwise.
- `UnavailableSpeechEngine` is **not** a fake. It never pretends to speak: `initialize()` and
  `speak()` throw `ENGINE_UNAVAILABLE` with an actionable hint, and `getCapabilities()` returns an
  empty list. This is what makes "no engine" a first-class, well-explained state rather than a
  crash.

The `SpeechEngine` contract (`src/types/index.ts`) is the brief's interface plus the four additions
needed to drive honest UI state and release native resources:

```ts
interface SpeechEngine {
  readonly id: string;
  readonly displayName: string;
  initialize(): Promise<void>;
  isInitialized(): boolean;
  getAvailableLanguages(): Promise<Language[]>;
  getCapabilities(): Promise<LanguageCapability[]>;
  speak(text: string, options: SpeechOptions): Promise<void>;
  stop(): Promise<void>;
  subscribe(listener: SpeechEngineListener): () => void;
  dispose(): Promise<void>;
}
```

### `AndroidTTSEngine.ts`

Implements the contract on top of the bridge and owns **capability classification**, which is the
heart of SwarSathi's honesty. `classifyAvailability(engineSupports, voices, totalVoicesOnDevice)`
produces exactly one of:

| `LanguageAvailability` | Meaning | What the user is told |
| --- | --- | --- |
| `available-offline` | A non-network voice is installed | Ready offline |
| `available-online-only` | A voice exists but needs the network | Online only |
| `available-unverified` | Engine says yes, device exposed no voice detail | Not yet verified |
| `missing-voice-data` | Engine unsupported, or all voices `notInstalled` | Voice not installed |

Only `available-offline` is a promise that speech works with no connectivity.

## 7. Controller — `SpeechController.ts`

A React-free state machine. It is the single place that decides when speech may start, when it must
stop, and what the user is told.

State: `{ status, speaking, error, engineId, engineDisplayName, capabilities }`, where `status` is
`initializing | ready | speaking | stopped | voice-unavailable | error`.

Behaviours that map directly to the brief's requirements:

- **Concurrent speech prevention.** `speak()` awaits `engine.stop()` before starting anything new,
  and the native layer additionally uses `QUEUE_FLUSH`.
- **Rapid Speak presses.** A monotonic `requestSequence` is incremented per call. A request may only
  write to the state if it is still the newest one, so a slow-then-fast pair cannot let an old
  utterance overwrite a fresh one.
- **Stale native events.** `currentUtteranceId` tracks the utterance that is allowed to drive the
  state machine. `onDone`/`onStopped`/errors from a superseded utterance id are ignored. Engines
  that report an empty id are accepted only while nothing is tracked.
- **Empty messages.** `normalizeForSpeech()` collapses whitespace runs and trims, then
  `isBlankMessage()` rejects the result with `INVALID_REQUEST` and a "type something first" hint.
  Normalisation never changes meaning — it only collapses runs of whitespace.
- **Immediate stop.** `stop()` bumps the sequence, clears the tracked utterance, calls
  `engine.stop()`, and reports `stopped`. It is safe when idle and always resolves.
- **Lifecycle interruptions.** `handleAppBackgrounded()` stops speech: a phone talking in a pocket
  is a privacy and dignity problem.
- **Failure is state, not an exception.** `initialize()` captures failure into `status: 'error'` so
  a missing engine degrades into a message instead of a crash.
- **Voice problems are their own status.** `LANGUAGE_UNAVAILABLE`, `VOICE_UNAVAILABLE` and
  `OFFLINE_VOICE_MISSING` map to the distinct `voice-unavailable` status, which the UI renders
  differently (it is a "fix this in Android settings" problem, not a generic error).

## 8. Store — `appStore.ts`

Zustand, with module-level singletons and explicit test seams.

- Singletons: `controller`, `messagesRepository`, `preferencesRepository`, `phraseRepository`,
  `favouriteRepository`, `customMessageRepository`.
- Test seams: `getSpeechController`, `setSpeechControllerForTesting`,
  `setStorageRepositoriesForTesting`, `setPhraseStorageForTesting`. Tests inject a
  `MockSpeechEngine`-backed controller and in-memory repositories without touching native code.
- `attachController()` subscribes the controller's state into the store, so components re-render
  from a single source of truth.
- `bootstrap()` loads preferences, then initialises the engine, then refreshes capabilities. If the
  database cannot open it falls back to `InMemory*Repositories` and records `storageAvailable`.
  Persistence degrades gracefully; speech never does.
- `setLanguage()` drops a `voiceId` that does not belong to the newly selected language, so a stale
  voice cannot be requested for the wrong language.
- `speak()` reads the current stored preferences and passes them as `SpeechOptions`, so the selected
  language/rate/pitch/voice is always respected.
- `refreshLibrary()` loads phrases for the active language, the raw favourites and the custom
  messages, then resolves the favourites into render-ready `FavouriteEntry` rows. Every read is
  guarded: a storage failure leaves the previous value in place and the bundled library still fills
  the phrase list.
- `speakText(text, language?)` is what the phrase screens use. It defaults to the active language and
  only reuses the stored `voiceId` when the target *is* the active language — a stored voice belongs
  to one language, and reusing it for another would either fail or quietly speak the wrong one.
- Favourites are additive and idempotent (`addPhraseFavourite` / `addCustomMessageFavourite` return
  early if the target is already pinned). `removeFavourite` and `reorderFavourites` write first, then
  refresh, so the UI can never show an order the database did not accept.
- `createCustomMessage` / `updateCustomMessage` return a discriminated result rather than throwing:
  `{ ok: true, message }` or `{ ok: false, reason: 'empty' | 'duplicate' | 'missing' | 'storage' }`.
  Validation lives here, not in the editor, so the rule is identical wherever a message is written.
- `deleteCustomMessage()` removes the favourites that point at the message explicitly before
  deleting it. SQLite would cascade (the schema declares `ON DELETE CASCADE`), but the in-memory
  fallback cannot, and one path that is correct on both backends beats two that differ.

## 9. UI

Expo Router routes in `src/app/`; everything reusable lives outside `src/app/`. Every route is
registered in `_layout.tsx`, which is what gives each screen its title and back button.

- `index.tsx` — home. Header with the app name and a Settings link, `LanguageSelector`,
  `MessageEditor`, `SpeakButton`, `StopButton`, `SpeechStatusBanner`, and a horizontal strip of
  quick-phrase cards. Everything sits inside a `KeyboardAvoidingView` + `ScrollView` so the keyboard
  can never permanently cover the Speak/Stop controls. Below that, a short "More ways to talk"
  section links to the other screens via `NavCard`. Speak stays the largest control and the
  navigation is deliberately three rows — the brief asked for a way into every screen without
  cluttering the one people use most.
- `phrases.tsx` — Quick Phrases. A `LanguageSelector` and the measured `LanguageNotice` sit above a
  `CategoryFilter` strip and the phrase list. Tapping a card speaks the phrase in the language it is
  displayed in; pressing and holding toggles it in favourites. The screen holds no copy of the
  library: it renders whatever `refreshLibrary()` put in the store for the active language, so
  switching language here switches both the wording and the locale handed to the controller.
- `favourites.tsx` — the pinned phrases and messages in the user's own order. Reordering is done
  with explicit **Move up** / **Move down** buttons that are disabled at the ends, rather than
  drag-and-drop: a button can be reached, announced and pressed by someone with limited dexterity or
  no sight.
- `messages.tsx` — the user's own messages. `PhraseEditorModal` handles both create and edit; delete
  goes through an `Alert` confirmation. A message keeps the language it was written in, and the card
  says so whenever that differs from the active language.
- `settings.tsx` — speech rate, pitch, voice, language, font scale, high contrast.
- Components are presentational and driven by props from the store. `PhraseCard` is the single card
  used by all three list screens; the actions it offers (move, edit, favourite, delete) are turned
  on by passing or omitting the corresponding callback.

Accessibility is treated as a requirement, not a polish pass: semantic roles, `accessibilityLabel`s
on every control, minimum 48dp touch targets, `allowFontScaling`, dynamic font scaling through the
theme, high-contrast mode, and `AccessibilityInfo.announceForAccessibility` for status changes so
TalkBack users hear "Speaking" without needing to find the status area. No information is conveyed
by colour alone: the status banner always carries text and an actionable hint.

## 10. Storage

`expo-sqlite` (async API). Six tables:

Part 1:

- `saved_messages` → `SavedMessage` (`id`, `text`, `language`, `category`, `createdAt`, `updatedAt`).
- `user_preferences` → a single row (`id = 1`) holding `language`, `speechRate`, `pitch`, `voiceId`,
  `fontScale`, `highContrast`.

Part 2:

- `phrases` → `Phrase`. `id` is the *logical* phrase key and is shared by every language variant, so
  the primary key is the pair `(id, language)`. `isDefault` distinguishes the bundled library from
  anything a later version adds.
- `custom_messages` → `CustomMessage` (`id`, `title`, `text`, `language`, `category`, `createdAt`,
  `updatedAt`). `title` is nullable: the title is optional in the editor.
- `favourites` → `Favourite` (`id`, `phraseId`, `customMessageId`, `sortOrder`, `createdAt`). A
  `CHECK ((phraseId IS NULL) <> (customMessageId IS NULL))` constraint enforces the invariant the
  rest of the app relies on: a favourite points at exactly one thing, never both and never neither.
  `customMessageId` carries `ON DELETE CASCADE`.
- `app_meta` → a key/value table. It currently holds one key, `phrases_seed_version`, which records
  which revision of the bundled library has already been copied in.

### Migrations

Schema changes go through a versioned list (`MIGRATIONS` in `services/storage/database.ts`), recorded
in SQLite's own `PRAGMA user_version`, with `LATEST_SCHEMA_VERSION` as the revision this build
expects. Three rules apply and none can be relaxed:

1. A migration that has shipped is never edited; a change is added as a new migration, because users
   already have the old one applied.
2. Statements must be safe to replay (`IF NOT EXISTS`). Part 1 databases were created before
   revisions were tracked, so they begin life reporting version 0 with their tables already present;
   migration 1 has to be a no-op for them.
3. Nothing may drop or rename a column. The messages a person has saved *are* their voice, and they
   must survive every update.

`runMigrations()` treats a gap in the sequence as corruption rather than guessing: if the next
migration is not exactly `current + 1` it throws `StorageError` and the app degrades to in-memory
storage instead of operating on a file it cannot trust.

`seedDefaultPhrases()` copies the bundled library into `phrases` so that one query can serve every
phrase (bundled today, user-authored later). It is skipped when `app_meta` already records the
current `PHRASE_LIBRARY_VERSION`, and uses `INSERT OR IGNORE`, so a later build can top the table up
without disturbing what is there. A seed failure is logged and swallowed — the library also ships in
the binary, and losing it must never cost the user their saved messages.

Both repository families have a SQLite implementation and an in-memory implementation behind one
interface. `initializeDatabase()` returns a boolean so the store can degrade to in-memory storage
instead of crashing (the failure is surfaced as `STORAGE_FAILED`). `normalizePreferences()` clamps
every field at the storage boundary — a value written by an older build, or a corrupted row, must
never push the UI into an unreachable state. All data stays on the device; there is no cloud sync and
no analytics that capture message contents.

## 11. Language registry

`src/data/languages.ts` is data-driven and extensible: English `en-IN`, Malayalam `ml-IN`, Hindi
`hi-IN`, Tamil `ta-IN`, Telugu `te-IN`, Kannada `kn-IN`. Availability is **always** determined at
runtime from the engine's capability matrix — nothing about what a given phone can speak is
hardcoded.

Every entry carries `verifiedOnDevice: false`. The UI surfaces this ("Not yet verified on a physical
phone.") and it stays `false` until a human completes the physical-device checklist in
[README.md](README.md) and confirms audio. This is the concrete mechanism behind the rule *do not
advertise a language as working until it has been tested on an actual Android device.*

### The bundled phrase library — `src/data/phrases.ts`

The phrase library is **data, in the application binary**, not a download: no network is needed to
open Quick Phrases, and there is nothing to become unavailable later.

- `BUNDLED_PHRASES` holds one entry per phrase: a logical `id`, a `category`, the canonical English
  `text`, and a `translations` map keyed by language tag. `Phrase.id` is language-independent, which
  is why a favourite can store the logical id and still follow the user's active language.
- `PHRASE_CATEGORIES` is the eight required categories, each with a label and a description that is
  also used as the screen-reader hint on its filter chip.
- `resolvePhraseText(phrase, language)` returns the stored translation, or the English wording when
  a translation is missing. It falls back so a phrase is never blank — but it never claims the
  result is in the requested language.
- `buildPhraseRows(language)` / `buildAllPhraseRows()` turn the library into the row shape the
  database and the repositories use, so the bundled library and the `phrases` table share one shape.
- `resolveFavouriteEntries(favourites, customMessages, language)` is the join behind the Favourites
  screen. A bundled phrase resolves to the *active* language, so it follows a language switch. A
  custom message keeps its own stored language, because re-speaking someone's own words in another
  language would change what they said.
- `TRANSLATIONS_REVIEWED` / `TRANSLATION_REVIEW_STATUS` record whether a native speaker has checked
  the non-English wording. They are `false` / `'draft-needs-native-review'` today, and
  `LanguageNotice` turns that into a plainly-worded notice on screen rather than hiding it.

## 12. Error taxonomy

`SpeechError` is the only error type that crosses a layer boundary; `mapNativeError()` translates
Kotlin `CodedException`s into it, and `toSpeechErrorInfo()` normalises anything else (including
thrown strings and `null`). Each error carries a `code`, `message`, optional `hint` (the actionable
next step) and optional `detail` (raw engine text, shown only in diagnostics).

`ENGINE_UNAVAILABLE · ENGINE_NOT_INITIALIZED · LANGUAGE_UNAVAILABLE · VOICE_UNAVAILABLE ·
OFFLINE_VOICE_MISSING · INVALID_REQUEST · SPEAK_FAILED · STORAGE_FAILED · UNKNOWN`

No speech failure is allowed to escape as an unhandled rejection or a crash.

## 13. Testing strategy

`jest-expo` preset, `@testing-library/react-native` v14 (its `render`/`fireEvent` are async in this
version), and `tests/setup.ts` which mocks `expo-sqlite` to reject — so the storage-failure path the
app must survive becomes the *tested* path, and the cursor stays on the in-memory repositories.

- `tests/speech/MockSpeechEngine.ts` — a fully controllable engine used to drive controller state
  transitions deterministically, including late and superseded events.
- `tests/speech/*` — controller behaviour, error mapping, availability classification.
- `tests/phrases/*` — text normalisation, language registry resolution, phrase data integrity, and
  the catalogue itself: all eight categories present, every phrase carrying a real translation in
  all five non-English languages, the sixteen example phrases from the brief, and the resolution
  rules for the home strip and the favourites list.
- `tests/storage/*` — preference normalisation/clamping and message repository behaviour, plus
  `migrations.test.ts` and `FakeDatabase.ts`.
- `tests/store/*` — end-to-end store flows with injected fakes: the phrase library per language,
  one-tap speech in the right language, favourites (add, dedupe, remove, reorder, language
  following) and custom-message CRUD with its empty/duplicate/missing refusals.
- `tests/accessibility/*` — TalkBack labels, roles, status announcements, the real
  type-a-sentence-and-press-Speak flow on the home screen, and the Quick Phrases screen: browsing by
  category, language switching, speaking a tapped phrase, long-press to favourite, and the
  missing-voice warning.
- `tests/screens/*` — the Favourites and Saved Messages screens driven through the UI: create, edit,
  delete-with-confirmation, favourite, reorder, and one-tap speech.

### Testing the database without a native driver

`jest-expo` cannot open a real SQLite file, so storage is tested from both ends:

- `tests/setup.ts` mocks `expo-sqlite` to reject, which makes the storage-failure path the *tested*
  path and keeps the cursor on the in-memory repositories.
- `tests/storage/FakeDatabase.ts` implements the same `DatabaseConnection` interface the real driver
  does. It understands two things for real — `PRAGMA user_version` and the `app_meta` key/value
  table, which is exactly what the migration runner and the seeding logic read back — records every
  statement, and returns queued rows for anything else. It is installed with
  `setDatabaseForTesting()`, so the SQLite repositories can be driven end-to-end.

That is what makes the migration guarantees testable: a fresh database reaches
`LATEST_SCHEMA_VERSION`; a Part 1 database reporting version 0 upgrades idempotently; replaying
`runMigrations()` is a no-op; a gap in the sequence throws `StorageError`; seeding writes one row
per phrase-and-language and is skipped on the second call; and a failing seed surfaces the error
rather than pretending to have succeeded.

Unit tests prove logic, not audio. Real speech, offline behaviour, rate/pitch audibility, TalkBack,
and maximum font scaling are covered by the manual device checklist in [README.md](README.md).

## 14. Known limitations

- **No audio has been verified on a physical device by this repository.** Offline speech works for
  the languages it works for on the device it is installed on; the app reports exactly what it finds
  but has not proven any language itself.
- **The non-English phrase translations are drafts.** No native speaker has reviewed them. The app
  says so on screen and `TRANSLATIONS_REVIEWED` stays `false` until one has; a reviewer is expected
  to correct the wording and then flip the flag. Nothing in the app hides this state.
- A local Android build requires JDK 17 and the Android SDK; alternatively use an EAS development
  build. The module cannot run in Expo Go.
- Part 2 stops at one-touch phrases: no phrase-prediction, no symbol grids, no voice banking, and no
  cloud sync. Those were explicitly out of scope.

## 15. Licence

SwarSathi's own source is Apache License 2.0 (`LICENSE`, and `modules/swar-tts/package.json`).
Third-party libraries, engines, and voices are **not** redistributed here and keep their own
licences; verify each individually before shipping.

## 16. Part 3 — Offline Neural TTS

### Engine choice & runtime

SwarSathi selects **sherpa-onnx** (`com.github.k2-fsa.sherpa-onnx:sherpa-onnx:v1.13.8`) for offline neural synthesis:
- Maintained, open-source C++ engine with precompiled Android AAR (ARM64, ARMv7, x86, x86_64).
- Pinned to **v1.13.8** because Piper VITS voices require the `dataDir` parameter pointing to `espeak-ng-data` for text phonemisation. In sherpa-onnx v2.0+, this parameter was deprecated/changed.
- Speech is synthesized per phrase/sentence and streamed directly to an `AudioTrack` in streaming mode (`AudioTrack.MODE_STREAM`, `AudioFormat.ENCODING_PCM_FLOAT`).
- Immediate stop is guaranteed: `stop()` sets a volatile `stopRequested` flag, halts `AudioTrack` playback, and prevents remaining audio from queuing.
- Native archive extraction: `NeuralTtsModule.kt` unpacks both `.zip` (via `ZipInputStream`) and `.tar.bz2` (via Apache Commons Compress `BZip2CompressorInputStream` + `TarArchiveInputStream`), stripping the single root folder level to normalize filenames.

### Model management

- Managed by `src/services/models/ModelManager.ts`.
- Downloads occur only upon explicit user request. No silent downloads, accounts, or telemetry.
- Pre-flight free storage check ensures device storage has at least 1.5× the archive size before download starts.
- Integrity verification: downloaded size is checked, archive extracted, and all `requiredFiles` (`tokens.txt`, `model.onnx`) verified to exist before registration.
- Migration v3 introduces the `installed_models` SQLite table, storing only metadata (`modelId`, `language`, `directory`, `bytes`, `verified`, `installedAt`). Large model graphs live on the filesystem in the document directory.

### Language coverage honesty

- **Verified offline neural voices**: Malayalam (`ml-IN` — Arjun, Meera) and Hindi (`hi-IN` — Pratham, Priyamvada, Rohan).
- **Tamil (`ta-IN`), Telugu (`te-IN`), and Kannada (`kn-IN`)**: No verified offline Piper models exist in the catalogue. SwarSathi explicitly does not fabricate support; these languages clearly fall back to the built-in Android Text-to-Speech engine with transparent UI labelling.

### Licensing & compliance

- The app source code is **Apache-2.0**.
- No weights or neural models are bundled within the distributed APK.
- The shared phonemiser dataset `espeak-ng-data` is **GPL-3.0-or-later**.
- Model weights have individual dataset licenses (e.g. AI4Bharat CC BY-NC-SA 4.0 for Pratham/Priyamvada; IITM IndicTTS license for Rohan). These are clearly surfaced in the UI alongside attribution before download.

