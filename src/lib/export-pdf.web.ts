import { jsPDF } from 'jspdf/dist/jspdf.es.min.js';
import { exportBinaryFile } from './export-file';

export async function exportPdf(
  filename: string,
  title: string,
  rows: [string, string][],
) {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = 56;
  const pageWidth = pdf.internal.pageSize.getWidth();

  const writeLine = (text: string, bold = false) => {
    const lines = pdf.splitTextToSize(text, pageWidth - 96) as string[];
    if (y + lines.length * 16 > pdf.internal.pageSize.getHeight() - 48) {
      pdf.addPage();
      y = 48;
    }
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.text(lines, 48, y);
    y += lines.length * 16;
  };

  writeLine(title, true);
  writeLine(`Generated ${new Date().toLocaleString()}`);
  y += 12;
  for (const [label, value] of rows) {
    writeLine(label, true);
    writeLine(value);
    y += 7;
  }

  await exportBinaryFile(filename, new Uint8Array(pdf.output('arraybuffer')), 'application/pdf');
}