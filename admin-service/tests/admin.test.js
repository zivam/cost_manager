const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

/**
 * Test suite for admin-service endpoints.
 */
describe('admin-service', () => {
  // Clean up: Close MongoDB connection after all tests complete
  afterAll(async () => {
    await mongoose.connection.close();
  });

  // Test: Health check endpoint should return 200 with status 'ok'
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  // Test: About endpoint should return an array of team members with first_name and last_name
  test('GET /api/about returns team array', async () => {
    const res = await request(app).get('/api/about');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('first_name');
      expect(res.body[0]).toHaveProperty('last_name');
    }
  });
});
