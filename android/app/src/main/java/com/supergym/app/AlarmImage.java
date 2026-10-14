package com.supergym.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;

/**
 * Alarm çalınca gösterilen resim. Uygulamanın kendi klasöründe durur; yedeğe girmez,
 * telefondan dışarı çıkmaz.
 */
final class AlarmImage {
    private static final String NAME = "alarm_image.jpg";

    private AlarmImage() {
    }

    private static File file(Context ctx) {
        return new File(ctx.getFilesDir(), NAME);
    }

    /** Arayüzden gelen JPEG (base64). Resim olarak açılamıyorsa kaydedilmez. */
    static boolean save(Context ctx, String base64) {
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o);
            if (o.outWidth <= 0 || o.outHeight <= 0) return false;
            File tmp = new File(ctx.getFilesDir(), NAME + ".tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(bytes);
                out.getFD().sync();
            }
            return tmp.renameTo(file(ctx));
        } catch (Exception e) {
            return false;
        }
    }

    static void clear(Context ctx) {
        //noinspection ResultOfMethodCallIgnored
        file(ctx).delete();
    }

    /** Arayüzde önizleme için data URL; resim yoksa boş. */
    static String dataUrl(Context ctx) {
        File f = file(ctx);
        if (!f.isFile()) return "";
        try (FileInputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream((int) f.length());
            byte[] buf = new byte[16384];
            for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
            return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }

    /** En uzun kenarı en fazla maxSide piksel olacak şekilde küçültülmüş resim; yoksa null. */
    static Bitmap load(Context ctx, int maxSide) {
        File f = file(ctx);
        if (!f.isFile()) return null;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(f.getPath(), o);
        int sample = 1;
        while (Math.max(o.outWidth, o.outHeight) / (sample * 2) >= maxSide) sample *= 2;
        o = new BitmapFactory.Options();
        o.inSampleSize = sample;
        try {
            return BitmapFactory.decodeFile(f.getPath(), o);
        } catch (OutOfMemoryError e) {
            return null;
        }
    }
}
