# API Keys Setup Guide

This guide explains how to obtain all the API keys needed for Business Metrics Hub.

## Quick Status

| Service | Required | Purpose |
|---------|----------|---------|
| Supabase | Yes | Stores all metrics data |
| RevenueCat | Yes | Subscription/revenue data |
| App Store Connect | Yes | iOS installs, revenue |
| Google Play | Yes | Android installs, revenue |
| Firebase/GA4 | Recommended | Analytics, DAU/MAU |
| DeepSeek | Recommended | AI insights in reports |
| Resend | Recommended | Email delivery |
| ElevenLabs | Optional | Cost tracking |
| Cartesia | Optional | Cost tracking |
| Anthropic | Optional | Alternative AI provider |
| Neon | Optional | Cost tracking |
| Google Cloud | Optional | Cost tracking |

---

## 1. RevenueCat (Subscription Data)

**What it provides:** Subscription events, MRR, trials, conversions, churn

### Steps:
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Click on your project
3. Go to **Project Settings** (gear icon)
4. Navigate to **API Keys**
5. Copy the **Secret API key** (starts with `sk_`)

### .env variable:
```
REVENUECAT_SECRET_API_KEY=sk_xxxxx
```

### Note:
The secret key gives access to ALL apps in your RevenueCat project. You don't need individual app keys for the API.

---

## 2. App Store Connect (iOS Data)

**What it provides:** iOS installs, revenue, ratings, impressions

### Steps:
1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **Users and Access**
3. Go to **Integrations** tab > **App Store Connect API**
4. Click **Generate API Key** (or use existing)
5. Select role: **Sales and Reports** (minimum required)
6. Download the `.p8` private key file (only available once!)
7. Note the **Key ID** and **Issuer ID**

### .env variables:
```
APP_STORE_CONNECT_KEY_ID=XXXXXXXXXX
APP_STORE_CONNECT_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
APP_STORE_CONNECT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
-----END PRIVATE KEY-----"
```

### Important:
- Keep the private key secure - it cannot be downloaded again
- The private key in .env should include the BEGIN/END lines
- Use quotes around the private key value

---

## 3. Google Play Console (Android Data)

**What it provides:** Android installs, revenue, ratings, crashes

### Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - **Google Play Android Developer API**
   - **Google Play Developer Reporting API**
4. Go to **IAM & Admin** > **Service Accounts**
5. Click **Create Service Account**
6. Name it (e.g., `business-metrics-reader`)
7. Grant role: **Viewer** (or create custom role)
8. Click **Create Key** > **JSON**
9. Download the JSON file

### Link to Play Console:
1. Go to [Google Play Console](https://play.google.com/console/)
2. Go to **Settings** > **API access**
3. Link the Cloud project
4. Find your service account and click **Manage permissions**
5. Grant: **View app information and download bulk reports**

### .env variable:
```
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

### Note:
Paste the entire JSON as a single line, or escape newlines properly.

---

## 4. Firebase / Google Analytics 4

**What it provides:** DAU, MAU, sessions, retention, custom events

### Steps for Firebase Service Account:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click gear icon > **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file

### Steps for GA4 Property ID:
1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **Admin** (gear icon)
3. Select your property
4. Go to **Property Settings**
5. Copy the **Property ID** (numeric, e.g., `123456789`)

### .env variables:
```
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
GA4_PROPERTY_ID_GUITAR_PROGRESSION=123456789
GA4_PROPERTY_ID_SMGUITAR=123456790
GA4_PROPERTY_ID_EAR_N_PLAY=123456791
GA4_PROPERTY_ID_MEDITNATION=123456792
```

---

## 5. DeepSeek (AI Insights)

**What it provides:** AI-generated insights in daily reports

### Steps:
1. Go to [DeepSeek Platform](https://platform.deepseek.com/)
2. Sign up or log in
3. Go to **API Keys**
4. Click **Create API Key**
5. Copy the key

### .env variable:
```
DEEPSEEK_API_KEY=sk-xxxxx
```

### Pricing:
DeepSeek is very affordable (~$0.14/million input tokens, ~$0.28/million output tokens)

---

## 6. Google AI Studio / Nano Banana (Image Generation)

**What it provides:** AI image generation using Gemini 2.0 Flash Image model

**Used by:** Meditnation Mobile app for personalized affirmation images

### Steps:
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Select a project or create new one
5. Copy the API key

### .env variable:
```
GOOGLE_AI_STUDIO_API_KEY=AIzaSy...
```

### Pricing:
- ~$0.03 per image generated
- Check usage at [Google Cloud Console](https://console.cloud.google.com/apis/dashboard)

### Model used:
- `gemini-2.0-flash-image-preview` (Image generation)

---

## 7. Smallest AI (Voice/TTS)

**What it provides:** Text-to-speech voice generation

**Used by:** Meditnation Mobile app

### Steps:
1. Go to [Smallest AI](https://smallest.ai/) (or relevant provider dashboard)
2. Create account and get API key

### .env variable:
```
SMALLEST_API_KEY=sk_...
```

---

## 8. Resend (Email Delivery)

**What it provides:** Sends daily report emails

### Steps:
1. Go to [Resend Dashboard](https://resend.com/)
2. Sign up or log in
3. Go to **API Keys**
4. Click **Create API Key**
5. Copy the key

### Domain Setup (Required for production):
1. Go to **Domains**
2. Add your domain
3. Add the DNS records shown (TXT, MX, CNAME)
4. Wait for verification

### .env variables:
```
RESEND_API_KEY=re_xxxxx
REPORT_EMAIL_FROM=reports@yourdomain.com
REPORT_EMAIL_TO=you@email.com
```

### Note:
Without a verified domain, you can only send to your own email address.

---

## 7. ElevenLabs (Cost Tracking)

**What it provides:** API usage and cost tracking

### Steps:
1. Go to [ElevenLabs](https://elevenlabs.io/)
2. Click your profile > **Profile + API key**
3. Copy the API key

### Required Permission:
The API key needs `speech_history_read` permission to access usage data.
If you see permission errors, create a new key with full permissions.

### .env variable:
```
ELEVENLABS_API_KEY=sk_xxxxx
```

---

## 8. Cartesia (Cost Tracking)

**What it provides:** API usage and cost tracking

### Steps:
1. Go to [Cartesia Dashboard](https://play.cartesia.ai/)
2. Go to **Settings** > **API Keys**
3. Create or copy your API key

### .env variable:
```
CARTESIA_API_KEY=sk_car_xxxxx
```

---

## 9. Anthropic (Alternative AI Provider)

**What it provides:** Alternative to DeepSeek for AI insights

### Steps:
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Go to **API Keys**
4. Click **Create Key**
5. Copy the key

### .env variable:
```
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Note:
Business Metrics Hub uses DeepSeek by default. Anthropic is a fallback.

---

## 10. Neon (Cost Tracking)

**What it provides:** Database usage and cost tracking

### Steps:
1. Go to [Neon Console](https://console.neon.tech/)
2. Click your profile > **Account Settings**
3. Go to **API Keys**
4. Click **Create API Key**
5. Copy the key

### .env variable:
```
NEON_API_KEY=xxxxx
```

---

## 11. Google Cloud Billing (Cost Tracking)

**What it provides:** GCP infrastructure costs

### Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Go to **Billing**
3. Note your **Billing Account ID** (format: XXXXX-XXXXX-XXXXX)
4. Enable BigQuery billing export:
   - Go to **Billing** > **Billing export**
   - Enable **BigQuery export**
   - Note the dataset name

### .env variables:
```
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_BILLING_ACCOUNT_ID=XXXXX-XXXXX-XXXXX
GOOGLE_CLOUD_BILLING_DATASET=billing_export
```

---

## 12. Supabase Management API (Cost Tracking)

**What it provides:** Supabase project usage and costs

### Steps:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/)
2. Click your profile (bottom left)
3. Go to **Access Tokens**
4. Click **Generate new token**
5. Copy the token

### .env variable:
```
SUPABASE_MANAGEMENT_API_KEY=sbp_xxxxx
```

---

---

## Credit Monitoring

Business Metrics Hub can monitor your API credits and alert you when running low.

### Check Credits Manually

```bash
npm run check-credits
```

### What It Monitors

| Service | What It Checks |
|---------|----------------|
| DeepSeek | Account balance ($) |
| OpenAI | API key validity |
| ElevenLabs | Characters remaining |
| Cartesia | Credits/usage |
| Resend | API key validity |
| Anthropic | API key validity |

### Alert Thresholds

- **Warning**: 80% of quota used
- **Critical**: 95% of quota used

When thresholds are crossed, you get an email alert.

### Run Regularly

Add to your cron to check every 6 hours:

```bash
0 */6 * * * cd /Users/rbsou/Documents/CODE/business_manager && npm run check-credits >> /tmp/credits.log 2>&1
```

---

## Daily Automation Setup

### Option 1: Supabase Edge Functions + pg_cron

Deploy the edge functions and set up cron:

```sql
-- Run in Supabase SQL Editor
SELECT cron.schedule(
  'daily-metrics-ingestion',
  '0 6 * * *', -- 6 AM UTC daily
  $$SELECT net.http_post(
    'https://ptndtjbyguhixwgbnfsm.supabase.co/functions/v1/daily-ingest',
    '{}',
    'application/json',
    ARRAY[http_header('Authorization', 'Bearer YOUR_ANON_KEY')]
  )$$
);
```

### Option 2: GitHub Actions

Create `.github/workflows/daily-metrics.yml`:

```yaml
name: Daily Metrics Ingestion

on:
  schedule:
    - cron: '0 6 * * *' # 6 AM UTC
  workflow_dispatch: # Manual trigger

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run ingest
      - run: npm run report -- --send
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      # ... add all other env vars as secrets
```

### Option 3: Local Cron (macOS)

```bash
# Edit crontab
crontab -e

# Add these lines:
# Daily metrics at 6 AM
0 6 * * * cd /Users/rbsou/Documents/CODE/business_manager && npm run ingest && npm run report -- --send >> /tmp/metrics.log 2>&1

# Credit monitoring every 6 hours
0 */6 * * * cd /Users/rbsou/Documents/CODE/business_manager && npm run check-credits >> /tmp/credits.log 2>&1
```

### Option 4: Render.com / Railway / Fly.io

Deploy as a cron job service on any platform that supports scheduled tasks.

---

## Testing Your Setup

After adding API keys, test each source:

```bash
# Test all sources
npm run test:ingestion

# Generate a report (without sending)
npm run report

# Generate and send report
npm run report -- --send
```

---

## Troubleshooting

### "not configured" error
The API key environment variable is missing or empty.

### 401 Unauthorized
The API key is invalid or expired. Generate a new one.

### 403 Forbidden
The API key doesn't have required permissions. Check the service's permission settings.

### Rate limiting
Add delays between requests or reduce frequency of ingestion.

---

## Security Notes

1. **Never commit `.env` to git** - it's in `.gitignore`
2. **Use secrets management** for production (GitHub Secrets, Vault, etc.)
3. **Rotate keys periodically** especially if exposed
4. **Use least-privilege** - only grant permissions the app needs
5. **Monitor usage** - set up billing alerts on paid services
