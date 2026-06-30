import { Config } from './config.interface';

export interface InfoConfig extends Config {
  enableEndUserAgreement: boolean;
  enablePrivacyStatement: boolean;
  enableCOARNotifySupport: boolean;
  enableCookieConsentPopup: boolean;
  /**
   * When false, the UI will not probe the backend for the `google.analytics.key`
   * property and will not attempt to load Google Analytics. Set this to true only
   * on installations that actually configure a Google Analytics tracking id on the
   * backend. Keeping it false avoids a 404 request to
   * `/server/api/config/properties/google.analytics.key` on every page.
   */
  enableGoogleAnalytics: boolean;
}
