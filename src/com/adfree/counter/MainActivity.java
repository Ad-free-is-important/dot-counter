package com.adfree.counter;

import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.HapticFeedbackConstants;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;
    private FrameLayout root;
    private volatile boolean destroyed;
    private String exportPayload;
    private String appearance = "system";
    private static final int EXPORT = 41, IMPORT = 42;
    private static final int MAX_BYTES = 4000000;
    private static final String ORIGIN = "https://counter.local/";

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        root = new FrameLayout(this);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this);
        WebSettings config = web.getSettings();
        config.setJavaScriptEnabled(true);
        config.setDomStorageEnabled(true);
        config.setAllowFileAccess(false);
        config.setAllowContentAccess(false);
        config.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        config.setSupportMultipleWindows(false);
        config.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= 33) config.setAlgorithmicDarkeningAllowed(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "CounterNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                String path = uri.getPath();
                if (!"https".equals(uri.getScheme()) || !"counter.local".equals(uri.getHost())) return empty(403, "Forbidden");
                if (path == null || path.equals("/")) path = "/index.html";
                if (!path.matches("/[A-Za-z0-9_.-]+")) return empty(404, "Not Found");
                try {
                    String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css" : "text/plain";
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open(path.substring(1)));
                } catch (IOException ex) { return empty(404, "Not Found"); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        applyAppearance(getSharedPreferences("counter", MODE_PRIVATE).getString("theme", "system"));
        root.requestApplyInsets();
        web.loadUrl(ORIGIN);
    }
    private WebResourceResponse empty(int code, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", code, reason, null, new ByteArrayInputStream(new byte[0]));
    }
    private boolean isDark() {
        return "dark".equals(appearance) || ("system".equals(appearance) && (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
    }
    private void applyAppearance(String mode) {
        appearance = mode;
        boolean dark = isDark();
        int bg = Color.parseColor(dark ? "#111217" : "#F6F5FA");
        root.setBackgroundColor(bg);
        web.setBackgroundColor(bg);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);
        int flags = getWindow().getDecorView().getSystemUiVisibility();
        int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(dark ? flags & ~light : flags | light);
    }
    private void eval(String script) { if (!destroyed) web.evaluateJavascript(script, null); }
    private void message(String msg) {
        runOnUiThread(() -> { if (!destroyed) Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show(); });
    }
    public class Bridge {
        @JavascriptInterface public boolean systemDark() { return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES; }
        @JavascriptInterface public String load() { return getSharedPreferences("counter", MODE_PRIVATE).getString("state", ""); }
        @JavascriptInterface public boolean save(String data) {
            if (data == null || data.length() > MAX_BYTES || destroyed) return false;
            try { new JSONObject(data); } catch (Exception ex) { return false; }
            return getSharedPreferences("counter", MODE_PRIVATE).edit().putString("state", data).commit();
        }
        @JavascriptInterface public void theme(final String mode) {
            if (!"dark".equals(mode) && !"light".equals(mode) && !"system".equals(mode)) return;
            getSharedPreferences("counter", MODE_PRIVATE).edit().putString("theme", mode).apply();
            runOnUiThread(() -> { if (!destroyed) applyAppearance(mode); });
        }
        @JavascriptInterface public void haptic() {
            runOnUiThread(() -> { if (!destroyed) web.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK); });
        }
        @JavascriptInterface public void keepAwake(final boolean on) {
            runOnUiThread(() -> {
                if (destroyed) return;
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
        @JavascriptInterface public void exportBackup(final String data) {
            if (data == null || data.length() > MAX_BYTES) return;
            runOnUiThread(() -> {
                if (destroyed) return;
                exportPayload = data;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "点点计数-备份-" + new java.text.SimpleDateFormat("yyyyMMdd-HHmmss", java.util.Locale.US).format(new java.util.Date()) + ".json");
                try { startActivityForResult(intent, EXPORT); } catch (Exception ex) { message("无法打开文件选择器"); }
            });
        }
        @JavascriptInterface public void importBackup() {
            runOnUiThread(() -> {
                if (destroyed) return;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try { startActivityForResult(intent, IMPORT); } catch (Exception ex) { message("无法打开文件选择器"); }
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result != RESULT_OK || data == null || data.getData() == null) { if (request == EXPORT) exportPayload = null; return; }
        final Uri uri = data.getData();
        final String payload = exportPayload;
        exportPayload = null;
        new Thread(() -> {
            try {
                if (request == EXPORT && payload != null) {
                    try (OutputStream stream = getContentResolver().openOutputStream(uri, "wt")) {
                        if (stream == null) throw new IOException();
                        stream.write(payload.getBytes(StandardCharsets.UTF_8));
                    }
                    message("备份已保存");
                } else if (request == IMPORT) {
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    try (InputStream stream = getContentResolver().openInputStream(uri)) {
                        if (stream == null) throw new IOException();
                        byte[] buf = new byte[8192]; int n;
                        while ((n = stream.read(buf)) != -1) {
                            if (output.size() + n > MAX_BYTES) throw new IOException("备份文件过大");
                            output.write(buf, 0, n);
                        }
                    }
                    final String imported = output.toString("UTF-8");
                    runOnUiThread(() -> eval("window.receiveImport(" + JSONObject.quote(imported) + ")"));
                }
            } catch (Exception ex) { message("文件操作失败，请重试"); }
        }).start();
    }
    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        applyAppearance(appearance);
        eval("window.systemThemeChanged && window.systemThemeChanged()");
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.handleBack ? window.handleBack() : false", result -> {
            if (!"true".equals(result)) MainActivity.super.onBackPressed();
        });
    }
    @Override protected void onPause() { if (web != null) { eval("window.stopRepeat && window.stopRepeat()"); web.onPause(); } super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { destroyed = true; if (web != null) { web.removeJavascriptInterface("CounterNative"); web.destroy(); } super.onDestroy(); }
}
