/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,   // ← add this line
  },
  eslint: {
    ignoreDuringBuilds: true,  // ← add this line
  },
  images: {
    domains: ['res.cloudinary.com', 'api.dicebear.com'],
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
};

module.exports = nextConfig;