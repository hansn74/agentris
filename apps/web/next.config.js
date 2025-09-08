/** @type {import('next').NextConfig} */
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
};

module.exports = nextConfig;
