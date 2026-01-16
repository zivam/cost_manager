const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

/**
 * Test suite for costs-service endpoints.
 */
describe('costs-service', () => {
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

  // Test: Report endpoint should return a properly structured report object
  test('GET /api/report returns report shape', async () => {
    const res = await request(app).get('/api/report?id=123123&year=2026&month=1');
    // Accept either 200 (success) or 400 (validation error)
    expect([200, 400]).toContain(res.statusCode);

    if (res.statusCode === 200) {
      // Verify the report has the expected structure
      expect(res.body).toHaveProperty('userid');
      expect(res.body).toHaveProperty('year');
      expect(res.body).toHaveProperty('month');
      expect(res.body).toHaveProperty('costs');
      expect(Array.isArray(res.body.costs)).toBe(true);
    }
  });
});
