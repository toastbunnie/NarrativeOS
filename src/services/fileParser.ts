import { DocumentFileType, DocumentSegment } from '../types';

declare global {
  interface Window {
    pdfjsLib?: any;
    mammoth?: any;
  }
}

export interface ParsedDocumentResult {
  title: string;
  fileType: DocumentFileType;
  text: string;
  segments: DocumentSegment[];
  wordCount: number;
  pageCount?: number;
  error?: string;
  warning?: string;
}

export async function parseFile(file: File): Promise<ParsedDocumentResult> {
  const extension = file.name.split('.').pop()?.toUpperCase() || 'TXT';
  const fileName = file.name.replace(/\.[^/.]+$/, '');

  let fileType: DocumentFileType = 'TXT';
  if (['TXT', 'MD', 'PDF', 'DOC', 'DOCX', 'JSON', 'CSV'].includes(extension)) {
    fileType = extension as DocumentFileType;
  }

  try {
    if (fileType === 'TXT' || fileType === 'MD') {
      const text = await file.text();
      return processRawText(text, fileName, fileType);
    }

    if (fileType === 'JSON') {
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        const formatted = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
        return processRawText(formatted, fileName, fileType);
      } catch (e) {
        return processRawText(text, fileName, fileType);
      }
    }

    if (fileType === 'CSV') {
      const text = await file.text();
      return processRawText(text, fileName, fileType);
    }

    if (fileType === 'PDF') {
      return await parsePDFFile(file, fileName);
    }

    if (fileType === 'DOCX') {
      return await parseDocxFile(file, fileName);
    }

    if (fileType === 'DOC') {
      // Try docx parsing first, if fails alert
      try {
        const res = await parseDocxFile(file, fileName);
        res.fileType = 'DOC';
        return res;
      } catch (e) {
        const text = await fallbackBinaryExtract(file);
        return {
          title: fileName,
          fileType: 'DOC',
          text,
          segments: segmentText(text),
          wordCount: countWords(text),
          warning: '检测到旧版 .DOC 二进制格式，建议在 Word/WPS 中另存为 .DOCX 获得 100% 格式还原。已提取基础文本流。',
        };
      }
    }

    const raw = await file.text();
    return processRawText(raw, fileName, 'TXT');
  } catch (err: any) {
    return {
      title: fileName,
      fileType,
      text: '',
      segments: [],
      wordCount: 0,
      error: `解析文件失败: ${err.message || String(err)}`,
    };
  }
}

async function parsePDFFile(file: File, fileName: string): Promise<ParsedDocumentResult> {
  const arrayBuffer = await file.arrayBuffer();
  
  if (!window.pdfjsLib) {
    throw new Error('PDF.js 解析器正在初始化，请刷新重试或粘贴纯文本。');
  }

  const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];
  const segments: DocumentSegment[] = [];

  let segmentIdx = 0;
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageString = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    pageTexts.push(pageString);

    const paragraphs = pageString.split(/\n\s*\n|\r\n\s*\r\n/).filter((p: string) => p.trim().length > 0);
    for (const para of paragraphs) {
      segments.push({
        id: `seg_${segmentIdx++}`,
        index: segmentIdx,
        text: para.trim(),
        page: i,
      });
    }
  }

  const fullText = pageTexts.join('\n\n--- [Page Break] ---\n\n');
  return {
    title: fileName,
    fileType: 'PDF',
    text: fullText,
    segments: segments.length > 0 ? segments : segmentText(fullText),
    wordCount: countWords(fullText),
    pageCount: numPages,
  };
}

async function parseDocxFile(file: File, fileName: string): Promise<ParsedDocumentResult> {
  const arrayBuffer = await file.arrayBuffer();

  if (!window.mammoth) {
    throw new Error('Mammoth.js 正在加载，请稍候重试。');
  }

  const result = await window.mammoth.extractRawText({ arrayBuffer });
  const fullText = result.value || '';

  return {
    title: fileName,
    fileType: 'DOCX',
    text: fullText,
    segments: segmentText(fullText),
    wordCount: countWords(fullText),
    warning: result.messages && result.messages.length > 0 ? result.messages.map((m: any) => m.message).join('; ') : undefined,
  };
}

async function fallbackBinaryExtract(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    const code = bytes[i];
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code > 127) {
      str += String.fromCharCode(code);
    }
  }
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ').replace(/\s{3,}/g, '\n\n');
}

export function processRawText(text: string, title: string, fileType: DocumentFileType = 'TXT'): ParsedDocumentResult {
  const segments = segmentText(text);
  return {
    title,
    fileType,
    text,
    segments,
    wordCount: countWords(text),
  };
}

export function segmentText(fullText: string): DocumentSegment[] {
  if (!fullText) return [];
  const rawParagraphs = fullText.split(/\n+/);
  const segments: DocumentSegment[] = [];
  let currentOffset = 0;
  let segIndex = 0;

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (trimmed.length > 0) {
      segments.push({
        id: `seg_${segIndex}`,
        index: segIndex,
        text: trimmed,
        paragraphOffset: currentOffset,
      });
      segIndex++;
    }
    currentOffset += para.length + 1;
  }
  return segments;
}

export function countWords(text: string): number {
  if (!text) return 0;
  // Match CJK characters as individual words, and English words by whitespace
  const cjkMatches = text.match(/[\u4e00-\u9fa5]/g) || [];
  const nonCjkText = text.replace(/[\u4e00-\u9fa5]/g, ' ');
  const englishMatches = nonCjkText.match(/\b\w+\b/g) || [];
  return cjkMatches.length + englishMatches.length;
}
