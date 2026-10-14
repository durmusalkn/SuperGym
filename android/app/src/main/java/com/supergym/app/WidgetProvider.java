package com.supergym.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;

import java.util.Set;

/** Ana ekran widget'ı: bu hafta kaç gün gidildiği, hafta serisi ve son antrenman. */
public class WidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager manager, int[] ids) {
        manager.updateAppWidget(ids, views(ctx));
    }

    static void updateAll(Context ctx) {
        AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
        if (manager == null) return;
        int[] ids = manager.getAppWidgetIds(new ComponentName(ctx, WidgetProvider.class));
        if (ids.length > 0) manager.updateAppWidget(ids, views(ctx));
    }

    private static RemoteViews views(Context ctx) {
        Set<Long> days = NativeState.days(NativeState.attended(ctx));
        long today = NativeState.epochDay(NativeState.today());
        int week = NativeState.countInWeek(days, NativeState.weekStart(today));
        int streak = NativeState.streakWeeks(days, today);
        long since = NativeState.daysSinceLast(days, today);

        String last;
        if (since < 0) last = "—";
        else if (since == 0) last = "Bugün";
        else if (since == 1) last = "Dün";
        else last = since + " gün önce";

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget);
        v.setTextViewText(R.id.widget_week, week + " gün");
        v.setTextViewText(R.id.widget_streak, streak + " hafta" + (streak >= 2 ? " 🔥" : ""));
        v.setTextViewText(R.id.widget_last, last);
        v.setOnClickPendingIntent(R.id.widget_root, Notifications.openApp(ctx));
        return v;
    }
}
