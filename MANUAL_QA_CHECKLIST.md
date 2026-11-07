# Manual QA Checklist for Android Release

This checklist must be completed on a physical Android device before releasing SwarSathi v1.0.0. Unit tests and automated checks cannot verify these user-facing behaviors.

## Prerequisites

- [ ] Physical Android device (not emulator) with Android 6.0+ (API 23+)
- [ ] Development build installed (not Expo Go)
- [ ] Android TTS engine installed (Google Speech Services or vendor engine)
- [ ] Internet connection available (for optional neural voice download testing)
- [ ] At least 100 MB free storage for neural voice model testing

## Part 1: Core Speech Functionality

### Basic Speech
- [ ] Launch app - reaches "Ready" status
- [ ] Type "Hello world" and press Speak - hears it spoken
- [ ] Press Speak twice quickly - first utterance is cut off, no overlap
- [ ] Press Stop mid-sentence - speech stops immediately
- [ ] Type empty message and press Speak - shows error "There is nothing to speak yet"

### Settings Persistence
- [ ] Change speech rate to 0.5x - next utterance is slower
- [ ] Change speech rate to 2.0x - next utterance is faster
- [ ] Change pitch to 0.5 - next utterance is lower
- [ ] Change pitch to 2.0 - next utterance is higher
- [ ] Reboot app - settings persist

### Language and Voice
- [ ] Select each language in Settings - app reports capability honestly
- [ ] Test a language marked "Ready offline" - works in airplane mode
- [ ] Test a language marked "Online only" - fails in airplane mode
- [ ] Test a language marked "Voice not installed" - shows installation instructions
- [ ] Select specific voice - that voice is used for speech
- [ ] Change language - voiceId drops if it doesn't belong to new language

### Edge Cases
- [ ] Switch between Android TTS and Neural TTS engines
- [ ] Speak while engine is still initializing - shows "engine still starting up" error
- [ ] Force-stop app during speech - app cleans up on restart
- [ ] Incoming phone call during speech - speech stops (test with real call or simulation)

## Part 2: Communication Features

### Quick Phrases
- [ ] Open Quick Phrases - all 8 categories visible
- [ ] Tap phrase in each category - speaks in correct language
- [ ] Long-press phrase - appears in Favourites
- [ ] Switch language - phrase list updates to new language
- [ ] Speak phrase - uses displayed language, not previous language

### Favourites
- [ ] Open Favourites - pinned phrases shown
- [ ] Tap favourite - speaks immediately
- [ ] Use Move up/Down - order changes correctly
- [ ] Delete favourite - removed from list
- [ ] Reboot app - order persists

### Saved Messages
- [ ] Create message with title, text, category - saves successfully
- [ ] Try empty message - refused with explanation
- [ ] Try duplicate message - refused with explanation
- [ ] Edit message - changes persist
- [ ] Delete message - confirmation prompt shown
- [ ] Favourite custom message - appears in Favourites
- [ ] Delete custom message - removed from Favourites

## Part 3: Neural Voice Models

### Model Download
- [ ] Open Settings > Voices
- [ ] Select available neural model - download starts
- [ ] Cancel download - stops and cleans up
- [ ] Download to completion - model marked as installed
- [ ] Low storage condition - shows appropriate error
- [ ] Airplane mode during download - fails gracefully

### Neural Speech
- [ ] Switch to Neural TTS engine - speech works
- [ ] Speak long message - completes without interruption
- [ ] Press Stop during neural speech - stops immediately
- [ ] Background app during neural speech - speech stops
- [ ] Switch back to Android TTS - works normally

### Model Management
- [ ] Remove installed model - removed from list
- [ ] Download corrupted archive - verification fails
- [ ] Reboot after model install - model still marked installed

## Part 4: Rapid Communication

### Home Cards
- [ ] Home screen shows communication cards
- [ ] Tap card - speaks immediately in active language
- [ ] Enable/disable cards in Settings - Home screen updates
- [ ] Reorder cards - order updates on Home
- [ ] Reset cards - returns to default layout

### Communication History
- [ ] Speak message - appears in history
- [ ] Tap history entry - speaks again
- [ ] Clear history - list empties
- [ ] Change history limit - list respects new limit
- [ ] Reboot app - history persists

### Frequent Messages
- [ ] Speak same message 3 times - appears in frequent list
- [ ] Tap frequent message - speaks again
- [ ] Clear history - frequent list also clears

### Emergency Messages
- [ ] Emergency section visible on Home
- [ ] Tap emergency button - speaks immediately
- [ ] Edit emergency wording - new wording used
- [ ] Reset emergency wording - returns to bundled default
- [ ] Switch language - emergency updates to new language

### Simplified Mode
- [ ] Enable Simplified Mode - only cards and Emergency shown
- [ ] Tap Exit Simplified Mode - returns to full screen
- [ ] Reboot app - Simplified Mode persists

## Part 5: Personalisation

### Profiles
- [ ] Open Profiles - default profile shown
- [ ] Create new profile - appears in list
- [ ] Rename profile - name updates
- [ ] Switch profile - settings, favourites, Home layout change
- [ ] Delete non-default profile - removed from list
- [ ] Try to delete default profile - not allowed
- [ ] Reboot app - active profile persists

### Profile Scoping
- [ ] Create profile A, add favourite - favourite only in profile A
- [ ] Switch to profile B - favourite not visible
- [ ] Add Home card to profile A - only in profile A
- [ ] Edit emergency in profile A - only affects profile A
- [ ] Switch back to profile A - all customizations preserved

### Communication Boards
- [ ] Open Boards - default boards shown
- [ ] Create new board - appears in list
- [ ] Add card with library phrase - speaks correctly
- [ ] Add card with custom text - speaks custom text
- [ ] Edit card - changes persist
- [ ] Reorder cards - order updates
- [ ] Delete card - removed from board
- [ ] Duplicate board - copy created successfully
- [ ] Delete board - removed from list
- [ ] Favourite board card - appears in Favourites

### Caregiver PIN
- [ ] Enable caregiver lock - set 4-digit PIN
- [ ] Try to open configuration screen - PIN prompt shown
- [ ] Enter wrong PIN - denied
- [ ] Enter correct PIN - screen opens
- [ ] Lock caregiver - screens locked again
- [ ] Disable caregiver - PIN removed
- [ ] Set 8-digit PIN - works correctly
- [ ] Try weak PIN (less than 4 digits) - refused

### Backup and Restore
- [ ] Export backup - file created and shared
- [ ] Import backup with Merge mode - data merged
- [ ] Import backup with Replace mode - data replaced
- [ ] Import damaged file - validation fails
- [ ] Import file from newer version - validation fails
- [ ] Restore with existing PIN - PIN preserved (merge mode)
- [ ] Restore after PIN change - new PIN applies (replace mode)
- [ ] Restore after profile deletion - profiles restored correctly

## Accessibility

### TalkBack
- [ ] Enable TalkBack - every control announced correctly
- [ ] Navigate Home screen - logical order, all labels present
- [ ] Speak state announced - "Speaking" when speech starts
- [ ] Error state announced - error message read aloud
- [ ] Settings screen - all controls reachable and labeled
- [ ] Profiles screen - profile names and actions announced
- [ ] Boards screen - board names and actions announced
- [ ] Board editor - card labels and actions announced
- [ ] Emergency screen - emergency buttons announced
- [ ] Backup screen - import/export actions announced

### Switch Access
- [ ] Enable Switch Access - can navigate all screens
- [ ] Can select Speak button
- [ ] Can select Stop button
- [ ] Can navigate through phrase lists
- [ ] Can access all settings controls
- [ ] Can operate profile switching
- [ ] Can operate board editing

### Touch Targets
- [ ] All interactive elements at least 48dp
- [ ] Buttons have sufficient spacing
- [ ] No overlapping touch targets
- [ ] Controls usable with reduced dexterity

### Font Scaling
- [ ] Set system font to largest - nothing clipped or overlapping
- [ ] Set system font to smallest - everything readable
- [ ] Adjust font scale in Settings - UI respects setting
- [ ] Long text wraps correctly at all scales

### High Contrast
- [ ] Enable high contrast mode - colors change appropriately
- [ ] Borders thickened for visibility
- [ ] Text remains readable
- [ ] All states (pressed, focused, disabled) visible beyond color

### Focus Visibility
- [ ] Enable TalkBack - focus rings visible
- [ ] Tab through controls - focus moves logically
- [ ] Two-button navigation works
- [ ] Focused state clearly indicated

## Data Integrity

### Database Upgrade
- [ ] Install from Part 1 build - data survives Part 5 upgrade
- [ ] Existing saved messages persist
- [ ] Existing favourites persist
- [ ] Settings migrate to default profile
- [ ] No data loss during migration

### Profile Switching
- [ ] Make changes in profile A
- [ ] Switch to profile B - profile A changes not visible
- [ ] Switch back to profile A - changes preserved
- [ ] No state leakage between profiles

### Backup/Restore Edge Cases
- [ ] Export backup, delete app, reinstall, import - all data restored
- [ ] Import with missing profile in backup - handled gracefully
- [ ] Import with corrupted favourite - skipped without breaking restore
- [ ] Interrupted import - partial changes rolled back

### Storage Failure
- [ ] **Critical**: App should warn user when falling back to in-memory storage
- [ ] **Note**: Currently no warning - documented as known limitation

## Performance

### Launch Time
- [ ] Cold launch - app opens within 3 seconds
- [ ] Warm launch - app opens within 1 second
- [ ] Engine initialization - completes quickly

### Speech Latency
- [ ] Android TTS - speech starts within 500ms of button press
- [ ] Neural TTS - speech starts within 1 second for short messages
- [ ] Long messages - no undue delays

### Memory Usage
- [ ] Extended use - no memory leaks
- [ ] Switch profiles repeatedly - memory stable
- [ ] Open/close many screens - memory stable

## Release-Specific Checks

### Android Configuration
- [ ] App name "SwarSathi" displayed correctly
- [ ] App icon displayed correctly
- [ ] Version number matches CHANGELOG
- [ ] Package name org.swarsathi.app
- [ ] Target SDK and min SDK appropriate
- [ ] Permissions declared correctly in manifest
- [ ] ProGuard/R8 configuration (if applicable)

### Build Verification
- [ ] Development build runs on device
- [ ] Release build (if environment supports) runs on device
- [ ] APK/AAB size reasonable (< 50 MB without voice models)
- [ ] No unnecessary dependencies included

### Offline First Launch
- [ ] Install app, put device in airplane mode, launch - app functions
- [ ] Can type and speak with Android TTS
- [ ] Can navigate all screens
- [ ] Settings accessible
- [ ] Can create profiles and boards

## Final Sign-Off

- [ ] All critical tests passed
- [ ] All major tests passed
- [ ] Known limitations documented
- [ ] Release blockers identified (if any)
- [ ] Manual QA complete

**Tester Name**: ___________________________
**Date**: ___________________________
**Device Model**: ___________________________
**Android Version**: ___________________________
**Build Version**: ___________________________
