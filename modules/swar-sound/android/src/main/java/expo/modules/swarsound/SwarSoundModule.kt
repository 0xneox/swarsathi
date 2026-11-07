package expo.modules.swarsound

import android.os.Bundle
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

/** Event names emitted to JavaScript. They must also be declared through `Events(...)`. */
private const val EVENT_DETECTION = "onSoundDetection"
private const val EVENT_ERROR = "onSoundError"

/** The device cannot load the model or open the microphone. */
class SwarSoundUnavailableException(message: String) :
  CodedException("ERR_SWAR_SOUND_UNAVAILABLE", message, null)

/** Listening was requested without the microphone permission. */
class SwarSoundPermissionException(message: String) :
  CodedException("ERR_SWAR_SOUND_PERMISSION", message, null)

/**
 * Native Android on-device environmental sound classification bridge.
 *
 * Wraps [YamnetEngine]: a bundled YAMNet model classifies 16 kHz microphone audio into AudioSet
 * classes (doorbell, knock, alarm, siren, dog bark, crying baby, smoke alarm and ~500 others).
 * Everything runs on-device; no audio leaves the phone.
 *
 * Each detection is emitted as a separate `onSoundDetection` event carrying a single
 * `{ label, score }` pair - the JavaScript layer owns the mapping from AudioSet labels to the
 * sound types the user enabled.
 */
class SwarSoundModule : Module() {
  private var engine: YamnetEngine? = null

  override fun definition() = ModuleDefinition {
    Name("SwarSound")

    Events(EVENT_DETECTION, EVENT_ERROR)

    AsyncFunction("isAvailable") {
      engineOrNull()?.ensureLoaded() == true
    }

    AsyncFunction("isMicrophonePermissionGranted") {
      appContext.permissions?.hasGrantedPermissions(android.Manifest.permission.RECORD_AUDIO) == true
    }

    AsyncFunction("requestMicrophonePermission") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(
        appContext.permissions,
        promise,
        android.Manifest.permission.RECORD_AUDIO
      )
    }

    AsyncFunction("start") { promise: Promise ->
      val current = engineOrNull()
      if (current == null || !current.ensureLoaded()) {
        promise.reject(
          SwarSoundUnavailableException(
            "This build of SwarSathi cannot classify sounds on this device."
          )
        )
        return@AsyncFunction
      }
      val granted = appContext.permissions
        ?.hasGrantedPermissions(android.Manifest.permission.RECORD_AUDIO) == true
      if (!granted) {
        promise.reject(
          SwarSoundPermissionException(
            "SwarSathi needs microphone permission to listen for sounds."
          )
        )
        return@AsyncFunction
      }
      // The module may be torn down while the capture thread is running; holding the module
      // through a weak reference keeps the listener from pinning it.
      val moduleRef = WeakReference(this@SwarSoundModule)
      val listener = object : YamnetEngine.Listener {
        override fun onClassifications(labels: List<String>, scores: List<Float>) {
          val module = moduleRef.get() ?: return
          for (index in labels.indices) {
            val payload = Bundle().apply {
              putString("label", labels[index])
              putDouble("score", scores[index].toDouble())
            }
            module.sendEvent(EVENT_DETECTION, payload)
          }
        }

        override fun onError(code: String, message: String) {
          val module = moduleRef.get() ?: return
          val payload = Bundle().apply {
            putString("code", code)
            putString("message", message)
          }
          module.sendEvent(EVENT_ERROR, payload)
        }
      }
      if (current.start(listener)) {
        promise.resolve(null)
      } else {
        promise.reject(
          SwarSoundUnavailableException("Sound listening could not be started on this device.")
        )
      }
    }

    AsyncFunction("stop") {
      engine?.stop()
    }

    OnDestroy {
      engine?.release()
      engine = null
    }
  }

  private fun engineOrNull(): YamnetEngine? {
    engine?.let { return it }
    val context = appContext.reactContext?.applicationContext ?: return null
    return YamnetEngine(context).also { engine = it }
  }
}
