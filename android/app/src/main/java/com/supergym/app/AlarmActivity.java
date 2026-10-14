package com.supergym.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Gitme saatinde kilit ekranının üstünde açılan tam ekran alarm: yüklenen resim,
 * "Antrenmana girdim", "Ertele" ve "Bugün gitmiyorum".
 */
public class AlarmActivity extends Activity {
    private static final int INK = 0xFF15121F;
    private static final int CORAL = 0xFFFF8A6B;
    private static final int TEXT = 0xFFEEEAF6;
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

        Bitmap image = AlarmImage.load(this, 1440);
        if (image != null) {
            ImageView iv = new ImageView(this);
            iv.setImageBitmap(image);
            iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
            iv.setContentDescription("Alarm resmi");
            root.addView(iv, new FrameLayout.LayoutParams(-1, -1));
            // Yazılar okunsun diye alttan koyulaşan gölge.
            View shade = new View(this);
            shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                    new int[]{Color.TRANSPARENT, 0x9915121F, 0xF215121F}));
            root.addView(shade, new FrameLayout.LayoutParams(-1, -1));
        } else {
            TextView emoji = new TextView(this);
            emoji.setText("💪");
            emoji.setTextSize(96);
            emoji.setGravity(Gravity.CENTER);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-1, -1);
            lp.bottomMargin = dp(260);
            root.addView(emoji, lp);
        }

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(24), dp(24), dp(24), dp(40));
        FrameLayout.LayoutParams plp = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM);
        root.addView(panel, plp);

        String time = WorkoutAlarms.ringTime(this);
        String program = WorkoutAlarms.ringProgram(this);

        TextView clock = text(time, 56, TEXT, true);
        panel.addView(clock);
        panel.addView(text("Antrenman vakti!", 28, TEXT, true));
        panel.addView(text(program.isEmpty() ? "Salona gitme zamanı." : "Bugün " + program + ". Salona gitme zamanı.", 17, MUTED, false));

        Button go = button("Antrenmana girdim", CORAL, INK);
        go.setOnClickListener(v -> enteredGym());
        LinearLayout.LayoutParams glp = new LinearLayout.LayoutParams(-1, dp(64));
        glp.topMargin = dp(28);
        panel.addView(go, glp);

        Button snooze = button("Ertele (" + NativeState.snoozeMinutes(this) + " dk)", 0x33EEEAF6, TEXT);
        snooze.setOnClickListener(v -> {
            WorkoutAlarms.snooze(this);
            finish();
        });
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(-1, dp(56));
        slp.topMargin = dp(12);
        panel.addView(snooze, slp);

        Button skip = button("Bugün gitmiyorum", Color.TRANSPARENT, MUTED);
        skip.setOnClickListener(v -> {
            WorkoutAlarms.stop(this);
            finish();
        });
        LinearLayout.LayoutParams klp = new LinearLayout.LayoutParams(-1, dp(48));
        klp.topMargin = dp(4);
        panel.addView(skip, klp);

        setContentView(root);
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setShadowLayer(8, 0, 2, 0x99000000);
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
        shape.setCornerRadius(dp(32));
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
