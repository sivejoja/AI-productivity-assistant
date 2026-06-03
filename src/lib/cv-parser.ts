// Client-side CV parser: supports .txt, .md, .pdf, .docx, .doc
import mammoth from "mammoth";

async function parsePdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Use a CDN worker matching the installed version to avoid bundler worker setup.
  // @ts-expect-error - version field exists at runtime
  const version = pdfjs.version as string;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    parts.push(
      tc.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" "),
    );
  }
  return parts.join("\n\n");
}

async function parseDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value;
}

export async function extractCvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (name.endsWith(".pdf") || type === "application/pdf") {
    return parsePdf(file);
  }
  if (
    name.endsWith(".docx") ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return parseDocx(file);
  }
  if (name.endsWith(".doc")) {
    throw new Error(
      "Legacy .doc files aren't supported. Please save as .docx or .pdf.",
    );
  }
  // Plain text / markdown / unknown text-like
  return file.text();
}
