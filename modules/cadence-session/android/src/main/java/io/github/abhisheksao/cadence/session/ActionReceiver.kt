package io.github.abhisheksao.cadence.session

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class ActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent == null) return
    val sessionId = intent.getStringExtra("sessionId") ?: return
    val action = intent.getStringExtra("action") ?: return

    // Only forward action if it matches the currently running service's session (FR-016)
    val activeSessionId = SessionService.currentInstance?.currentSessionId
    Log.d("CadenceSession", "ActionReceiver: action=$action, sessionId=$sessionId, activeSessionId=$activeSessionId")
    if (activeSessionId != null && activeSessionId == sessionId) {
      CadenceSessionModule.emitAction(sessionId, action)
    }
  }
}
