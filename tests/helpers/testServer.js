import http from 'node:http';
import app from '../../src/server.js';

/**
 * Creates and starts an ephemeral HTTP test server running the Express application.
 * Listens on port 0 to prevent EADDRINUSE collisions.
 * 
 * @returns {Promise<{
 *   server: http.Server,
 *   port: number,
 *   baseUrl: string,
 *   fetch: (path: string, options?: RequestInit) => Promise<Response>,
 *   close: () => Promise<void>
 * }>}
 */
export async function createTestServer() {
  const server = http.createServer(app);

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  const requestHelper = async (path, options = {}) => {
    const targetUrl = path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    return fetch(targetUrl, options);
  };

  const closeHelper = async () => {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    return new Promise((resolve) => {
      server.close(() => resolve());
    });
  };

  return {
    server,
    port,
    baseUrl,
    fetch: requestHelper,
    close: closeHelper,
  };
}
