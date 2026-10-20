import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export async function exportPdf(
  filename: string,
  title: string,
  rows: [string, string][],
) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{font-family:Arial,sans-serif;color:#17202b;padding:28px}h1{font-size:22px;margin:0 0 8px}
    p{font-size:11px;color:#5f6b78;margin:0 0 22px}table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{text-align:left;padding:9px 7px;border-bottom:1px solid #dce2e8}th{width:38%;color:#435267}
    @page{margin:24px}
  </style></head><body><h1>${escapeHtml(title)}</h1><p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
  <table>${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table></body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  if (Platform.OS !== 'web') {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('PDF sharing is unavailable on this device.');
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: '.pdf',
    });
  }
}