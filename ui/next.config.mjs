/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained build in .next/standalone
  // Required for the Docker multi-stage Dockerfile
  output: "standalone",

  // Don't fail the production build on ESLint warnings or TS errors.
  // Lint locally with: npm run lint
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
