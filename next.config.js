/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
    ],
  },
  images: {
    // Consider configuring domains for optimized images; keeping unoptimized off for prod
    unoptimized: false,
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.firebaseapp.com' },
      { protocol: 'https', hostname: '**.firebasestorage.googleapis.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Consider SAMEORIGIN if you embed internal iframes; keep DENY if not needed
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Basic CSP; adjust as needed for analytics/fonts
          { key: 'Content-Security-Policy', value: [
            "default-src 'self'",
            // Allow Vercel Live feedback widget (injected on preview deployments) alongside self + inline
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com",
            "style-src 'self' 'unsafe-inline' https://vercel.live",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data: https://vercel.live https://assets.vercel.com",
            // Allow PDF viewer/yoga-wasm (data: and blob:) and Firebase HTTPS endpoints + Medplum localhost + Vercel Live pusher websocket
            "connect-src 'self' http://localhost:8103 https: wss: data: blob:",
            // Allow embedding PDF viewer iframe, blob URLs, and Vercel Live feedback iframe
            "frame-src 'self' blob: data: https://vercel.live",
            "child-src 'self' blob: data: https://vercel.live",
            // Allow web workers for PDF rendering
            "worker-src 'self' blob:",
            "frame-ancestors 'none'",
          ].join('; ') },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      encoding: false,
    };
    return config;
  }
};

module.exports = nextConfig;
