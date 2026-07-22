/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The engine is a separate package the app calls. Next transpiles its TS
  // source; the app never contains the engine's logic (6A.0 separability).
  transpilePackages: ['@margia/engine'],
};

export default nextConfig;
