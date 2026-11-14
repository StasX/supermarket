import { jsPDF } from 'jspdf';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface InvoiceItem {
  id: string;
  name?: string;
  count: number;
  price: number;
}
export interface InvoiceOrder {
  _id: unknown;
  price: number;
  products?: InvoiceItem[];
  shipping: { street: string; city: string; date: Date | string };
  payment: { last4: string };
}

/** Keep the invoice's table and palette aligned with the order review page. */
export function createInvoice(order: InvoiceOrder): Buffer {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const logo = readFileSync(join(__dirname, '..', 'static', 'invoice-logo.png'));
  const logoHeight = 32;
  const logoWidth = (logoHeight * logo.readUInt32BE(16)) / logo.readUInt32BE(20);
  pdf.setProperties({ title: `Dragon shop invoice ${order._id}`, author: 'Dragon shop' });
  const formatMoney = (value: number) => `$${value.toFixed(2)}`;
  let cursorY = 0;
  const drawPage = () => {
    pdf.setFillColor('#f8faef');
    pdf.rect(0, 0, 210, 297, 'F');
    pdf.setFillColor('#ffffff');
    pdf.setDrawColor('#dfe7cc');
    pdf.roundedRect(12, 12, 186, 273, 4, 4, 'FD');
    pdf.addImage(logo, 'PNG', 188 - logoWidth, 20, logoWidth, logoHeight, 'shop-logo', 'FAST');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor('#6d785c');
    pdf.text('YOUR GOOD THINGS, ALL TOGETHER', 22, 27);
    pdf.setFont('times', 'normal');
    pdf.setFontSize(27);
    pdf.setTextColor('#293b1d');
    pdf.text('Your order invoice', 22, 41);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text('Dragon shop', 22, 51);
    pdf.setFontSize(8);
    pdf.setTextColor('#6d785c');
    pdf.text(`Order: ${order._id}`, 22, 58);
    cursorY = 68;
  };
  const drawTableHeader = () => {
    pdf.setFillColor('#edf3df');
    pdf.rect(22, cursorY - 5, 166, 11, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor('#6d785c');
    pdf.text('PRODUCT', 25, cursorY + 2);
    pdf.text('QUANTITY', 113, cursorY + 2, { align: 'right' });
    pdf.text('PRICE', 149, cursorY + 2, { align: 'right' });
    pdf.text('TOTAL', 185, cursorY + 2, { align: 'right' });
    cursorY += 14;
  };
  drawPage();
  drawTableHeader();
  for (const item of order.products ?? []) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const lines: string[] = pdf.splitTextToSize(item.name || 'Unavailable product', 63);
    // Split unusually long names as well as long orders across pages.
    for (let offset = 0; offset < lines.length; offset += 30) {
      const nameLines = lines.slice(offset, offset + 30);
      const rowHeight = Math.max(13, nameLines.length * 5 + 5);
      if (cursorY + rowHeight > 263) {
        pdf.addPage();
        drawPage();
        drawTableHeader();
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor('#293b1d');
      pdf.text(nameLines, 25, cursorY);
      if (offset === 0) {
        pdf.text(String(item.count), 113, cursorY, { align: 'right' });
        pdf.text(formatMoney(item.price), 149, cursorY, { align: 'right' });
        pdf.text(formatMoney(item.price * item.count), 185, cursorY, { align: 'right' });
      }
      cursorY += rowHeight;
      pdf.setDrawColor('#dfe7cc');
      pdf.line(22, cursorY - 6, 188, cursorY - 6);
    }
  }
  const address: string[] = pdf.splitTextToSize(
    `Shipping to: ${order.shipping.street}, ${order.shipping.city}`,
    160,
  );
  if (cursorY + 49 + address.length * 5 > 267) {
    pdf.addPage();
    drawPage();
  }
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor('#496d20');
  pdf.text(`Total: ${formatMoney(order.price)}`, 185, cursorY + 6, { align: 'right' });
  cursorY += 21;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor('#293b1d');
  pdf.text(address, 25, cursorY);
  cursorY += address.length * 5 + 3;
  pdf.text(
    `Shipping date: ${new Date(order.shipping.date).toISOString().slice(0, 10)}`,
    25,
    cursorY,
  );
  pdf.text(`Credit card ending: ${order.payment.last4}`, 25, cursorY + 7);
  for (let pageNumber = 1; pageNumber <= pdf.getNumberOfPages(); pageNumber++) {
    pdf.setPage(pageNumber);
    pdf.setFontSize(8);
    pdf.setTextColor('#6d785c');
    pdf.text(`Dragon shop | ${pageNumber} / ${pdf.getNumberOfPages()}`, 188, 278, {
      align: 'right',
    });
  }
  return Buffer.from(pdf.output('arraybuffer'));
}
