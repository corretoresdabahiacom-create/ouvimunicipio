import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'dev-api-plugin',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.method === 'POST' && req.url) {
              const cleanedUrl = req.url.split('?')[0];
              if (cleanedUrl === '/api/classify' || cleanedUrl === '/api/despacho') {
                try {
                  const { handleLocalClassify, handleLocalDespacho } = await import('./vite-dev-api');
                  let body = '';
                  req.on('data', chunk => {
                    body += chunk;
                  });
                  req.on('end', async () => {
                    try {
                      const parsedBody = JSON.parse(body || '{}');
                      res.setHeader('Content-Type', 'application/json');
                      if (cleanedUrl === '/api/classify') {
                        const result = await handleLocalClassify(parsedBody);
                        res.end(JSON.stringify(result));
                      } else {
                        const result = await handleLocalDespacho(parsedBody);
                        res.end(JSON.stringify(result));
                      }
                    } catch (err: any) {
                      res.statusCode = 500;
                      res.end(JSON.stringify({ error: err.message }));
                    }
                  });
                  return;
                } catch (loadErr: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to load Dev API Helpers: ' + loadErr.message }));
                  return;
                }
              }
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
