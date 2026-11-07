# SwarSathi

**SwarSathi** (स्वर + साथी — "voice companion") is a free, open-source **AAC (Augmentative and
Alternative Communication)** app for Android. It is built for people who cannot speak, or who find
speaking difficult: type a message, press one button, and the phone says it out loud.

> Every person deserves the ability to communicate, regardless of their financial situation or
> physical ability.

## Principles

- **Free forever.** No account, no login, no subscription, no advertisements, no API keys, no paid
  cloud dependency. The essential communication path must never sit behind a paywall.
- **Offline first.** If a voice is installed on the device, speaking works with no internet.
- **Private by design.** Messages never leave the phone. There is no cloud sync and no analytics
  that collect message contents.
- **Honest.** The app never claims a language or voice works until it has been verified on a real
  device.

## Status — Parts 1–5 (Production Release Candidate)

**Part 1 (foundation)** — the reliable Android text-to-speech foundation. A person can open
SwarSathi, type a sentence, press **Speak**, and hear the phone say it.

**Part 2 (communication features)** — everyday communication through one-touch phrases.

**Part 3 (neural voices)** — optional offline neural TTS via sherpa-onnx.

**Part 4 (rapid communication)** — Home cards, history, frequency tracking, emergency messages, and Simplified Mode.

**Part 5 (personalisation)** — multiple user profiles, context boards, caregiver PIN, and backup/restore.

Implemented in Part 1:

- React Native + Expo (Prebuild / Continuous Native Generation) + TypeScript (strict).
- A native **Kotlin** Android `TextToSpeech` module (`modules/swar-tts`) behind a
  multi-engine `SpeechEngine` abstraction.
- A React-independent `SpeechController` handling concurrency, lifecycle, and error states.
- A light, high-contrast-capable home screen with TalkBack labels, large touch targets, dynamic
  text scaling, and keyboard-aware layout.
- SQLite persistence (via `expo-sqlite`) with an in-memory fallback if the database cannot open.
- Speech rate, pitch, voice, and language preferences that persist across restarts.

Implemented in Part 2:

- **Quick Phrases** — the eight categories the brief asks for (Medical, Emergency, Daily Needs,
  Family, Banking, Travel, Personal Care, General Conversation), each with natural English wording
  and a translation into all five non-English supported languages, bundled in the app binary.
- **Phrase interactions** — tap to speak immediately, press and hold to save to favourites. Speech
  goes through the *existing* `SpeechController`; no second engine was added.
- **Favourites** — a dedicated screen to save, remove, reorder (explicit **Move up** / **Move down**
  buttons, not dragging), edit and speak pinned phrases and messages with one tap.
- **Saved Messages** — write your own messages with a title, language and category; create, edit,
  delete, favourite and speak them, with empty and duplicate entries refused.
- **Language handling** — changing language re-renders the phrase list and reloads favourites, and
  passes that language to the `SpeechController`. If the phone has no voice for the language, a
  warning is shown *before* speaking. SwarSathi never silently speaks a different language.
- **Versioned SQLite migrations** (`PRAGMA user_version`) that extend the Part 1 schema without
  dropping or renaming anything, so existing saved messages survive the upgrade.
- **Updated home screen** — navigation to Speak, Quick Phrases, Favourites, Saved Messages and
  Settings, with Speak still the largest control and the screen otherwise unchanged.
- Jest + React Native Testing Library suite covering all of the above.

Implemented in Part 3:

- **Neural TTS integration** — sherpa-onnx-based offline neural voice engine via local Expo module
- **Model download** — download, verify (SHA-256), and extract neural voice models
- **Engine selection** — switch between Android TTS and Neural TTS in Settings
- **Model management** — install, remove, and track installed neural models
- **Storage migration** — schema version 3 for installed model metadata

Implemented in Part 4:

- **Home communication cards** — one-tap quick messages on the home screen
- **Communication history** — recently spoken messages with replay capability
- **Message frequency** — tracking and ranking of frequently spoken messages
- **Emergency messages** — editable emergency communication with dedicated section
- **Simplified Mode** — reduced UI for users who need minimal interaction
- **History limit** — configurable cap on history retention
- **Storage migration** — schema version 4 for communication data

Implemented in Part 5:

- **Communication profiles** — multiple user profiles with per-profile settings
- **Context boards** — situation-specific communication boards with custom cards
- **Board editor** — create, edit, duplicate, and delete boards and cards
- **Profile switching** — switch between profiles without app restart
- **Caregiver PIN** — optional lock for configuration screens
- **Backup/restore** — local JSON backup and restore of all configuration
- **Profile-scoped data** — favourites, Home layout, and emergency wording per profile
- **Storage migration** — schema version 5 for profiles and boards

**Not** implemented (deliberately): cloud services, AI features, analytics, tracking, and voice cloning.

### Important limitations

**No third-party voice or engine is bundled or redistributed.** SwarSathi uses whatever
text-to-speech engine is already installed on the phone (typically Google Speech Services or a
vendor engine). Language and voice availability is therefore **detected at runtime**, never
hardcoded, and **offline speech has not been verified for any language** by this repository.

The `verifiedOnDevice` flag on every entry in `src/data/languages.ts` is `false` until a human
confirms speech on a physical device (see the checklist below). The UI reflects this and shows
"Not yet verified on a physical phone."

**The bundled translations have not been reviewed by a native speaker.** The English wording is
authored directly; the Malayalam, Hindi, Tamil, Telugu and Kannada strings are drafts. Rather than
hide this or silently fall back to English, SwarSathi labels the situation in the app: on any
non-English language it shows "The bundled phrases in this language are drafts. They have not been
reviewed by a native speaker, so please check the wording before relying on it." The status is
recorded in one place, `TRANSLATION_REVIEW_STATUS` / `TRANSLATIONS_REVIEWED` in
`src/data/phrases.ts`, and flips to reviewed only once a speaker of each language has gone through
the list. **Please treat the non-English phrase lists as unverified until then.**

## Requirements

- Node.js 20+ and npm.
- An Android device (recommended: a real phone, not an emulator) with an Android TTS engine
  installed. Android 6.0 (API 23) or newer.
- For a **local** Android build: JDK 17 and the Android SDK (`ANDROID_HOME`). Alternatively, use an
  EAS cloud development build (no local Android toolchain needed).

## Getting started

```bash
npm install

# Type check, lint, and unit tests
npm run typecheck
npm run lint
npm test
```

### Running on a real Android device

SwarSathi contains **custom native code** (the Kotlin TTS module), so it will **not** run in Expo Go.
You need a development build:

```bash
# Local development build (requires JDK 17 + Android SDK)
npx expo run:android

# ...or a cloud development build (no local toolchain needed)
npx eas-cli@latest build --profile development --platform android
```

`android/` is generated by Expo Prebuild / CNG. **Do not edit it by hand** — configure native
behaviour in `app.json`, config plugins, or the local module under `modules/`.

## Physical-device verification checklist

Unit tests mock the native TTS layer; they prove the logic, not the audio. Before claiming any
language works, complete this on a real phone:

1. Launch the development build on the device.
2. Confirm the app reaches the **Ready** status (the engine initialised).
3. Type a sentence and press **Speak** — hear it spoken aloud.
4. Press **Speak** twice quickly — confirm the first utterance is cut off, not overlapped.
5. Press **Stop** mid-sentence — confirm speech stops immediately.
6. Open **Settings** and change **speech rate** and **pitch** — confirm the next utterance changes.
7. Select each language in turn and confirm the app reports its capability honestly
   (Ready offline / Online only / Voice not installed / Not yet verified).
8. Turn on **airplane mode** and repeat step 3 for a language the app reports as **Ready offline** —
   this is the actual offline proof.
9. Reboot the app and confirm language, rate, and pitch persisted.
10. Enable **TalkBack** and confirm every control is reachable and announced correctly.
11. Raise the system font size to maximum and confirm nothing overlaps or is clipped.

Part 2:

12. Open **Quick Phrases**. Browse each of the eight categories and confirm every phrase is legible
    and that the category chip states whether it is selected.
13. Tap a phrase — confirm it is spoken in the language shown on screen, and that it is spoken in
    that language and no other.
14. Press and hold a phrase — confirm it appears in **Favourites**.
15. In **Favourites**, tap a favourite to speak it, use **Move up** / **Move down** to reorder, and
    **Delete** to remove one. Reopen the app and confirm the order survived.
16. Open **Saved Messages**, write a message, and save it. Then edit it, favourite it, and delete it
    (confirming the delete prompt). Try saving an empty message and a duplicate — both should be
    refused with an explanation.
17. Switch to a language the phone has **no voice** for, open **Quick Phrases**, and confirm the
    warning appears and that the phrase text is shown in that language.
18. Force-stop and reopen the app — confirm favourites, saved messages and their order are all still
    there (this is the persistence proof, and it also proves the Part 1 → Part 2 migration ran).

Before claiming a language works:

19. Only after step 8 succeeds for a language, set its `verifiedOnDevice` flag to `true` in
    `src/data/languages.ts`.
20. Only after a native speaker of a language has read every phrase in that language and corrected
    it, set `TRANSLATIONS_REVIEWED` to `true` in `src/data/phrases.ts` and clear the draft notice.
    Today it is `false` for all five non-English languages.

## Privacy

- No account, login, or API key.
- No `INTERNET` permission is requested by the app's own native module.
- Messages, favourites, saved messages and preferences are stored only in the device's local SQLite
  database. The bundled phrase library ships inside the app binary and is not downloaded.
- No analytics that capture message contents.

## Licence

The SwarSathi application source code is licensed under the **Apache License 2.0** (see
[LICENSE](LICENSE)).

> Third-party libraries, engines, and voices are **not** covered by this licence and are **not**
> redistributed here. Each keeps its own licence. If you add a dependency or voice, verify its
> licence individually before shipping it.
