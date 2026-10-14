package com.supergym.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Günlük hatırlatma alarmı; telefon yeniden başlayınca ya da uygulama güncellenince
 * hatırlatmayı ve antrenman alarmlarını yeniden kurar.
 */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        Notifications.createChannels(ctx);
        if (Reminders.ACTION_REMIND.equals(intent.getAction())) Reminders.check(ctx);
        Reminders.schedule(ctx);
        if (!Reminders.ACTION_REMIND.equals(intent.getAction())) WorkoutAlarms.schedule(ctx);
        WidgetProvider.updateAll(ctx);
    }
}
