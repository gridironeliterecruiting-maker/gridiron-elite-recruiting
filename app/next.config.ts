import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inline Twitter env vars at build time since Vercel doesn't inject
  // them into the serverless function runtime environment.
  // These are only referenced in server-side API routes (lib/twitter.ts),
  // so they won't appear in client bundles.
  env: {
    TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
    TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
  },
};

export default nextConfig;
