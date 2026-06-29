# OAuth Setup Guide — Calendar & Video Integrations

> This guide walks you through creating OAuth apps in Google Cloud Console and Azure App registrations so each client can connect their own Google/Outlook calendar.

---

## 1. Google Cloud Console — Google Calendar API

### Step 1: Create a Project
1. Go to https://console.cloud.google.com/
2. Click the project selector (top-left) → **New Project**
3. Name it `Wehoware SaaS` (or your app name)
4. Click **Create**

### Step 2: Enable the Google Calendar API
1. In the left menu: **APIs & Services → Library**
2. Search for **Google Calendar API**
3. Click **Enable**

### Step 3: Configure OAuth Consent Screen
1. **APIs & Services → OAuth consent screen**
2. Choose **External** (so any Google user can connect, not just your org)
3. Fill in:
   - **App name**: `Wehoware`
   - **User support email**: your email
   - **Developer contact email**: your email
   - **App domain**: your production domain (e.g. `https://yourdomain.com`)
   - **Authorized domains**: your production domain (without `https://`)
4. Click **Save and Continue**
5. On **Scopes**, click **Add or Remove Scopes**
   - Search for `calendar` and add:
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/calendar.readonly`
   - Click **Update** → **Save and Continue**
6. On **Test Users**, add your Google email → **Save and Continue**
7. Click **Back to Dashboard**

> **Important**: While in "Testing" mode, only test users can connect. When ready to go live, click **Publish App** under the OAuth consent screen.

### Step 4: Create OAuth 2.0 Credentials
1. **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Wehoware Web Client`
5. **Authorized redirect URIs** — add BOTH:
   - Development: `http://localhost:3000/api/v1/integrations/google/calendar/callback`
   - Production: `https://YOUR_DOMAIN.com/api/v1/integrations/google/calendar/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### Step 5: Add to .env.local
```
GOOGLE_CLIENT_ID=your-copied-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-copied-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/integrations/google/calendar/callback
```

For production, change `GOOGLE_REDIRECT_URI` to your production callback URL.

---

## 2. Azure Portal — Microsoft Outlook Calendar

### Step 1: Register an App
1. Go to https://portal.azure.com/
2. Search for **App registrations** → click it
3. Click **+ New registration**
4. Fill in:
   - **Name**: `Wehoware Outlook Calendar`
   - **Supported account types**: `Accounts in any organizational directory and personal Microsoft accounts`
   - **Redirect URI**: Select **Web**
5. Add redirect URIs:
   - Development: `http://localhost:3000/api/v1/integrations/microsoft/calendar/callback`
   - Production: `https://YOUR_DOMAIN.com/api/v1/integrations/microsoft/calendar/callback`
6. Click **Register**

### Step 2: Add API Permissions
1. In your new app, go to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph → Delegated permissions**
4. Add:
   - `Calendars.ReadWrite`
   - `offline_access`
   - `openid`
   - `email`
   - `profile`
5. Click **Grant admin consent for [tenant]** (if you own the tenant)

### Step 3: Create a Client Secret
1. Go to **Certificates & secrets**
2. Click **+ New client secret**
3. Description: `Wehoware production`
4. Expires: select duration (recommend 24 months)
5. Click **Add**
6. **Immediately copy the secret value** — you can only see it once!

### Step 4: Copy Application (client) ID
1. Go to **Overview**
2. Copy the **Application (client) ID**

### Step 5: Add to .env.local
```
MICROSOFT_CLIENT_ID=your-copied-client-id
MICROSOFT_CLIENT_SECRET=your-copied-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/v1/integrations/microsoft/calendar/callback
```

---

## 3. Update .env.local in this project

Replace the empty values in `.env.local` with your copied credentials:

```env
GOOGLE_CLIENT_ID=<paste here>
GOOGLE_CLIENT_SECRET=<paste here>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/integrations/google/calendar/callback

MICROSOFT_CLIENT_ID=<paste here>
MICROSOFT_CLIENT_SECRET=<paste here>
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/v1/integrations/microsoft/calendar/callback
```

For production deployment, update the redirect URIs to your production domain.

---

## 4. Test the Integration

1. Start the dev server: `npm run dev`
2. Go to **Admin → Appointments → Settings**
3. Click **Connect** next to Google Calendar
4. You should be redirected to Google, authorize, then redirect back with `?success=google_connected`
5. Create a test appointment — it should appear in your Google Calendar

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `redirect_uri_mismatch` | The redirect URI in the OAuth app must exactly match `GOOGLE_REDIRECT_URI` / `MICROSOFT_REDIRECT_URI` in `.env.local` |
| `invalid_client` | Wrong Client ID or Client Secret |
| `unauthorized_client` | OAuth consent screen not published, or user not added as test user |
| `insufficient permissions` | Calendar API not enabled, or scopes not configured |
