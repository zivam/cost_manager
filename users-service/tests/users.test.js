const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

/**
 * Test suite for users-service endpoints.
 */
describe('users-service', () => {
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

  // Test: Users endpoint should return an array of all users
  test('GET /api/users returns array', async () => {
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Test: Get user by ID endpoint should return user details with total costs
  test('GET /api/users/123123 returns 200 or 404', async () => {
    const res = await request(app).get('/api/users/123123');
    // Accept either 200 (user found) or 404 (user not found)
    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      // Verify the response has the expected user properties and total costs
      expect(res.body).toHaveProperty('first_name');
      expect(res.body).toHaveProperty('last_name');
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('total');
    }
  });

  // Test: POST /api/add with missing fields should return error
  test('POST /api/add with missing fields returns error', async () => {
    const res = await request(app)
      .post('/api/add')
      .send({ id: 999888 });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('message');
  });

  // Test: POST /api/add with invalid id type should return error
  test('POST /api/add with invalid id type returns error', async () => {
    const res = await request(app)
      .post('/api/add')
      .send({ id: 'not-a-number', first_name: 'Test', last_name: 'User', birthday: '2000-01-01' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('message');
  });

  // Test: GET /api/users/:id with invalid id should return error
  test('GET /api/users/invalid returns error', async () => {
    const res = await request(app).get('/api/users/not-a-number');
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('message');
  });
});
