# Vercel Environment Variable Setup

## To Fix Preview Environments

### Option 1: Remove NEXT_PUBLIC_APP_URL Completely (Recommended)
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Delete `NEXT_PUBLIC_APP_URL` if it exists
3. The app will now auto-detect URLs using our getAppUrl() helper

### Option 2: Set Different Values per Environment
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. For `NEXT_PUBLIC_APP_URL`:
   - Production: Set to `https://gridironeliterecruiting.com`
   - Preview: Leave unset or delete
   - Development: Leave unset or delete

## How It Works Now

The app uses a smart URL detection system:
- **In browser**: Uses `window.location.origin` 
- **On Vercel preview**: Uses `VERCEL_URL` environment variable (auto-provided by Vercel)
- **In development**: Uses `http://localhost:3001`
- **Fallback**: Uses `NEXT_PUBLIC_APP_URL` if set, otherwise `https://gridironeliterecruiting.com`

This ensures:
- Preview deployments stay on their preview URL
- Production always uses gridironeliterecruiting.com
- Local development works without configuration
- OAuth callbacks return to the correct environment