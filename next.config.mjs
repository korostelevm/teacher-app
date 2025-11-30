/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // Build should not fail on ESLint errors during the Next.js build
    // The circular structure error is a known issue with plugin introspection
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
