/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    // ⚠️ TEMPORARY: Ignore type errors during build
    // TODO: Fix Medplum FHIR type incompatibilities
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: __dirname,
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
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", 
            "style-src 'self' 'unsafe-inline'", 
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            // Allow PDF viewer/yoga-wasm (data: and blob:) and Firebase HTTPS endpoints + Medplum localhost
            "connect-src 'self' http://localhost:8103 https: data: blob:",
            // Allow embedding PDF viewer iframe and blob URLs
            "frame-src 'self' blob: data:",
            "child-src 'self' blob: data:",
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
