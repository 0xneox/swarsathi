# SwarSathi — Product Architecture (Blueprint)

Status: **proposed, pending approval**. This document defines the target architecture for the
post-Part-5 pivot. It does not describe implemented code; `ARCHITECTURE.md` remains the source of
truth for what exists today. Nothing here authorises implementation until this blueprint is
approved.

> Guiding principle: *Someone who cannot speak should never have to feel that they cannot
> participate in life.*

> Product principle: **SwarSathi must never make a person adapt to the limitations of the app.
> The app adapts to the person's way of communicating** — typing, tapping symbols, mixing
> languages, choosing their voice, sharing however they need, with no prescribed method.

## 1. Product vision

SwarSathi helps people communicate across every barrier — not only speech disabilities:

- **Express** — type, tap, select, dictate, or use alternative input.
- **Speak** — natural, expressive, personalised voices.
- **Understand** — transliteration, translation, multilingual communication.
- **Connect** — share speech and messages across platforms.
- **Interact** — participate in real-world conversations.
- **Personalise** — a communication experience that feels like their own.

Principles (unchanged): free and open source; privacy-first; offline-first; no subscriptions or
advertisements; no mandatory accounts; no dependence on paid APIs; accessible by design; Android
first, broader future in mind.

## 2. Foundational separation

The most important architectural rule: **no single object is responsible for everything.**

| Concept | Owns | Does NOT own |
| --- | --- | --- |
| **Message** | What the person wants to communicate — content, segments, provenance, lineage | Who is speaking, how it sounds, what the device can do |
| **Profile** | Who is communicating — identity, voice preferences, layout, vocabulary | Message content |
| **Rendering preferences** | How a message is presented — voice, rate, pitch, output format choice | Whether the capability exists |
| **Capabilities** | What the device can actually do — detected voices, installed packs | User intent |
| **Output** | The produced artefact — spoken audio, text, audio file, share payload | The message itself |

Data flow: `Input → Message → (Profile prefs × Capabilities) → Renderer → Output`.
Every layer is replaceable; every deferred feature is a new adapter or renderer, not a rewrite.

## 3. The communication engine

One engine, many surfaces. Parts 1–5 become the foundation — unified, not replaced.

```
┌──────────────────────────────────────────────────────────────────┐
│ SURFACES (thin — own no domain logic)                            │
│  Compose · AAC Board · Conversation* · Share/Inbox* · Settings   │
│  Dictionary · Voices/Packs · Profile manager                     │
│  * = seams designed now, built later                             │
├──────────────────────────────────────────────────────────────────┤
│ COMMUNICATION ENGINE                                             │
│  Input adapters → Message store → Renderers                      │
│  • Input: keyboard + symbol tap (initial); dictation only when   │
│    a compatible speech-recognition capability is present          │
│  • Message: structured utterance (see §4)                        │
│  • Renderers: speak, toText, toAudioFile, shareIntent,           │
│    transliterate                                               │
│  • Services: transliteration (Tier 0), translation (Tier 1 stub) │
├──────────────────────────────────────────────────────────────────┤
│ CAPABILITY LAYER (detected + downloadable, §6)                   │
└──────────────────────────────────────────────────────────────────┘
```

## 4. Message model

A Message is a **structured utterance with provenance**, not a string.

```
Message {
  id:        string                 // stable; supports edit/re-send history
  segments:  Segment[]               // ordered content units

  // Segment
  //   text:        string           // resolved text
  //   language:    BCP47 language   // e.g. "ml", "en", "hi" — language only
  //   script:      Latn|Mlym|Deva|Taml|Telu|Knda   // script, independent of language
  //   origin:      { kind, refId }  // symbol | wordEntry | rawInput | photo
  //   editableAs:  'symbol'|'text'|'both'

  meta {
    source:    'keyboard'|'aac-grid'|'dictation'|'translation'
               |'voice-clone'|'imported'
    profileId: string               // links to Part 5 multi-profile
    createdAt, parents: MessageId[] // lightweight lineage only
    flags:     { translated, transliterated, edited }
  }

  renderHints {                     // advisory; renderers may override
    speak: [{ language, voiceId?, rate?, pitch? }]
    share: { preferred: 'text'|'audio' }
  }
}
```

**Approved decisions:**

- **Segments, not flat text** — a single message may mix Malayalam, English and Manglish
  (Malayalam written in Latin script) without forcing one language. Language and script are
  separate fields and must remain so. Examples:
  `ml`+`Mlym` = Malayalam, `ml`+`Latn` = Manglish, `en`+`Latn` = English,
  `hi`+`Deva` = Hindi. Each segment carries its own language and script.
- **Provenance preserved** — `origin` retains the symbol sequence and source so an AAC message
  can be re-edited as symbols, not just text.
- **`parents` lineage retained** — lightweight pointers from a translation/transliteration to
  its source message. Enables original/translated views later; no heavy version tree.
- **Mixed-language first-class** — never collapse a message into a single language tag.

**Deliberately excluded** (avoid overengineering): no grammar tree, no per-word timestamps, no
embedded audio (rendered audio is a cached output artefact; the cache key must include the
resolved voice/model identity and renderer version — not just message content and render hints —
so that installing a new voice pack can never return audio produced by an older voice).

## 5. Rendering preferences vs. capabilities

Per the approved separation:

- **Profile** holds voice preferences (voice identity per profile — *not* global device
  settings), layout density, vocabulary, language preferences.
- **Capabilities** are probed at runtime and reported honestly. A preference is a *request*;
  the capability layer decides what is actually possible. The UI never offers what cannot run.
- **Renderers** resolve `(Message, Profile prefs, Capabilities) → Output`. If the preferred
  voice is unavailable, the renderer reports the gap — it never silently substitutes (existing
  rule: *the app must never claim it can speak when it cannot*).

## 6. Capability tiers

- **Tier 0 — works at zero downloads, fully offline after install.** System TTS probe, bundled
  starter symbol set, rule-based transliteration, keyboard, phrase library.
- **Tier 1 — optional downloadable packs.** Installed once, usable permanently offline, never
  streamed. Enhanced per-language voices, offline MT models, ASR models, extended symbol sets.
  Offline-first means *useful without internet*, not *everything bundled in the APK*.
- **Tier 2 — research track.** Voice identity/preservation, two-way conversation loop.
  Not committed; lands behind existing seams if/when feasible.

A **Capabilities** surface reports per-language, per-feature status generated from the device —
never hardcoded.

## 7. TTS capability matrix (honest)

Google Speech Services ships offline-capable voices for all six launch languages, but:

| Language | Script | Engine voice exists | Preinstalled? | Expected quality |
| --- | --- | --- | --- | --- |
| English | Latn | Yes (US/UK/IN/AU/NG) | Download-on-demand | Good |
| Hindi | Deva | Yes (hi-IN) | Download-on-demand | Fair–Good |
| Malayalam | Mlym | Yes (ml-IN) | Download-on-demand | Fair (weakest) |
| Tamil | Taml | Yes (ta-IN) | Download-on-demand | Fair |
| Telugu | Telu | Yes (te-IN) | Download-on-demand | Fair |
| Kannada | Knda | Yes (kn-IN) | Download-on-demand | Fair |

Caveats that make runtime probing mandatory:

1. Voice existence ≠ voice installed. Voices download on demand and cache.
2. Default engine varies by OEM (Samsung TTS, Xiaomi, etc.) with different voice sets.
3. Some voices may fall back to network synthesis — offline claim must be verified per voice
   (`networkRequired` / `notInstalled` flags already surfaced by the Part 2 native module).
4. Indic voice quality is the weakest link; Tier 1 voice packs may be needed for acceptable
   launch quality in Malayalam/Tamil/Telugu/Kannada.

**Part 6 deliverable:** extend the existing TTS probe into a per-language capability matrix
across installed engines.

## 8. Symbols

- **ARASAAC** is the *candidate* primary pictogram source: ~13,800 pictograms, CC BY-NC-SA 4.0.
  Its licence compatibility is **not yet confirmed** — BY-NC-SA carries redistribution,
  modification, attribution, share-alike and future-commercial-use obligations that require an
  explicit licence review before any sign-off. ARASAAC is **not a release dependency** until
  that review passes; `SymbolProvider` must allow substitution regardless.
- **Known gap:** ARASAAC metadata languages do not include ml/ta/te/kn. SwarSathi needs its own
  Indic keyword→symbol mapping layer regardless of source.
- **Local symbols are first-class:** user-uploaded photos and custom symbols live behind the
  same `SymbolProvider` interface as ARASAAC, stored locally.
- **Architecture:** `SymbolProvider` interface with bundled starter subset (~500–1000 core
  symbols) + downloadable full packs. Mulberry Symbols (CC BY-SA) or other permissive sets can
  plug in later without redesign.

## 9. Pillar commitments

- **Express** — Compose surface unifies keyboard and AAC grid as initial input adapters;
  dictation appears only when a compatible on-device speech-recognition capability is detected
  (Android `SpeechRecognizer` on-device where available, or a Tier 1 ASR pack). Two-way
  conversation remains future research. All inputs produce Messages.
- **Speak** — Message → TTS via renderers; per-profile voice preferences; personalised voice
  naming. Voice cloning is a long-term research direction only — a few minutes of audio will
  not produce high-quality local clones on ordinary hardware; do not promise it.
- **Understand** — transliteration is rule-based, Tier 0, no AI dependency. AI may enhance but
  is never a prerequisite. Translation is a Tier 1 optional pack.
- **Connect** — outbound first: "Send as text" and "Send as audio" via **standard Android share
  mechanisms only** (intents/share sheet). No WhatsApp-specific integrations as foundation.
  Universal sharing is the requirement. Inbound share-target deferred; **no notification-listener
  permission**.
- **Interact** — deferred. Preserve seams (ASR input adapter, conversation session surface)
  without building UI.
- **Personalise** — per-profile everything; vocabulary learning; exportable local data (no
  lock-in).

## 10. Non-negotiable rules carried forward

1. Never claim speech that cannot happen — honest capability reporting everywhere.
2. No backend, no accounts, no telemetry dependency. All data local.
3. Optional packs install once and work permanently offline.
4. Voice preferences belong to profiles, not the device.
5. Rule-based features (transliteration) work with zero AI/ML dependencies.
6. Accessibility is a requirement: semantic roles, TalkBack announcements, 48dp targets,
   font scaling, high contrast, no colour-only meaning.

## 11. Open items before Part 6

- Explicit ARASAAC licence review covering redistribution, modifications, attribution,
  share-alike obligations and future commercial use — required before ARASAAC can become a
  release dependency.
- Indic keyword→symbol mapping: scope and sourcing.
- Audio share format decision (m4a/AAC vs opus) for maximum compatibility.
- Migration path: existing `SavedMessage`/phrase data → Message model (Parts 1–5 data must
  survive; see ARCHITECTURE.md §10 migration rules).

## 12. Suggested Part 6 scope (after approval)

Engine unification (Message model + store) → Compose surface → Speak renderer hardening +
TTS capability matrix → AAC Board on starter symbols → outbound Connect (text + audio share).
Everything else remains a seam.
