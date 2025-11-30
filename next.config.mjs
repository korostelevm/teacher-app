/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // Only ignore ESLint during builds in production
    // This allows catching errors in development
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
  typescript: {
    // Enforce strict type checking during build
    tsconfigPath: './tsconfig.json',
  },
};

export default nextConfig;
