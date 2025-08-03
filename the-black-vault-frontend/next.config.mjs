/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    unoptimized: true,
  },
  swcMinify: true,
  experimental: {
    typedRoutes: true,
    // Optimize build performance
    optimizePackageImports: ['@rainbow-me/rainbowkit', 'wagmi', 'viem', 'ethers'],
    optimizeCss: true,
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  // Optimize build traces
  outputFileTracing: true,
  // Reduce build trace collection time
  generateBuildId: async () => {
    return 'build-' + Date.now();
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
    
    // Optimize bundle size
    config.optimization = {
      ...config.optimization,
      usedExports: true,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    };
    
    return config
  },
  transpilePackages: ['@reown/appkit', '@reown/appkit-adapter-ethers'],
}

export default nextConfig
