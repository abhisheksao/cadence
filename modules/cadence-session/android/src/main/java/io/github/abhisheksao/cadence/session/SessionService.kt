package io.github.abhisheksao.cadence.session

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.ServiceCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class SessionService : HeadlessJsTaskService() {
  companion object {
    const val NOTIFICATION_ID = 42421
    const val TASK_NAME = "CadenceSession"
    private const val WAKE_LOCK_TAG = "Cadence::SessionWakeLock"
    private const val WAKE_LOCK_TIMEOUT_MS = 10 * 60 * 1000L // 10 minutes
    private const val WATCHDOG_INTERVAL_MS = 5_000L
    private const val HEARTBEAT_EXPIRY_MS = 10_000L

    @Volatile
    var currentInstance: SessionService? = null
      private set
  }

  private var wakeLock: PowerManager.WakeLock? = null
  private var lastHeartbeatTimestamp = 0L
  private val mainHandler = Handler(Looper.getMainLooper())

  private var sessionId: String = ""
  val currentSessionId: String get() = sessionId
  private var route: String = ""
  private var currentTitle: String = ""
  private var currentText: String = ""
  private var currentTimerKind: String? = null
  private var currentTimerMs: Long? = null
  private var currentPaused: Boolean = false

  private val watchdogRunnable = object : Runnable {
    override fun run() {
      val now = SystemClock.elapsedRealtime()
      if (lastHeartbeatTimestamp > 0 && (now - lastHeartbeatTimestamp > HEARTBEAT_EXPIRY_MS)) {
        // Heartbeat expired! JS side is unresponsive or dead (FR-026)
        stopSelf()
        return
      }
      mainHandler.postDelayed(this, WATCHDOG_INTERVAL_MS)
    }
  }

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: Bundle()
    return HeadlessJsTaskConfig(
      TASK_NAME,
      Arguments.fromBundle(extras),
      0, // 0 = no timeout
      true // allowed in foreground
    )
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null) {
      stopSelf(startId)
      return START_NOT_STICKY
    }

    val extras = intent.extras
    if (extras == null) {
      stopSelf(startId)
      return START_NOT_STICKY
    }

    sessionId = extras.getString("sessionId") ?: ""
    route = extras.getString("route") ?: ""
    currentTitle = extras.getString("title") ?: ""
    currentText = extras.getString("text") ?: ""
    currentTimerKind = extras.getString("timerKind")
    currentTimerMs = if (extras.containsKey("timerMs")) extras.getLong("timerMs") else null
    currentPaused = extras.getBoolean("paused", false)

    val notification = SessionNotification.buildNotification(
      context = this,
      sessionId = sessionId,
      title = currentTitle,
      text = currentText,
      route = route,
      timerKind = currentTimerKind,
      timerMs = currentTimerMs,
      paused = currentPaused
    )

    try {
      val fgsType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      } else {
        0
      }
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, fgsType)
    } catch (e: Exception) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
        e is android.app.ForegroundServiceStartNotAllowedException
      ) {
        stopSelf(startId)
        return START_NOT_STICKY
      }
      throw e
    }

    acquireWakeLock()
    renewHeartbeat()
    startWatchdog()
    currentInstance = this

    return super.onStartCommand(intent, flags, startId)
  }

  private fun acquireWakeLock() {
    if (wakeLock == null) {
      val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
      wakeLock = powerManager?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG)?.apply {
        setReferenceCounted(false)
      }
    }
    try {
      wakeLock?.acquire(WAKE_LOCK_TIMEOUT_MS)
    } catch (_: Exception) {}
  }

  fun renewHeartbeat() {
    lastHeartbeatTimestamp = SystemClock.elapsedRealtime()
    try {
      wakeLock?.acquire(WAKE_LOCK_TIMEOUT_MS)
    } catch (_: Exception) {}
  }

  fun updateNotification(
    title: String,
    text: String,
    timerKind: String?,
    timerMs: Long?,
    paused: Boolean
  ) {
    currentTitle = title
    currentText = text
    currentTimerKind = timerKind
    currentTimerMs = timerMs
    currentPaused = paused

    val notification = SessionNotification.buildNotification(
      context = this,
      sessionId = sessionId,
      title = title,
      text = text,
      route = route,
      timerKind = timerKind,
      timerMs = timerMs,
      paused = paused
    )

    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
    notificationManager?.notify(NOTIFICATION_ID, notification)
  }

  private fun startWatchdog() {
    mainHandler.removeCallbacks(watchdogRunnable)
    mainHandler.postDelayed(watchdogRunnable, WATCHDOG_INTERVAL_MS)
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    CadenceSessionModule.emitTaskRemoved(sessionId)
    // Backstop: 1 s later, stop itself if still running
    mainHandler.postDelayed({
      stopSelf()
    }, 1_000L)
  }

  override fun onTimeout(startId: Int) {
    super.onTimeout(startId)
    stopSelf(startId)
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    super.onTimeout(startId, fgsType)
    stopSelf(startId)
  }

  override fun onDestroy() {
    super.onDestroy()
    mainHandler.removeCallbacks(watchdogRunnable)
    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
      }
    } catch (_: Exception) {}
    wakeLock = null

    try {
      ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      notificationManager?.cancel(NOTIFICATION_ID)
    } catch (_: Exception) {}

    if (currentInstance == this) {
      currentInstance = null
    }
  }
}
