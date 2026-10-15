/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(['zalo', 'crm'].includes(process.env.ZALO_TEAM_RUNTIME) ? {
    output: 'standalone',
    experimental: { outputFileTracingRoot: require('path').join(__dirname, '../..'), cpus: 2 },
  } : {}),
  assetPrefix: process.env.ZALO_TEAM_RUNTIME === 'zalo' ? '/zalo-team-assets' : undefined,
  webpack(config, { webpack }) {
    // PDF.js ships an already-minified ES module. Next 14's script minimizer
    // cannot parse its import.meta; preserve this asset without re-minifying it.
    config.plugins.push({ apply(compiler) {
      compiler.hooks.thisCompilation.tap('PdfWorkerModule', (compilation) => {
        compilation.hooks.processAssets.tap({
          name: 'PdfWorkerModule', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE - 1,
        }, () => {
          for (const asset of compilation.getAssets()) {
            if (/\/pdf\.worker\.min\.[\w-]+\.mjs$/.test(asset.name)) {
              compilation.updateAsset(asset.name, asset.source, { ...asset.info, minimized: true });
            }
          }
        });
      });
    } });
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
    NEXT_PUBLIC_REVERB_ENABLED: process.env.NEXT_PUBLIC_REVERB_ENABLED || 'false',
    NEXT_PUBLIC_REVERB_APP_KEY: process.env.NEXT_PUBLIC_REVERB_APP_KEY || '',
    NEXT_PUBLIC_REVERB_HOST: process.env.NEXT_PUBLIC_REVERB_HOST || 'localhost',
    NEXT_PUBLIC_REVERB_PORT: process.env.NEXT_PUBLIC_REVERB_PORT || '8080',
    NEXT_PUBLIC_REVERB_SCHEME: process.env.NEXT_PUBLIC_REVERB_SCHEME || 'http',
  },
};

module.exports = nextConfig;
