package com.al.oredrift;

import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/** Fullscreen game: the status and navigation bars stay hidden (a swipe from the edge shows them briefly). */
public class MainActivity extends BridgeActivity {
    /** True between a touch's first finger down and its ACTION_UP or ACTION_CANCEL. */
    private boolean touchOpen;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            // Draw into the camera cutout area too; the page pads itself with safe-area insets.
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        hideSystemBars();
        disableZoom();
    }

    /**
     * Pinch-zoom (and with it, a multi-finger touch) can zoom the page so that one-finger drags pan the
     * zoomed view instead of scrolling the lists. A game has no use for zoom, so turn it off for good.
     */
    private void disableZoom() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
    }

    /**
     * Some phones take over three-finger touches (for example a three-finger screenshot gesture) without
     * sending the game the matching ACTION_UP or ACTION_CANCEL. The WebView then thinks a finger is still
     * down, treats every later one-finger drag as a pinch, and nothing scrolls until the app restarts.
     * When a new touch starts before the last one ended, cancel the old one first.
     */
    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        int action = ev.getActionMasked();
        if (action == MotionEvent.ACTION_DOWN) {
            if (touchOpen) cancelWebViewTouch();
            touchOpen = true;
        } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
            touchOpen = false;
        }
        return super.dispatchTouchEvent(ev);
    }

    private void cancelWebViewTouch() {
        touchOpen = false;
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        long now = SystemClock.uptimeMillis();
        MotionEvent cancel = MotionEvent.obtain(now, now, MotionEvent.ACTION_CANCEL, 0, 0, 0);
        webView.dispatchTouchEvent(cancel);
        cancel.recycle();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // A system gesture or overlay that grabs focus mid-touch can leave that touch open too.
        if (!hasFocus && touchOpen) cancelWebViewTouch();
        // Bars come back after dialogs and ads; hide them again whenever the game regains focus.
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
