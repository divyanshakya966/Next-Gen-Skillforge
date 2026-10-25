import { describe, it, expect, vi } from 'vitest';
import {
  extractPdfText,
  isPdfFile,
  pdfTextToTxtFile,
  PdfExtractionError,
  type PdfJsLike,
} from '@/lib/pdf-extract';

function makeLoader(pages: Array<Array<{ str?: string; hasEOL?: boolean }>>, destroy = vi.fn()) {
  const lib: PdfJsLike = {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: async (n: number) => ({
          getTextContent: async () => ({ items: pages[n - 1] }),
        }),
        destroy,
      }),
    }),
  };
  return { loader: async () => lib, destroy };
}

const pdf = new File([new Uint8Array([37, 80, 68, 70])], 'cv.pdf', { type: 'application/pdf' });

describe('isPdfFile', () => {
  it('detects PDFs by mime type or extension', () => {
    expect(isPdfFile({ name: 'a.pdf', type: '' })).toBe(true);
    expect(isPdfFile({ name: 'a', type: 'application/pdf' })).toBe(true);
    expect(isPdfFile({ name: 'A.PDF', type: '' })).toBe(true);
    expect(isPdfFile({ name: 'a.txt', type: 'text/plain' })).toBe(false);
  });
});

describe('extractPdfText', () => {
  it('joins text across pages', async () => {
    const { loader, destroy } = makeLoader([
      [{ str: 'Jane', hasEOL: false }, { str: 'Doe', hasEOL: true }],
      [{ str: 'Skills: TypeScript' }],
    ]);
    const text = await extractPdfText(pdf, loader);
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Skills: TypeScript');
    expect(destroy).toHaveBeenCalled();
  });

  it('throws an "empty" error when no text is found', async () => {
    const { loader } = makeLoader([[{ str: '  ' }], []]);
    await expect(extractPdfText(pdf, loader)).rejects.toMatchObject({
      name: 'PdfExtractionError',
      code: 'empty',
    });
  });

  it('wraps parser failures in a "failed" error', async () => {
    const loader = async () => {
      throw new Error('boom');
    };
    const err = await extractPdfText(pdf, loader).catch((e) => e);
    expect(err).toBeInstanceOf(PdfExtractionError);
    expect(err.code).toBe('failed');
  });
});

describe('pdfTextToTxtFile', () => {
  it('produces a .txt file the existing backend accepts', async () => {
    const file = pdfTextToTxtFile('hello world', 'My Resume.PDF');
    expect(file.name).toBe('My Resume.txt');
    expect(file.type).toBe('text/plain');
    expect(await file.text()).toBe('hello world');
  });
});
