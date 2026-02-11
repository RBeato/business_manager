import { config as dotenvConfig } from 'dotenv';
import type { Config } from '../types/index.js';

// Load environment variables
dotenvConfig();

function getEnv(key: string, required = false): string | undefined {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getRequiredEnv(key: string): string {
  const value = getEnv(key, true);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parseJsonEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  // Handle both raw JSON and escaped JSON strings
  return value.startsWith("'") ? value.slice(1, -1) : value;
}

export function loadConfig(): Config {
  return {
    supabase: {
      url: getRequiredEnv('SUPABASE_URL'),
      anonKey: getRequiredEnv('SUPABASE_ANON_KEY'),
      serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    },

    appStoreConnect: process.env.APP_STORE_CONNECT_KEY_ID
      ? {
          keyId: getRequiredEnv('APP_STORE_CONNECT_KEY_ID'),
          issuerId: getRequiredEnv('APP_STORE_CONNECT_ISSUER_ID'),
          privateKey: getRequiredEnv('APP_STORE_CONNECT_PRIVATE_KEY'),
        }
      : undefined,

    googlePlay: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
      ? {
          serviceAccountJson: parseJsonEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') || '',
        }
      : undefined,

    revenueCat: process.env.REVENUECAT_SECRET_API_KEY
      ? {
          apiKey: getRequiredEnv('REVENUECAT_SECRET_API_KEY'),
          appKeys: {
            guitar_progression_generator: getEnv('REVENUECAT_GPG_SECRET_API_KEY'),
            smguitar: getEnv('REVENUECAT_SMGUITAR_SECRET_API_KEY'),
            ear_n_play: getEnv('REVENUECAT_EARNPLAY_SECRET_API_KEY'),
            meditnation_mobile: getEnv('REVENUECAT_MEDITNATION_SECRET_API_KEY'),
            health_open_page: getEnv('REVENUECAT_HOP_SECRET_API_KEY'),
          } as Record<string, string | undefined>,
        }
      : undefined,

    firebase: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? {
          serviceAccountJson: parseJsonEnv('FIREBASE_SERVICE_ACCOUNT_JSON') || '',
        }
      : undefined,

    anthropic: process.env.ANTHROPIC_API_KEY
      ? {
          apiKey: getRequiredEnv('ANTHROPIC_API_KEY'),
        }
      : undefined,

    deepseek: process.env.DEEPSEEK_API_KEY
      ? {
          apiKey: getRequiredEnv('DEEPSEEK_API_KEY'),
        }
      : undefined,

    elevenlabs: process.env.ELEVENLABS_API_KEY
      ? {
          apiKey: getRequiredEnv('ELEVENLABS_API_KEY'),
        }
      : undefined,

    cartesia: process.env.CARTESIA_API_KEY
      ? {
          apiKey: getRequiredEnv('CARTESIA_API_KEY'),
        }
      : undefined,

    googleCloud: process.env.GOOGLE_CLOUD_BILLING_ACCOUNT_ID
      ? {
          billingAccountId: getRequiredEnv('GOOGLE_CLOUD_BILLING_ACCOUNT_ID'),
        }
      : undefined,

    neon: process.env.NEON_API_KEY
      ? {
          apiKey: getRequiredEnv('NEON_API_KEY'),
        }
      : undefined,

    telegram: process.env.TELEGRAM_BOT_TOKEN
      ? {
          botToken: getRequiredEnv('TELEGRAM_BOT_TOKEN'),
          chatId: getRequiredEnv('TELEGRAM_CHAT_ID'),
        }
      : undefined,

    umami: process.env.UMAMI_API_TOKEN
      ? {
          apiUrl: process.env.UMAMI_API_URL || 'https://umami-analytics-theta.vercel.app',
          apiToken: process.env.UMAMI_API_TOKEN,
        }
      : undefined,

    brevo: process.env.BREVO_HOP_API_KEY || process.env.BREVO_RIFFROUTINE_API_KEY
      ? {
          websites: {
            ...(process.env.BREVO_HOP_API_KEY ? {
              healthopenpage: { apiKey: process.env.BREVO_HOP_API_KEY, appSlug: 'healthopenpage_website' },
            } : {}),
            ...(process.env.BREVO_RIFFROUTINE_API_KEY ? {
              riffroutine: { apiKey: process.env.BREVO_RIFFROUTINE_API_KEY, appSlug: 'riffroutine_website' },
            } : {}),
          },
        }
      : undefined,
  };
}

// Singleton config instance
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

// Helper to check if a specific integration is configured
export function isConfigured(integration: keyof Config): boolean {
  const config = getConfig();
  return config[integration] !== undefined;
}

// Date helpers
export function getYesterday(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z');
}
