const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

/**
 * Test suite for logs-service endpoints.
 */
describe('logs-service', () => {
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

  // Test: Logs endpoint should return an array of log entries
  test('GET /api/logs returns array', async () => {
    const res = await request(app).get('/api/logs');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Test: GET /api/logs should not include MongoDB _id field
  test('GET /api/logs does not include _id field', async () => {
    const res = await request(app).get('/api/logs');
    expect(res.statusCode).toBe(200);
    if (res.body.length > 0) {
      expect(res.body[0]).not.toHaveProperty('_id');
    }
  });

  // Test: POST /api/logs should accept log entries
  test('POST /api/logs accepts log entry', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({ service: 'test-service', type: 'test', message: 'test log' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
  });
});
