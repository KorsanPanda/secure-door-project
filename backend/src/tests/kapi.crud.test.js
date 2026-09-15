const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const request = require('supertest');
const app = require('../index');
const prisma = require('../config/prisma');
const { getAdminToken } = require('./authTestUtils');

describe('Kapı CRUD Entegrasyon Testleri', () => {
  let olusturulanKapiId;
  let adminToken;
  const testAd = `Crud Test Kapı ${Date.now()}`;

  beforeAll(async () => { adminToken = await getAdminToken(); });
  const authorized = (method, url) => request(app)[method](url)
    .set('Authorization', `Bearer ${adminToken}`);

  afterAll(async () => {
    try {
      await prisma.kapi.deleteMany({ where: { ad: testAd } });
    } catch (e) {
      // Test zaten sildiyse veya bağlantı kapandıysa sorun değil
    }
  });

  test('POST /api/kapilar - ad olmadan istek 400 dönmeli', async () => {
    const res = await authorized('post', '/api/kapilar').send({});
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('hata');
  });

  test('POST /api/kapilar - Yeni kapı oluşturulabilmeli', async () => {
    const res = await authorized('post', '/api/kapilar')
      .send({
        ad: testAd,
        bina: 'A Blok',
        kat: 2,
        aciklama: 'Test amaçlı oluşturuldu'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('kapiId');
    expect(res.body.ad).toEqual(testAd);
    olusturulanKapiId = res.body.kapiId;
  });

  test('GET /api/kapilar/:id - Oluşturulan kapı getirilebilmeli', async () => {
    const res = await authorized('get', `/api/kapilar/${olusturulanKapiId}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.ad).toEqual(testAd);
  });

  test('GET /api/kapilar/:id - Var olmayan id için 404 dönmeli', async () => {
    const res = await authorized('get', '/api/kapilar/999999999');
    expect(res.statusCode).toEqual(404);
  });

  test('PUT /api/kapilar/:id - Kapı güncellenebilmeli', async () => {
    const res = await authorized('put', `/api/kapilar/${olusturulanKapiId}`)
      .send({ durum: 'bakimda' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.durum).toEqual('bakimda');
  });

  test('PUT /api/kapilar/:id - Var olmayan id için 404 dönmeli', async () => {
    const res = await authorized('put', '/api/kapilar/999999999')
      .send({ durum: 'aktif' });
    expect(res.statusCode).toEqual(404);
  });

  test('GET /api/kapilar - Liste dönmeli ve oluşturulan kapıyı içermeli', async () => {
    const res = await authorized('get', '/api/kapilar');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    const bulunan = res.body.find((k) => k.ad === testAd);
    expect(bulunan).toBeDefined();
  });

  test('DELETE /api/kapilar/:id - Kapı silinebilmeli', async () => {
    const res = await authorized('delete', `/api/kapilar/${olusturulanKapiId}`);
    expect(res.statusCode).toEqual(200);
  });

  test('GET /api/kapilar/:id - Silinen kapı artık bulunamamalı', async () => {
    const res = await authorized('get', `/api/kapilar/${olusturulanKapiId}`);
    expect(res.statusCode).toEqual(404);
  });

  test('DELETE /api/kapilar/:id - Var olmayan id için 404 dönmeli', async () => {
    const res = await authorized('delete', '/api/kapilar/999999999');
    expect(res.statusCode).toEqual(404);
  });
});
