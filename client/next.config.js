const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Both programs live in one repo with several lockfiles, so say where the website's root is.
  turbopack: { root: path.join(__dirname) },
  // Don't generate agent-instruction files inside the project.
  agentRules: false,
  // The browser only ever talks to localhost:3000. Next.js forwards /api/* to the Express server,
  // so the login cookie is same-origin and the Gemini key never leaves the server.
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:4000/api/:path*' }];
  },
};

module.exports = nextConfig;
