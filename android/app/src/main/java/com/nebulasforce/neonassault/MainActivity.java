package com.nebulasforce.neonassault;

import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        tuneWebView();
    }

    @Override
    public void onStart() {
        super.onStart();
        tuneWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        tuneWebView();
    }

    private void tuneWebView() {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        /* 不要 LAYER_TYPE_HARDWARE：整页打进一张硬件纹理后，60fps 全屏 Canvas
           经常不再更新，战场全黑，HUD / 小地图却还在。Activity 级硬件加速保留。 */
        webView.setLayerType(View.LAYER_TYPE_NONE, null);
        webView.setBackgroundColor(Color.parseColor("#05070f"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }
        WebSettings settings = webView.getSettings();
        settings.setOffscreenPreRaster(false);
    }
}
