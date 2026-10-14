package com.supergym.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Insets;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.Animation;
import android.view.animation.ScaleAnimation;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Gitme saatinde kilit ekranının (ve izin verildiyse diğer uygulamaların) üstünde açılan
 * tam ekran alarm: ekranı kaplayan fotoğraf, "Ertele" ve "Antrenmana girdim". Alarmı
 * yalnızca "Antrenmana girdim" (ya da o gün set girmek) tamamen susturur.
 */
public class AlarmActivity extends Activity {
    private static final int INK = 0xFF15121F;
    private static final int CORAL = 0xFFFF8A6B;
    private static final int TEXT = 0xFFFFFFFF;
    private static final int MUTED = 0xFFA39DB8;

    private boolean leaving; // "girdim" sonrası kilit açma bekleniyor

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showOverLockScreen();
        build();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        build();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Alarm bu arada başka yerden susturulduysa (bildirimden "girdim" vb.) ekranı kapat.
        if (!leaving && !WorkoutAlarms.ringing(this)) finish();
    }

    @SuppressWarnings("deprecation")
    private void showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private void build() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(INK);

        // Fotoğraf ekranın tamamını kaplar ve yavaşça yakınlaşıp uzaklaşır; yazılar ve
        // düğmeler yalnızca üst ve alt kenarda, fotoğrafın üstünü kapatmadan durur.
        Bitmap image = AlarmImage.load(this, 1440);
        if (image != null) {
            ImageView iv = new ImageView(this);
            iv.setImageBitmap(image);
            iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
            iv.setContentDescription("Alarm resmi");
            root.addView(iv, new FrameLayout.LayoutParams(-1, -1));
            ScaleAnimation zoom = new ScaleAnimation(1f, 1.08f, 1f, 1.08f,
                    Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f);
            zoom.setDuration(6000);
            zoom.setRepeatMode(Animation.REVERSE);
            zoom.setRepeatCount(Animation.INFINITE);
            zoom.setInterpolator(new AccelerateDecelerateInterpolator());
            iv.startAnimation(zoom);
        } else {
            TextView hint = text("Plan › Antrenman alarmları'ndan bir fotoğraf ekle", 15, MUTED, false);
            hint.setGravity(Gravity.CENTER);
            hint.setPadding(dp(32), 0, dp(32), 0);
            root.addView(hint, new FrameLayout.LayoutParams(-1, -1));
        }

        // Üst kenar: saat ve program, ince bir gölge üzerinde.
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.VERTICAL);
        top.setPadding(dp(24), dp(20), dp(24), dp(40));
        top.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{0x8015121F, Color.TRANSPARENT}));
        String time = WorkoutAlarms.ringTime(this);
        String program = WorkoutAlarms.ringProgram(this);
        top.addView(text(time, 40, TEXT, true));
        top.addView(text(program.isEmpty() ? "Antrenman vakti" : "Antrenman vakti · " + program, 16, TEXT, false));
        root.addView(top, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));

        // Alt kenar: yan yana iki düğme.
        LinearLayout bottom = new LinearLayout(this);
        bottom.setOrientation(LinearLayout.HORIZONTAL);
        bottom.setPadding(dp(16), dp(48), dp(16), dp(24));
        bottom.setBackground(new GradientDrawable(GradientDrawable.Orientation.BOTTOM_TOP,
                new int[]{0x9915121F, Color.TRANSPARENT}));

        Button snooze = button("Ertele " + NativeState.snoozeMinutes(this) + " dk", 0x66000000, TEXT);
        snooze.setOnClickListener(v -> {
            WorkoutAlarms.snooze(this);
            finish();
        });
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(0, dp(60), 1f);
        slp.rightMargin = dp(10);
        bottom.addView(snooze, slp);

        Button go = button("Antrenmana girdim", CORAL, INK);
        go.setOnClickListener(v -> enteredGym());
        bottom.addView(go, new LinearLayout.LayoutParams(0, dp(60), 1.6f));
        root.addView(bottom, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM));

        // Android 15'te ekran kenardan kenaradır: fotoğraf sistem çubuklarının altına da
        // uzanır, yazılar ve düğmeler çubuklar kadar içeride kalır.
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                top.setPadding(dp(24), dp(20) + bars.top, dp(24), dp(40));
                bottom.setPadding(dp(16), dp(48), dp(16), dp(24) + bars.bottom);
                return insets;
            });
        }

        setContentView(root);
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setShadowLayer(10, 0, 2, 0xB3000000);
        return t;
    }

    private Button button(String label, int bg, int fg) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(17);
        b.setTextColor(fg);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(bg);
        shape.setCornerRadius(dp(30));
        b.setBackground(shape);
        b.setStateListAnimator(null);
        return b;
    }

    /** Alarm susar; kilit açılınca uygulama o günün programıyla açılır. */
    private void enteredGym() {
        leaving = true;
        WorkoutAlarms.entered(this);
        Runnable open = () -> {
            startActivity(new Intent(this, MainActivity.class)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP));
            finish();
        };
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && km != null && km.isKeyguardLocked()) {
            km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                @Override
                public void onDismissSucceeded() {
                    open.run();
                }

                @Override
                public void onDismissCancelled() {
                    finish();
                }

                @Override
                public void onDismissError() {
                    finish();
                }
            });
        } else {
            open.run();
        }
    }
}
