// Export matched-jobs shortlist to CSV or PDF.
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

export interface ExportMatch {
  title: string;
  company: string;
  location: string;
  posted: string;
  url: string;
  match_percent: number;
  interview_probability: string;
  why_match: string;
  matched_keywords: string[];
}

function csvCell(v: string | number) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadMatchesCsv(matches: ExportMatch[], base = "job-shortlist") {
  const headers = [
    "Match %",
    "Interview probability",
    "Title",
    "Company",
    "Location",
    "Posted",
    "Why it matches",
    "Matched keywords",
    "Apply URL",
  ];
  const rows = matches.map((m) => [
    m.match_percent,
    m.interview_probability,
    m.title,
    m.company,
    m.location,
    m.posted,
    m.why_match,
    (m.matched_keywords || []).join("; "),
    m.url,
  ]);
  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
}

export function downloadMatchesPdf(matches: ExportMatch[], base = "job-shortlist") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLine = (text: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
  };

  writeLine("Job Shortlist", 18, true);
  writeLine(new Date().toLocaleString(), 9);
  y += 8;

  matches.forEach((m, i) => {
    ensureSpace(80);
    writeLine(`${i + 1}. ${m.title} — ${m.company}`, 12, true);
    writeLine(
      `Match ${m.match_percent}% · Interview: ${m.interview_probability} · ${m.location} · ${m.posted}`,
      9,
    );
    writeLine(`Why: ${m.why_match}`, 10);
    if (m.matched_keywords?.length) {
      writeLine(`Matched skills: ${m.matched_keywords.join(", ")}`, 10);
    }
    writeLine(`Apply: ${m.url}`, 10);
    y += 10;
  });

  doc.save(`${base}.pdf`);
}
