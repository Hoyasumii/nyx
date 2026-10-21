/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  /** Ad network shown on the landing page: `ethicalads`, `carbon`, or empty for none. */
  readonly VITE_ADS_PROVIDER?: string;
  /** EthicalAds publisher id. */
  readonly VITE_ETHICALADS_PUBLISHER?: string;
  /** Carbon Ads `serve` code, e.g. `CXXXXXXX`. */
  readonly VITE_CARBON_SERVE?: string;
  /** Carbon Ads `placement`, usually the site's domain. */
  readonly VITE_CARBON_PLACEMENT?: string;
  /** Donation page shown when no ad is configured or none could be served. */
  readonly VITE_SUPPORT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
