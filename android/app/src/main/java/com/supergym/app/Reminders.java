package com.supergym.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import java.util.Calendar;
import java.util.Set;

/**
 * Antrenman hatırlatmaları: her gün ayarlanan saatte kontrol edilir. Seçilen günlerden
 * biriyse ya da uzun süredir antrenman yoksa (ve bugün antrenman girilmediyse) bildirim gelir.
 */
final class Reminders {
    static final String ACTION_REMIND = "com.supergym.app.REMIND";

    private Reminders() {
    }

    static void schedule(Context ctx) {
        PendingIntent pi = intent(ctx);
        if (NativeState.reminderDays(ctx).isEmpty() && NativeState.inactiveDays(ctx) == 0) {
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

        // Calendar: Pazar = 1; arayüzde Pazar = 0.
        int dow = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1;
        long since = NativeState.daysSinceLast(NativeState.days(attended), NativeState.epochDay(todayStr));
        int inactive = NativeState.inactiveDays(ctx);

        String title;
        String text;
        if (NativeState.reminderDays(ctx).contains(String.valueOf(dow))) {
            title = "Bugün antrenman günü 💪";
            text = since > 0 ? "Son antrenmanın " + since + " gün önceydi. Salon seni bekliyor!" : "Salon seni bekliyor!";
        } else if (inactive > 0 && since >= inactive) {
            title = since + " gündür antrenman yapmadın";
            text = "Kısa bir antrenman bile serini korur.";
        } else {
            return;
        }
        Notification n = Notifications.builder(ctx, Notifications.CH_REMINDER)
                .setContentTitle(title)
                .setContentText(text)
                .setAutoCancel(true)
                .build();
        Notifications.post(ctx, Notifications.ID_REMINDER, n);
    }

    private static PendingIntent intent(Context ctx) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_REMIND);
        return PendingIntent.getBroadcast(ctx, 1, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
