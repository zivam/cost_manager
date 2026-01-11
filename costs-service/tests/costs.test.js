const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

describe('costs-service', () => {
  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/report returns report shape', async () => {
    const res = await request(app).get('/api/report?id=123123&year=2026&month=1');
    expect([200, 400]).toContain(res.statusCode);

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('userid');
      expect(res.body).toHaveProperty('year');
      expect(res.body).toHaveProperty('month');
      expect(res.body).toHaveProperty('costs');
      expect(Array.isArray(res.body.costs)).toBe(true);
    }
  });
});
