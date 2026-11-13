import { jsPDF } from 'jspdf';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface InvoiceItem { id: string; name?: string; count: number; price: number; }
export interface InvoiceOrder {
  _id: unknown; price: number; products?: InvoiceItem[];
  shipping: { street: string; city: string; date: Date | string };
  payment: { last4: string };
}

/** Keep the invoice's table and palette aligned with the order review page. */
export function createInvoice(order: InvoiceOrder): Buffer {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const logo = readFileSync(join(__dirname, '..', 'static', 'invoice-logo.png'));
  const logoHeight = 32;
  const logoWidth = logoHeight * logo.readUInt32BE(16) / logo.readUInt32BE(20);
  pdf.setProperties({ title: `Dragon shop invoice ${order._id}`, author: 'Dragon shop' });
  const money = (value: number) => `$${value.toFixed(2)}`;
  let y = 0;
  const page = () => {
    pdf.setFillColor('#f8faef'); pdf.rect(0, 0, 210, 297, 'F');
    pdf.setFillColor('#ffffff'); pdf.setDrawColor('#dfe7cc');
    pdf.roundedRect(12, 12, 186, 273, 4, 4, 'FD');
    pdf.addImage(logo, 'PNG', 188 - logoWidth, 20, logoWidth, logoHeight, 'shop-logo', 'FAST');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor('#6d785c');
    pdf.text('YOUR GOOD THINGS, ALL TOGETHER', 22, 27);
    pdf.setFont('times', 'normal'); pdf.setFontSize(27); pdf.setTextColor('#293b1d');
    pdf.text('Your order invoice', 22, 41);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
    pdf.text('Dragon shop', 22, 51);
    pdf.setFontSize(8); pdf.setTextColor('#6d785c');
    pdf.text(`Order: ${order._id}`, 22, 58);
    y = 68;
  };
  const tableHeader = () => {
    pdf.setFillColor('#edf3df'); pdf.rect(22, y - 5, 166, 11, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor('#6d785c');
    pdf.text('PRODUCT', 25, y + 2); pdf.text('QUANTITY', 113, y + 2, { align: 'right' });
    pdf.text('PRICE', 149, y + 2, { align: 'right' }); pdf.text('TOTAL', 185, y + 2, { align: 'right' });
    y += 14;
  };
  page(); tableHeader();
  for (const item of order.products ?? []) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
    const lines: string[] = pdf.splitTextToSize(item.name || 'Unavailable product', 63);
    // Split unusually long names as well as long orders across pages.
    for (let offset = 0; offset < lines.length; offset += 30) {
      const part = lines.slice(offset, offset + 30);
      const height = Math.max(13, part.length * 5 + 5);
      if (y + height > 263) { pdf.addPage(); page(); tableHeader(); }
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor('#293b1d');
      pdf.text(part, 25, y);
      if (offset === 0) {
        pdf.text(String(item.count), 113, y, { align: 'right' });
        pdf.text(money(item.price), 149, y, { align: 'right' });
        pdf.text(money(item.price * item.count), 185, y, { align: 'right' });
      }
      y += height;
      pdf.setDrawColor('#dfe7cc'); pdf.line(22, y - 6, 188, y - 6);
    }
  }
  const address: string[] = pdf.splitTextToSize(`Shipping to: ${order.shipping.street}, ${order.shipping.city}`, 160);
  if (y + 49 + address.length * 5 > 267) { pdf.addPage(); page(); }
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor('#496d20');
  pdf.text(`Total: ${money(order.price)}`, 185, y + 6, { align: 'right' });
  y += 21;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor('#293b1d');
  pdf.text(address, 25, y); y += address.length * 5 + 3;
  pdf.text(`Shipping date: ${new Date(order.shipping.date).toISOString().slice(0, 10)}`, 25, y);
  pdf.text(`Credit card ending: ${order.payment.last4}`, 25, y + 7);
  for (let number = 1; number <= pdf.getNumberOfPages(); number++) {
    pdf.setPage(number); pdf.setFontSize(8); pdf.setTextColor('#6d785c');
    pdf.text(`Dragon shop | ${number} / ${pdf.getNumberOfPages()}`, 188, 278, { align: 'right' });
  }
  return Buffer.from(pdf.output('arraybuffer'));
}
