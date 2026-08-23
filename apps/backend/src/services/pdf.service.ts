import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { db } from '../db/connection.js';
import { companySettings } from '../db/schema/index.js';
import path from 'path';
import fs from 'fs';

function formatToRupiah(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'Rp 0';
  const val = typeof value === 'string' ? parseFloat(value) : value;
  return 'Rp ' + val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDateStr(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export async function generateQuotationPdf(
  res: Response,
  quo: any,
  items: any[],
  client: any
): Promise<void> {
  const [settings] = await db.select().from(companySettings).limit(1);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  // Stream directly to response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="QUOTATION_${quo.number}.pdf"`);
  doc.pipe(res);

  // Colors
  const primaryColor = '#4f46e5'; // Brand color Indigo
  const textDark = '#1f2937';
  const textGray = '#4b5563';
  const tableHeaderBg = '#f3f4f6';
  const borderLight = '#e5e7eb';

  // 1. Header (Company Info & Logo)
  let logoY = 40;
  if (settings?.logoUrl) {
    const rootDir = path.resolve();
    // Assuming uploads directory in apps/backend/uploads
    const logoPath = path.join(rootDir, settings.logoUrl);
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, logoY, { width: 60 });
      logoY = 110;
    }
  }

  doc.fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(settings?.name || 'TARALAYA STUDIO', 120, 40)
    .fontSize(9)
    .font('Helvetica')
    .fillColor(textGray)
    .text(settings?.address || '', 120, 65, { width: 250 })
    .text(`Email: ${settings?.email || '—'} | Telp: ${settings?.phone || '—'}`, 120, doc.y + 5);

  // Document Title
  doc.fillColor(primaryColor)
    .font('Helvetica-Bold')
    .fontSize(24)
    .text('QUOTATION', 400, 40, { align: 'right' })
    .fontSize(10)
    .fillColor(textDark)
    .font('Helvetica-Bold')
    .text(`NO: ${quo.number}`, 400, 70, { align: 'right' })
    .font('Helvetica')
    .fillColor(textGray)
    .text(`Tanggal: ${formatDateStr(quo.issuedDate)}`, 400, 85, { align: 'right' })
    .text(`Berlaku s/d: ${formatDateStr(quo.validUntil)}`, 400, 100, { align: 'right' });

  // Divider Line
  doc.moveTo(40, 140).lineTo(555, 140).strokeColor(borderLight).lineWidth(1).stroke();

  // 2. Info Klien (Bill To) & Details
  let clientY = 160;
  doc.fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('DITUJUKAN KEPADA:', 40, clientY)
    .fontSize(12)
    .text(client.name, 40, clientY + 15)
    .font('Helvetica')
    .fontSize(9)
    .fillColor(textGray)
    .text(`PIC: ${client.picName || '—'}`, 40, doc.y + 5)
    .text(`Email: ${client.email || '—'}`, 40, doc.y + 3)
    .text(`Telp: ${client.phone || '—'}`, 40, doc.y + 3)
    .text(`Alamat: ${client.address || '—'}`, 40, doc.y + 3, { width: 300 });

  // Status Badge in PDF
  doc.fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('INFO TAMBAHAN:', 400, clientY)
    .fontSize(9)
    .font('Helvetica')
    .fillColor(textGray)
    .text(`Status: ${quo.status.toUpperCase()}`, 400, clientY + 15)
    .text(`Revisi: ${quo.revisionLabel || '—'}`, 400, doc.y + 3);

  // 3. Items Table Header
  let tableY = 280;
  doc.rect(40, tableY, 515, 20).fill(tableHeaderBg);

  doc.fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('DESKRIPSI ITEM', 45, tableY + 6)
    .text('QTY', 340, tableY + 6, { width: 30, align: 'center' })
    .text('HARGA SATUAN', 380, tableY + 6, { width: 80, align: 'right' })
    .text('SUBTOTAL', 470, tableY + 6, { width: 80, align: 'right' });

  // Draw Items Rows
  let currentY = tableY + 20;
  doc.font('Helvetica').fontSize(9);

  items.forEach((item, index) => {
    // Avoid page breaking issues by wrapping rows
    if (currentY > 700) {
      doc.addPage();
      currentY = 40;
    }

    // Row Background (zebra striping)
    if (index % 2 === 1) {
      doc.rect(40, currentY, 515, 20).fill('#f9fafb');
    }

    doc.fillColor(textDark)
      .text(item.name, 45, currentY + 6, { width: 280, height: 12, ellipsis: true })
      .text(String(parseFloat(item.qty)), 340, currentY + 6, { width: 30, align: 'center' })
      .text(formatToRupiah(item.unitPrice), 380, currentY + 6, { width: 80, align: 'right' })
      .text(formatToRupiah(item.subtotal), 470, currentY + 6, { width: 80, align: 'right' });

    currentY += 20;
  });

  // Table bottom border
  doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor(borderLight).stroke();

  // 4. Totals Block
  let totalsY = currentY + 15;
  if (totalsY > 700) {
    doc.addPage();
    totalsY = 40;
  }

  // Notes
  if (quo.notes) {
    doc.fillColor(textDark)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('CATATAN:', 40, totalsY)
      .font('Helvetica')
      .fillColor(textGray)
      .text(quo.notes, 40, totalsY + 12, { width: 300 });
  }

  // Totals calculations
  doc.fillColor(textDark)
    .font('Helvetica')
    .text('Subtotal:', 380, totalsY, { width: 80, align: 'right' })
    .text(formatToRupiah(quo.subtotal), 470, totalsY, { width: 80, align: 'right' });

  let offset = 15;
  if (parseFloat(quo.discount) > 0) {
    doc.text('Diskon:', 380, totalsY + offset, { width: 80, align: 'right' })
      .text(`-${formatToRupiah(quo.discount)}`, 470, totalsY + offset, { width: 80, align: 'right' });
    offset += 15;
  }

  if (parseFloat(quo.tax) > 0) {
    const taxLabel = parseFloat(quo.taxRate) > 0 ? `Pajak (${parseFloat(quo.taxRate)}%):` : 'Pajak:';
    doc.text(taxLabel, 360, totalsY + offset, { width: 100, align: 'right' })
      .text(formatToRupiah(quo.tax), 470, totalsY + offset, { width: 80, align: 'right' });
    offset += 15;
  }

  doc.font('Helvetica-Bold')
    .text('Total:', 380, totalsY + offset, { width: 80, align: 'right' })
    .fillColor(primaryColor)
    .text(formatToRupiah(quo.total), 470, totalsY + offset, { width: 80, align: 'right' });

  // Bank Info (from settings)
  let afterBankY = totalsY + offset + 35;
  if (settings?.bankName && settings?.bankAccountHolder && settings?.bankAccountNumber) {
    let bankY = afterBankY;
    if (bankY > 720) {
      doc.addPage();
      bankY = 40;
    }
    doc.moveTo(40, bankY - 10).lineTo(555, bankY - 10).strokeColor(borderLight).stroke();
    doc.fillColor(textDark)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('INFORMASI PEMBAYARAN:', 40, bankY)
      .font('Helvetica')
      .fillColor(textGray)
      .text(`Bank: ${settings.bankName}`, 40, bankY + 12)
      .text(`No. Rekening: ${settings.bankAccountNumber}`, 40, bankY + 24)
      .text(`Atas Nama: ${settings.bankAccountHolder}`, 40, bankY + 36);
    afterBankY = bankY + 60;
  }

  // Signature block
  {
    const sigBoxW = 150;
    const sigBoxX = 555 - sigBoxW; // right-aligned
    let sigY = afterBankY + 10;
    if (sigY > 700) {
      doc.addPage();
      sigY = 40;
    }

    doc.fillColor(textGray).font('Helvetica').fontSize(8)
      .text('Hormat Kami,', sigBoxX, sigY, { width: sigBoxW, align: 'center' });

    if (settings?.signatureUrl) {
      const sigPath = path.join(
        path.resolve(), 'uploads',
        path.basename(settings.signatureUrl)
      );
      if (fs.existsSync(sigPath)) {
        doc.image(sigPath, sigBoxX + 25, sigY + 8, { width: 100, height: 50, fit: [100, 50], align: 'center' });
      }
    }

    // signature line
    const lineY = sigY + 68;
    doc.moveTo(sigBoxX, lineY).lineTo(sigBoxX + sigBoxW, lineY).strokeColor(textDark).lineWidth(0.5).stroke();

    doc.fillColor(textDark).font('Helvetica-Bold').fontSize(8)
      .text(settings?.name ?? 'Taralaya Studio', sigBoxX, lineY + 4, { width: sigBoxW, align: 'center' });
  }

  doc.end();
}

export async function generateInvoicePdf(
  res: Response,
  inv: any,
  items: any[],
  installments: any[],
  client: any
): Promise<void> {
  const [settings] = await db.select().from(companySettings).limit(1);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  // Stream directly to response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="INVOICE_${inv.number}.pdf"`);
  doc.pipe(res);

  // Colors
  const primaryColor = '#0284c7'; // Sky blue / Teal-ish accent for Invoices
  const textDark = '#1f2937';
  const textGray = '#4b5563';
  const tableHeaderBg = '#f3f4f6';
  const borderLight = '#e5e7eb';

  // 1. Header (Company Info & Logo)
  let logoY = 40;
  if (settings?.logoUrl) {
    const rootDir = path.resolve();
    const logoPath = path.join(rootDir, settings.logoUrl);
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, logoY, { width: 60 });
      logoY = 110;
    }
  }

  doc.fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(settings?.name || 'TARALAYA STUDIO', 120, 40)
    .fontSize(9)
    .font('Helvetica')
    .fillColor(textGray)
    .text(settings?.address || '', 120, 65, { width: 250 })
    .text(`Email: ${settings?.email || '—'} | Telp: ${settings?.phone || '—'}`, 120, doc.y + 5);

  // Document Title
  doc.fillColor(primaryColor)
    .font('Helvetica-Bold')
    .fontSize(24)
    .text('INVOICE', 400, 40, { align: 'right' })
    .fontSize(10)
    .fillColor(textDark)
    .font('Helvetica-Bold')
    .text(`NO: ${inv.number}`, 400, 70, { align: 'right' })
    .font('Helvetica')
    .fillColor(textGray)
    .text(`Tanggal: ${formatDateStr(inv.issueDate)}`, 400, 85, { align: 'right' })
    .text(`Tenggat: ${formatDateStr(inv.dueDate)}`, 400, 100, { align: 'right' });

  // Divider Line
  doc.moveTo(40, 140).lineTo(555, 140).strokeColor(borderLight).lineWidth(1).stroke();

  // 2. Info Klien & Details
  let clientY = 160;
  doc.fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('DITAGIHKAN KEPADA:', 40, clientY)
    .fontSize(12)
    .text(client.name, 40, clientY + 15)
    .font('Helvetica')
    .fontSize(9)
    .fillColor(textGray)
    .text(`PIC: ${client.picName || '—'}`, 40, doc.y + 5)
    .text(`Email: ${client.email || '—'}`, 40, doc.y + 3)
    .text(`Telp: ${client.phone || '—'}`, 40, doc.y + 3)
    .text(`Alamat: ${client.address || '—'}`, 40, doc.y + 3, { width: 300 });

  // Status Block
  doc.fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('STATUS TAGIHAN:', 400, clientY)
    .fontSize(9)
    .font('Helvetica')
    .fillColor(textGray)
    .text(`Status: ${inv.status.toUpperCase()}`, 400, clientY + 15)
    .text(`Metode: ${inv.paymentType.toUpperCase()}`, 400, doc.y + 3);

  // 3. Items Table Header
  let tableY = 280;
  doc.rect(40, tableY, 515, 20).fill(tableHeaderBg);

  doc.fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('DESKRIPSI ITEM', 45, tableY + 6)
    .text('QTY', 340, tableY + 6, { width: 30, align: 'center' })
    .text('HARGA SATUAN', 380, tableY + 6, { width: 80, align: 'right' })
    .text('SUBTOTAL', 470, tableY + 6, { width: 80, align: 'right' });

  // Draw Items Rows
  let currentY = tableY + 20;
  doc.font('Helvetica').fontSize(9);

  items.forEach((item, index) => {
    if (currentY > 700) {
      doc.addPage();
      currentY = 40;
    }

    if (index % 2 === 1) {
      doc.rect(40, currentY, 515, 20).fill('#f9fafb');
    }

    doc.fillColor(textDark)
      .text(item.name, 45, currentY + 6, { width: 280, height: 12, ellipsis: true })
      .text(String(parseFloat(item.qty)), 340, currentY + 6, { width: 30, align: 'center' })
      .text(formatToRupiah(item.unitPrice), 380, currentY + 6, { width: 80, align: 'right' })
      .text(formatToRupiah(item.subtotal), 470, currentY + 6, { width: 80, align: 'right' });

    currentY += 20;
  });

  doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor(borderLight).stroke();

  // 4. Totals Block
  let totalsY = currentY + 15;
  if (totalsY > 680) {
    doc.addPage();
    totalsY = 40;
  }

  // Notes
  if (inv.notes) {
    doc.fillColor(textDark)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('CATATAN:', 40, totalsY)
      .font('Helvetica')
      .fillColor(textGray)
      .text(inv.notes, 40, totalsY + 12, { width: 300 });
  }

  // Totals calculations
  doc.fillColor(textDark)
    .font('Helvetica')
    .text('Subtotal:', 380, totalsY, { width: 80, align: 'right' })
    .text(formatToRupiah(inv.subtotal), 470, totalsY, { width: 80, align: 'right' });

  let offset = 15;
  if (parseFloat(inv.tax) > 0) {
    const taxLabel = parseFloat(inv.taxRate) > 0 ? `Pajak (${parseFloat(inv.taxRate)}%):` : 'Pajak:';
    doc.text(taxLabel, 360, totalsY + offset, { width: 100, align: 'right' })
      .text(formatToRupiah(inv.tax), 470, totalsY + offset, { width: 80, align: 'right' });
    offset += 15;
  }

  doc.font('Helvetica-Bold')
    .text('Total Tagihan:', 380, totalsY + offset, { width: 80, align: 'right' })
    .fillColor(primaryColor)
    .text(formatToRupiah(inv.total), 470, totalsY + offset, { width: 80, align: 'right' });

  // 5. Installments Section (Termin Pembayaran)
  let instY = totalsY + offset + 35;
  if (instY > 620) {
    doc.addPage();
    instY = 40;
  }

  doc.moveTo(40, instY - 10).lineTo(555, instY - 10).strokeColor(borderLight).stroke();

  doc.fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('JADWAL PEMBAYARAN TERMIN / INSTALLMENTS:', 40, instY);

  // Installments Table Header
  let instTableY = instY + 18;
  doc.rect(40, instTableY, 515, 18).fill('#f3f4f6');
  doc.fontSize(8).fillColor(textDark)
    .text('TERMIN', 45, instTableY + 5)
    .text('PERSENTASE', 180, instTableY + 5, { width: 80, align: 'center' })
    .text('NOMINAL', 270, instTableY + 5, { width: 100, align: 'right' })
    .text('JATUH TEMPO', 380, instTableY + 5, { width: 100, align: 'center' })
    .text('STATUS', 490, instTableY + 5, { width: 60, align: 'center' });

  let rowY = instTableY + 18;
  doc.font('Helvetica').fontSize(8);

  installments.forEach((inst, index) => {
    if (rowY > 730) {
      doc.addPage();
      rowY = 40;
    }

    if (index % 2 === 1) {
      doc.rect(40, rowY, 515, 18).fill('#f9fafb');
    }

    const pct = parseFloat(inst.percentage).toFixed(0) + '%';
    const statusText = inst.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR';
    const statusColor = inst.status === 'paid' ? '#059669' : '#d97706';

    doc.fillColor(textDark)
      .text(inst.label, 45, rowY + 5)
      .text(pct, 180, rowY + 5, { width: 80, align: 'center' })
      .text(formatToRupiah(inst.amount), 270, rowY + 5, { width: 100, align: 'right' })
      .text(formatDateStr(inst.dueDate), 380, rowY + 5, { width: 100, align: 'center' })
      .fillColor(statusColor)
      .font('Helvetica-Bold')
      .text(statusText, 490, rowY + 5, { width: 60, align: 'center' })
      .font('Helvetica');

    rowY += 18;
  });

  doc.moveTo(40, rowY).lineTo(555, rowY).strokeColor(borderLight).stroke();

  // Bank Info
  let afterBankYInv = rowY + 15;
  if (settings?.bankName && settings?.bankAccountHolder && settings?.bankAccountNumber) {
    let bankY = afterBankYInv;
    if (bankY > 720) {
      doc.addPage();
      bankY = 40;
    }
    doc.fillColor(textDark)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('INFORMASI PEMBAYARAN:', 40, bankY)
      .font('Helvetica')
      .fillColor(textGray)
      .text(`Bank: ${settings.bankName} | No. Rekening: ${settings.bankAccountNumber} | A.N: ${settings.bankAccountHolder}`, 40, bankY + 12);
    afterBankYInv = bankY + 35;
  }

  // Signature block
  {
    const sigBoxW = 150;
    const sigBoxX = 555 - sigBoxW;
    let sigY = afterBankYInv + 10;
    if (sigY > 700) {
      doc.addPage();
      sigY = 40;
    }

    doc.fillColor(textGray).font('Helvetica').fontSize(8)
      .text('Hormat Kami,', sigBoxX, sigY, { width: sigBoxW, align: 'center' });

    if (settings?.signatureUrl) {
      const sigPath = path.join(
        path.resolve(), 'uploads',
        path.basename(settings.signatureUrl)
      );
      if (fs.existsSync(sigPath)) {
        doc.image(sigPath, sigBoxX + 25, sigY + 8, { width: 100, height: 50, fit: [100, 50], align: 'center' });
      }
    }

    const lineY = sigY + 68;
    doc.moveTo(sigBoxX, lineY).lineTo(sigBoxX + sigBoxW, lineY).strokeColor(textDark).lineWidth(0.5).stroke();

    doc.fillColor(textDark).font('Helvetica-Bold').fontSize(8)
      .text(settings?.name ?? 'Taralaya Studio', sigBoxX, lineY + 4, { width: sigBoxW, align: 'center' });
  }

  doc.end();
}

export async function generateDocumentPdf(
  res: Response,
  mergedContent: string,
  templateName: string
): Promise<void> {
  const [settings] = await db.select().from(companySettings).limit(1);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Stream directly to response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${templateName.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
  doc.pipe(res);

  const textDark = '#1f2937';
  const textGray = '#4b5563';
  const borderLight = '#e5e7eb';

  // 1. Header (Company Info & Logo)
  let logoY = 40;
  if (settings?.logoUrl) {
    const rootDir = path.resolve();
    const logoPath = path.join(rootDir, settings.logoUrl);
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, logoY, { width: 60 });
      logoY = 110;
    }
  }

  doc.fillColor(textDark)
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(settings?.name || 'TARALAYA STUDIO', 130, 40)
    .fontSize(9)
    .font('Helvetica')
    .fillColor(textGray)
    .text(settings?.address || '', 130, 60, { width: 250 })
    .text(`Email: ${settings?.email || '-'} | Telp: ${settings?.phone || '-'}`, 130, doc.y + 5);

  // Divider Line
  doc.moveTo(50, 110).lineTo(545, 110).strokeColor(borderLight).lineWidth(1).stroke();

  // 2. Document Title & Content
  doc.moveDown(2);
  doc.fillColor(textDark)
     .font('Helvetica-Bold')
     .fontSize(14)
     .text(templateName.toUpperCase(), { align: 'center' });
     
  doc.moveDown(2);

  // Content (merged placeholders)
  doc.font('Helvetica')
     .fontSize(11)
     .fillColor(textDark)
     .text(mergedContent, {
       align: 'left',
       lineGap: 4
     });

  // 3. Footer with signature if needed (just simple for now)
  doc.moveDown(4);

  // Signature block
  const sigBoxW = 150;
  const sigBoxX = 545 - sigBoxW;
  let sigY = doc.y;
  if (sigY > 700) {
    doc.addPage();
    sigY = 50;
  }

  doc.fillColor(textGray).font('Helvetica').fontSize(9)
    .text('Hormat Kami,', sigBoxX, sigY, { width: sigBoxW, align: 'center' });

  if (settings?.signatureUrl) {
    const sigPath = path.join(
      path.resolve(), 'uploads',
      path.basename(settings.signatureUrl)
    );
    if (fs.existsSync(sigPath)) {
      doc.image(sigPath, sigBoxX + 25, sigY + 15, { width: 100, height: 50, fit: [100, 50], align: 'center' });
    }
  }

  const lineY = sigY + 75;
  doc.moveTo(sigBoxX, lineY).lineTo(sigBoxX + sigBoxW, lineY).strokeColor(textDark).lineWidth(0.5).stroke();

  doc.fillColor(textDark).font('Helvetica-Bold').fontSize(9)
    .text(settings?.name ?? 'Taralaya Studio', sigBoxX, lineY + 5, { width: sigBoxW, align: 'center' });

  doc.end();
}
