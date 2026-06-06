// Export revamped CV markdown to multiple formats.
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import jsPDF from "jspdf";

function stripMd(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)");
}

export function downloadText(md: string, base = "revamped-cv") {
  const plain = md
    .split("\n")
    .map((l) => stripMd(l.replace(/^#{1,6}\s*/, "")))
    .join("\n");
  saveAs(new Blob([plain], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
}

export function downloadMarkdown(md: string, base = "revamped-cv") {
  saveAs(new Blob([md], { type: "text/markdown;charset=utf-8" }), `${base}.md`);
}

export function downloadHtml(md: string, base = "revamped-cv") {
  // very light md -> html
  const html = md
    .split("\n")
    .map((l) => {
      if (/^###\s/.test(l)) return `<h3>${stripMd(l.replace(/^###\s/, ""))}</h3>`;
      if (/^##\s/.test(l)) return `<h2>${stripMd(l.replace(/^##\s/, ""))}</h2>`;
      if (/^#\s/.test(l)) return `<h1>${stripMd(l.replace(/^#\s/, ""))}</h1>`;
      if (/^\s*[-*]\s/.test(l)) return `<li>${stripMd(l.replace(/^\s*[-*]\s/, ""))}</li>`;
      if (l.trim() === "") return "";
      return `<p>${stripMd(l)}</p>`;
    })
    .join("\n");
  const doc = `<!doctype html><meta charset="utf-8"><title>CV</title>
<style>body{font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#111;line-height:1.5}h1,h2,h3{margin:1.2em 0 .4em}h1{font-size:24px}h2{font-size:18px;border-bottom:1px solid #ddd;padding-bottom:4px}h3{font-size:15px}li{margin:2px 0}</style>
${html}`;
  saveAs(new Blob([doc], { type: "text/html;charset=utf-8" }), `${base}.html`);
}

export async function downloadDocx(md: string, base = "revamped-cv") {
  const children: Paragraph[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") {
      children.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }
    if (/^#\s/.test(line)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: stripMd(line.replace(/^#\s/, "")), bold: true, size: 32 })],
        }),
      );
      continue;
    }
    if (/^##\s/.test(line)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: stripMd(line.replace(/^##\s/, "")), bold: true, size: 28 })],
        }),
      );
      continue;
    }
    if (/^###\s/.test(line)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: stripMd(line.replace(/^###\s/, "")), bold: true, size: 24 })],
        }),
      );
      continue;
    }
    if (/^\s*[-*]\s/.test(line)) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(stripMd(line.replace(/^\s*[-*]\s/, "")))],
        }),
      );
      continue;
    }
    // bold inline rendering
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    children.push(
      new Paragraph({
        children: parts.map((p) =>
          p.startsWith("**") && p.endsWith("**")
            ? new TextRun({ text: p.slice(2, -2), bold: true })
            : new TextRun(stripMd(p)),
        ),
      }),
    );
  }
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${base}.docx`);
}

export function downloadPdf(md: string, base = "revamped-cv") {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usable = pageWidth - margin * 2;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  for (const raw of md.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") {
      y += 8;
      continue;
    }
    let text = line;
    let size = 11;
    let bold = false;
    let leading = 14;
    let bullet = false;

    if (/^#\s/.test(line)) { text = line.replace(/^#\s/, ""); size = 18; bold = true; leading = 22; y += 6; }
    else if (/^##\s/.test(line)) { text = line.replace(/^##\s/, ""); size = 14; bold = true; leading = 18; y += 4; }
    else if (/^###\s/.test(line)) { text = line.replace(/^###\s/, ""); size = 12; bold = true; leading = 16; y += 2; }
    else if (/^\s*[-*]\s/.test(line)) { text = line.replace(/^\s*[-*]\s/, ""); bullet = true; }

    text = stripMd(text);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);

    const indent = bullet ? 14 : 0;
    const wrapped = pdf.splitTextToSize(text, usable - indent) as string[];
    for (let i = 0; i < wrapped.length; i++) {
      ensure(leading);
      if (bullet && i === 0) pdf.text("•", margin, y);
      pdf.text(wrapped[i], margin + indent, y);
      y += leading;
    }
  }
  pdf.save(`${base}.pdf`);
}
