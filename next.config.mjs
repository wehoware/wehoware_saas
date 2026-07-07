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
  // Keep @sparticuz/chromium as external package so its binary files
  // are included in the Vercel serverless function deployment
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
