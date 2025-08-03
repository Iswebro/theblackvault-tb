/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Completely ignore TypeScript errors during build
    ignoreBuildErrors: true,
    tsconfigPath: './tsconfig.json',
  },
  images: {
    unoptimized: true,
  },
  compiler: {
    // Ensure ES2020 support for BigInt literals
    target: 'es2020',
  },
  swcMinify: true,
  experimental: {
    // Enable ES2020 features
    esmExternals: true,
    // Skip type checking during build
    typedRoutes: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        process: false,
        buffer: false,
      }
    }
    return config
  },
  transpilePackages: ['@reown/appkit', '@reown/appkit-adapter-ethers'],
}

export default nextConfig
