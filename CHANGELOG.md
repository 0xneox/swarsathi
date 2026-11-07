# Changelog

All notable changes to SwarSathi will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Security documentation (SECURITY.md) explaining PIN implementation, threat model, and limitations
- Comprehensive audit of database migrations, speech reliability, and accessibility

### Changed
- Documentation improved for production release readiness

### Security
- Documented PIN implementation limitations and threat model
- No changes to PIN implementation (current implementation deemed appropriate for threat model)
- Documented that database and backups are stored in plain text

### Known Limitations
- Caregiver PIN uses iterative SHA-256 (2048 iterations) rather than PBKDF2/Argon2
- SQLite database is not encrypted at rest
- Backup files contain plain-text PIN hashes and salts
- No user-facing warning when app falls back to in-memory storage
- Offline voice availability not verified on physical devices

## [1.0.0] - Parts 1-5

### Part 1 - Foundation
- Reliable Android TextToSpeech integration via native Kotlin module
- SpeechController state machine for concurrency and lifecycle management
- SQLite persistence with in-memory fallback
- Speech rate, pitch, voice, and language preferences
- High-contrast mode and dynamic font scaling
- TalkBack labels and minimum 48dp touch targets

### Part 2 - Communication Features
- Quick Phrases library (8 categories, 6 languages)
- Phrase interactions (tap to speak, long-press to favourite)
- Favourites screen with Move up/Down reordering
- Saved Messages with create, edit, delete, and duplicate detection
- Profile-specific phrase resolution
- Versioned SQLite migrations (schema version 2)

### Part 3 - Neural Voice Support
- sherpa-onnx neural TTS engine integration
- Offline voice model download and installation
- Model verification via SHA-256 checksums
- Engine selection between Android TTS and Neural TTS
- Progress tracking for model downloads
- Storage migration for installed models (schema version 3)

### Part 4 - Rapid Communication
- Home screen communication cards
- Communication history (recently spoken messages)
- Message frequency tracking
- Emergency messages with editable wording
- Simplified Mode for reduced UI complexity
- History limit configuration
- Storage migration for communication data (schema version 4)

### Part 5 - Personalisation
- Communication profiles (multiple users, per-profile settings)
- Context-based communication boards
- Board card editor with phrase library integration
- Profile-scoped favourites, Home layout, and emergency wording
- Caregiver PIN for configuration lock
- Local backup and restore (JSON export/import)
- Profile switching without app restart
- Storage migration for profiles and boards (schema version 5)

### Architecture
- Expo SDK 58 with Continuous Native Generation
- Local Expo modules for native TTS (swar-tts, swar-neural-tts)
- Zustand store with singleton test seams
- Layered architecture: UI → Store → Controller → Engine → Bridge → Native
- TypeScript strict mode
- Jest + React Native Testing Library test suite (425 tests)

### Privacy Principles
- No account, login, or API key
- No cloud sync or cloud dependency
- No analytics or tracking
- No advertisements
- Offline-first design
- Messages never leave the device
- No unnecessary Android permissions

### Supported Languages
- English (en-IN)
- Hindi (hi-IN)
- Malayalam (ml-IN)
- Tamil (ta-IN)
- Telugu (te-IN)
- Kannada (kn-IN)

**Note**: Non-English translations are drafts and have not been reviewed by native speakers. The app displays a notice for these languages.

### Known Limitations
- Offline voice availability not verified on physical devices
- Neural voice models are large (~63 MB per language)
- Caregiver PIN is a convenience lock, not a security barrier
- Database and backups stored in plain text
- No device binding or hardware-backed keystore
