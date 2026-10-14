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

    static void cancel(Context ctx, PendingIntent pi) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        am.cancel(pi);
    }
}
