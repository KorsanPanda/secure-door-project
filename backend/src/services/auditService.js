const prisma = require('../config/prisma');

function jsonSafe(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value, (_, item) => (
    typeof item === 'bigint' ? item.toString() : item
  )));
}

async function writeAudit({
  client = prisma,
  actorId = null,
  action = 'guncelle',
  tableName,
  recordId = null,
  before = null,
  after = null
}) {
  return client.denetimKaydi.create({
    data: {
      islemYapan: actorId == null ? null : BigInt(actorId),
      islemTuru: action,
      tabloAdi: String(tableName).slice(0, 64),
      kayitId: recordId == null ? null : String(recordId).slice(0, 64),
      eskiDeger: jsonSafe(before),
      yeniDeger: jsonSafe(after)
    }
  });
}

module.exports = { writeAudit };
