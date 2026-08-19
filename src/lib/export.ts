import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type Row = Array<string | number | null | undefined>;

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function downloadCsv(filename: string, headers: string[], rows: Row[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => escape(cell(value))).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

export function downloadPdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: Row[],
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.setTextColor(26, 54, 93);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 40, 58);
  autoTable(doc, {
    startY: 74,
    head: [headers],
    body: rows.map((row) => row.map(cell)),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [26, 54, 93], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });
  doc.save(`${filename}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
