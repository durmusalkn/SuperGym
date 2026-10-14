package com.supergym.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import java.util.Calendar;
import java.util.Set;

/**
 * Uzun ara uyarısı: her gün ayarlanan saatte kontrol edilir; uzun süredir antrenman yoksa
 * bildirim gelir. (Antrenman günleri için alarmlar WorkoutAlarms'tadır.)
 */
final class Reminders {
    static final String ACTION_REMIND = "com.supergym.app.REMIND";

    private Reminders() {
    }

    static void schedule(Context ctx) {
        PendingIntent pi = intent(ctx);
        if (NativeState.inactiveDays(ctx) == 0) {
            Alarms.cancel(ctx, pi);
            return;
        }
        int hour = 18;
        int minute = 0;
        try {
            String[] t = NativeState.reminderTime(ctx).split(":");
            hour = Integer.parseInt(t[0]);
            minute = Integer.parseInt(t[1]);
        } catch (RuntimeException ignored) {
            // varsayılan 18:00
        }
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, minute);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= System.currentTimeMillis() + 1000) c.add(Calendar.DAY_OF_MONTH, 1);
        Alarms.setExact(ctx, c.getTimeInMillis(), pi);
    }

    static void check(Context ctx) {
        String todayStr = NativeState.today();
        Set<String> attended = NativeState.attended(ctx);
        if (attended.contains(todayStr)) return;

        long since = NativeState.daysSinceLast(NativeState.days(attended), NativeState.epochDay(todayStr));
        int inactive = NativeState.inactiveDays(ctx);
        if (inactive <= 0 || since < inactive) return;

        Notification n = Notifications.builder(ctx, Notifications.CH_REMINDER)
                .setContentTitle(since + " gündür antrenman yapmadın")
                .setContentText("Kısa bir antrenman bile serini korur.")
                .setAutoCancel(true)
                .build();
        Notifications.post(ctx, Notifications.ID_REMINDER, n);
    }

    private static PendingIntent intent(Context ctx) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_REMIND);
        return PendingIntent.getBroadcast(ctx, 1, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
