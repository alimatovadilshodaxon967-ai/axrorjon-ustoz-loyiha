import { createRequire } from 'node:module';
import { getConnectionString } from '@netlify/database';

const require = createRequire(import.meta.url);
const serverless = require('serverless-http');

let handler;

export default async (req, context) => {
  if (!process.env.NETLIFY_DB_URL) {
    try {
      const connStr = getConnectionString();
      if (connStr) process.env.NETLIFY_DB_URL = connStr;
    } catch {
      // Fallback to existing env var
    }
  }

  if (!handler) {
    const app = require('../../backend/server.js');
    handler = serverless(app);
  }

  const url = new URL(req.url);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== null;
  const bodyBuf = hasBody ? Buffer.from(await req.arrayBuffer()) : null;
  const headers = Object.fromEntries(req.headers.entries());

  const event = {
    version: '2.0',
    routeKey: '$default',
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers,
    requestContext: {
      http: {
        method: req.method,
        path: url.pathname,
        sourceIp: context.ip || '127.0.0.1',
      },
    },
    body: bodyBuf ? bodyBuf.toString('base64') : undefined,
    isBase64Encoded: Boolean(bodyBuf),
  };

  const result = await handler(event, {});
  const resHeaders = new Headers(result.headers || {});

  if (result.multiValueHeaders) {
    for (const [key, values] of Object.entries(result.multiValueHeaders)) {
      for (const val of values) resHeaders.append(key, val);
    }
  }
  if (result.cookies) {
    for (const cookie of result.cookies) resHeaders.append('set-cookie', cookie);
  }

  const resBody = result.isBase64Encoded
    ? Buffer.from(result.body || '', 'base64')
    : (result.body || '');

  return new Response(resBody, {
    status: result.statusCode || 200,
    headers: resHeaders,
  });
};
