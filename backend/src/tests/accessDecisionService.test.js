jest.mock('../config/prisma', () => ({
  cihazKapiAtama: { findFirst: jest.fn() },
  kart: { findUnique: jest.fn() },
  yetkiKurali: { findMany: jest.fn() },
  kullaniciGrup: { findMany: jest.fn() },
  kullanici: { findMany: jest.fn() },
  kapiSifreGecmisi: { findFirst: jest.fn() }
}));

jest.mock('../services/cardApprovalService', () => ({
  handleUnknownCardScan: jest.fn()
}));

const prisma = require('../config/prisma');
const cardApprovalService = require('../services/cardApprovalService');
const accessDecisionService = require('../services/accessDecisionService');

describe('accessDecisionService kart doğrulaması', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('kapı ataması eksik olsa bile bilinmeyen kartı onay kuyruğuna ekler', async () => {
    prisma.kart.findUnique.mockResolvedValue(null);
    prisma.cihazKapiAtama.findFirst.mockResolvedValue(null);
    cardApprovalService.handleUnknownCardScan.mockResolvedValue({ success: false });

    const decision = await accessDecisionService.verifyCard({
      cihazId: 1,
      kapiId: 1,
      kartUid: 'ab:68:e5:06'
    });

    expect(cardApprovalService.handleUnknownCardScan).toHaveBeenCalledWith('AB:68:E5:06');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('aktif_kapi_bulunamadi');
  });

  test('kayıtlı kartı kapı ataması eksikken yeniden onay kuyruğuna eklemez', async () => {
    prisma.kart.findUnique.mockResolvedValue({
      kartUid: '3C:B2:24:07',
      durum: 'aktif',
      kartYetkilendirmeler: []
    });
    prisma.cihazKapiAtama.findFirst.mockResolvedValue(null);

    const decision = await accessDecisionService.verifyCard({
      cihazId: 1,
      kapiId: 1,
      kartUid: '3C:B2:24:07'
    });

    expect(cardApprovalService.handleUnknownCardScan).not.toHaveBeenCalled();
    expect(decision.reason).toBe('aktif_kapi_bulunamadi');
  });
});
