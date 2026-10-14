package com.supergym.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
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
                intent.setType("*/*");
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

        // Dinlenme sayacı bitince telefonu titretir.
        @JavascriptInterface
        public void vibrate(long ms) {
            Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= 26) {
                vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(ms);
            }
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
