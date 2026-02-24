import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
    TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
  },
};

export default nextConfig;
