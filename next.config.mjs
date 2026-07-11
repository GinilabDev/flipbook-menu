/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfjs-dist has an optional `canvas` dep meant for Node; stub it out in the browser bundle.
  turbopack: {
    resolveAlias: {
      canvas: "./lib/empty.js",
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
