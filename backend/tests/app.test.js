const request = require('supertest');
const app = require('../app');

describe('Backend health endpoint', () => {
  test('GET /health returns service status', async () => {
    const response = await request(app).get('/health');

    expect(response.statusCode).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe('backend');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('GET /api/users/profile requires authentication', async () => {
    const response = await request(app).get('/api/users/profile');

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toMatch(/Unauthorized/i);
  });

  test('GET /api/admin/allComplaints requires authentication', async () => {
    const response = await request(app).get('/api/admin/allComplaints');

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toMatch(/Unauthorized/i);
  });

  test('GET /api/worker/assignedComplaints requires authentication', async () => {
    const response = await request(app).get('/api/worker/assignedComplaints');

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toMatch(/Unauthorized/i);
  });
});
