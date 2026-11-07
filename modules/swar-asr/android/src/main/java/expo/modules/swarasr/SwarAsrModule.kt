package expo.modules.swarasr

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale

/** Event names emitted to JavaScript. They must also be declared through `Events(...)`. */
private const val EVENT_PARTIAL = "onRecognitionPartial"
private const val EVENT_FINAL = "onRecognitionFinal"
private const val EVENT_END = "onRecognitionEnd"
private const val EVENT_ERROR = "onRecognitionError"

/** The device has no recogniser, or none that works without the network. */
class SwarAsrUnavailableException(message: String) :
  CodedException("ERR_SWAR_ASR_UNAVAILABLE", message, null)

/** The recogniser failed to start for a reason we cannot classify. */
class SwarAsrStartFailedException(message: String) :
  CodedException("ERR_SWAR_ASR_START_FAILED", message, null)

/**
 * Native Android on-device dictation bridge.
 *
 * Design notes:
 * - Recognition is **on-device only**. This module uses `createOnDeviceSpeechRecognizer` (Android 12+)
 *   so audio never leaves the phone. If the device cannot do that, `isAvailable()` is false and the
 *   JavaScript layer hides dictation entirely. There is no network path to fall back to, by design.
 * - `SpeechRecognizer` must be created, driven and destroyed on the main thread, so every call is
 *   marshalled through [mainHandler].
 * - Interim results are forwarded as they arrive and a final result closes the session. Stop and
 *   cancel are always safe to call, including when nothing is listening.
 */
class SwarAsrModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null
  private var listening = false

  override fun definition() = ModuleDefinition {
    Name("SwarAsr")

    Events(EVENT_PARTIAL, EVENT_FINAL, EVENT_END, EVENT_ERROR)

    AsyncFunction("isAvailable") {
      recognitionAvailable() && onDeviceAvailable()
    }

    AsyncFunction("isOnDeviceAvailable") {
      onDeviceAvailable()
    }

    AsyncFunction("isLanguageOnDevice") { languageTag: String, promise: Promise ->
      queryLanguageSupport(languageTag, promise)
    }

    AsyncFunction("startListening") { options: Map<String, Any?>, promise: Promise ->
      startListeningInternal(options, promise)
    }

    AsyncFunction("stopListening") {
      stopInternal(cancel = false)
    }

    AsyncFunction("cancelListening") {
      stopInternal(cancel = true)
    }

    AsyncFunction("destroy") {
      destroyRecognizer()
    }

    OnDestroy {
      destroyRecognizer()
    }
  }

  // region Capability discovery

  private fun appContextOrNull(): Context? = appContext.reactContext?.applicationContext

  private fun recognitionAvailable(): Boolean {
    val context = appContextOrNull() ?: return false
    return try {
      SpeechRecognizer.isRecognitionAvailable(context)
    } catch (ignored: Exception) {
      false
    }
  }

  private fun onDeviceAvailable(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      // On-device recognition arrived with Android 12. Older phones only offer the network service,
      // which SwarSathi refuses to use.
      return false
    }
    val context = appContextOrNull() ?: return false
    return try {
      SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
    } catch (ignored: Exception) {
      false
    }
  }

  /**
   * Answers "can this phone recognise this language without the network?".
   *
   * Android 13 added `checkRecognitionSupport`, the only API that exposes the on-device language
   * lists. On Android 12 the answer is genuinely unknown, so `null` is returned rather than a
   * fabricated yes.
   */
  private fun queryLanguageSupport(languageTag: String, promise: Promise) {
    if (!onDeviceAvailable()) {
      promise.resolve(false)
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || languageTag.isBlank()) {
      promise.resolve(null)
      return
    }
    val context = appContextOrNull()
    if (context == null) {
      promise.resolve(null)
      return
    }

    val intent = buildIntent(languageTag)
    mainHandler.post {
      // checkRecognitionSupport is an instance method on SpeechRecognizer (API 33+). A throwaway
      // recogniser is created for the query and destroyed immediately after.
      val probe = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
      try {
        probe.checkRecognitionSupport(
          intent,
          java.util.concurrent.Executor { command -> mainHandler.post(command) },
          object : RecognitionSupportCallback {
            override fun onSupportResult(support: RecognitionSupport) {
              val languages =
                support.installedOnDeviceLanguages + support.supportedOnDeviceLanguages
              promise.resolve(languages.any { matchesLanguage(it, languageTag) })
              probe.destroy()
            }

            override fun onError(error: Int) {
              probe.destroy()
              promise.resolve(null)
            }
          }
        )
      } catch (ignored: Exception) {
        probe.destroy()
        promise.resolve(null)
      }
    }
  }

  // endregion

  // region Listening

  private fun startListeningInternal(options: Map<String, Any?>, promise: Promise) {
    val context = appContextOrNull()
    if (context == null) {
      promise.reject(SwarAsrUnavailableException("The Android application context is not available."))
      return
    }
    if (!onDeviceAvailable()) {
      promise.reject(
        SwarAsrUnavailableException(
          "This phone cannot recognise speech without internet. SwarSathi never sends your voice to a server."
        )
      )
      return
    }

    val languageTag = (options["language"] as? String)?.trim().orEmpty()
    val silenceMs = (options["silenceMs"] as? Number)?.toLong()
    val hintPhrases = (options["hintPhrases"] as? List<*>)?.filterIsInstance<String>().orEmpty()

    mainHandler.post {
      destroyRecognizerNow()

      val created = try {
        SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
      } catch (ignored: Exception) {
        null
      }
      if (created == null) {
        promise.reject(
          SwarAsrUnavailableException("The on-device speech recogniser could not be started.")
        )
        return@post
      }

      recognizer = created
      created.setRecognitionListener(listener)

      val intent = buildIntent(languageTag).apply {
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        if (silenceMs != null && silenceMs > 0) {
          putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, silenceMs)
          putExtra(
            RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,
            silenceMs
          )
        }
        if (hintPhrases.isNotEmpty()) {
          putStringArrayListExtra(RecognizerIntent.EXTRA_BIASING_STRINGS, ArrayList(hintPhrases))
        }
      }

      try {
        created.startListening(intent)
        listening = true
        promise.resolve(null)
      } catch (exception: Exception) {
        listening = false
        promise.reject(
          SwarAsrStartFailedException(
            "Could not start listening: ${exception.localizedMessage ?: exception.javaClass.simpleName}"
          )
        )
      }
    }
  }

  private fun stopInternal(cancel: Boolean) {
    mainHandler.post {
      val current = recognizer ?: return@post
      listening = false
      try {
        if (cancel && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          current.cancel()
        } else {
          current.stopListening()
        }
      } catch (ignored: Exception) {
        // Stopping a recogniser that is already idle is a no-op for callers.
      }
    }
  }

  private fun destroyRecognizer() {
    mainHandler.post { destroyRecognizerNow() }
  }

  private fun destroyRecognizerNow() {
    listening = false
    val current = recognizer
    recognizer = null
    try {
      current?.destroy()
    } catch (ignored: Exception) {
      // Best-effort cleanup.
    }
  }

  // endregion

  private fun buildIntent(languageTag: String): Intent {
    return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      if (languageTag.isNotEmpty()) {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, languageTag)
      }
      // Belt and braces: the recogniser is already the on-device one, and this asks the platform to
      // prefer offline models even if the implementation consults the network service.
      putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
    }
  }

  private fun matchesLanguage(candidate: String, languageTag: String): Boolean {
    val left = Locale.forLanguageTag(candidate)
    val right = Locale.forLanguageTag(languageTag)
    if (!left.language.equals(right.language, ignoreCase = true)) {
      return false
    }
    return right.country.isEmpty() || left.country.equals(right.country, ignoreCase = true)
  }

  private fun firstResult(bundle: Bundle?): String? {
    val results = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
    return results?.firstOrNull()?.trim()?.takeIf { it.isNotEmpty() }
  }

  private val listener = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) = Unit

    override fun onBeginningOfSpeech() = Unit

    override fun onRmsChanged(rmsdB: Float) = Unit

    override fun onBufferReceived(buffer: ByteArray?) = Unit

    override fun onEndOfSpeech() {
      sendEvent(EVENT_END, Bundle())
    }

    override fun onPartialResults(partialResults: Bundle?) {
      val text = firstResult(partialResults) ?: return
      val payload = Bundle().apply { putString("text", text) }
      sendEvent(EVENT_PARTIAL, payload)
    }

    override fun onResults(results: Bundle?) {
      listening = false
      val payload = Bundle().apply { putString("text", firstResult(results).orEmpty()) }
      sendEvent(EVENT_FINAL, payload)
    }

    override fun onError(error: Int) {
      listening = false
      val payload = Bundle().apply {
        putInt("errorCode", error)
        putString("message", describeError(error))
      }
      sendEvent(EVENT_ERROR, payload)
    }

    override fun onEvent(eventType: Int, params: Bundle?) = Unit
  }

  /** Plain-language wording for a `SpeechRecognizer.ERROR_*` code. */
  private fun describeError(code: Int): String = when (code) {
    SpeechRecognizer.ERROR_AUDIO -> "The microphone could not be read."
    SpeechRecognizer.ERROR_CLIENT -> "Dictation was cancelled."
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
      "SwarSathi needs microphone permission to listen."
    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
      "This phone tried to use the network to recognise speech, which SwarSathi does not allow."
    SpeechRecognizer.ERROR_NO_MATCH -> "I did not catch that. Please try again."
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "The speech recogniser is busy. Please try again."
    SpeechRecognizer.ERROR_SERVER -> "The speech recogniser reported a problem. Please try again."
    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "I did not hear anything."
    12 -> "This phone cannot recognise that language offline." // ERROR_LANGUAGE_NOT_SUPPORTED
    13 -> "That language is not installed for offline recognition." // ERROR_LANGUAGE_UNAVAILABLE
    else -> "Dictation stopped unexpectedly."
  }
}
