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
  // Explicitly include @sparticuz/chromium binaries in the serverless
  // function trace for routes that generate PDFs
  outputFileTracingIncludes: {
    "/api/v1/invoices/[id]/share": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/v1/invoices/public/[token]/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/v1/invoices/[id]/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
