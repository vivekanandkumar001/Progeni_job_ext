import { randomUUID } from 'node:crypto';
import zlib from 'node:zlib';
import { getDatabase } from '../config/mongodb.js';
import type { ResumeStudioData } from './resumeStudioService.js';

const EXPORT_LOGS_TABLE = 'resume_export_logs';

// CRC32 Lookup Table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function calculateCrc32(buf: Buffer): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

interface ZipEntry {
  name: string;
  data: string | Buffer;
}

function createZipArchive(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const compressed = zlib.deflateRawSync(dataBuf);
    const crc = calculateCrc32(dataBuf);

    // Local Header (30 bytes + name length + compressed length)
    const local = Buffer.alloc(30 + nameBuf.length + compressed.length);
    local.writeUInt32LE(0x04034b50, 0); // Local file header signature
    local.writeUInt16LE(20, 4); // Min version (2.0)
    local.writeUInt16LE(0, 6); // Flags
    local.writeUInt16LE(8, 8); // Compression: Deflate
    local.writeUInt16LE(0, 10); // Mod time
    local.writeUInt16LE(0, 12); // Mod date
    local.writeUInt32LE(crc, 14); // CRC32
    local.writeUInt32LE(compressed.length, 18); // Compressed size
    local.writeUInt32LE(dataBuf.length, 22); // Uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // Name length
    local.writeUInt16LE(0, 28); // Extra field length
    nameBuf.copy(local, 30);
    compressed.copy(local, 30 + nameBuf.length);
    localHeaders.push(local);

    // Central Directory Header (46 bytes + name length)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // Central directory signature
    central.writeUInt16LE(20, 4); // Made by version
    central.writeUInt16LE(20, 6); // Min version
    central.writeUInt16LE(0, 8); // Flags
    central.writeUInt16LE(8, 10); // Compression: Deflate
    central.writeUInt16LE(0, 12); // Mod time
    central.writeUInt16LE(0, 14); // Mod date
    central.writeUInt32LE(crc, 16); // CRC32
    central.writeUInt32LE(compressed.length, 20); // Compressed size
    central.writeUInt32LE(dataBuf.length, 24); // Uncompressed size
    central.writeUInt16LE(nameBuf.length, 28); // Name length
    central.writeUInt16LE(0, 30); // Extra field length
    central.writeUInt16LE(0, 32); // File comment length
    central.writeUInt16LE(0, 34); // Disk number start
    central.writeUInt16LE(0, 36); // Internal file attributes
    central.writeUInt32LE(0, 38); // External file attributes
    central.writeUInt32LE(offset, 42); // Relative offset of local header
    nameBuf.copy(central, 46);
    centralHeaders.push(central);

    offset += local.length;
  }

  const centralSize = centralHeaders.reduce((acc, h) => acc + h.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0); // End of central dir signature
  endRecord.writeUInt16LE(0, 4); // Number of this disk
  endRecord.writeUInt16LE(0, 6); // Disk where central directory starts
  endRecord.writeUInt16LE(entries.length, 8); // Number of central directory records on this disk
  endRecord.writeUInt16LE(entries.length, 10); // Total number of central directory records
  endRecord.writeUInt32LE(centralSize, 12); // Size of central directory
  endRecord.writeUInt32LE(offset, 16); // Offset of start of central directory
  endRecord.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, endRecord]);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapePdfText(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export class ResumeExportService {
  /**
   * Generates a deterministic, compliant PDF document from resume data.
   */
  async exportPdf(userId: string, resume: ResumeStudioData, clientIp?: string): Promise<Buffer> {
    const content = resume.content;
    const personal = content.personal_info;

    // Build text lines for PDF stream
    const commands: string[] = [];
    let currentY = 750;

    // Header: Name
    commands.push('BT');
    commands.push('/F2 20 Tf');
    commands.push(`50 ${currentY} Td`);
    commands.push(`(${escapePdfText(personal.full_name || 'Candidate')}) Tj`);
    commands.push('ET');
    currentY -= 20;

    // Target Role if present
    if (personal.target_role) {
      commands.push('BT');
      commands.push('/F1 12 Tf');
      commands.push(`50 ${currentY} Td`);
      commands.push(`(${escapePdfText(personal.target_role)}) Tj`);
      commands.push('ET');
      currentY -= 16;
    }

    // Contact Bar
    const contactParts: string[] = [];
    if (personal.email) contactParts.push(personal.email);
    if (personal.phone) contactParts.push(personal.phone);
    if (personal.city || personal.country) {
      contactParts.push([personal.city, personal.country].filter(Boolean).join(', '));
    }
    if (personal.linkedin_url) contactParts.push(personal.linkedin_url);

    if (contactParts.length > 0) {
      commands.push('BT');
      commands.push('/F1 9 Tf');
      commands.push(`50 ${currentY} Td`);
      commands.push(`(${escapePdfText(contactParts.join(' | '))}) Tj`);
      commands.push('ET');
      currentY -= 20;
    }

    // Section Ordering
    const sections = resume.section_order || ['summary', 'experience', 'education', 'skills', 'projects'];

    for (const sec of sections) {
      if (currentY < 100) break; // Keep within single/first page limit

      if (sec === 'summary' && content.summary) {
        commands.push('BT');
        commands.push('/F2 12 Tf');
        commands.push(`50 ${currentY} Td`);
        commands.push('(PROFESSIONAL SUMMARY) Tj');
        commands.push('ET');
        currentY -= 14;

        commands.push('BT');
        commands.push('/F1 10 Tf');
        commands.push(`50 ${currentY} Td`);
        commands.push(`(${escapePdfText(content.summary.slice(0, 250))}) Tj`);
        commands.push('ET');
        currentY -= 22;
      } else if (sec === 'experience' && content.work_experience?.length) {
        commands.push('BT');
        commands.push('/F2 12 Tf');
        commands.push(`50 ${currentY} Td`);
        commands.push('(WORK EXPERIENCE) Tj');
        commands.push('ET');
        currentY -= 14;

        for (const exp of content.work_experience.slice(0, 3)) {
          if (currentY < 100) break;
          const roleLine = `${exp.role} - ${exp.company} (${[exp.start_date, exp.end_date || 'Present'].filter(Boolean).join(' - ')})`;
          commands.push('BT');
          commands.push('/F2 10 Tf');
          commands.push(`50 ${currentY} Td`);
          commands.push(`(${escapePdfText(roleLine)}) Tj`);
          commands.push('ET');
          currentY -= 14;

          for (const bullet of (exp.highlights || []).slice(0, 2)) {
            commands.push('BT');
            commands.push('/F1 9 Tf');
            commands.push(`60 ${currentY} Td`);
            commands.push(`(- ${escapePdfText(bullet.slice(0, 110))}) Tj`);
            commands.push('ET');
            currentY -= 12;
          }
          currentY -= 4;
        }
        currentY -= 10;
      } else if (sec === 'education' && content.education?.length) {
        commands.push('BT');
        commands.push('/F2 12 Tf');
        commands.push(`50 ${currentY} Td`);
        commands.push('(EDUCATION) Tj');
        commands.push('ET');
        currentY -= 14;

        for (const edu of content.education.slice(0, 2)) {
          const eduLine = `${edu.degree}${edu.field_of_study ? ` in ${edu.field_of_study}` : ''} - ${edu.institution} (${[edu.start_year, edu.end_year].filter(Boolean).join(' - ')})`;
          commands.push('BT');
          commands.push('/F1 9 Tf');
          commands.push(`50 ${currentY} Td`);
          commands.push(`(${escapePdfText(eduLine)}) Tj`);
          commands.push('ET');
          currentY -= 14;
        }
        currentY -= 10;
      } else if (sec === 'skills' && content.skills?.length) {
        commands.push('BT');
        commands.push('/F2 12 Tf');
        commands.push(`50 ${currentY} Td`);
        commands.push('(TECHNICAL SKILLS) Tj');
        commands.push('ET');
        currentY -= 14;

        const skillLine = content.skills.map((s) => s.name).join(', ');
        commands.push('BT');
        commands.push('/F1 9 Tf');
        commands.push(`50 ${currentY} Td`);
        commands.push(`(${escapePdfText(skillLine.slice(0, 200))}) Tj`);
        commands.push('ET');
        currentY -= 20;
      }
    }

    const streamData = commands.join('\n');
    const streamLength = Buffer.byteLength(streamData, 'utf8');

    // Assemble PDF Objects
    const pdfParts: string[] = [
      '%PDF-1.4\n',
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 6 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
      `6 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamData}\nendstream\nendobj\n`,
    ];

    // Compute XREF offsets
    let offset = 0;
    const offsets: number[] = [0];
    for (const part of pdfParts) {
      offsets.push(offset);
      offset += Buffer.byteLength(part, 'utf8');
    }

    const xrefOffset = offset;
    let xref = `xref\n0 7\n0000000000 65535 f \n`;
    for (let i = 1; i <= 6; i++) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const fullPdf = Buffer.from(pdfParts.join('') + xref + trailer, 'utf8');

    // Audit Log
    await this.logExport(userId, resume.id, 'pdf', clientIp);

    return fullPdf;
  }

  /**
   * Generates a deterministic, compliant DOCX (Office Open XML) document.
   */
  async exportDocx(userId: string, resume: ResumeStudioData, clientIp?: string): Promise<Buffer> {
    const content = resume.content;
    const personal = content.personal_info;

    const paragraphs: string[] = [];

    // Title / Candidate Name
    paragraphs.push(
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${escapeXml(personal.full_name || 'Candidate')}</w:t></w:r></w:p>`,
    );

    // Target Role
    if (personal.target_role) {
      paragraphs.push(
        `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(personal.target_role)}</w:t></w:r></w:p>`,
      );
    }

    // Contact line
    const contacts: string[] = [];
    if (personal.email) contacts.push(personal.email);
    if (personal.phone) contacts.push(personal.phone);
    if (personal.city || personal.country) {
      contacts.push([personal.city, personal.country].filter(Boolean).join(', '));
    }
    if (personal.linkedin_url) contacts.push(personal.linkedin_url);

    if (contacts.length > 0) {
      paragraphs.push(
        `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(contacts.join(' | '))}</w:t></w:r></w:p>`,
      );
    }

    // Divider
    paragraphs.push('<w:p/>');

    // Sections
    const sections = resume.section_order || ['summary', 'experience', 'education', 'skills', 'projects'];

    for (const sec of sections) {
      if (sec === 'summary' && content.summary) {
        paragraphs.push(
          `<w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>PROFESSIONAL SUMMARY</w:t></w:r></w:p>`,
        );
        paragraphs.push(
          `<w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(content.summary)}</w:t></w:r></w:p>`,
        );
        paragraphs.push('<w:p/>');
      } else if (sec === 'experience' && content.work_experience?.length) {
        paragraphs.push(
          `<w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>WORK EXPERIENCE</w:t></w:r></w:p>`,
        );
        for (const exp of content.work_experience) {
          paragraphs.push(
            `<w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(exp.role)} - ${escapeXml(exp.company)}</w:t></w:r><w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>  (${escapeXml([exp.start_date, exp.end_date || 'Present'].filter(Boolean).join(' - '))})</w:t></w:r></w:p>`,
          );
          for (const highlight of exp.highlights || []) {
            paragraphs.push(
              `<w:p><w:pPr><w:ind w:left="360"/></w:pPr><w:r><w:t>• ${escapeXml(highlight)}</w:t></w:r></w:p>`,
            );
          }
        }
        paragraphs.push('<w:p/>');
      } else if (sec === 'education' && content.education?.length) {
        paragraphs.push(
          `<w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>EDUCATION</w:t></w:r></w:p>`,
        );
        for (const edu of content.education) {
          paragraphs.push(
            `<w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(edu.degree)}${edu.field_of_study ? ` in ${escapeXml(edu.field_of_study)}` : ''}</w:t></w:r><w:r><w:t> - ${escapeXml(edu.institution)} (${escapeXml([edu.start_year, edu.end_year].filter(Boolean).join(' - '))})</w:t></w:r></w:p>`,
          );
        }
        paragraphs.push('<w:p/>');
      } else if (sec === 'skills' && content.skills?.length) {
        paragraphs.push(
          `<w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>TECHNICAL SKILLS</w:t></w:r></w:p>`,
        );
        const skillText = content.skills.map((s) => s.name).join(', ');
        paragraphs.push(
          `<w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(skillText)}</w:t></w:r></w:p>`,
        );
        paragraphs.push('<w:p/>');
      }
    }

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join('\n    ')}
  </w:body>
</w:document>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const docxZip = createZipArchive([
      { name: '[Content_Types].xml', data: contentTypesXml },
      { name: '_rels/.rels', data: relsXml },
      { name: 'word/document.xml', data: documentXml },
    ]);

    // Audit Log
    await this.logExport(userId, resume.id, 'docx', clientIp);

    return docxZip;
  }

  private async logExport(
    userId: string,
    resumeId: string,
    format: 'pdf' | 'docx',
    clientIp?: string,
  ): Promise<void> {
    try {
      await (await getDatabase()).collection(EXPORT_LOGS_TABLE).insertOne({
        _id: randomUUID() as any,
        user_id: userId,
        resume_id: resumeId,
        format,
        exported_at: new Date().toISOString(),
        client_ip: clientIp || '127.0.0.1',
      } as any);
    } catch {
      // Non-blocking logging
    }
  }
}

export const resumeExportService = new ResumeExportService();
