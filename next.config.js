/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

module.exports = nextConfig;
