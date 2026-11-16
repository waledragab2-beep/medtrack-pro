import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; webUrl?: string; eas?: { projectId?: string } };

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'http://localhost:4000').replace(/\/$/, '');
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? extra.webUrl ?? 'http://localhost:5173').replace(/\/$/, '');
export const EAS_PROJECT_ID = extra.eas?.projectId;
