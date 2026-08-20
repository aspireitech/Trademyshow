/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module; bundling it breaks the .node binary.
  serverExternalPackages: ["better-sqlite3"],

  // Standalone output is for the container image only, where the runtime stage
  // copies just the files the server reaches. It is deliberately NOT the
  // default: `next start` warns that it does not support standalone output,
  // and the VM deployment runs exactly that. The Dockerfile opts in.
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" } : {}),
};

export default nextConfig;
