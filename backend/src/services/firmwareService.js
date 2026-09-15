const crypto = require('crypto');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,31}$/;
const FILENAME_PATTERN = /^secure-door-[0-9A-Za-z._-]+\.bin$/;
const DEFAULT_LINK_TTL_SECONDS = 15 * 60;

function firmwareDirectory() {
  return path.resolve(
    process.env.FIRMWARE_STORAGE_DIR
      || path.join(__dirname, '..', '..', 'firmware')
  );
}

function signingSecret() {
  const secret = process.env.OTA_SIGNING_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('OTA_SIGNING_SECRET üretim ortamında zorunludur.');
  }

  return 'securelab-development-ota-secret';
}

function normalizeVersion(version) {
  const normalized = String(version || '').trim();
  if (!VERSION_PATTERN.test(normalized)) {
    const error = new Error('Firmware sürümü 1-32 karakter olmalı; yalnızca harf, rakam, nokta, tire ve alt çizgi kullanılabilir.');
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function filenameForVersion(version) {
  return `secure-door-${normalizeVersion(version)}.bin`;
}

function metadataPath(filename) {
  return path.join(firmwareDirectory(), `${filename}.json`);
}

function binaryPath(filename) {
  if (!FILENAME_PATTERN.test(filename)) {
    const error = new Error('Geçersiz firmware dosya adı.');
    error.statusCode = 400;
    throw error;
  }
  return path.join(firmwareDirectory(), filename);
}

async function ensureDirectory() {
  await fsPromises.mkdir(firmwareDirectory(), { recursive: true });
}

async function saveFirmware(buffer, version) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 1024) {
    const error = new Error('Firmware gövdesi boş veya çok küçük.');
    error.statusCode = 400;
    throw error;
  }

  // ESP32 uygulama imajları 0xE9 magic byte ile başlar.
  if (buffer[0] !== 0xE9) {
    const error = new Error('Dosya geçerli bir ESP32 firmware .bin imajı değil.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedVersion = normalizeVersion(version);
  const filename = filenameForVersion(normalizedVersion);
  const destination = binaryPath(filename);
  const temporary = `${destination}.${process.pid}.tmp`;
  const md5 = crypto.createHash('md5').update(buffer).digest('hex');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const metadata = {
    filename,
    version: normalizedVersion,
    size: buffer.length,
    md5,
    sha256,
    uploadedAt: new Date().toISOString()
  };

  await ensureDirectory();
  await fsPromises.writeFile(temporary, buffer, { flag: 'wx' });
  await fsPromises.rm(destination, { force: true });
  await fsPromises.rename(temporary, destination);
  await fsPromises.writeFile(metadataPath(filename), JSON.stringify(metadata, null, 2), 'utf8');

  return metadata;
}

async function readMetadata(filename) {
  const filePath = binaryPath(filename);
  try {
    const [rawMetadata, stat] = await Promise.all([
      fsPromises.readFile(metadataPath(filename), 'utf8'),
      fsPromises.stat(filePath)
    ]);
    const metadata = JSON.parse(rawMetadata);
    if (metadata.filename !== filename || Number(metadata.size) !== stat.size) {
      throw new Error('Firmware metadata ile dosya boyutu eşleşmiyor.');
    }
    return { ...metadata, filePath };
  } catch (error) {
    if (error.code === 'ENOENT') {
      const notFound = new Error('Firmware bulunamadı.');
      notFound.statusCode = 404;
      throw notFound;
    }
    throw error;
  }
}

async function getFirmwareByVersion(version) {
  return readMetadata(filenameForVersion(version));
}

async function listFirmwares() {
  await ensureDirectory();
  const entries = await fsPromises.readdir(firmwareDirectory());
  const metadataFiles = entries.filter((entry) => entry.endsWith('.bin.json'));
  const results = [];

  for (const entry of metadataFiles) {
    try {
      const filename = entry.slice(0, -5);
      results.push(await readMetadata(filename));
    } catch (error) {
      // Yarım kalmış veya bozuk metadata listeyi tamamen bozmasın.
    }
  }

  return results
    .map(({ filePath, ...metadata }) => metadata)
    .sort((left, right) => String(right.uploadedAt).localeCompare(String(left.uploadedAt)));
}

function signaturePayload(filename, deviceId, expires) {
  return `${filename}\n${deviceId}\n${expires}`;
}

function createSignature(filename, deviceId, expires) {
  return crypto
    .createHmac('sha256', signingSecret())
    .update(signaturePayload(filename, deviceId, expires))
    .digest('hex');
}

function verifySignature(filename, deviceId, expires, signature) {
  if (!/^\d+$/.test(String(expires || '')) || Number(expires) < Math.floor(Date.now() / 1000)) {
    return false;
  }
  if (!/^[0-9a-f]{64}$/i.test(String(signature || ''))) return false;

  const expected = Buffer.from(createSignature(filename, deviceId, expires), 'hex');
  const received = Buffer.from(String(signature), 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function buildSignedDownloadUrl(baseUrl, metadata, deviceId, ttlSeconds = DEFAULT_LINK_TTL_SECONDS) {
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!/^http:\/\//i.test(normalizedBaseUrl)) {
    const error = new Error('Bu sürümde FIRMWARE_PUBLIC_BASE_URL http:// ile başlamalıdır.');
    error.statusCode = 500;
    throw error;
  }

  const expires = Math.floor(Date.now() / 1000) + Math.max(60, Number(ttlSeconds) || DEFAULT_LINK_TTL_SECONDS);
  const url = new URL(`${normalizedBaseUrl}/api/firmware/download/${encodeURIComponent(metadata.filename)}`);
  url.searchParams.set('cihaz_id', String(deviceId));
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('signature', createSignature(metadata.filename, deviceId, expires));
  return url.toString();
}

function createReadStream(filePath) {
  return fs.createReadStream(filePath);
}

module.exports = {
  buildSignedDownloadUrl,
  createReadStream,
  getFirmwareByVersion,
  listFirmwares,
  readMetadata,
  saveFirmware,
  verifySignature
};
