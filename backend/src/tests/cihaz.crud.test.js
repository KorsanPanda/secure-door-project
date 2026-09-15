const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const request = require('supertest');
const app = require('../index');
const prisma = require('../config/prisma');
const { getAdminToken } = require('./authTestUtils');

describe('Cihaz CRUD Entegrasyon Testleri', () => {
  let olusturulanCihazId;
  let adminToken;
  const testSeriNo = `CRUD-TEST-${Date.now()}`;

  beforeAll(async () => { adminToken = await getAdminToken(); });
  const authorized = (method, url) => request(app)[method](url)
    .set('Authorization', `Bearer ${adminToken}`);

  afterAll(async () => {
    try {
      await prisma.cihaz.deleteMany({ where: { seriNo: testSeriNo } });
    } catch (e) {
      // Test zaten sildiyse veya bağlantı kapandıysa sorun değil
    }
  });

  test('POST /api/cihazlar - seriNo olmadan istek 400 dönmeli', async () => {
    const res = await authorized('post', '/api/cihazlar').send({});
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('hata');
  });

  test('POST /api/cihazlar - Yeni cihaz oluşturulabilmeli', async () => {
    const res = await authorized('post', '/api/cihazlar')
      .send({ seriNo: testSeriNo });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('cihazId');
    expect(res.body.seriNo).toEqual(testSeriNo);
    olusturulanCihazId = res.body.cihazId;
  });

  test('POST /api/cihazlar - Aynı seriNo ile ikinci kayıt 409 dönmeli', async () => {
    const res = await authorized('post', '/api/cihazlar')
      .send({ seriNo: testSeriNo });

    expect(res.statusCode).toEqual(409);
  });

  test('GET /api/cihazlar/:id - Oluşturulan cihaz getirilebilmeli', async () => {
    const res = await authorized('get', `/api/cihazlar/${olusturulanCihazId}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.seriNo).toEqual(testSeriNo);
  });

  test('GET /api/cihazlar/:id - Var olmayan id için 404 dönmeli', async () => {
    const res = await authorized('get', '/api/cihazlar/999999999');
    expect(res.statusCode).toEqual(404);
  });

  test('PUT /api/cihazlar/:id - Cihaz güncellenebilmeli', async () => {
    const res = await authorized('put', `/api/cihazlar/${olusturulanCihazId}`)
      .send({ durum: 'bakimda' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.durum).toEqual('bakimda');
  });

  test('PUT /api/cihazlar/:id - Var olmayan id için 404 dönmeli', async () => {
    const res = await authorized('put', '/api/cihazlar/999999999')
      .send({ durum: 'aktif' });
    expect(res.statusCode).toEqual(404);
  });

  test('GET /api/cihazlar - Liste dönmeli ve oluşturulan cihazı içermeli', async () => {
    const res = await authorized('get', '/api/cihazlar');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    const bulunan = res.body.find((c) => c.seriNo === testSeriNo);
    expect(bulunan).toBeDefined();
  });

  test('DELETE /api/cihazlar/:id - Cihaz silinebilmeli', async () => {
    const res = await authorized('delete', `/api/cihazlar/${olusturulanCihazId}`);
    expect(res.statusCode).toEqual(200);
  });

  test('GET /api/cihazlar/:id - Silinen cihaz artık bulunamamalı', async () => {
    const res = await authorized('get', `/api/cihazlar/${olusturulanCihazId}`);
    expect(res.statusCode).toEqual(404);
  });

  test('DELETE /api/cihazlar/:id - Var olmayan id için 404 dönmeli', async () => {
    const res = await authorized('delete', '/api/cihazlar/999999999');
    expect(res.statusCode).toEqual(404);
  });
});
