package com.google.android.ump;
public class UserMessagingPlatform {
  public interface OnConsentFormDismissedListener { void onConsentFormDismissed(FormError e); }
  public static ConsentInformation getConsentInformation(android.content.Context c) { return null; }
  public static void loadAndShowConsentFormIfRequired(android.app.Activity a, OnConsentFormDismissedListener l) {}
  public static void showPrivacyOptionsForm(android.app.Activity a, OnConsentFormDismissedListener l) {}
}
