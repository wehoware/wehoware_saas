/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Disable X-Powered-By header
  poweredByHeader: false,
  // Allow LAN IP access to dev resources
  allowedDevOrigins: ['172.7.10.104'],
  // Disable source maps in production to reduce .next/ output size
  // (saves ~60MB — critical for AWS Amplify's 230MB deploy artifact limit)
  productionBrowserSourceMaps: false,
};

export default nextConfig;
