package com.supergym.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/**
 * Arayüzün Android tarafıyla paylaştığı bilgiler (antrenman yapılan günler, alarmlar ve
 * hatırlatma ayarları). Alarmlar, hatırlatmalar ve ana ekran widget'ı uygulama kapalıyken
 * bunları kullanır.
 */
final class NativeState {
    private NativeState() {
    }

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences("supergym", Context.MODE_PRIVATE);
    }

    /**
     * Arayüzden gelen JSON: {attended: [...], reminderTime, inactiveDays, prepMinutes,
     * snoozeMinutes, alarms: [{day, time, templateId, program, exercises: [...]}],
     * plans: {"YYYY-AA-GG": [hareket adları]}}.
     */
    static void save(Context ctx, String json) throws JSONException {
        JSONObject o = new JSONObject(json);
        JSONArray alarms = o.optJSONArray("alarms");
        JSONObject plans = o.optJSONObject("plans");
        prefs(ctx).edit()
                .putString("attended", join(o.getJSONArray("attended")))
                .putString("reminder_time", o.optString("reminderTime", "18:00"))
                .putInt("inactive_days", o.optInt("inactiveDays", 0))
                .putString("alarms", alarms != null ? alarms.toString() : "[]")
                .putString("plans", plans != null ? plans.toString() : "{}")
                .putInt("prep_minutes", o.optInt("prepMinutes", 0))
                .putInt("snooze_minutes", o.optInt("snoozeMinutes", 10))
                .remove("reminder_days")
                .commit();
    }

    private static String join(JSONArray a) throws JSONException {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < a.length(); i++) {
            if (i > 0) b.append(',');
            b.append(a.getString(i));
        }
        return b.toString();
    }

    static Set<String> split(String s) {
        Set<String> out = new HashSet<>();
        if (s == null || s.isEmpty()) return out;
        for (String part : s.split(",")) out.add(part.trim());
        return out;
    }

    static Set<String> attended(Context ctx) {
        return split(prefs(ctx).getString("attended", ""));
    }

    static String alarms(Context ctx) {
        return prefs(ctx).getString("alarms", "[]");
    }

    /**
     * O gün antrenmana önceden girilen hareketlerin adları (Antrenman sekmesinde o güne
     * eklenenler); girilmemişse boş liste.
     */
    static List<String> planFor(Context ctx, String date) {
        List<String> out = new ArrayList<>();
        try {
            JSONArray a = new JSONObject(prefs(ctx).getString("plans", "{}")).optJSONArray(date);
            for (int i = 0; a != null && i < a.length(); i++) out.add(a.getString(i));
        } catch (JSONException ignored) {
            // bozuk veri: plan yok sayılır
        }
        return out;
    }

    static int prepMinutes(Context ctx) {
        return prefs(ctx).getInt("prep_minutes", 0);
    }

    static int snoozeMinutes(Context ctx) {
        return Math.max(1, prefs(ctx).getInt("snooze_minutes", 10));
    }

    static String reminderTime(Context ctx) {
        return prefs(ctx).getString("reminder_time", "18:00");
    }

    static int inactiveDays(Context ctx) {
        return prefs(ctx).getInt("inactive_days", 0);
    }

    // --- Tarih hesapları (YYYY-AA-GG, telefonun saatine göre) ---

    static String today() {
        return date(System.currentTimeMillis());
    }

    /** Verilen anın tarihi (YYYY-AA-GG, telefonun saatine göre). */
    static String date(long millis) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(millis);
        return String.format(Locale.US, "%04d-%02d-%02d",
                c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    /** 1970-01-01'den bu yana geçen gün sayısı. */
    static long epochDay(String date) {
        String[] p = date.split("-");
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.clear();
        c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
        return c.getTimeInMillis() / 86_400_000L;
    }

    /** Haftanın pazartesisi (1970-01-01 perşembedir). */
    static long weekStart(long day) {
        return day - Math.floorMod(day + 3, 7);
    }

    static Set<Long> days(Set<String> dates) {
        Set<Long> out = new HashSet<>();
        for (String d : dates) {
            try {
                out.add(epochDay(d));
            } catch (RuntimeException ignored) {
                // geçersiz tarih atlanır
            }
        }
        return out;
    }

    static int countInWeek(Set<Long> days, long weekStart) {
        int n = 0;
        for (long d = weekStart; d < weekStart + 7; d++) if (days.contains(d)) n++;
        return n;
    }

    /** Art arda en az bir gün gidilen hafta sayısı; bu hafta henüz boşsa seriyi bozmaz. */
    static int streakWeeks(Set<Long> days, long today) {
        long week = weekStart(today);
        if (countInWeek(days, week) == 0) week -= 7;
        int streak = 0;
        while (countInWeek(days, week) > 0) {
            streak++;
            week -= 7;
        }
        return streak;
    }

    /** Son antrenmandan bu yana geçen gün; hiç yoksa -1. */
    static long daysSinceLast(Set<Long> days, long today) {
        long last = Long.MIN_VALUE;
        for (long d : days) if (d <= today && d > last) last = d;
        return last == Long.MIN_VALUE ? -1 : today - last;
    }
}
