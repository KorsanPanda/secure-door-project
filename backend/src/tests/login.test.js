const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const request = require('supertest');
const app = require('../index');
const prisma = require('../config/prisma');
const argon2 = require('argon2');

describe('Login Testi', () => {
  const testEmail = `test_login_${Date.now()}@example.com`;
  const testPin = '1234';

  beforeAll(async () => {
    const pinHash = await argon2.hash(testPin);
    await prisma.kullanici.create({
      data: {
        ad: 'Test',
        soyad: 'Kullanici',
        eposta: testEmail,
        pinHash: pinHash,
        rol: 'hoca',
        durum: 'aktif'
      }
    });
  });

  afterAll(async () => {
    try {
      await prisma.kullanici.deleteMany({ where: { eposta: testEmail } });
    } catch (e) {
      // Bağlantı kapanma hatası olursa testi kırmasın
    }
  });

  test('POST /api/auth/login - Doğru eposta ve pin ile giriş yapılıp token alınabilmeli', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ eposta: testEmail, pin: testPin });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
  });
});