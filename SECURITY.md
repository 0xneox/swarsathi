# SwarSathi Security Documentation

## Overview

SwarSathi is designed to work entirely offline with no cloud dependency. This document describes the security properties of the application, what it protects against, and what it does not protect against.

## Threat Model

SwarSathi is designed for the following threat model:

- **Primary threat**: A casual user or helper (caregiver) who has physical access to the device and wants to prevent unauthorized changes to communication boards and settings.
- **Assumption**: The user trusts the device itself and the Android operating system. The app does not protect against device-level attacks, malicious apps, or OS compromise.
- **Assumption**: The user understands that the PIN is a convenience lock, not a security barrier against a determined attacker with access to the device's storage.

## What the Caregiver PIN Protects Against

The optional caregiver PIN feature protects against:

- **Unauthorized configuration changes**: Prevents helpers from accidentally or intentionally modifying communication boards, emergency messages, Home card layout, or settings without permission.
- **Profile deletion**: Prevents deletion of communication profiles.
- **Settings modifications**: Prevents changes to language, speech rate, pitch, and other preferences.

## What the Caregiver PIN Does NOT Protect Against

The PIN implementation has the following limitations:

- **Database extraction**: The PIN hash and salt are stored in the SQLite database in plain text. An attacker with root access or the ability to extract the database file can perform offline brute-force attacks against the PIN.
- **Backup file exposure**: Backup files are plain JSON that include the PIN hash and salt. Anyone with access to a backup file can attempt to recover the PIN.
- **Not a password manager**: The PIN is a 4-8 digit numeric code with a small keyspace (10,000 to 100,000 combinations). It is designed to stop casual access, not withstand brute-force attacks.
- **No rate limiting**: There is no built-in rate limiting on PIN attempts. However, the UI is designed to discourage rapid repeated attempts.
- **Timing attacks**: While timing-safe comparison is used, the implementation is not hardened against sophisticated side-channel attacks.

## PIN Implementation Details

### Current Implementation (SwarSathi v1.0.0)

The PIN is hashed using a custom iterative SHA-256 approach:

```
digest = SHA256( SHA256( ... SHA256( salt + ":" + pin ) ... ) )   (2048 iterations)
```

- **Algorithm**: SHA-256
- **Iterations**: 2048
- **Salt**: 128-bit random value generated per device
- **Key derivation**: Custom implementation using `expo-crypto`

### Security Assessment

This implementation is **appropriate for a local convenience lock** but **not appropriate for a security-critical password**:

**Strengths**:
- Salt prevents rainbow table attacks
- Iterations increase computational cost
- Timing-safe comparison prevents basic timing attacks
- PIN never stored, only hash

**Weaknesses**:
- SHA-256 is not a password-hardening function (lacks memory-hardness)
- 2048 iterations is modest compared to modern KDFs
- Small PIN keyspace makes brute-force feasible given the hash
- No hardware acceleration protection

### Why This Implementation Was Chosen

The current implementation was chosen because:

1. **No external dependencies**: Uses only `expo-crypto` which is already in the project
2. **Cross-platform**: Works on both iOS and Android without additional native modules
3. **Sufficient for threat model**: Stops casual access, which is the primary use case
4. **Simple audit**: Easier to verify correctness than complex KDF implementations

### Future Improvements

For a higher security requirement, consider:

- **PBKDF2**: Available via `expo-crypto` in some versions, but would require version upgrades
- **Argon2id**: Industry standard for password hashing, but requires additional native modules (e.g., `expo-crypto-argon2` or `@sonnetstationsolutions/expo-argon2`)
- **Scrypt**: Memory-hard alternative, but requires additional dependencies

**Migration note**: Any change to the PIN hashing algorithm would require a database migration to re-hash existing PINs or require users to reset their PINs.

## Data Storage Security

### SQLite Database

- **Encryption**: The SQLite database is **not encrypted**. It is stored in plain text on the device's internal storage.
- **Access protection**: Relies on Android's file system permissions. Apps cannot access each other's data directories by default.
- **Backup exposure**: Database backups are exported as plain JSON files containing all user data including PIN hashes.

### What This Means

- **Rooted devices**: On a rooted device, the database file can be copied and read directly.
- **Physical access**: Someone with physical access to an unlocked device can use Android's backup/restore mechanisms to extract data.
- **Backup files**: Shared backup files contain all configuration data in plain text.

### Why No Encryption

Encryption was not implemented because:

1. **No cloud sync**: All data stays on the device, reducing the risk of data in transit
2. **Complexity**: Implementing SQLCipher or similar would significantly increase complexity and dependency surface
3. **Trade-off**: The threat model assumes trusted device access; encryption would add protection against physical extraction but not against the device itself being compromised

### Future Improvements

For better data protection, consider:

- **SQLCipher**: Encrypt the SQLite database at rest (requires native library integration)
- **Android Keystore**: Use platform keystore for protecting sensitive keys
- **Backup encryption**: Encrypt exported backup files with a user-provided password

## Network Security

SwarSathi is designed to work offline and makes minimal network requests:

- **No data transmission**: User messages, profiles, and settings are never sent over the network
- **Optional model downloads**: Neural voice models are downloaded from public URLs. Downloads use HTTPS but the authenticity of downloaded files is verified via SHA-256 checksums.
- **No analytics**: No analytics or telemetry data is collected
- **No cloud services**: No account, no cloud sync, no third-party APIs

## Permissions

SwarSathi requests the following Android permissions:

- **None**: The app's native modules do not request any permissions beyond what Expo automatically includes
- **Storage**: Uses Expo's file system APIs with app-scoped storage
- **Internet**: Only used for optional neural voice model downloads (user-initiated)

## Recommendations for Users

1. **Choose a strong PIN**: Use the maximum 8 digits if you enable the caregiver PIN
2. **Protect the device**: Use Android's screen lock, biometric authentication, and full-disk encryption
3. **Secure backups**: Treat backup files as sensitive data - don't share them with untrusted parties
4. **Physical security**: Don't leave the device unattended where unauthorized users could access it
5. **Update regularly**: Keep the app updated to receive security fixes

## Security Best Practices Followed

- **No secret logging**: PINs, hashes, and sensitive data are never logged
- **Input validation**: All user input is validated and sanitized
- **Error handling**: Errors are caught and logged without exposing sensitive information
- **Least privilege**: Components only have access to the data they need
- **Timing-safe comparison**: PIN verification uses constant-time comparison
- **Random salt generation**: Salts are generated using cryptographically secure random number generation

## Known Limitations

1. **PIN brute-force**: The PIN is vulnerable to offline brute-force if the database or backup file is extracted
2. **No device binding**: The app does not bind to specific device hardware (e.g., hardware-backed keystore)
3. **No integrity verification**: The app does not verify its own integrity at runtime (no APK signature verification beyond Android's normal checks)
4. **Plain text storage**: All data is stored in plain text on the device

## Reporting Security Issues

If you discover a security vulnerability in SwarSathi, please report it responsibly:

1. Do not create public issues for security vulnerabilities
2. Send details to the project maintainers through a private channel
3. Allow time for the issue to be addressed before public disclosure
4. Include steps to reproduce and the potential impact

## References

- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Android Security Best Practices](https://developer.android.com/topic/security/best-practices)
