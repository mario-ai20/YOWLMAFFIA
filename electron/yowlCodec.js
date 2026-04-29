const crypto = require('node:crypto');

const MAGIC = Buffer.from('YOWL');
const VERSION = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function deriveKey(secret, salt) {
  return crypto.pbkdf2Sync(secret, salt, 150000, KEY_LENGTH, 'sha512');
}

function encryptYowl(payload, secret) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(secret, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, tag, encrypted]);
}

function decryptYowl(buffer, secret) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Ongeldig .yowl-bestand.');
  }

  if (buffer.length < MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
    throw new Error('Het .yowl-bestand is te kort of beschadigd.');
  }

  const magic = buffer.subarray(0, MAGIC.length).toString('utf8');
  if (magic !== 'YOWL') {
    throw new Error('Dit bestand lijkt geen geldige .yowl-export.');
  }

  const version = buffer[MAGIC.length];
  if (version !== VERSION) {
    throw new Error(`Niet-ondersteunde .yowl-versie: ${version}.`);
  }

  const saltStart = MAGIC.length + 1;
  const ivStart = saltStart + SALT_LENGTH;
  const tagStart = ivStart + IV_LENGTH;
  const payloadStart = tagStart + TAG_LENGTH;

  const salt = buffer.subarray(saltStart, ivStart);
  const iv = buffer.subarray(ivStart, tagStart);
  const tag = buffer.subarray(tagStart, payloadStart);
  const encrypted = buffer.subarray(payloadStart);
  const key = deriveKey(secret, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted);
}

module.exports = {
  encryptYowl,
  decryptYowl
};
