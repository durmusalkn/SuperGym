package com.supergym.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * Antrenman alarmları. Her alarm haftanın bir günü ve gitme saatidir; gitme saatinden
 * PrepMinutes önce o günün programını gösteren hazırlık bildirimi gelir, gitme saatinde
 * alarm çalar ve resim tam ekran açılır. "Antrenmana girdim" denene (ya da o gün set
 * girilene) kadar alarm 5 dakikada bir yeniden çalar.
 *
 * Android'e her seferinde yalnızca en yakın olay (hazırlık ya da gitme) kurulur; olay
 * gerçekleşince bir sonraki kurulur.
 */
final class WorkoutAlarms {
    static final String ACTION_EVENT = "com.supergym.app.ALARM_EVENT";
    static final String ACTION_RING = "com.supergym.app.ALARM_RING";
    static final String ACTION_SNOOZE = "com.supergym.app.ALARM_SNOOZE";
    static final String ACTION_TEST = "com.supergym.app.ALARM_TEST";
    static final String EXTRA_AT = "at";
    static final String EXTRA_ENTERED = "alarm_entered";

    static final long REPEAT_MS = 5 * 60_000L;
    static final long RING_MS = 60_000L; // her çalış bu kadar sürer
    static final long MAX_RINGING_MS = 2 * 60 * 60_000L; // en fazla bu kadar süre tekrar çalar

    private static final int RC_EVENT = 10;
    private static final int RC_RING = 11;
    private static final int RC_SNOOZE = 12;
    private static final int RC_TEST = 13;
    private static final int RC_ENTERED = 14;
    private static final int RC_SCREEN = 15;

    private WorkoutAlarms() {
    }

    /** Arayüzden gelen alarm. */
    static final class Entry {
        int day; // 0: Pazar … 6: Cumartesi
        int hour;
        int minute;
        String templateId = "";
        String program = "";
        List<String> exercises = new ArrayList<>();

        String time() {
            return String.format(Locale.US, "%02d:%02d", hour, minute);
        }
    }

    /** Takvimdeki bir olay: hazırlık ya da gitme. */
    private static final class Event {
        final long at;
        final long go; // hazırlıkta da gitme saati (hangi günün antrenmanı?)
        final boolean prep;
        final Entry entry;

        Event(long at, long go, boolean prep, Entry entry) {
            this.at = at;
            this.go = go;
            this.prep = prep;
            this.entry = entry;
        }
    }

    static List<Entry> entries(Context ctx) {
        List<Entry> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(NativeState.alarms(ctx));
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                String[] t = o.getString("time").split(":");
                Entry e = new Entry();
                e.day = o.getInt("day");
                e.hour = Integer.parseInt(t[0]);
                e.minute = Integer.parseInt(t[1]);
                e.templateId = o.optString("templateId", "");
                e.program = o.optString("program", "");
                JSONArray ex = o.optJSONArray("exercises");
                for (int k = 0; ex != null && k < ex.length(); k++) e.exercises.add(ex.getString(k));
                out.add(e);
            }
        } catch (Exception ignored) {
            // bozuk veri: alarm yok sayılır
        }
        return out;
    }

    /** from'dan sonraki 8 gün içindeki olaylar (hazırlık bir önceki güne de düşebilir). */
    private static List<Event> events(Context ctx, long from) {
        List<Event> out = new ArrayList<>();
        long prep = NativeState.prepMinutes(ctx) * 60_000L;
        for (Entry e : entries(ctx)) {
            for (int offset = -1; offset <= 8; offset++) {
                Calendar c = Calendar.getInstance();
                c.setTimeInMillis(from);
                c.add(Calendar.DAY_OF_MONTH, offset);
                // Calendar: Pazar = 1; arayüzde Pazar = 0.
                if (c.get(Calendar.DAY_OF_WEEK) - 1 != e.day) continue;
                c.set(Calendar.HOUR_OF_DAY, e.hour);
                c.set(Calendar.MINUTE, e.minute);
                c.set(Calendar.SECOND, 0);
                c.set(Calendar.MILLISECOND, 0);
                long go = c.getTimeInMillis();
                out.add(new Event(go, go, false, e));
                if (prep > 0) out.add(new Event(go - prep, go, true, e));
            }
        }
        return out;
    }

    /** En yakın olayı kurar; alarm yoksa kurulu olanı iptal eder. */
    static void schedule(Context ctx) {
        long now = System.currentTimeMillis();
        Event next = null;
        boolean anyGo = false;
        for (Event ev : events(ctx, now)) {
            if (ev.at <= now + 1000) continue;
            if (next == null || ev.at < next.at) next = ev;
        }
        PendingIntent pi = broadcast(ctx, ACTION_EVENT, RC_EVENT);
        if (next == null) {
            Alarms.cancel(ctx, pi);
            return;
        }
        for (Event ev : events(ctx, now)) if (ev.at == next.at && !ev.prep) anyGo = true;
        Intent i = new Intent(ctx, WorkoutAlarmReceiver.class).setAction(ACTION_EVENT).putExtra(EXTRA_AT, next.at);
        pi = PendingIntent.getBroadcast(ctx, RC_EVENT, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        if (anyGo) {
            Alarms.setAlarmClock(ctx, next.at, pi, screen(ctx));
        } else {
            Alarms.setExact(ctx, next.at, pi);
        }
    }

    /** Kurulan olayın zamanı geldi: o andaki hazırlık ve gitme olaylarını işler. */
    static void onEvent(Context ctx, long at) {
        if (at > 0) {
            for (Event ev : events(ctx, at)) {
                if (Math.abs(ev.at - at) > 30_000) continue;
                List<String> exercises = exercisesFor(ctx, ev.entry, NativeState.date(ev.go));
                if (ev.prep) prepare(ctx, ev.entry, exercises);
                else startRinging(ctx, ev.entry, exercises, false);
            }
        }
        schedule(ctx);
    }

    private static boolean attendedToday(Context ctx) {
        return NativeState.attended(ctx).contains(NativeState.today());
    }

    /**
     * O günün yapılacak hareketleri: Antrenman sekmesinde o güne hareket girildiyse onlar,
     * girilmediyse alarmın programındakiler.
     */
    private static List<String> exercisesFor(Context ctx, Entry e, String date) {
        List<String> planned = NativeState.planFor(ctx, date);
        return planned.isEmpty() ? e.exercises : planned;
    }

    // --- Hazırlık bildirimi ---

    private static void prepare(Context ctx, Entry e, List<String> exercises) {
        if (attendedToday(ctx)) return;
        String title = e.program.isEmpty()
                ? "Hazırlan: antrenman " + e.time() + "'de"
                : "Hazırlan: " + e.time() + "'de " + e.program;
        String text = exercises.isEmpty()
                ? "Çantanı hazırla, su şişeni unutma."
                : "Bugün: " + TextUtils.join(" · ", exercises);
        Notification n = Notifications.builder(ctx, Notifications.CH_PREP)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .build();
        Notifications.post(ctx, Notifications.ID_PREP, n);
    }

    // --- Alarm ---

    private static SharedPreferences prefs(Context ctx) {
        return NativeState.prefs(ctx);
    }

    static boolean ringing(Context ctx) {
        return prefs(ctx).getLong("ring_since", 0) > 0;
    }

    static String ringProgram(Context ctx) {
        return prefs(ctx).getString("ring_program", "");
    }

    static String ringTime(Context ctx) {
        return prefs(ctx).getString("ring_time", "");
    }

    /** Çalan alarmın günündeki yapılacak hareketler. */
    static List<String> ringExercises(Context ctx) {
        List<String> out = new ArrayList<>();
        for (String s : prefs(ctx).getString("ring_exercises", "").split("\n")) if (!s.isEmpty()) out.add(s);
        return out;
    }

    /** Gitme saati geldi. Bugün zaten set girildiyse (salondaysa) çalmaz. */
    private static void startRinging(Context ctx, Entry e, List<String> exercises, boolean test) {
        if (!test && attendedToday(ctx)) return;
        Notifications.cancel(ctx, Notifications.ID_PREP);
        prefs(ctx).edit()
                .putLong("ring_since", System.currentTimeMillis())
                .putString("ring_date", NativeState.today())
                .putString("ring_template", e.templateId)
                .putString("ring_program", e.program)
                .putString("ring_exercises", TextUtils.join("\n", exercises))
                .putString("ring_time", e.time())
                .putBoolean("ring_test", test)
                .commit();
        ring(ctx);
    }

    /** Tekrar zamanı ya da erteleme bitti. */
    static void onRepeat(Context ctx) {
        if (!ringing(ctx)) return;
        SharedPreferences p = prefs(ctx);
        boolean expired = System.currentTimeMillis() - p.getLong("ring_since", 0) > MAX_RINGING_MS
                || !NativeState.today().equals(p.getString("ring_date", ""));
        if (expired || (!p.getBoolean("ring_test", false) && attendedToday(ctx))) {
            stop(ctx);
            return;
        }
        ring(ctx);
    }

    /** Alarm sesi ve tam ekran resim; 5 dakika sonra yeniden çalmak üzere kurulur. */
    private static void ring(Context ctx) {
        String program = ringProgram(ctx);
        List<String> exercises = ringExercises(ctx);
        String title = program.isEmpty() ? "Antrenman vakti!" : "Antrenman vakti: " + program;
        String text = exercises.isEmpty() ? "Salona gitme zamanı." : TextUtils.join(" · ", exercises);

        PendingIntent full = screen(ctx);
        Intent enteredIntent = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(EXTRA_ENTERED, true);
        PendingIntent entered = PendingIntent.getActivity(ctx, RC_ENTERED, enteredIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        @SuppressWarnings("deprecation")
        Notification.Builder b = Notifications.builder(ctx, AlarmSound.channel(ctx))
                .setContentTitle(title)
                .setContentText(text)
                .setContentIntent(full)
                .setFullScreenIntent(full, true)
                .setCategory(Notification.CATEGORY_ALARM)
                .setPriority(Notification.PRIORITY_MAX)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setSound(AlarmSound.uri(ctx), new android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_ALARM).build())
                .setVibrate(new long[]{0, 800, 400, 800, 400, 800})
                .addAction(new Notification.Action.Builder(null, "Antrenmana girdim", entered).build())
                .addAction(new Notification.Action.Builder(null,
                        "Ertele (" + NativeState.snoozeMinutes(ctx) + " dk)", broadcast(ctx, ACTION_SNOOZE, RC_SNOOZE)).build());
        if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(RING_MS);
        Bitmap image = AlarmImage.load(ctx, 720);
        if (image != null) b.setStyle(new Notification.BigPictureStyle().bigPicture(image).setSummaryText(text));
        else b.setStyle(new Notification.BigTextStyle().bigText(text));
        Notification n = b.build();
        // Bildirim kaldırılana (ya da süresi dolana) kadar ses tekrar tekrar çalar.
        n.flags |= Notification.FLAG_INSISTENT;
        Notifications.cancel(ctx, Notifications.ID_ALARM);
        Notifications.post(ctx, Notifications.ID_ALARM, n);
        showScreen(ctx);

        if (!prefs(ctx).getBoolean("ring_test", false)) {
            Alarms.setExact(ctx, System.currentTimeMillis() + REPEAT_MS, broadcast(ctx, ACTION_RING, RC_RING));
        }
    }

    /**
     * Android, telefon kullanılırken tam ekran bildirimi yalnızca üstte küçük bir bildirim
     * olarak gösterir. "Diğer uygulamaların üzerinde göster" izni verildiyse resim ekranı
     * doğrudan açılır, böylece telefon elindeyken de fotoğraf öne gelir.
     */
    private static void showScreen(Context ctx) {
        if (!overlayAllowed(ctx)) return;
        try {
            ctx.startActivity(new Intent(ctx, AlarmActivity.class)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION));
        } catch (Exception ignored) {
            // Telefon izin vermezse bildirimdeki tam ekran resim yine çalışır.
        }
    }

    static boolean overlayAllowed(Context ctx) {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx);
    }

    /** Ertele: şimdilik sustur, erteleme süresi sonunda yeniden çal. */
    static void snooze(Context ctx) {
        if (!ringing(ctx)) return;
        Notifications.cancel(ctx, Notifications.ID_ALARM);
        prefs(ctx).edit().putBoolean("ring_test", false).apply();
        Alarms.setExact(ctx, System.currentTimeMillis() + NativeState.snoozeMinutes(ctx) * 60_000L,
                broadcast(ctx, ACTION_RING, RC_RING));
    }

    /**
     * "Antrenmana girdim": alarm susar ve tekrarlanmaz; uygulama açılınca o günün programı
     * bugünün antrenmanına eklenir.
     */
    static void entered(Context ctx) {
        String template = prefs(ctx).getString("ring_template", "");
        try {
            prefs(ctx).edit().putString("alarm_start", new JSONObject().put("templateId", template).toString()).commit();
        } catch (Exception ignored) {
            // JSON oluşturulamazsa programsız açılır
        }
        stop(ctx);
    }

    /** Arayüz bekleyen "Antrenmana girdim" isteğini alır (bir kez). */
    static String takeStart(Context ctx) {
        String s = prefs(ctx).getString("alarm_start", "");
        if (!s.isEmpty()) prefs(ctx).edit().remove("alarm_start").commit();
        return s;
    }

    /** Alarmı tamamen susturur ("Antrenmana girdim", süre dolması ya da o gün set girilmesi). */
    static void stop(Context ctx) {
        prefs(ctx).edit()
                .remove("ring_since").remove("ring_date").remove("ring_template")
                .remove("ring_program").remove("ring_exercises").remove("ring_time").remove("ring_test")
                .commit();
        Alarms.cancel(ctx, broadcast(ctx, ACTION_RING, RC_RING));
        Notifications.cancel(ctx, Notifications.ID_ALARM);
    }

    /** Ayarlardaki "Alarmı dene": 10 saniye sonra tekrarlamadan bir kez çalar. */
    static void test(Context ctx) {
        Alarms.setExact(ctx, System.currentTimeMillis() + 10_000, broadcast(ctx, ACTION_TEST, RC_TEST));
    }

    static void onTest(Context ctx) {
        Entry e = new Entry();
        Calendar c = Calendar.getInstance();
        e.hour = c.get(Calendar.HOUR_OF_DAY);
        e.minute = c.get(Calendar.MINUTE);
        for (Entry x : entries(ctx)) {
            if (!x.program.isEmpty()) {
                e.program = x.program;
                e.templateId = x.templateId;
                e.exercises = x.exercises;
                break;
            }
        }
        startRinging(ctx, e, exercisesFor(ctx, e, NativeState.today()), true);
    }

    /** Tam ekran alarm ekranı. */
    private static PendingIntent screen(Context ctx) {
        Intent i = new Intent(ctx, AlarmActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        return PendingIntent.getActivity(ctx, RC_SCREEN, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent broadcast(Context ctx, String action, int requestCode) {
        Intent i = new Intent(ctx, WorkoutAlarmReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(ctx, requestCode, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
