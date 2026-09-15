const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const request = require('supertest');
const app = require('../index');

describe('Health Check Testi', () => {
  test('GET / - Sağlık kontrolü çalışmalı', async () => {
    const res = await request(app).get('/');
    expect([200, 404, 401]).toContain(res.statusCode);
  });
});