# Android Release Instructions

This document describes how to build and release SwarSathi for Android.

## Prerequisites

- Node.js 20+
- npm or bun (project uses bun.lock)
- Expo CLI
- EAS CLI (for cloud builds)
- JDK 17 (for local Android builds)
- Android SDK with ANDROID_HOME set (for local builds)
- Expo account with EAS configured

## Configuration

### App Identity

- **App Name**: SwarSathi
- **Package**: org.swarsathi.app
- **Version**: 1.0.0
- **Build Number**: Auto-incremented by EAS
- **Owner**: binarybodhi

### Android Settings

From `app.json`:
- Minimum SDK: Implicitly set by Expo SDK 58 (typically Android 5.0+, API 21+)
- Target SDK: Set by Expo SDK 58 (typically Android 13+, API 33+)
- Orientation: Portrait only
- Adaptive Icon: Configured with foreground, background, and monochrome variants

### Permissions

The app requests no additional Android permissions beyond what Expo automatically includes:

- **Custom modules**: The two native TTS modules (`swar-tts`, `swar-neural-tts`) declare no permissions
- **TTS query**: `swar-tts` uses `<queries>` for `android.intent.action.TTS_SERVICE` (Android 11+ requirement)
- **Internet**: Not requested by the app itself; only used for optional neural voice model downloads via Expo's networking layer
- **Storage**: Uses Expo's file system APIs with app-scoped storage (no explicit permission needed for app's own directory)

## Building for Android

### Development Build (APK)

For testing on physical devices:

```bash
# Local build (requires JDK 17 + Android SDK)
npx expo run:android

# Or cloud build (no local toolchain needed)
npx eas-cli@latest build --profile development --platform android
```

The development build includes:
- Custom native modules (swar-tts, swar-neural-tts)
- Debug symbols
- DevTools connection
- Not signed for release

### Preview Build (APK)

For internal testing without DevTools:

```bash
npx eas-cli@latest build --profile preview --platform android
```

### Production Build (AAB)

For Google Play Store submission:

```bash
npx eas-cli@latest build --profile production --platform android
```

The production build:
- Auto-increments version code
- Optimized and minified
- Signed with your configured credentials
- Ready for Play Store upload

## Signing Configuration

### Development Builds

Development builds use Expo's default signing certificates. These are suitable for testing but not for release.

### Production Builds

Production builds require proper signing. Configure via EAS:

1. Set up signing credentials in EAS dashboard:
   - Upload keystore or let EAS generate one
   - Store keystore password, key alias, and key password
   - Enable automatic signing

2. Or configure locally in `eas.json` (not recommended for security):
   ```json
   {
     "build": {
       "production": {
         "android": {
           "keystore": "./path/to/keystore.jks",
           "keystorePassword": "YOUR_PASSWORD",
           "keyAlias": "YOUR_KEY_ALIAS",
           "keyPassword": "YOUR_KEY_PASSWORD"
         }
       }
     }
   }
   ```

**Important**: Never commit signing credentials to the repository.

## Release Checklist

Before releasing:

- [ ] Update version in `app.json` if not using auto-increment
- [ ] Update CHANGELOG.md with release notes
- [ ] Run full test suite: `npm test`
- [ ] Run typecheck: `npm run typecheck`
- [ ] Run lint: `npm run lint`
- [ ] Complete manual QA checklist (MANUAL_QA_CHECKLIST.md)
- [ ] Verify all known limitations are documented
- [ ] Test production build on at least one physical device
- [ ] Verify offline first-launch behavior
- [ ] Verify backup/restore works in production build
- [ ] Verify neural voice model download works (if applicable)

## Post-Release

After release:

- [ ] Tag the release in git: `git tag -a v1.0.0 -m "Release v1.0.0"`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Update GitHub releases with release notes
- [ ] Monitor crash reports (if crash reporting is added later)
- [ ] Gather user feedback for future improvements

## Troubleshooting

### Build Fails

If a build fails:

1. Check Expo SDK version compatibility
2. Run `npx expo-doctor` to diagnose dependency issues
3. Check EAS build logs for specific errors
4. Ensure native modules are properly linked
5. Verify Android SDK and JDK versions

### Native Module Not Found

If the TTS modules are not found:

1. Ensure you're using a development build, not Expo Go
2. Run `npx expo prebuild --clean` to regenerate native code
3. Check that `modules/` directory is present
4. Verify `package.json` has correct dependencies

### Speech Not Working

If speech doesn't work in production build:

1. Verify Android TTS engine is installed on device
2. Check app has audio focus permissions
3. Test with different TTS engines
4. Check for runtime errors in logcat
5. Verify native module is loaded (check in Settings diagnostics)

## Version Information

- Expo SDK: 58.0.23
- React Native: 0.88.1
- React: 19.3.0
- Target Android: API 33+ (Android 13+)
- Minimum Android: API 21+ (Android 5.0+)

## App Size

Approximate sizes (without voice models):

- Development APK: ~25-30 MB
- Production AAB: ~20-25 MB
- Installed app: ~30-40 MB

Neural voice models add ~63 MB per language when installed.

## Third-Party Licenses

The app includes:

- **expo-sqlite**: Embedded SQLite database
- **sherpa-onnx**: Neural TTS engine (via swar-neural-tts module)
- **Apache Commons Compress**: Archive extraction (via swar-neural-tts module)

Review and attribute third-party licenses in the app's settings or about screen if required by the licences.

## Privacy Considerations

The app:

- Stores all data locally on the device
- Does not transmit user messages or settings
- Does not include analytics or tracking
- Does not require accounts or cloud services
- Exports backups as plain JSON (user's responsibility to secure)

See SECURITY.md for detailed security and privacy information.
