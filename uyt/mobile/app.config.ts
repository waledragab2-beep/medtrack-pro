import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json:
 *  - google-services.json (FCM for Android) is attached only when present, so local builds work without it.
 *  - EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WEB_URL override the default endpoints per EAS profile.
 */
export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    android: {
      ...config.android,
      ...(existsSync('./google-services.json') ? { googleServicesFile: './google-services.json' } : {}),
    },
    extra: {
      ...config.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? config.extra?.apiUrl,
      webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? config.extra?.webUrl,
    },
  }) as ExpoConfig;
