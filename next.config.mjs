/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module; bundling it breaks the .node binary.
  serverExternalPackages: ["better-sqlite3"],

  // Standalone output is for the container image only, where the runtime stage
  // copies just the files the server reaches. It is deliberately NOT the
  // default: `next start` warns that it does not support standalone output,
  // and the VM deployment runs exactly that. The Dockerfile opts in.
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" } : {}),

  /**
   * Stock pages moved out of /dashboard and became public.
   *
   * The redirect lives here rather than in a page under the old path because
   * the dashboard layout sends anyone without a session to /login before a
   * page inside it renders — so a signed-out reader following an old alert
   * link landed on a login screen instead of the stock. A config redirect
   * runs before routing, and therefore before that.
   */
  async redirects() {
    return [
      {
        source: "/dashboard/stocks/:symbol",
        destination: "/stocks/:symbol",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
