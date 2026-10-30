import * as XLSX from 'xlsx';
import { DomainRecord } from '../types/domain';

/**
 * Downloads a Blob as a file with the given filename
 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export results to Excel (.xlsx) using SheetJS (xlsx) library:
 * - Sheet named "Results"
 * - Bold header row
 * - Green fill for "yes" cells, red fill for "no" cells
 * - Auto column widths
 * - Second sheet "Summary" with totals
 */
export function exportToExcel(records: DomainRecord[], filename = 'domain-checker-results.xlsx') {
  if (records.length === 0) return;

  // Sort export data strictly by original input index
  const sortedRecords = [...records].sort(
    (a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0)
  );

  const wb = XLSX.utils.book_new();

  // Columns: Domain | Registered On | Updated On | SSL | Website
  const headers = ['Domain', 'Registered On', 'Updated On', 'SSL', 'Website'];

  const rows = sortedRecords.map((r) => [
    r.domain,
    r.registeredOn,
    r.updatedOn,
    r.ssl,
    r.website,
  ]);

  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Compute Auto Column Widths
  const colWidths = headers.map((header, colIndex) => {
    let maxLen = header.length;
    for (const row of rows) {
      const cellVal = String(row[colIndex] ?? '');
      if (cellVal.length > maxLen) {
        maxLen = cellVal.length;
      }
    }
    return { wch: Math.max(maxLen + 4, 12) };
  });
  ws['!cols'] = colWidths;

  // Apply styling to header and "yes"/"no" cells
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellAddress];
      if (!cell) continue;

      // Header row styling (bold header row)
      if (R === 0) {
        cell.s = {
          font: { bold: true, color: { rgb: '0F172A' }, name: 'Calibri' },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          alignment: { horizontal: 'left', vertical: 'center' },
        };
        continue;
      }

      // Column 3 = SSL, Column 4 = Website
      const valStr = String(cell.v || '').toLowerCase();
      if (C === 3 || C === 4) {
        if (valStr === 'yes') {
          cell.s = {
            fill: { fgColor: { rgb: 'DCFCE7' } }, // Green fill
            font: { bold: true, color: { rgb: '166534' } }, // Dark green text
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        } else if (valStr === 'no') {
          cell.s = {
            fill: { fgColor: { rgb: 'FEE2E2' } }, // Red fill
            font: { bold: true, color: { rgb: '991B1B' } }, // Dark red text
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        } else if (valStr === '?') {
          cell.s = {
            fill: { fgColor: { rgb: 'F1F5F9' } }, // Neutral gray fill
            font: { bold: true, color: { rgb: '475569' } }, // Gray text
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      }
    }
  }

  // Second Sheet: "Summary" with totals
  const total = records.length;
  const sslYes = records.filter((r) => r.ssl === 'yes').length;
  const sslNo = records.filter((r) => r.ssl === 'no').length;
  const webYes = records.filter((r) => r.website === 'yes').length;
  const webNo = records.filter((r) => r.website === 'no').length;
  const bothYes = records.filter((r) => r.ssl === 'yes' && r.website === 'yes').length;
  const whoisFound = records.filter((r) => r.registeredOn !== 'no data').length;

  const summaryHeaders = ['Metric', 'Count', 'Percentage'];
  const summaryRows = [
    ['Total Domains', total, '100%'],
    ['SSL = yes', sslYes, `${total ? Math.round((sslYes / total) * 100) : 0}%`],
    ['SSL = no', sslNo, `${total ? Math.round((sslNo / total) * 100) : 0}%`],
    ['Website = yes', webYes, `${total ? Math.round((webYes / total) * 100) : 0}%`],
    ['Website = no', webNo, `${total ? Math.round((webNo / total) * 100) : 0}%`],
    ['Both SSL & Website = yes', bothYes, `${total ? Math.round((bothYes / total) * 100) : 0}%`],
    ['WHOIS RDAP Data Available', whoisFound, `${total ? Math.round((whoisFound / total) * 100) : 0}%`],
  ];

  const summaryData = [summaryHeaders, ...summaryRows];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 14 }];

  // Sheet 1: Results, Sheet 2: Summary
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  triggerDownload(blob, filename);
}

/**
 * Export results to CSV with columns:
 * Domain, Registered On, Updated On, SSL, Website
 */
export function exportToCsv(records: DomainRecord[], filename = 'domain-checker-results.csv') {
  if (records.length === 0) return;

  // Sort export data strictly by original input index
  const sortedRecords = [...records].sort(
    (a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0)
  );

  const headers = ['Domain', 'Registered On', 'Updated On', 'SSL', 'Website'];

  const escapeCsv = (val: any) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvRows = [
    headers.join(','),
    ...sortedRecords.map((r) =>
      [
        escapeCsv(r.domain),
        escapeCsv(r.registeredOn),
        escapeCsv(r.updatedOn),
        escapeCsv(r.ssl),
        escapeCsv(r.website),
      ].join(',')
    ),
  ];

  const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}
