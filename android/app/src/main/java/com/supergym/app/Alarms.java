package com.supergym.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.os.Build;

final class Alarms {
    private Alarms() {
    }

    /** Telefon uykudayken bile tam zamanında çalışan alarm kurar. */
    static void setExact(Context ctx, long atMillis, PendingIntent pi) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
            // Tam zamanlı alarm izni kapatılmışsa (Ayarlar > Alarmlar) birkaç dakika
            // gecikebilen alarma düşülür.
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi);
        }
    }

    /**
     * Çalar saat alarmı: durum çubuğunda alarm simgesi görünür ve pil tasarrufu modunda
     * bile tam zamanında çalar. İzin yoksa normal alarma düşülür.
     */
    static void setAlarmClock(Context ctx, long atMillis, PendingIntent pi, PendingIntent show) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (exactAllowed(ctx)) {
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(atMillis, show), pi);
        } else {
            setExact(ctx, atMillis, pi);
        }
    }

    static boolean exactAllowed(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
    }

    static void cancel(Context ctx, PendingIntent pi) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        am.cancel(pi);
    }
}
