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
};

export default nextConfig;
