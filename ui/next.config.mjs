/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained build in .next/standalone
  // Required for the Docker multi-stage Dockerfile
  output: "standalone",
};

export default nextConfig;
