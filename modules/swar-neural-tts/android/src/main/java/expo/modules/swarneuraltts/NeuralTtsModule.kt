package expo.modules.swarneuraltts

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Bundle
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.zip.ZipInputStream

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

class NeuralTtsException(code: String, message: String) :
    CodedException(code, message, null)

// ---------------------------------------------------------------------------
// Event names
// ---------------------------------------------------------------------------

private const val EVENT_SPEECH_START = "onSpeechStart"
private const val EVENT_SPEECH_DONE = "onSpeechDone"
private const val EVENT_SPEECH_STOPPED = "onSpeechStopped"
private const val EVENT_SPEECH_ERROR = "onSpeechError"

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

class NeuralTtsModule : Module() {

    // The loaded TTS instance. Access only inside the executor or under the lock.
    @Volatile
    private var tts: OfflineTts? = null

    // Volatile flag checked between sentences so stop() can interrupt in-flight synthesis.
    @Volatile
    private var stopRequested: Boolean = false

    // AudioTrack used while speaking. Set in speak, cleared in finally.
    @Volatile
    private var audioTrack: AudioTrack? = null

    // Single-threaded executor so synthesis never overlaps.
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()

    override fun definition() = ModuleDefinition {

        Name("NeuralTts")

        Events(EVENT_SPEECH_START, EVENT_SPEECH_DONE, EVENT_SPEECH_STOPPED, EVENT_SPEECH_ERROR)

        // ------------------------------------------------------------------ isSupported
        AsyncFunction("isSupported") {
            return@AsyncFunction try {
                Class.forName("com.k2fsa.sherpa.onnx.OfflineTts")
                true
            } catch (_: ClassNotFoundException) {
                false
            }
        }

        // ------------------------------------------------------------------ loadModel
        AsyncFunction("loadModel") { options: Map<String, Any?> ->
            val modelDir = options["modelDir"] as? String
                ?: throw NeuralTtsException(
                    "ERR_NEURAL_TTS_MODEL_NOT_LOADED",
                    "loadModel: modelDir is required."
                )
            val espeakDataDir = options["espeakDataDir"] as? String
                ?: throw NeuralTtsException(
                    "ERR_NEURAL_TTS_MODEL_NOT_LOADED",
                    "loadModel: espeakDataDir is required."
                )
            val numThreads = (options["numThreads"] as? Number)?.toInt() ?: 2
            val rate = (options["rate"] as? Number)?.toFloat() ?: 1.0f

            // Release the previous model if any.
            tts?.release()
            tts = null

            val config = OfflineTtsConfig(
                model = OfflineTtsModelConfig(
                    vits = OfflineTtsVitsModelConfig(
                        model = "$modelDir/model.onnx",
                        lexicon = "",
                        tokens = "$modelDir/tokens.txt",
                        dataDir = espeakDataDir,
                        dictDir = "",
                        noiseScale = 0.667f,
                        noiseScaleW = 0.8f,
                        lengthScale = 1.0f / rate
                    ),
                    numThreads = numThreads,
                    debug = false,
                    provider = "cpu"
                ),
                ruleFsts = "",
                maxNumSentences = 1
            )

            val engine = OfflineTts(config = config)
            tts = engine

            mapOf(
                "sampleRate" to engine.sampleRate(),
                "numSpeakers" to engine.numSpeakers()
            )
        }

        // ------------------------------------------------------------------ isModelLoaded
        AsyncFunction("isModelLoaded") {
            tts != null
        }

        // ------------------------------------------------------------------ unloadModel
        AsyncFunction("unloadModel") {
            tts?.release()
            tts = null
            null
        }

        // ------------------------------------------------------------------ speak
        AsyncFunction("speak") { text: String, options: Map<String, Any?> ->
            val engine = tts
                ?: throw NeuralTtsException(
                    "ERR_NEURAL_TTS_MODEL_NOT_LOADED",
                    "No model is loaded. Call loadModel() first."
                )

            val rate = (options["rate"] as? Number)?.toFloat() ?: 1.0f
            val speakerId = (options["speakerId"] as? Number)?.toInt() ?: 0
            val utteranceId = UUID.randomUUID().toString()

            // Reset the stop flag before submitting the task.
            stopRequested = false

            executor.submit {
                runSpeech(engine, text, rate, speakerId, utteranceId)
            }

            utteranceId
        }

        // ------------------------------------------------------------------ stop
        AsyncFunction("stop") {
            stopRequested = true
            try {
                audioTrack?.stop()
            } catch (_: Exception) {
                // Stopping an already-stopped AudioTrack is harmless.
            }
            null
        }

        // ------------------------------------------------------------------ extractArchive
        AsyncFunction("extractArchive") { options: Map<String, Any?> ->
            val archivePath = options["archivePath"] as? String
                ?: throw NeuralTtsException(
                    "ERR_NEURAL_TTS_EXTRACT_FAILED",
                    "extractArchive: archivePath is required."
                )
            val destinationDir = options["destinationDir"] as? String
                ?: throw NeuralTtsException(
                    "ERR_NEURAL_TTS_EXTRACT_FAILED",
                    "extractArchive: destinationDir is required."
                )
            val format = options["format"] as? String
                ?: throw NeuralTtsException(
                    "ERR_NEURAL_TTS_EXTRACT_FAILED",
                    "extractArchive: format is required."
                )

            try {
                val destDir = File(destinationDir)
                if (!destDir.exists()) {
                    destDir.mkdirs()
                }
                when (format) {
                    "zip" -> extractZip(archivePath, destDir)
                    "tar.bz2" -> extractTarBz2(archivePath, destDir)
                    else -> throw NeuralTtsException(
                        "ERR_NEURAL_TTS_EXTRACT_FAILED",
                        "extractArchive: unsupported format '$format'."
                    )
                }
            } catch (e: NeuralTtsException) {
                throw e
            } catch (e: Exception) {
                throw NeuralTtsException(
                    "ERR_NEURAL_TTS_EXTRACT_FAILED",
                    "Extraction failed: ${e.localizedMessage ?: e.javaClass.simpleName}"
                )
            }
        }

        OnDestroy {
            tts?.release()
            tts = null
            executor.shutdownNow()
        }
    }

    // --------------------------------------------------------------------------
    // Speech synthesis (runs on the background executor)
    // --------------------------------------------------------------------------

    private fun runSpeech(
        engine: OfflineTts,
        text: String,
        rate: Float,
        speakerId: Int,
        utteranceId: String
    ) {
        var track: AudioTrack? = null
        try {
            if (stopRequested) {
                sendStopped(utteranceId, interrupted = true)
                return
            }

            // Generate audio.
            val audio = engine.generate(text = text, sid = speakerId, speed = rate)
            val samples: FloatArray = audio.samples
            val sampleRate: Int = audio.sampleRate

            if (stopRequested) {
                sendStopped(utteranceId, interrupted = true)
                return
            }

            // Build a streaming AudioTrack.
            val minBufSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_FLOAT
            )
            val bufSize = maxOf(minBufSize, samples.size * 4)

            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()

            val audioFormat = AudioFormat.Builder()
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                .build()

            track = AudioTrack(
                attributes,
                audioFormat,
                bufSize,
                AudioTrack.MODE_STREAM,
                AudioManager.AUDIO_SESSION_ID_GENERATE
            )
            audioTrack = track

            track.play()
            sendStart(utteranceId)

            // Write samples in chunks so the stop flag is checked periodically.
            val chunkSize = 4096
            var offset = 0
            while (offset < samples.size) {
                if (stopRequested) {
                    track.stop()
                    sendStopped(utteranceId, interrupted = true)
                    return
                }
                val end = minOf(offset + chunkSize, samples.size)
                track.write(samples, offset, end - offset, AudioTrack.WRITE_BLOCKING)
                offset = end
            }

            // Flush the last buffer.
            if (!stopRequested) {
                track.stop()
                sendDone(utteranceId)
            } else {
                track.stop()
                sendStopped(utteranceId, interrupted = true)
            }
        } catch (e: Exception) {
            try {
                track?.stop()
            } catch (_: Exception) {}
            sendError(utteranceId, e.localizedMessage ?: e.javaClass.simpleName)
        } finally {
            try {
                track?.release()
            } catch (_: Exception) {}
            if (audioTrack === track) {
                audioTrack = null
            }
        }
    }

    // --------------------------------------------------------------------------
    // Archive extraction helpers
    // --------------------------------------------------------------------------

    /**
     * Extracts a ZIP archive, stripping the first path component from each entry
     * (e.g. `model-name/model.onnx` → `model.onnx`).
     */
    private fun extractZip(archivePath: String, destDir: File): Map<String, Any?> {
        var bytesWritten = 0L
        var fileCount = 0

        ZipInputStream(FileInputStream(archivePath).buffered()).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) {
                    val strippedName = stripFirstComponent(entry.name)
                    if (strippedName.isNotEmpty()) {
                        val outFile = File(destDir, strippedName)
                        outFile.parentFile?.mkdirs()
                        FileOutputStream(outFile).use { fos ->
                            bytesWritten += zis.copyTo(fos)
                        }
                        fileCount++
                    }
                }
                zis.closeEntry()
                entry = zis.nextEntry
            }
        }

        return mapOf("bytes" to bytesWritten, "fileCount" to fileCount)
    }

    /**
     * Extracts a `.tar.bz2` archive, stripping the first path component from each entry.
     */
    private fun extractTarBz2(archivePath: String, destDir: File): Map<String, Any?> {
        var bytesWritten = 0L
        var fileCount = 0

        FileInputStream(archivePath).buffered().use { fis ->
            BZip2CompressorInputStream(fis).use { bz2 ->
                TarArchiveInputStream(bz2).use { tar ->
                    var entry = tar.nextEntry
                    while (entry != null) {
                        if (!entry.isDirectory) {
                            val strippedName = stripFirstComponent(entry.name)
                            if (strippedName.isNotEmpty()) {
                                val outFile = File(destDir, strippedName)
                                outFile.parentFile?.mkdirs()
                                FileOutputStream(outFile).use { fos ->
                                    bytesWritten += tar.copyTo(fos)
                                }
                                fileCount++
                            }
                        }
                        entry = tar.nextEntry
                    }
                }
            }
        }

        return mapOf("bytes" to bytesWritten, "fileCount" to fileCount)
    }

    /**
     * Strips the leading directory component from an archive entry name.
     *
     * `vits-piper-ml_IN-arjun-medium/model.onnx` → `model.onnx`
     * `model.onnx` → `` (empty, so the caller skips it safely)
     */
    private fun stripFirstComponent(entryName: String): String {
        val slash = entryName.indexOf('/')
        return if (slash >= 0 && slash < entryName.length - 1) {
            entryName.substring(slash + 1)
        } else {
            ""
        }
    }

    // --------------------------------------------------------------------------
    // Event helpers
    // --------------------------------------------------------------------------

    private fun sendStart(utteranceId: String) {
        val payload = Bundle()
        payload.putString("utteranceId", utteranceId)
        sendEvent(EVENT_SPEECH_START, payload)
    }

    private fun sendDone(utteranceId: String) {
        val payload = Bundle()
        payload.putString("utteranceId", utteranceId)
        sendEvent(EVENT_SPEECH_DONE, payload)
    }

    private fun sendStopped(utteranceId: String, interrupted: Boolean) {
        val payload = Bundle()
        payload.putString("utteranceId", utteranceId)
        payload.putBoolean("interrupted", interrupted)
        sendEvent(EVENT_SPEECH_STOPPED, payload)
    }

    private fun sendError(utteranceId: String, message: String) {
        val payload = Bundle()
        payload.putString("utteranceId", utteranceId)
        payload.putString("message", message)
        sendEvent(EVENT_SPEECH_ERROR, payload)
    }
}
