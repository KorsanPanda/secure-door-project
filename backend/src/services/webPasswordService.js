const crypto = require('crypto');

function validateWebPassword(password) {
  const value = String(password || '');
  if (value.length < 8) {
    return { valid: false, message: 'Web şifresi en az 8 karakter olmalıdır.' };
  }
  if (value.length > 72) {
    return { valid: false, message: 'Web şifresi en fazla 72 karakter olabilir.' };
  }
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(value) || !/\d/.test(value)) {
    return { valid: false, message: 'Web şifresi en az bir harf ve bir rakam içermelidir.' };
  }
  return { valid: true };
}

function generateTemporaryWebPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const pick = (alphabet) => alphabet[crypto.randomInt(0, alphabet.length)];
  let password = `SL${pick(letters)}${pick(letters)}${pick(numbers)}${pick(numbers)}-`;
  while (password.length < 12) password += pick(letters + numbers);
  return password;
}

module.exports = {
  validateWebPassword,
  generateTemporaryWebPassword
};
