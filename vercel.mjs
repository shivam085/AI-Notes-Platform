// Vercel evaluates this configuration during deployment. Keep /api on the
// browser's origin while forwarding it to the Express service on Render.
const apiOrigin = process.env.EXPRESS_API_ORIGIN?.replace(/\/$/, '');

if (!apiOrigin || !/^https:\/\/[^/]+$/.test(apiOrigin)) {
  throw new Error('Set EXPRESS_API_ORIGIN to the HTTPS origin of the Render Express service.');
}

export const config = {
  framework: 'vite',
  installCommand: 'npm ci',
  buildCommand: 'npm run build',
  outputDirectory: 'client/dist',
  rewrites: [
    { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
    { source: '/(.*)', destination: '/index.html' },
  ],
};
