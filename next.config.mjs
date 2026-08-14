/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Anthropic SDK stays server-only; never bundled to the client.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
