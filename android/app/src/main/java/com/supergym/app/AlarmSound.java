package com.supergym.app;

import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;

import java.io.InputStream;
import java.io.OutputStream;

/**
 * Antrenman alarmının sesi. Seçilen ses SharedPreferences'ta tutulur (yedeğe girmez).
 *
 * Android 8+ bildirim kanalının sesi kanal oluşturulduktan sonra değiştirilemez; ses
 * değişince eski kanal silinir ve yeni sürüm numarasıyla yeni kanal açılır.
 */
final class AlarmSound {
    private static final String KEY_URI = "alarm_sound";
    private static final String KEY_CHANNEL = "alarm_channel_ver";
    /** Kendi dosyası için üst sınır (MB). */
    static final int MAX_FILE_MB = 20;

    private AlarmSound() {
    }

    /** Seçili ses; seçilmemişse telefonun varsayılan alarm sesi. */
    static Uri uri(Context ctx) {
        String s = NativeState.prefs(ctx).getString(KEY_URI, "");
        return s.isEmpty() ? Notifications.alarmSound() : Uri.parse(s);
    }

    static boolean isDefault(Context ctx) {
        return NativeState.prefs(ctx).getString(KEY_URI, "").isEmpty();
    }

    /** Alarm bildirim kanalının şu anki kimliği. */
    static String channel(Context ctx) {
        int v = NativeState.prefs(ctx).getInt(KEY_CHANNEL, 0);
        return v == 0 ? Notifications.CH_ALARM : Notifications.CH_ALARM + "_" + v;
    }

    /** Sesi değiştirir; null telefonun varsayılan alarm sesine döner. */
    static void set(Context ctx, Uri uri) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            nm.deleteNotificationChannel(channel(ctx));
        }
        int v = NativeState.prefs(ctx).getInt(KEY_CHANNEL, 0);
        NativeState.prefs(ctx).edit()
                .putString(KEY_URI, uri == null ? "" : uri.toString())
                .putInt(KEY_CHANNEL, v + 1)
                .commit();
        Notifications.createChannels(ctx);
    }

    /** Arayüzde gösterilecek ad (örn. "Oxygen"). */
    static String title(Context ctx) {
        if (isDefault(ctx)) return "Varsayılan alarm sesi";
        try {
            Ringtone r = RingtoneManager.getRingtone(ctx, uri(ctx));
            String t = r != null ? r.getTitle(ctx) : null;
            return t != null && !t.isEmpty() ? t : "Seçilen ses";
        } catch (Exception e) {
            return "Seçilen ses";
        }
    }

    /** Telefondan seçilen müzik dosyası kullanılabilir mi? (Android 10+.) */
    static boolean fileSupported() {
        return Build.VERSION.SDK_INT >= 29;
    }

    /**
     * Telefondan seçilen ses dosyasını Alarms/SuperGym klasörüne kopyalar ve alarm sesi
     * yapar. Kopyalanır, çünkü bildirimi çalan sistem seçilen dosyanın kendisini
     * okuyamayabilir; Alarms klasöründeki ses ise telefonun ses listesinde de görünür.
     */
    static boolean importFile(Context ctx, Uri src) {
        if (Build.VERSION.SDK_INT < 29) return false;
        ContentResolver r = ctx.getContentResolver();
        String name = "SuperGym alarmı";
        long size = -1;
        try (Cursor c = r.query(src, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                if (!c.isNull(0)) name = c.getString(0);
                if (!c.isNull(1)) size = c.getLong(1);
            }
        } catch (Exception ignored) {
            // ad ve boyut bilinmiyorsa varsayılanla devam
        }
        if (size > MAX_FILE_MB * 1024L * 1024L) return false;
        String mime = r.getType(src);
        if (mime == null || !mime.startsWith("audio/")) mime = "audio/mpeg";

        ContentValues v = new ContentValues();
        v.put(MediaStore.Audio.Media.DISPLAY_NAME, name);
        v.put(MediaStore.Audio.Media.MIME_TYPE, mime);
        v.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_ALARMS + "/SuperGym/");
        v.put(MediaStore.Audio.Media.IS_ALARM, 1);
        v.put(MediaStore.Audio.Media.IS_PENDING, 1);
        Uri dst = null;
        try {
            dst = r.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, v);
            if (dst == null) return false;
            long total = 0;
            try (InputStream in = r.openInputStream(src); OutputStream out = r.openOutputStream(dst)) {
                if (in == null || out == null) throw new IllegalStateException("dosya açılamadı");
                byte[] buf = new byte[65536];
                for (int n; (n = in.read(buf)) > 0; ) {
                    total += n;
                    if (total > MAX_FILE_MB * 1024L * 1024L) throw new IllegalStateException("dosya çok büyük");
                    out.write(buf, 0, n);
                }
            }
            v.clear();
            v.put(MediaStore.Audio.Media.IS_PENDING, 0);
            r.update(dst, v, null, null);
        } catch (Exception e) {
            if (dst != null) r.delete(dst, null, null);
            return false;
        }
        set(ctx, dst);
        return true;
    }
}
