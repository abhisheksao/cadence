package io.github.abhisheksao.cadence.session

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

class CadenceSessionModule : Module() {
  private var focus: Focus? = null

  private fun getFocus(): Focus? {
    if (focus == null) {
      appContext.reactContext?.let { focus = Focus(it) }
    }
    return focus
  }

  companion object {
    private var instance: WeakReference<CadenceSessionModule>? = null

    fun emitTaskRemoved(sessionId: String) {
      instance?.get()?.sendEvent("onTaskRemoved", mapOf("sessionId" to sessionId))
    }

    fun emitAction(sessionId: String, action: String) {
      instance?.get()?.sendEvent("onAction", mapOf("sessionId" to sessionId, "action" to action))
    }

    fun emitFocusLost() {
      instance?.get()?.sendEvent("onFocusLost", emptyMap<String, Any>())
    }
  }

  override fun definition() = ModuleDefinition {
    Name("CadenceSession")

    Events("onAction", "onTaskRemoved", "onFocusLost")

    OnCreate {
      instance = WeakReference(this@CadenceSessionModule)
    }

    OnDestroy {
      if (instance?.get() == this@CadenceSessionModule) {
        instance = null
      }
      try {
        focus?.abandon()
        focus = null
      } catch (_: Exception) {}
      try {
        appContext.reactContext?.let { ctx ->
          ctx.stopService(Intent(ctx, SessionService::class.java))
        }
      } catch (_: Exception) {}
    }

    // Clock
    Function("elapsedRealtime") {
      SystemClock.elapsedRealtime().toDouble()
    }

    Function("bootCount") {
      try {
        val cr = appContext.reactContext?.contentResolver ?: return@Function null
        val count = Settings.Global.getInt(cr, Settings.Global.BOOT_COUNT, -1)
        if (count >= 0) count.toDouble() else null
      } catch (_: Exception) {
        null
      }
    }

    // Service
    AsyncFunction("startService") { args: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@AsyncFunction false

      val sessionId = args["sessionId"] as? String ?: ""
      val route = args["route"] as? String ?: ""
      val title = args["title"] as? String ?: ""
      val text = args["text"] as? String ?: ""
      val paused = args["paused"] as? Boolean ?: false

      val timerMap = args["timer"] as? Map<*, *>
      val timerKind = timerMap?.get("kind") as? String
      val timerMs = (timerMap?.get("remainingMs") as? Number)?.toLong()
        ?: (timerMap?.get("elapsedMs") as? Number)?.toLong()

      val intent = Intent(context, SessionService::class.java).apply {
        putExtra("sessionId", sessionId)
        putExtra("route", route)
        putExtra("title", title)
        putExtra("text", text)
        putExtra("paused", paused)
        if (timerKind != null) putExtra("timerKind", timerKind)
        if (timerMs != null) putExtra("timerMs", timerMs)
      }

      try {
        ContextCompat.startForegroundService(context, intent)
        true
      } catch (e: Exception) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
          e is android.app.ForegroundServiceStartNotAllowedException
        ) {
          false
        } else {
          throw e
        }
      }
    }

    Function("updateNotification") { args: Map<String, Any?> ->
      val title = args["title"] as? String ?: ""
      val text = args["text"] as? String ?: ""
      val paused = args["paused"] as? Boolean ?: false

      val timerMap = args["timer"] as? Map<*, *>
      val timerKind = timerMap?.get("kind") as? String
      val timerMs = (timerMap?.get("remainingMs") as? Number)?.toLong()
        ?: (timerMap?.get("elapsedMs") as? Number)?.toLong()

      SessionService.currentInstance?.updateNotification(
        title = title,
        text = text,
        timerKind = timerKind,
        timerMs = timerMs,
        paused = paused
      )
    }

    Function("heartbeat") {
      SessionService.currentInstance?.renewHeartbeat()
    }

    AsyncFunction("stopService") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      val intent = Intent(context, SessionService::class.java)
      context.stopService(intent)
      SessionService.currentInstance?.stopSelf()
      null
    }

    // Audio focus and vibration
    Function("requestFocus") {
      getFocus()?.request() ?: false
    }

    Function("abandonFocus") {
      getFocus()?.abandon()
    }

    Function("vibrate") { ms: Long ->
      val context = appContext.reactContext ?: return@Function
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vm?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
      } else {
        @Suppress("DEPRECATION")
        vibrator?.vibrate(ms)
      }
    }
  }
}
