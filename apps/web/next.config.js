/** @type {import('next').NextConfig} */

// Load environment variables from root .env file
require('dotenv').config({ path: '../../.env' });

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: [
    '@agentris/api',
    '@agentris/db',
    '@agentris/auth',
    '@agentris/integrations',
    '@agentris/ai-engine',
    '@agentris/services',
    '@agentris/shared',
  ],
  env: {
    // Map NEXTAUTH variables to AUTH variables for Auth.js v5 compatibility
    AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL || process.env.NEXTAUTH_URL,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
