const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

describe('logs-service', () => {
  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/logs returns array', async () => {
    const res = await request(app).get('/api/logs');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
