package com.supergym.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import mobile.Mobile;

public class MainActivity extends Activity {
    private static final int REQUEST_IMPORT = 1;
    private static final int REQUEST_EXPORT = 2;

    private static final int REQUEST_PERMISSION = 3;

    private static boolean visible;

    private WebView webView;
    private ValueCallback<Uri[]> importCallback;
    private String pendingExport;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String url;
        try {
            // Go sunucusu telefonun içinde, uygulamanın kendi klasöründeki verilerle başlar.
            url = Mobile.start(getFilesDir().getAbsolutePath());
        } catch (Exception e) {
            Toast.makeText(this, "Başlatılamadı: " + e.getMessage(), Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        Notifications.createChannels(this);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            // İçe aktar: <input type="file"> için telefonun dosya seçicisini açar.
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (importCallback != null) importCallback.onReceiveValue(null);
                importCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                // Alarm resmi için yalnızca resimler; yedek için her dosya (JSON türü
                // telefonlarda tutarlı tanınmadığından).
                boolean image = false;
                for (String t : params.getAcceptTypes()) if (t != null && t.startsWith("image/")) image = true;
                intent.setType(image ? "image/*" : "*/*");
                startActivityForResult(intent, REQUEST_IMPORT);
                return true;
            }
        });
        webView.addJavascriptInterface(new Bridge(), "SuperGymAndroid");

        // Android 15'te uygulama ekranın tamamına çizilir; durum çubuğu, alt gezinme
        // çubuğu ve klavye kadar boşluk bırakılmazsa arayüz bunların altında kalır.
        FrameLayout root = new FrameLayout(this);
        root.addView(webView);
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(root);

        // Kaydedilmiş sayfa durumu geri yüklenmez: uygulama kapanıp açıldığında sunucu
        // yeni bir anahtarla başlar, eski adres artık geçersizdir.
        webView.loadUrl(url);
        handleAlarmIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (handleAlarmIntent(intent) && webView != null) {
            webView.evaluateJavascript("window.onAlarmStart && window.onAlarmStart()", null);
        }
    }

    /** Alarm bildirimindeki "Antrenmana girdim": alarmı susturur, programı açtırır. */
    private boolean handleAlarmIntent(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(WorkoutAlarms.EXTRA_ENTERED, false)) return false;
        intent.removeExtra(WorkoutAlarms.EXTRA_ENTERED);
        WorkoutAlarms.entered(this);
        return true;
    }

    /** Uygulama şu an ekranda mı? (Dinlenme bitince bildirim yerine sadece titreşim için.) */
    static boolean isVisible() {
        return visible;
    }

    @Override
    protected void onResume() {
        super.onResume();
        visible = true;
        // Arka plandayken sayaç bitmiş ya da bildirimden durdurulmuş olabilir.
        if (webView != null) webView.evaluateJavascript("window.onAppResume && window.onAppResume()", null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        visible = false;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Uri uri = (resultCode == RESULT_OK && data != null) ? data.getData() : null;

        if (requestCode == REQUEST_IMPORT && importCallback != null) {
            importCallback.onReceiveValue(uri != null ? new Uri[]{uri} : null);
            importCallback = null;
        } else if (requestCode == REQUEST_EXPORT && pendingExport != null) {
            boolean ok = false;
            if (uri != null) {
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    out.write(pendingExport.getBytes(StandardCharsets.UTF_8));
                    ok = true;
                } catch (Exception ignored) {
                }
            }
            pendingExport = null;
            if (uri != null) webView.evaluateJavascript("window.onExportDone(" + ok + ")", null);
        }
    }

    private void openSettings(Intent intent) {
        runOnUiThread(() -> {
            try {
                startActivity(intent);
            } catch (Exception e) {
                // Bu ekran telefonda yoksa uygulama ayarları açılır.
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getPackageName())));
            }
        });
    }

    /** Arayüzden (JavaScript) çağrılan köprü. */
    private class Bridge {
        // Dışa aktar: telefonun "dosyayı kaydet" ekranını açar.
        @JavascriptInterface
        public void exportFile(String fileName, String content) {
            runOnUiThread(() -> {
                pendingExport = content;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, fileName);
                startActivityForResult(intent, REQUEST_EXPORT);
            });
        }

        @JavascriptInterface
        public void vibrate(long ms) {
            RestTimer.vibrate(MainActivity.this, ms);
        }

        // Dinlenme sayacı: bitiş zamanı (epoch ms) Android alarmına kurulur, böylece
        // uygulama kapalıyken ya da ekran kilitliyken de bitince haber verir.
        @JavascriptInterface
        public void startRest(long endMillis) {
            RestTimer.start(MainActivity.this, endMillis);
        }

        @JavascriptInterface
        public void cancelRest() {
            RestTimer.cancel(MainActivity.this);
        }

        @JavascriptInterface
        public long restEndsAt() {
            return RestTimer.endsAt(MainActivity.this);
        }

        // Android 13+ bildirim izni (dinlenme sayacı ve hatırlatmalar için).
        @JavascriptInterface
        public void requestNotifications() {
            if (Build.VERSION.SDK_INT < 33 || Notifications.allowed(MainActivity.this)) return;
            runOnUiThread(() -> requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_PERMISSION));
        }

        // Otomatik yedek: başarılıysa true. Android 9 ve öncesinde izin yoksa izin ister
        // ve false döner (bir sonraki açılışta tekrar denenir).
        @JavascriptInterface
        public boolean autoBackup(String fileName, String content) {
            if (Backup.needsPermission(MainActivity.this)) {
                runOnUiThread(() -> requestPermissions(
                        new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQUEST_PERMISSION));
                return false;
            }
            return Backup.write(MainActivity.this, fileName, content);
        }

        // Antrenman günleri ve hatırlatma ayarları: hatırlatmalar ve widget uygulama
        // kapalıyken bunları kullanır.
        @JavascriptInterface
        public void syncState(String json) {
            try {
                NativeState.save(MainActivity.this, json);
            } catch (Exception e) {
                return;
            }
            Reminders.schedule(MainActivity.this);
            WorkoutAlarms.schedule(MainActivity.this);
            WidgetProvider.updateAll(MainActivity.this);
        }

        // --- Antrenman alarmı ---

        @JavascriptInterface
        public boolean setAlarmImage(String base64) {
            return AlarmImage.save(MainActivity.this, base64);
        }

        @JavascriptInterface
        public String alarmImage() {
            return AlarmImage.dataUrl(MainActivity.this);
        }

        @JavascriptInterface
        public void clearAlarmImage() {
            AlarmImage.clear(MainActivity.this);
        }

        @JavascriptInterface
        public void testAlarm() {
            WorkoutAlarms.test(MainActivity.this);
        }

        // Alarm ekranında "Antrenmana girdim" denildiyse {templateId}, yoksa boş.
        @JavascriptInterface
        public String takeAlarmStart() {
            return WorkoutAlarms.takeStart(MainActivity.this);
        }

        @JavascriptInterface
        public boolean fullScreenAllowed() {
            return Notifications.fullScreenAllowed(MainActivity.this);
        }

        @JavascriptInterface
        public void openFullScreenSettings() {
            if (Build.VERSION.SDK_INT < 34) return;
            openSettings(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                    Uri.parse("package:" + getPackageName())));
        }

        @JavascriptInterface
        public boolean exactAlarmsAllowed() {
            return Alarms.exactAllowed(MainActivity.this);
        }

        @JavascriptInterface
        public void openExactAlarmSettings() {
            if (Build.VERSION.SDK_INT < 31) return;
            openSettings(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + getPackageName())));
        }

        @JavascriptInterface
        public boolean notificationsAllowed() {
            return Notifications.allowed(MainActivity.this);
        }

        // Dinlenme sayacı çalışırken ekran kararmasın.
        @JavascriptInterface
        public void keepScreenOn(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
    }
}
