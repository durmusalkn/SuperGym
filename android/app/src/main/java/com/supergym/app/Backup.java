package com.supergym.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Otomatik yedek: telefonun İndirilenler/SuperGym klasörüne yazılır. Bu klasör uygulama
 * silinse de kalır; en yeni KEEP yedek tutulur, eskileri silinir.
 */
final class Backup {
    static final String PREFIX = "supergym-otomatik-";
    private static final String FOLDER = "SuperGym";
    private static final int KEEP = 8;

    private Backup() {
    }

    /** Android 9 ve öncesinde depolama izni gerekir. */
    static boolean needsPermission(Context ctx) {
        return Build.VERSION.SDK_INT < 29
                && ctx.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED;
    }

    static boolean write(Context ctx, String name, String content) {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                writeMediaStore(ctx, name, bytes);
            } else {
                writeLegacy(name, bytes);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static void writeMediaStore(Context ctx, String name, byte[] bytes) throws Exception {
        ContentResolver r = ctx.getContentResolver();
        Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
        String relPath = Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER + "/";

        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, relPath);
        v.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = r.insert(collection, v);
        if (uri == null) throw new IllegalStateException("dosya oluşturulamadı");
        try (OutputStream out = r.openOutputStream(uri)) {
            if (out == null) throw new IllegalStateException("dosya açılamadı");
            out.write(bytes);
        } catch (Exception e) {
            r.delete(uri, null, null);
            throw e;
        }
        v.clear();
        v.put(MediaStore.MediaColumns.IS_PENDING, 0);
        r.update(uri, v, null, null);

        // Eski otomatik yedekleri sil (uygulama yalnızca kendi oluşturduklarını görür).
        try (Cursor c = r.query(collection, new String[]{MediaStore.MediaColumns._ID},
                MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?",
                new String[]{relPath, PREFIX + "%"},
                MediaStore.MediaColumns.DATE_ADDED + " DESC")) {
            int n = 0;
            while (c != null && c.moveToNext()) {
                if (++n > KEEP) r.delete(ContentUris.withAppendedId(collection, c.getLong(0)), null, null);
            }
        }
    }

    @SuppressWarnings("deprecation")
    private static void writeLegacy(String name, byte[] bytes) throws Exception {
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), FOLDER);
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("klasör oluşturulamadı");
        try (FileOutputStream out = new FileOutputStream(new File(dir, name))) {
            out.write(bytes);
        }
        File[] old = dir.listFiles((d, n) -> n.startsWith(PREFIX));
        if (old != null && old.length > KEEP) {
            Arrays.sort(old, (a, b) -> b.getName().compareTo(a.getName()));
            for (int i = KEEP; i < old.length; i++) old[i].delete();
        }
    }
}
