package io.github.abhisheksao.cadence.session

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build

class Focus(context: Context) {
  private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
  private var focusRequest: AudioFocusRequest? = null
  private var isHeld = false

  private val listener = AudioManager.OnAudioFocusChangeListener { focusChange ->
    if (focusChange == AudioManager.AUDIOFOCUS_LOSS ||
        focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
      isHeld = false
      CadenceSessionModule.emitFocusLost()
    }
  }

  fun request(): Boolean {
    val am = audioManager ?: return false
    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      if (focusRequest == null) {
        val attributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
        focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
          .setAudioAttributes(attributes)
          .setOnAudioFocusChangeListener(listener)
          .setAcceptsDelayedFocusGain(false)
          .setWillPauseWhenDucked(false)
          .build()
      }
      am.requestAudioFocus(focusRequest!!)
    } else {
      @Suppress("DEPRECATION")
      am.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
    }

    isHeld = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    return isHeld
  }

  fun abandon() {
    val am = audioManager ?: return
    if (!isHeld && focusRequest == null) return
    isHeld = false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { am.abandonAudioFocusRequest(it) }
    } else {
      @Suppress("DEPRECATION")
      am.abandonAudioFocus(listener)
    }
  }
}
