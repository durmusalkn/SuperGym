package com.supergym.app;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.genai.common.DownloadCallback;
import com.google.mlkit.genai.common.FeatureStatus;
import com.google.mlkit.genai.common.GenAiException;
import com.google.mlkit.genai.prompt.Candidate;
import com.google.mlkit.genai.prompt.GenerateContentResponse;
import com.google.mlkit.genai.prompt.Generation;
import com.google.mlkit.genai.prompt.GenerativeModel;
import com.google.mlkit.genai.prompt.java.GenerativeModelFutures;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import kotlin.Result;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.CoroutineContext;
import kotlin.coroutines.EmptyCoroutineContext;
import kotlin.coroutines.intrinsics.IntrinsicsKt;

/**
 * Gemini Nano: telefonun içinde çalışan model (ML Kit GenAI Prompt API, AICore).
 * İnternet ve anahtar gerekmez; yalnızca destekleyen telefonlarda çalışır.
 * Sonuçlar arayüze JSON olarak gönderilir (bkz. web/src/coach.js window.onNano).
 */
final class Nano {
    interface Listener {
        void send(JSONObject message);
    }

    private static final Executor executor = Executors.newSingleThreadExecutor();
    private static GenerativeModel model;

    private Nano() {}

    private static synchronized GenerativeModel model() {
        if (model == null) model = Generation.INSTANCE.getClient();
        return model;
    }

    /** Modelin durumu: available, downloadable, downloading, unavailable (+ model adı). */
    static void status(Listener l) {
        try {
            GenerativeModel m = model();
            await(m::checkStatus, (Integer status, Throwable err) -> {
                if (err != null) {
                    l.send(message("status", "status", "error", "error", describe(err)));
                    return;
                }
                String s = statusName(status);
                if (!"available".equals(s)) {
                    l.send(message("status", "status", s));
                    return;
                }
                await(m::getBaseModelName, (String name, Throwable e) ->
                        l.send(message("status", "status", s, "model", name == null ? "" : name)));
            });
        } catch (Throwable e) {
            l.send(message("status", "status", "error", "error", describe(e)));
        }
    }

    static void download(Listener l) {
        try {
            GenerativeModelFutures.from(model()).download(new DownloadCallback() {
                @Override
                public void onDownloadProgress(long bytes) {
                    l.send(message("progress", "bytes", bytes));
                }

                @Override
                public void onDownloadCompleted() {
                    l.send(message("downloaded"));
                }

                @Override
                public void onDownloadFailed(GenAiException e) {
                    l.send(message("status", "status", "error", "error", describe(e)));
                }
            });
        } catch (Throwable e) {
            l.send(message("status", "status", "error", "error", describe(e)));
        }
    }

    static void ask(String prompt, Listener l) {
        try {
            ListenableFuture<GenerateContentResponse> f = GenerativeModelFutures.from(model()).generateContent(prompt);
            f.addListener(() -> {
                try {
                    List<Candidate> candidates = f.get().getCandidates();
                    String text = candidates.isEmpty() ? null : candidates.get(0).getText();
                    if (text == null || text.trim().isEmpty()) l.send(message("error", "error", "Model boş cevap döndü"));
                    else l.send(message("answer", "text", text.trim()));
                } catch (Throwable e) {
                    l.send(message("error", "error", describe(e)));
                }
            }, executor);
        } catch (Throwable e) {
            l.send(message("error", "error", describe(e)));
        }
    }

    private static String statusName(Integer s) {
        if (s == null) return "unavailable";
        if (s == FeatureStatus.AVAILABLE) return "available";
        if (s == FeatureStatus.DOWNLOADABLE) return "downloadable";
        if (s == FeatureStatus.DOWNLOADING) return "downloading";
        return "unavailable";
    }

    private static String describe(Throwable e) {
        while (e.getCause() != null && !(e instanceof GenAiException)) e = e.getCause();
        String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        if (e instanceof GenAiException) msg += " (kod " + ((GenAiException) e).getErrorCode() + ")";
        return msg;
    }

    private static JSONObject message(String type, Object... kv) {
        JSONObject o = new JSONObject();
        try {
            o.put("type", type);
            for (int i = 0; i + 1 < kv.length; i += 2) o.put((String) kv[i], kv[i + 1]);
        } catch (JSONException ignored) {
            // anahtarlar sabit; olmaz
        }
        return o;
    }

    // --- Kotlin suspend fonksiyonlarını Java'dan çağırmak ---
    // ML Kit'in Java sarmalayıcısında (GenerativeModelFutures) checkStatus ve
    // getBaseModelName yok; bunlar Kotlin suspend fonksiyonu. Bir Continuation verilerek
    // çağrılır: ya sonucu hemen döner ya da COROUTINE_SUSPENDED döner ve sonra resumeWith
    // ile sonuçlanır.

    private interface Suspend<T> {
        Object call(Continuation<T> c);
    }

    private interface Done<T> {
        void accept(T value, Throwable error);
    }

    @SuppressWarnings("unchecked")
    private static <T> void await(Suspend<T> fn, Done<T> done) {
        Continuation<T> c = new Continuation<T>() {
            @Override
            public CoroutineContext getContext() {
                return EmptyCoroutineContext.INSTANCE;
            }

            @Override
            public void resumeWith(Object result) {
                if (result instanceof Result.Failure) done.accept(null, ((Result.Failure) result).exception);
                else done.accept((T) result, null);
            }
        };
        try {
            Object r = fn.call(c);
            if (r != IntrinsicsKt.getCOROUTINE_SUSPENDED()) c.resumeWith(r);
        } catch (Throwable e) {
            done.accept(null, e);
        }
    }
}
