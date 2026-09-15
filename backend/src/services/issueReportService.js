// backend/src/services/issueReportService.js
const prisma = require('../config/prisma');

/**
 * 1. QR kod ile gelen yeni bir arıza bildirimini kaydeder.
 */
async function createIssueReport({ reportedBy = "Anonim", issueType, description, photoName = null, photoData = null }) {
  try {
    const newReport = await prisma.arizaBildirimi.create({
      data: {
        bildiren: reportedBy,
        arizaTuru: issueType,
        aciklama: description,
        fotografAdi: photoName,
        fotografVerisi: photoData,
        durum: "OPEN"
      }
    });

    console.log(`[ARIZA BİLDİRİMİ] Yeni arıza kaydı oluşturuldu: ID ${newReport.arizaId} - ${issueType}`);

    return {
      success: true,
      message: "Arıza bildiriminiz başarıyla yöneticilere iletildi. Teşekkür ederiz.",
      report: newReport
    };
  } catch (error) {
    console.error('Arıza kaydı oluşturulurken hata:', error);
    return { success: false, message: 'Arıza kaydı oluşturulamadı.' };
  }
}

/**
 * 2. Yöneticinin panelde tüm arıza bildirimlerini görmesini sağlar.
 */
async function getAllIssueReports() {
  return await prisma.arizaBildirimi.findMany({
    orderBy: { olusturulma: 'desc' }
  });
}

/**
 * 3. Yöneticinin arıza durumunu güncellemesini sağlar.
 */
async function updateReportStatus(reportId, status) {
  try {
    const report = await prisma.arizaBildirimi.update({
      where: { arizaId: Number(reportId) },
      data: { durum: status }
    });

    console.log(`[ARIZA GÜNCELLENDİ] ID: ${reportId} durumu yeni hali: ${status}`);

    return {
      success: true,
      message: `Arıza durumu '${status}' olarak güncellendi.`,
      report
    };
  } catch (error) {
    console.error('Arıza durumu güncellenirken hata:', error);
    return { success: false, message: 'Arıza kaydı güncellenemedi.' };
  }
}

module.exports = {
  createIssueReport,
  getAllIssueReports,
  updateReportStatus
};
