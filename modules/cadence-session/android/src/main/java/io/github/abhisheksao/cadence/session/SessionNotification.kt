package io.github.abhisheksao.cadence.session

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat

object SessionNotification {
  const val CHANNEL_ID = "cadence-session"
  private const val CHANNEL_NAME = "Cadence Session"
  private const val CHANNEL_DESCRIPTION = "Ongoing Cadence session"
  private const val OLD_CHANNEL_ID = "RN_BACKGROUND_ACTIONS_CHANNEL"
  private const val BRAND_COLOR = 0xFFFF7A45.toInt()

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: return

      // Delete the old background actions channel once so it does not linger
      try {
        notificationManager.deleteNotificationChannel(OLD_CHANNEL_ID)
      } catch (_: Exception) {}

      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = CHANNEL_DESCRIPTION
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      notificationManager.createNotificationChannel(channel)
    }
  }

  fun buildNotification(
    context: Context,
    title: String,
    text: String,
    route: String,
    timerKind: String? = null,
    timerMs: Long? = null,
    paused: Boolean = false
  ): Notification {
    ensureChannel(context)

    val cleanRoute = route.removePrefix("/")
    val deepLinkUri = Uri.parse("cadence://$cleanRoute")
    val contentIntent = Intent(Intent.ACTION_VIEW, deepLinkUri).apply {
      setPackage(context.packageName)
    }
    val pendingContentIntent = PendingIntent.getActivity(
      context,
      0,
      contentIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val iconId = context.resources.getIdentifier("ic_launcher", "mipmap", context.packageName).let {
      if (it != 0) it else android.R.drawable.ic_dialog_info
    }

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(iconId)
      .setColor(BRAND_COLOR)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setContentIntent(pendingContentIntent)

    if (!paused && timerKind == "countdown" && timerMs != null && timerMs > 0) {
      builder.setUsesChronometer(true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        builder.setChronometerCountDown(true)
      }
      builder.setWhen(System.currentTimeMillis() + timerMs)
    } else if (!paused && timerKind == "elapsed" && timerMs != null && timerMs >= 0) {
      builder.setUsesChronometer(true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        builder.setChronometerCountDown(false)
      }
      builder.setWhen(System.currentTimeMillis() - timerMs)
    } else {
      builder.setUsesChronometer(false)
    }

    return builder.build()
  }
}
