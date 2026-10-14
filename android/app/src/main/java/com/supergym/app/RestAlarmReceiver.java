package com.supergym.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Dinlenme alarmı ve bildirimdeki "Bitir" düğmesi. */
public class RestAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        Notifications.createChannels(ctx);
        if (RestTimer.ACTION_STOP.equals(intent.getAction())) {
            RestTimer.cancel(ctx);
        } else if (RestTimer.ACTION_DONE.equals(intent.getAction())) {
            RestTimer.finished(ctx);
        }
    }
}
