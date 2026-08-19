/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module; bundling it breaks the .node binary.
  serverExternalPackages: ["better-sqlite3"],

  // Emits .next/standalone with only the files the server actually reaches,
  // which is what the Dockerfile's runtime stage copies. Without it the image
  // has to carry the whole node_modules tree.
  output: "standalone",
};

export default nextConfig;
