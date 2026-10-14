package com.supergym.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Günlük hatırlatma alarmı; telefon yeniden başlayınca ya da uygulama güncellenince alarmı yeniden kurar. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        Notifications.createChannels(ctx);
        if (Reminders.ACTION_REMIND.equals(intent.getAction())) Reminders.check(ctx);
        Reminders.schedule(ctx);
        WidgetProvider.updateAll(ctx);
    }
}
