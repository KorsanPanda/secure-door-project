const nodemailer = require('nodemailer');

function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

async function sendPasswordResetEmail({ to, name, resetUrl, expiresAt }) {
  if (!isMailConfigured()) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'SecureLab web şifresi yenileme',
    text: `${name || 'Merhaba'},\n\nWeb şifrenizi yenilemek için aşağıdaki tek kullanımlık bağlantıyı açın:\n${resetUrl}\n\nBağlantı ${expiresAt.toLocaleString('tr-TR')} tarihinde geçersiz olacaktır. Bu talebi siz yapmadıysanız mesajı dikkate almayın.`,
    html: `<p>${name || 'Merhaba'},</p><p>Web şifrenizi yenilemek için 15 dakika geçerli tek kullanımlık bağlantıyı açın:</p><p><a href="${resetUrl}">Şifremi yenile</a></p><p>Bu talebi siz yapmadıysanız mesajı dikkate almayın.</p>`
  });
  return true;
}

module.exports = { isMailConfigured, sendPasswordResetEmail };
