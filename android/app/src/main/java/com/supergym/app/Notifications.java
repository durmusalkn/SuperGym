package com.supergym.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import java.util.Arrays;

/** Bildirim kanalları ve ortak bildirim yardımcıları. */
final class Notifications {
    static final String CH_TIMER = "rest_timer";
    static final String CH_TIMER_DONE = "rest_done";
    static final String CH_REMINDER = "reminders";

    static final int ID_TIMER = 1;
    static final int ID_TIMER_DONE = 2;
    static final int ID_REMINDER = 3;

    private Notifications() {
    }

    static void createChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel running = new NotificationChannel(CH_TIMER, "Dinlenme sayacı",
                NotificationManager.IMPORTANCE_LOW);
        running.setDescription("Setler arası dinlenmede kalan süre");
        running.setShowBadge(false);

        NotificationChannel done = new NotificationChannel(CH_TIMER_DONE, "Dinlenme bitti",
                NotificationManager.IMPORTANCE_HIGH);
        done.setDescription("Dinlenme süresi dolunca titreşim ve ses");
        done.enableVibration(true);
        done.setVibrationPattern(new long[]{0, 400, 150, 400});
        done.setShowBadge(false);

        NotificationChannel reminders = new NotificationChannel(CH_REMINDER, "Antrenman hatırlatmaları",
                NotificationManager.IMPORTANCE_DEFAULT);
        reminders.setDescription("Antrenman günü ve uzun ara hatırlatmaları");

        manager(ctx).createNotificationChannels(Arrays.asList(running, done, reminders));
    }

    @SuppressWarnings("deprecation")
    static Notification.Builder builder(Context ctx, String channel) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(ctx, channel)
                : new Notification.Builder(ctx);
        return b.setSmallIcon(R.drawable.ic_stat_supergym)
                .setColor(0xFF10B981)
                .setContentIntent(openApp(ctx));
    }

    /** Bildirime dokununca uygulamayı (açıksa olduğu yerden) öne getirir. */
    static PendingIntent openApp(Context ctx) {
        Intent intent = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 0, intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Android 13+ bildirim izni verildi mi? */
    static boolean allowed(Context ctx) {
        return Build.VERSION.SDK_INT < 33
                || ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    static void post(Context ctx, int id, Notification n) {
        if (allowed(ctx)) manager(ctx).notify(id, n);
    }

    static void cancel(Context ctx, int id) {
        manager(ctx).cancel(id);
    }

    private static NotificationManager manager(Context ctx) {
        return (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    }
}
