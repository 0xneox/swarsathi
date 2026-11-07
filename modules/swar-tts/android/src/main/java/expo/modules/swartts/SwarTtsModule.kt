package expo.modules.swartts

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale
import java.util.UUID

/**
 * Event names emitted to JavaScript. They must also be declared through `Events(...)` so that the
 * JS side can subscribe with `addListener`.
 */
private const val EVENT_START = "onSpeechStart"
private const val EVENT_DONE = "onSpeechDone"
private const val EVENT_STOPPED = "onSpeechStopped"
private const val EVENT_ERROR = "onSpeechError"

/** The Android speech engine could not be created (no TTS engine installed / disabled). */
class SwarTtsUnavailableException(message: String) :
  CodedException("ERR_SWAR_TTS_UNAVAILABLE", message, null)

/** A speech request was made before `initialize()` resolved. */
class SwarTtsNotInitializedException :
  CodedException(
    "ERR_SWAR_TTS_NOT_INITIALIZED",
    "The speech engine has not finished initialising. Call initialize() and wait for it to resolve.",
    null
  )

/** The installed engine has no data for the requested language. We never substitute another language. */
class SwarTtsLanguageUnavailableException(languageTag: String) :
  CodedException(
    "ERR_SWAR_TTS_LANGUAGE_UNAVAILABLE",
    "No installed voice supports the language \"$languageTag\". " +
      "Install the voice data from Android Settings > Accessibility > Text-to-speech.",
    null
  )

/** A specific voice id was requested but that voice is not present on this device. */
class SwarTtsVoiceUnavailableException(message: String) :
  CodedException("ERR_SWAR_TTS_VOICE_UNAVAILABLE", message, null)

/** The message was empty or otherwise not speakable. */
class SwarTtsInvalidRequestException(message: String) :
  CodedException("ERR_SWAR_TTS_INVALID_REQUEST", message, null)

/** The engine accepted the request but reported a failure. */
class SwarTtsSpeakFailedException(message: String) :
  CodedException("ERR_SWAR_TTS_SPEAK_FAILED", message, null)

/**
 * Native Android TextToSpeech bridge.
 *
 * Design notes:
 * - `android.speech.tts.TextToSpeech` is only safe to drive from the main thread, so every call is
 *   marshalled through [mainHandler]. The JS-facing functions themselves are asynchronous.
 * - Initialisation is a one-shot, awaited operation. Concurrent `initialize()` calls are queued and
 *   all resolved (or all rejected) together, so JS can never observe a half-initialised engine.
 * - Language resolution never falls back silently: if the requested language is not installed the
 *   request fails with [SwarTtsLanguageUnavailableException].
 */
class SwarTtsModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val pendingInitialisations = mutableListOf<Promise>()

  private var engine: TextToSpeech? = null
  private var engineReady = false
  private var initialisationFailure: String? = null
  private var permanentlyReleased = false
  private var activeUtteranceId: String? = null
  /** File synthesis in flight: utteranceId, output path, and the promise to settle on completion. */
  private var pendingSynthesis: Triple<String, String, Promise>? = null

  override fun definition() = ModuleDefinition {
    Name("SwarTts")

    Events(EVENT_START, EVENT_DONE, EVENT_STOPPED, EVENT_ERROR)

    AsyncFunction("initialize") { promise: Promise ->
      initializeEngine(promise)
    }

    AsyncFunction("isReady") {
      engineReady
    }

    AsyncFunction("getVoices") {
      collectVoices()
    }

    AsyncFunction("isLanguageAvailable") { languageTag: String ->
      val current = engine
      if (current == null || !engineReady || languageTag.isBlank()) {
        false
      } else {
        try {
          current.isLanguageAvailable(Locale.forLanguageTag(languageTag)) >= TextToSpeech.LANG_AVAILABLE
        } catch (ignored: Exception) {
          false
        }
      }
    }

    AsyncFunction("getDefaultLanguageTag") {
      Locale.getDefault().toLanguageTag()
    }

    AsyncFunction("speak") { text: String, options: Map<String, Any?>, promise: Promise ->
      speakInternal(text, options, promise)
    }

    AsyncFunction("synthesizeToFile") { text: String, options: Map<String, Any?>, fileName: String, promise: Promise ->
      synthesizeToFileInternal(text, options, fileName, promise)
    }

    AsyncFunction("stop") {
      stopInternal()
    }

    AsyncFunction("release") {
      releaseEngine(permanent = false)
    }

    OnDestroy {
      releaseEngine(permanent = true)
    }
  }

  // region Initialisation

  private fun initializeEngine(promise: Promise) {
    if (permanentlyReleased) {
      promise.reject(SwarTtsUnavailableException("The speech engine was released and cannot be reused."))
      return
    }
    if (engineReady) {
      promise.resolve(null)
      return
    }
    initialisationFailure?.let { failure ->
      promise.reject(SwarTtsUnavailableException(failure))
      return
    }

    pendingInitialisations.add(promise)

    // Only the first caller creates the engine; the rest simply wait on the shared callback.
    if (engine != null) {
      return
    }

    mainHandler.post {
      if (engine != null) {
        return@post
      }
      val context = appContext.reactContext
      if (context == null) {
        failInitialisation("The Android application context is not available.")
        return@post
      }
      engine = try {
        TextToSpeech(context.applicationContext) { status -> handleInitStatus(status) }
      } catch (exception: Exception) {
        failInitialisation(
          "Android TextToSpeech could not be created: ${exception.localizedMessage ?: exception.javaClass.simpleName}"
        )
        null
      }
    }
  }

  private fun handleInitStatus(status: Int) {
    mainHandler.post {
      if (permanentlyReleased) {
        return@post
      }
      if (status != TextToSpeech.SUCCESS) {
        failInitialisation(
          "Android TextToSpeech failed to initialise (status=$status). " +
            "Install or enable a text-to-speech engine in Android Settings."
        )
        return@post
      }

      val current = engine
      if (current == null) {
        failInitialisation("The speech engine disappeared during initialisation.")
        return@post
      }

      current.setOnUtteranceProgressListener(progressListener)
      engineReady = true
      initialisationFailure = null

      val waiting = pendingInitialisations.toList()
      pendingInitialisations.clear()
      waiting.forEach { it.resolve(null) }
    }
  }

  private fun failInitialisation(message: String) {
    initialisationFailure = message
    drainPending { promise -> promise.reject(SwarTtsUnavailableException(message)) }
    mainHandler.post {
      try {
        engine?.shutdown()
      } catch (ignored: Exception) {
        // Nothing useful to do if shutdown fails on a broken engine.
      }
      engine = null
      engineReady = false
    }
  }

  private fun drainPending(action: (Promise) -> Unit) {
    val waiting = pendingInitialisations.toList()
    pendingInitialisations.clear()
    waiting.forEach(action)
  }

  // endregion

  // region Speaking

  private fun speakInternal(text: String, options: Map<String, Any?>, promise: Promise) {
    val message = text.trim()
    if (message.isEmpty()) {
      promise.reject(SwarTtsInvalidRequestException("There is nothing to speak: the message is empty."))
      return
    }

    mainHandler.post {
      val current = engine
      if (current == null || !engineReady) {
        promise.reject(SwarTtsNotInitializedException())
        return@post
      }

      val rate = ((options["rate"] as? Number)?.toFloat() ?: 1.0f).coerceIn(0.1f, 3.0f)
      val pitch = ((options["pitch"] as? Number)?.toFloat() ?: 1.0f).coerceIn(0.1f, 3.0f)
      val languageTag = (options["language"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
      val voiceId = (options["voiceId"] as? String)?.trim()?.takeIf { it.isNotEmpty() }

      val selection = resolveSelection(current, languageTag, voiceId)
      selection.error?.let { error ->
        promise.reject(error)
        return@post
      }

      current.setSpeechRate(rate)
      current.setPitch(pitch)

      val voice = selection.voice
      if (voice != null) {
        current.setVoice(voice)
      } else if (languageTag != null) {
        current.setLanguage(Locale.forLanguageTag(languageTag))
      }

      val utteranceId = UUID.randomUUID().toString()
      activeUtteranceId = utteranceId

      // QUEUE_FLUSH guarantees the previous utterance is cancelled: speech never overlaps.
      val result = current.speak(message, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
      if (result == TextToSpeech.ERROR) {
        activeUtteranceId = null
        promise.reject(
          SwarTtsSpeakFailedException("The installed speech engine rejected the request to speak.")
        )
      } else {
        promise.resolve(utteranceId)
      }
    }
  }

  /**
   * Renders an utterance to an audio file in the app's cache directory instead of playing it.
   * Used by Connect's "share as audio": the file is handed to the system share sheet.
   */
  private fun synthesizeToFileInternal(
    text: String,
    options: Map<String, Any?>,
    fileName: String,
    promise: Promise
  ) {
    val message = text.trim()
    if (message.isEmpty()) {
      promise.reject(SwarTtsInvalidRequestException("There is nothing to speak: the message is empty."))
      return
    }
    val safeName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "speech.wav" }

    mainHandler.post {
      val current = engine
      if (current == null || !engineReady) {
        promise.reject(SwarTtsNotInitializedException())
        return@post
      }
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(SwarTtsUnavailableException("The Android application context is not available."))
        return@post
      }

      val rate = ((options["rate"] as? Number)?.toFloat() ?: 1.0f).coerceIn(0.1f, 3.0f)
      val pitch = ((options["pitch"] as? Number)?.toFloat() ?: 1.0f).coerceIn(0.1f, 3.0f)
      val languageTag = (options["language"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
      val voiceId = (options["voiceId"] as? String)?.trim()?.takeIf { it.isNotEmpty() }

      val selection = resolveSelection(current, languageTag, voiceId)
      selection.error?.let { error ->
        promise.reject(error)
        return@post
      }

      current.setSpeechRate(rate)
      current.setPitch(pitch)
      val voice = selection.voice
      if (voice != null) {
        current.setVoice(voice)
      } else if (languageTag != null) {
        current.setLanguage(Locale.forLanguageTag(languageTag))
      }

      val file = java.io.File(context.cacheDir, safeName)
      if (file.exists()) {
        file.delete()
      }
      val utteranceId = UUID.randomUUID().toString()
      val result = current.synthesizeToFile(message, Bundle(), file, utteranceId)
      if (result == TextToSpeech.SUCCESS) {
        // Synthesis is asynchronous: the file is only complete when the utterance's progress
        // callback fires. Hold the promise until then — resolving early would hand JavaScript a
        // path to a file that does not exist yet.
        pendingSynthesis = Triple(utteranceId, "file://${file.absolutePath}", promise)
      } else {
        promise.reject(
          SwarTtsSpeakFailedException("The installed speech engine could not create the audio file.")
        )
      }
    }
  }

  private fun stopInternal() {
    mainHandler.post {
      activeUtteranceId = null
      try {
        engine?.stop()
      } catch (ignored: Exception) {
        // Stopping an engine that is already idle is a no-op for callers.
      }
    }
  }

  private fun releaseEngine(permanent: Boolean) {
    if (permanent) {
      permanentlyReleased = true
    }
    drainPending { promise ->
      promise.reject(SwarTtsUnavailableException("The speech engine was released."))
    }
    mainHandler.post {
      try {
        engine?.stop()
        engine?.shutdown()
      } catch (ignored: Exception) {
        // Best effort cleanup.
      }
      engine = null
      engineReady = false
      activeUtteranceId = null
      pendingSynthesis?.third?.reject(
        SwarTtsUnavailableException("The speech engine was released before the audio file finished.")
      )
      pendingSynthesis = null
      if (!permanent) {
        initialisationFailure = null
      }
    }
  }

  // endregion

  // region Capability discovery

  /**
   * Flattens the engine's voice catalogue. Each entry describes one installable voice so that
   * JavaScript can tell the difference between "the engine knows this language",
   * "a voice exists on the device" and "that voice works without a network connection".
   */
  private fun collectVoices(): List<Map<String, Any?>> {
    if (!engineReady) {
      return emptyList()
    }
    val voices = try {
      engine?.voices?.toList()
    } catch (ignored: Exception) {
      null
    } ?: return emptyList()

    return voices.map { voice ->
      val features = voice.features ?: emptySet()
      mapOf(
        "id" to voice.name,
        "name" to voice.name,
        "language" to voice.locale.toLanguageTag(),
        "quality" to voice.quality,
        "latency" to voice.latency,
        "networkRequired" to voice.isNetworkConnectionRequired,
        "notInstalled" to features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
      )
    }
  }

  private class Selection(
    val languageTag: String?,
    val voice: Voice?,
    val error: CodedException?
  )

  /**
   * Never substitutes a different language. Given a requested language tag we either return a voice
   * that genuinely matches it, or an error explaining what is missing.
   */
  private fun resolveSelection(
    engine: TextToSpeech,
    languageTag: String?,
    voiceId: String?
  ): Selection {
    val availableVoices = try {
      engine.voices?.toList().orEmpty()
    } catch (ignored: Exception) {
      emptyList()
    }

    if (voiceId != null) {
      val requested = availableVoices.firstOrNull { it.name == voiceId }
        ?: return Selection(
          null,
          null,
          SwarTtsVoiceUnavailableException("The voice \"$voiceId\" is not available on this device.")
        )
      if (languageTag != null && !matchesLanguage(requested.locale, languageTag)) {
        return Selection(
          null,
          null,
          SwarTtsVoiceUnavailableException(
            "The voice \"$voiceId\" does not speak \"$languageTag\" on this device."
          )
        )
      }
      return Selection(requested.locale.toLanguageTag(), requested, null)
    }

    if (languageTag == null) {
      // No language requested: keep whatever the engine currently has configured.
      return Selection(null, null, null)
    }

    val locale = Locale.forLanguageTag(languageTag)
    val availability = try {
      engine.isLanguageAvailable(locale)
    } catch (ignored: Exception) {
      TextToSpeech.LANG_NOT_SUPPORTED
    }

    if (availability == TextToSpeech.LANG_MISSING_DATA || availability == TextToSpeech.LANG_NOT_SUPPORTED) {
      return Selection(null, null, SwarTtsLanguageUnavailableException(languageTag))
    }

    // Prefer a voice that works offline, then the highest quality one.
    val bestVoice = availableVoices
      .filter { matchesLanguage(it.locale, languageTag) }
      .sortedWith(
        compareBy<Voice> { if (it.isNetworkConnectionRequired) 1 else 0 }
          .thenByDescending { it.quality }
      )
      .firstOrNull()

    return Selection(languageTag, bestVoice, null)
  }

  private fun matchesLanguage(locale: Locale, languageTag: String): Boolean {
    val target = Locale.forLanguageTag(languageTag)
    if (!locale.language.equals(target.language, ignoreCase = true)) {
      return false
    }
    val targetCountry = target.country
    return targetCountry.isEmpty() || locale.country.equals(targetCountry, ignoreCase = true)
  }

  // endregion

  private val progressListener = object : UtteranceProgressListener() {
    override fun onStart(utteranceId: String?) {
      emit(EVENT_START, utteranceId)
    }

    override fun onDone(utteranceId: String?) {
      if (activeUtteranceId == utteranceId) {
        activeUtteranceId = null
      }
      settleSynthesis(utteranceId) { path, promise -> promise.resolve(path) }
      emit(EVENT_DONE, utteranceId)
    }

    @Deprecated("Kept for engines that only report the legacy error callback.")
    override fun onError(utteranceId: String?) {
      if (activeUtteranceId == utteranceId) {
        activeUtteranceId = null
      }
      settleSynthesis(utteranceId) { _, promise ->
        promise.reject(
          SwarTtsSpeakFailedException("The speech engine failed while creating the audio file.")
        )
      }
      emit(EVENT_ERROR, utteranceId, errorCode = -1)
    }

    override fun onError(utteranceId: String?, errorCode: Int) {
      if (activeUtteranceId == utteranceId) {
        activeUtteranceId = null
      }
      settleSynthesis(utteranceId) { _, promise ->
        promise.reject(
          SwarTtsSpeakFailedException("The speech engine failed while creating the audio file (code $errorCode).")
        )
      }
      emit(EVENT_ERROR, utteranceId, errorCode = errorCode)
    }

    override fun onStop(utteranceId: String?, interrupted: Boolean) {
      if (activeUtteranceId == utteranceId) {
        activeUtteranceId = null
      }
      if (interrupted) {
        settleSynthesis(utteranceId) { _, promise ->
          promise.reject(
            SwarTtsSpeakFailedException("Audio creation was interrupted before the file was finished.")
          )
        }
      } else {
        settleSynthesis(utteranceId) { path, promise -> promise.resolve(path) }
      }
      val payload = basePayload(utteranceId)
      payload.putBoolean("interrupted", interrupted)
      sendEvent(EVENT_STOPPED, payload)
    }
  }

  /** Resolves or rejects the in-flight file synthesis when its utterance reaches a terminal state. */
  private fun settleSynthesis(
    utteranceId: String?,
    settle: (path: String, promise: Promise) -> Unit
  ) {
    val pending = pendingSynthesis ?: return
    if (utteranceId == null || utteranceId != pending.first) {
      return
    }
    pendingSynthesis = null
    settle(pending.second, pending.third)
  }

  private fun basePayload(utteranceId: String?): Bundle {
    val payload = Bundle()
    payload.putString("utteranceId", utteranceId ?: "")
    return payload
  }

  private fun emit(eventName: String, utteranceId: String?, errorCode: Int? = null) {
    val payload = basePayload(utteranceId)
    if (errorCode != null) {
      payload.putInt("errorCode", errorCode)
    }
    sendEvent(eventName, payload)
  }
}
