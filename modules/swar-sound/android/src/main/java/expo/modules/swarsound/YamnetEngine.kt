package expo.modules.swarsound

import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * On-device YAMNet sound classifier.
 *
 * The model (`yamnet.tflite`, bundled in this module's assets) is the TensorFlow YAMNet AudioSet
 * classifier: 16 kHz mono PCM in, 521 AudioSet class scores out. Inference runs on a dedicated
 * capture thread; each completed window emits the top classes through [Listener].
 *
 * Window and hop sizes are read from the model's input tensor at load time rather than hard-coded,
 * so a different YAMNet export still works.
 */
class YamnetEngine(private val context: Context) {

  interface Listener {
    /** Top classes for one window, best first. `labels`/`scores` are index-aligned. */
    fun onClassifications(labels: List<String>, scores: List<Float>)
    fun onError(code: String, message: String)
  }

  private var interpreter: Interpreter? = null
  private var labels: List<String> = emptyList()
  private var windowSize = 0
  private var numClasses = 0
  private var hopSize = 0

  @Volatile
  private var running = false

  @Volatile
  private var recorder: AudioRecord? = null

  private var captureThread: Thread? = null

  val isLoaded: Boolean
    get() = interpreter != null

  /**
   * Loads the model and label list on first use. Returns false when either asset is missing or the
   * interpreter cannot be created - callers surface that as "sound awareness unavailable".
   */
  @Synchronized
  fun ensureLoaded(): Boolean {
    if (interpreter != null) {
      return true
    }
    return try {
      val modelBytes = context.assets.open(ASSET_MODEL).use { it.readBytes() }
      val buffer = ByteBuffer.allocateDirect(modelBytes.size)
        .order(ByteOrder.nativeOrder())
        .put(modelBytes)
      buffer.flip()

      val options = Interpreter.Options().setNumThreads(4)
      val created = Interpreter(buffer, options)

      val inputShape = created.getInputTensor(0).shape()
      windowSize = if (inputShape.size >= 2) inputShape[1] else DEFAULT_WINDOW
      numClasses = created.getOutputTensor(0).shape().last()
      hopSize = (windowSize / 2).coerceAtLeast(1)

      labels = context.assets.open(ASSET_LABELS).bufferedReader().use { it.readLines() }
      interpreter = created
      true
    } catch (ignored: Exception) {
      interpreter = null
      false
    }
  }

  /**
   * Starts microphone capture and classification. Returns false without starting when the model is
   * unavailable or RECORD_AUDIO has not been granted.
   */
  fun start(listener: Listener): Boolean {
    if (running) {
      return true
    }
    if (!ensureLoaded()) {
      return false
    }
    if (context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return false
    }
    running = true
    captureThread = Thread({ captureLoop(listener) }, "swar-sound-capture").also { it.start() }
    return true
  }

  /** Stops capture. Safe to call when not running; unblocks a pending `AudioRecord.read`. */
  fun stop() {
    running = false
    try {
      recorder?.stop()
    } catch (ignored: Exception) {
      // Stopping a recorder that already stopped is a no-op.
    }
    val thread = captureThread
    captureThread = null
    if (thread != null && thread !== Thread.currentThread()) {
      try {
        thread.join(STOP_JOIN_MS)
      } catch (ignored: InterruptedException) {
        Thread.currentThread().interrupt()
      }
    }
  }

  /** Stops capture and releases the interpreter. The engine reloads on the next [start]. */
  fun release() {
    stop()
    try {
      interpreter?.close()
    } catch (ignored: Exception) {
      // Best-effort cleanup.
    }
    interpreter = null
  }

  // region Capture loop

  private fun captureLoop(listener: Listener) {
    val minBuffer = AudioRecord.getMinBufferSize(
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT
    )
    if (minBuffer <= 0 || windowSize <= 0 || numClasses <= 0) {
      listener.onError(ERR_CAPTURE, "This device cannot open the microphone for sound listening.")
      running = false
      return
    }

    val bufferSizeBytes = maxOf(minBuffer * 2, windowSize * 4)
    val record = try {
      AudioRecord(
        MediaRecorder.AudioSource.MIC,
        SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        bufferSizeBytes
      )
    } catch (error: Exception) {
      listener.onError(ERR_CAPTURE, "The microphone could not be opened.")
      running = false
      return
    }

    if (record.state != AudioRecord.STATE_INITIALIZED) {
      listener.onError(ERR_CAPTURE, "The microphone could not be opened.")
      record.release()
      running = false
      return
    }

    recorder = record
    try {
      record.startRecording()
      val pending = ShortArray(windowSize)
      var pendingCount = 0
      val chunk = ShortArray(CHUNK_SAMPLES)
      val input = Array(1) { FloatArray(windowSize) }
      val output = Array(1) { FloatArray(numClasses) }

      while (running) {
        val read = record.read(chunk, 0, chunk.size)
        if (read <= 0) {
          if (!running) break
          // A transient read error (e.g. buffer underrun during route change) is retried; a dead
          // recorder reports an error and ends the loop.
          if (read == AudioRecord.ERROR_INVALID_OPERATION ||
            read == AudioRecord.ERROR_BAD_VALUE ||
            read == AudioRecord.ERROR_DEAD_OBJECT
          ) {
            listener.onError(ERR_CAPTURE, "The microphone stopped unexpectedly.")
            break
          }
          continue
        }

        var offset = 0
        var remaining = read
        while (remaining > 0 && running) {
          val space = windowSize - pendingCount
          val take = minOf(space, remaining)
          System.arraycopy(chunk, offset, pending, pendingCount, take)
          pendingCount += take
          offset += take
          remaining -= take

          if (pendingCount == windowSize) {
            emitClassification(pending, input, output, listener)
            // Discard the oldest `hopSize` samples so the next window overlaps by half, matching
            // the model's expected hop.
            System.arraycopy(pending, hopSize, pending, 0, windowSize - hopSize)
            pendingCount = windowSize - hopSize
          }
        }
      }
    } catch (error: Exception) {
      listener.onError(ERR_INFERENCE, "Sound classification stopped unexpectedly.")
    } finally {
      try {
        record.stop()
      } catch (ignored: Exception) {
        // Already stopped.
      }
      record.release()
      recorder = null
      running = false
    }
  }

  private fun emitClassification(
    pending: ShortArray,
    input: Array<FloatArray>,
    output: Array<FloatArray>,
    listener: Listener
  ) {
    val engine = interpreter ?: return
    val floats = input[0]
    for (i in 0 until windowSize) {
      floats[i] = pending[i] / 32768f
    }
    try {
      engine.run(input, output)
    } catch (error: Exception) {
      listener.onError(ERR_INFERENCE, "The sound model could not classify this audio.")
      return
    }

    val scores = output[0]
    val ranked = scores.indices
      .sortedByDescending { scores[it] }
      .take(TOP_K)
      .filter { scores[it] >= MIN_SCORE }
    if (ranked.isEmpty()) {
      return
    }
    listener.onClassifications(
      ranked.map { index -> labels.getOrElse(index) { "Class $index" } },
      ranked.map { index -> scores[index] }
    )
  }

  // endregion

  companion object {
    private const val ASSET_MODEL = "yamnet.tflite"
    private const val ASSET_LABELS = "yamnet_labels.txt"

    private const val SAMPLE_RATE = 16000
    private const val CHUNK_SAMPLES = 4096
    private const val DEFAULT_WINDOW = 15600
    private const val TOP_K = 5
    private const val MIN_SCORE = 0.05f
    private const val STOP_JOIN_MS = 400L

    private const val ERR_CAPTURE = "ERR_SWAR_SOUND_CAPTURE"
    private const val ERR_INFERENCE = "ERR_SWAR_SOUND_INFERENCE"
  }
}
