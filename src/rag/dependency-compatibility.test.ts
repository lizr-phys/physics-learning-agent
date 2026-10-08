import { strToU8, zipSync } from "fflate";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { extractDocumentChunks } from "@/rag/document-loader";

const sampleText = "Harmonic oscillator boundary conditions select normalizable states.";
const packageTypes = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>';

function officeZip(files: Record<string, string>) {
  return Buffer.from(zipSync(Object.fromEntries(
    Object.entries(files).map(([name, content]) => [name, strToU8(content)]),
  )));
}

// A complete one-page text PDF with calculated offsets; no external fixture files.
function textPdf() {
  const stream = `BT /F1 12 Tf 50 750 Td (${sampleText}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let output = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output);
}

function fixtures() {
  return [
    { name: "sample.rtf", data: Buffer.from(`{\\rtf1\\ansi ${sampleText}}`) },
    { name: "sample.pdf", data: textPdf() },
    {
      name: "sample.docx",
      data: officeZip({
        "[Content_Types].xml": packageTypes,
        "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${sampleText}</w:t></w:r></w:p></w:body></w:document>`,
      }),
    },
    {
      name: "sample.xlsx",
      data: officeZip({
        "[Content_Types].xml": packageTypes,
        "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Notes" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${sampleText}</t></is></c></row></sheetData></worksheet>`,
      }),
    },
    {
      name: "sample.pptx",
      data: officeZip({
        "[Content_Types].xml": packageTypes,
        "ppt/presentation.xml": '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
        "ppt/_rels/presentation.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
        "ppt/slides/slide1.xml": `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${sampleText}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
      }),
    },
  ];
}

describe("patched dependency compatibility", () => {
  it.each(fixtures())("extracts synthetic $name without writing user data", async ({ name, data }) => {
    const result = await extractDocumentChunks({
      fileName: name,
      data,
      metadata: { documentId: "synthetic-dependency-fixture", userId: "synthetic-user" },
    });

    expect(result.extractionMethod).toBe("officeparser-structure");
    expect(result.chunks.some((chunk) => chunk.content.includes("Harmonic oscillator"))).toBe(true);
    expect(result.chunks.every((chunk) => chunk.metadata?.documentId === "synthetic-dependency-fixture")).toBe(true);

    if (name.endsWith(".pdf")) expect(result.chunks[0].metadata?.pageNumber).toBe(1);
    if (name.endsWith(".pptx")) expect(result.chunks[0].metadata?.slideNumber).toBe(1);
    if (name.endsWith(".xlsx")) expect(result.chunks[0].metadata?.sheetName).toBe("Notes");
  }, 15_000);

  it("loads the native image binary and roundtrips PNG/AVIF in memory", async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 20, g: 40, b: 60 } },
    }).png().toBuffer();
    const avif = await sharp(png).avif().toBuffer();
    const resized = await sharp(avif).resize(4, 4).png().toBuffer();
    const metadata = await sharp(resized).metadata();

    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(4);
    expect(metadata.height).toBe(4);
  });
});
