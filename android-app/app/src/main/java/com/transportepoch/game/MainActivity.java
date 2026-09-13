package com.transportepoch.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String HOME_URL = "https://" + APP_HOST + "/assets/index.html";
    private WebView gameView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(11, 20, 34));
        getWindow().setNavigationBarColor(Color.rgb(11, 20, 34));

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.rgb(11, 20, 34));
        gameView = new WebView(this);
        FrameLayout.LayoutParams gameLayout = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        gameView.setLayoutParams(gameLayout);
        gameView.setBackgroundColor(Color.rgb(11, 20, 34));
        gameView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        container.addView(gameView);
        container.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) gameView.getLayoutParams();
                params.setMargins(
                    insets.getSystemWindowInsetLeft(),
                    insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(),
                    insets.getSystemWindowInsetBottom()
                );
                gameView.setLayoutParams(params);
                return insets;
            }
        });
        WebSettings settings = gameView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        gameView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse local = loadAsset(request.getUrl());
                return local != null ? local : super.shouldInterceptRequest(view, request);
            }

            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                WebResourceResponse local = loadAsset(Uri.parse(url));
                return local != null ? local : super.shouldInterceptRequest(view, url);
            }

            private WebResourceResponse loadAsset(Uri uri) {
                if (!"https".equalsIgnoreCase(uri.getScheme()) || !APP_HOST.equalsIgnoreCase(uri.getHost())) return null;
                String path = uri.getPath();
                if (path == null || !path.startsWith("/assets/")) return emptyResponse();
                String assetPath = path.substring("/assets/".length());
                if (assetPath.isEmpty() || assetPath.contains("..") || assetPath.startsWith("/")) return emptyResponse();
                try {
                    InputStream input = getAssets().open(assetPath);
                    String mime = URLConnection.guessContentTypeFromName(assetPath);
                    if (mime == null) mime = assetPath.endsWith(".js") ? "text/javascript" : assetPath.endsWith(".css") ? "text/css" : assetPath.endsWith(".html") ? "text/html" : "application/octet-stream";
                    return new WebResourceResponse(mime, "UTF-8", input);
                } catch (IOException error) {
                    return emptyResponse();
                }
            }

            private WebResourceResponse emptyResponse() {
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
            }
        });
        setContentView(container);
        container.requestApplyInsets();
        if (savedInstanceState == null) gameView.loadUrl(HOME_URL);
        else gameView.restoreState(savedInstanceState);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (gameView != null) gameView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (gameView != null && gameView.canGoBack()) gameView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (gameView != null) {
            gameView.stopLoading();
            gameView.loadUrl("about:blank");
            gameView.clearHistory();
            gameView.removeAllViews();
            gameView.destroy();
            gameView = null;
        }
        super.onDestroy();
    }
}
