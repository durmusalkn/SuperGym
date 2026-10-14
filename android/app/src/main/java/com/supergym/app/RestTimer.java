package com.supergym.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * Dinlenme sayacı. Uygulama arka plandayken ya da ekran kapalıyken de çalışsın diye
 * süre Android'in alarm servisine bırakılır; kalan süre bildirimde geri sayılır.
 */
final class RestTimer {
    static final String ACTION_DONE = "com.supergym.app.REST_DONE";
    static final String ACTION_STOP = "com.supergym.app.REST_STOP";
    private static final String KEY_END = "rest_end";

    private RestTimer() {
    }

    static void start(Context ctx, long endMillis) {
        prefs(ctx).edit().putLong(KEY_END, endMillis).apply();
        Notifications.cancel(ctx, Notifications.ID_TIMER_DONE);
        Alarms.setExact(ctx, endMillis, intent(ctx, ACTION_DONE));

        Notification n = Notifications.builder(ctx, Notifications.CH_TIMER)
                .setContentTitle("Dinlenme")
                .setContentText("Sıradaki set için hazırlan")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(true)
                .setWhen(endMillis)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setCategory(Notification.CATEGORY_PROGRESS)
                .addAction(new Notification.Action.Builder(null, "Bitir", intent(ctx, ACTION_STOP)).build())
                .build();
        Notifications.post(ctx, Notifications.ID_TIMER, n);
    }

    static void cancel(Context ctx) {
        prefs(ctx).edit().remove(KEY_END).apply();
        Alarms.cancel(ctx, intent(ctx, ACTION_DONE));
        Notifications.cancel(ctx, Notifications.ID_TIMER);
    }

    /** Sayaç çalışıyorsa bitiş zamanı, çalışmıyorsa 0. */
    static long endsAt(Context ctx) {
        long end = prefs(ctx).getLong(KEY_END, 0);
        return end > System.currentTimeMillis() ? end : 0;
    }

    /** Alarm çaldığında: uygulama açıksa sadece titret, değilse bildirim göster. */
    static void finished(Context ctx) {
        cancel(ctx);
        if (MainActivity.isVisible()) {
            vibrate(ctx, 600);
            return;
        }
        @SuppressWarnings("deprecation")
        Notification.Builder b = Notifications.builder(ctx, Notifications.CH_TIMER_DONE)
                .setContentTitle("Dinlenme bitti")
                .setContentText("Sıradaki sete geç 💪")
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_ALARM)
                .setPriority(Notification.PRIORITY_HIGH)
                .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);
        if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(60_000);
        Notifications.post(ctx, Notifications.ID_TIMER_DONE, b.build());
    }

    @SuppressWarnings("deprecation")
    static void vibrate(Context ctx, long ms) {
        Vibrator vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= 26) {
            vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            vibrator.vibrate(ms);
        }
    }

    private static PendingIntent intent(Context ctx, String action) {
        Intent i = new Intent(ctx, RestAlarmReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(ctx, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences("supergym", Context.MODE_PRIVATE);
    }
}
