const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

describe('users-service', () => {
  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/users returns array', async () => {
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/users/123123 returns 200 or 404', async () => {
    const res = await request(app).get('/api/users/123123');
    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('first_name');
      expect(res.body).toHaveProperty('last_name');
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('total');
    }
  });
});
