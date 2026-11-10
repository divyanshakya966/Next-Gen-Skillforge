/**
 * Client-side PDF text extraction for resume uploads.
 *
 * pdfjs-dist is loaded with a dynamic import so it never ends up in the
 * initial bundle (and is never evaluated during SSR/static export).
 */

export class PdfExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: 'empty' | 'failed',
  ) {
    super(message);
    this.name = 'PdfExtractionError';
  }
}

export function isPdfFile(file: Pick<File, 'name' | 'type'>): boolean {
  return (file.type || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

type PdfTextItem = { str?: string; hasEOL?: boolean };

/** Minimal shape of the pdfjs-dist API we rely on (keeps the loader injectable for tests). */
export interface PdfJsLike {
  getDocument: (src: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: PdfTextItem[] }>;
        cleanup?: () => void;
      }>;
      destroy?: () => Promise<void> | void;
    }>;
  };
  GlobalWorkerOptions?: { workerSrc: string };
}

async function loadPdfJs(): Promise<PdfJsLike> {
  const pdfjs = (await import('pdfjs-dist')) as unknown as PdfJsLike;
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

/**
 * Extracts plain text from a PDF file in the browser.
 * Throws PdfExtractionError with a user-presentable message when the PDF
 * cannot be read or contains no extractable text (e.g. scanned images).
 */
export async function extractPdfText(
  file: File,
  loader: () => Promise<PdfJsLike> = loadPdfJs,
): Promise<string> {
  let doc: Awaited<ReturnType<PdfJsLike['getDocument']>['promise']> | null = null;
  try {
    const pdfjs = await loader();
    const data = new Uint8Array(await file.arrayBuffer());
    doc = await pdfjs.getDocument({ data }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let pageText = '';
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue;
        pageText += item.str + (item.hasEOL ? '\n' : ' ');
      }
      pages.push(pageText);
      page.cleanup?.();
    }

    const text = pages.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) {
      throw new PdfExtractionError(
        'No readable text found in this PDF. It may be a scanned image — try a text-based PDF or a .txt export.',
        'empty',
      );
    }
    return text;
  } catch (error) {
    if (error instanceof PdfExtractionError) throw error;
    throw new PdfExtractionError(
      'Could not read this PDF. It may be corrupted or password-protected — try another file or a .txt export.',
      'failed',
    );
  } finally {
    try {
      await doc?.destroy?.();
    } catch {
      /* ignore cleanup errors */
    }
  }
}

/** Wraps extracted text in a .txt File so the existing /api/resume/import contract is unchanged. */
export function pdfTextToTxtFile(text: string, originalName: string): File {
  const base = (originalName || 'resume').replace(/\.pdf$/i, '') || 'resume';
  return new File([text], `${base}.txt`, { type: 'text/plain' });
}
