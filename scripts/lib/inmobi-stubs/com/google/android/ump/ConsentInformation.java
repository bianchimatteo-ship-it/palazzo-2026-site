package com.google.android.ump;
public interface ConsentInformation {
  @interface ConsentStatus { int UNKNOWN = 0; int NOT_REQUIRED = 1; int REQUIRED = 2; int OBTAINED = 3; }
  enum PrivacyOptionsRequirementStatus { UNKNOWN, NOT_REQUIRED, REQUIRED }
  interface OnConsentInfoUpdateSuccessListener { void onConsentInfoUpdateSuccess(); }
  interface OnConsentInfoUpdateFailureListener { void onConsentInfoUpdateFailure(FormError error); }
  void requestConsentInfoUpdate(android.app.Activity a, ConsentRequestParameters p, OnConsentInfoUpdateSuccessListener s, OnConsentInfoUpdateFailureListener f);
  boolean canRequestAds(); int getConsentStatus(); PrivacyOptionsRequirementStatus getPrivacyOptionsRequirementStatus();
}
