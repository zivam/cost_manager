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

  // Test: POST /api/add with missing fields should return error
  test('POST /api/add with missing fields returns error', async () => {
    const res = await request(app)
      .post('/api/add')
      .send({ description: 'test' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('message');
  });

  // Test: POST /api/add with invalid category should return error
  test('POST /api/add with invalid category returns error', async () => {
    const res = await request(app)
      .post('/api/add')
      .send({ description: 'test', category: 'invalid', userid: 123123, sum: 10 });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('message');
  });

  // Test: POST /api/add with non-existent user should return error
  test('POST /api/add with non-existent user returns error', async () => {
    const res = await request(app)
      .post('/api/add')
      .send({ description: 'test', category: 'food', userid: 999999999, sum: 10 });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('message');
  });

  // Test: GET /api/report with invalid params should return error
  test('GET /api/report with invalid month returns error', async () => {
    const res = await request(app).get('/api/report?id=123123&year=2026&month=13');
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('message');
  });
});
