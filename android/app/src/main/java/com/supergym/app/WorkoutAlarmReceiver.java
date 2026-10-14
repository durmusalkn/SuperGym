package com.supergym.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Antrenman alarmının olayları: hazırlık/gitme zamanı, tekrar, ertele ve deneme. */
public class WorkoutAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        Notifications.createChannels(ctx);
        String action = intent.getAction();
        if (WorkoutAlarms.ACTION_EVENT.equals(action)) {
            WorkoutAlarms.onEvent(ctx, intent.getLongExtra(WorkoutAlarms.EXTRA_AT, 0));
        } else if (WorkoutAlarms.ACTION_RING.equals(action)) {
            WorkoutAlarms.onRepeat(ctx);
        } else if (WorkoutAlarms.ACTION_SNOOZE.equals(action)) {
            WorkoutAlarms.snooze(ctx);
        } else if (WorkoutAlarms.ACTION_TEST.equals(action)) {
            WorkoutAlarms.onTest(ctx);
        }
    }
}
