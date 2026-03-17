const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-placeholder';

const { authRoutes } = require('../src/routes/authRoutes');
const { boardRoutes } = require('../src/routes/boardRoutes');

const invokeRouter = (router, { method, url, body, headers = {} }) =>
  new Promise((resolve) => {
    const req = {
      method,
      url,
      headers,
      body,
      query: {},
      params: {},
      get(name) {
        return this.headers[name.toLowerCase()];
      },
    };

    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(name, value) {
        this.headers[name] = value;
      },
      getHeader(name) {
        return this.headers[name];
      },
      json(payload) {
        this.body = payload;
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
      end(payload) {
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
    };

    router.handle(req, res, (error) => {
      if (error) {
        resolve({
          statusCode: error.statusCode || 500,
          body: {
            code: error.code || 'INTERNAL_SERVER_ERROR',
            error: error.message,
            details: error.details || null,
          },
        });
        return;
      }

      resolve({ statusCode: res.statusCode, body: res.body });
    });
  });

test('auth route rejects invalid signup payloads', async () => {
  const response = await invokeRouter(authRoutes, {
    method: 'POST',
    url: '/signup',
    headers: { 'content-type': 'application/json' },
    body: { email: 'not-an-email', password: 'short' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, 'VALIDATION_ERROR');
});

test('board session route requires authentication', async () => {
  const response = await invokeRouter(boardRoutes, {
    method: 'GET',
    url: '/6f6f6f6f-6f6f-4f6f-8f6f-6f6f6f6f6f6f/session',
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'AUTH_REQUIRED');
});
