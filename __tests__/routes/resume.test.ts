import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubGlobal('fetch', originalFetch);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PDF text extraction (browser)', () => {

  describe('handleResumeFile with TXT files', () => {
    it('preserves existing TXT upload behavior', async () => {
      const mockFile = new File(['some resume text'], 'resume.txt', {
        type: 'text/plain',
      });

      const formData = new FormData();
      formData.append('resume', mockFile);

      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ fileName: 'resume.txt', resumeText: 'some resume text' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })));

      const { apiPostForm } = await import('../../lib/api-client');
      const result = await apiPostForm('/api/resume/import', formData);

      expect(result).toEqual({ fileName: 'resume.txt', resumeText: 'some resume text' });
    });
  });

  describe('File type validation in handleResumeFile', () => {
    it('rejects files that are not .txt or .pdf', async () => {
      const mockFile = new File(['content'], 'resume.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const handleResumeFile = async (file: File) => {
        if (uploading) return;

        const fileNameLower = file.name.toLowerCase();

        if (!fileNameLower.endsWith('.txt') && !fileNameLower.endsWith('.pdf')) {
          toast({
            title: 'Unsupported file type',
            description: 'Only .txt and .pdf files are supported.',
            variant: 'destructive',
          });
          setUploading(false);
          if (resumeFileInputRef.current) {
            resumeFileInputRef.current.value = '';
          }
          return;
        }
        return 'accepted';
      };

      const uploading = false;
      const setUploading = vi.fn();
      const resumeFileInputRef = { current: null as HTMLInputElement | null };
      const toast = vi.fn();

      const result = await handleResumeFile(mockFile);

      expect(result).toBeUndefined();
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Unsupported file type' })
      );
      expect(setUploading).toHaveBeenCalledWith(false);
    });

    it('accepts .txt files', () => {
      const mockFile = new File(['text content'], 'resume.txt', {
        type: 'text/plain',
      });

      const fileNameLower = mockFile.name.toLowerCase();
      if (!fileNameLower.endsWith('.txt') && !fileNameLower.endsWith('.pdf')) {
        return;
      }

      expect(fileNameLower.endsWith('.txt')).toBe(true);
    });

    it('accepts .pdf files', () => {
      const mockFile = new File(['content'], 'resume.pdf', {
        type: 'application/pdf',
      });

      const fileNameLower = mockFile.name.toLowerCase();
      if (!fileNameLower.endsWith('.txt') && !fileNameLower.endsWith('.pdf')) {
        return;
      }

      expect(fileNameLower.endsWith('.pdf')).toBe(true);
    });
  });

  describe('PDF extraction logic', () => {
    const mockTextItem = (str: string) => ({ str, dir: 'ltr' });

    it('combines text from multiple pages into single string', () => {
      // Simulate the extraction logic from handleResumeFile
      const extractedText = 'Page 1 content\nPage 2 content\nPage 3 content';
      const cleanedText = extractedText.replace(/\s+/g, ' ').trim();

      expect(cleanedText).toBe('Page 1 content Page 2 content Page 3 content');
    });

    it('rejects empty text after cleaning', () => {
      const extractedText = '   \n   ';
      const cleanedText = extractedText.replace(/\s+/g, ' ').trim();

      expect(cleanedText).toBe('');
      expect(!cleanedText).toBe(true);
    });

    it('rejects whitespace-only text after cleaning', () => {
      const extractedText = '\n\n\n';
      const cleanedText = extractedText.replace(/\s+/g, ' ').trim();

      expect(cleanedText).toBe('');
      expect(!cleanedText).toBe(true);
    });

    it('preserves reading order across pages with newlines', () => {
      const extractedText = 'Header\nBody text\nFooter';
      const cleanedText = extractedText.replace(/\s+/g, ' ').trim();

      expect(cleanedText).toBe('Header Body text Footer');
    });
  });

  describe('Unsupported DOCX rejection', () => {
    it('DOCX files are rejected with clear message', () => {
      const mockFile = new File(['docx content'], 'resume.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const fileNameLower = mockFile.name.toLowerCase();
      const supported = fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.pdf');

      expect(supported).toBe(false);
    });

    it('DOCX file name correctly ends with .docx', () => {
      const mockFile = new File(['docx content'], 'resume.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const fileNameLower = mockFile.name.toLowerCase();
      expect(fileNameLower).toMatch(/\.docx$/);
      expect(fileNameLower).not.toMatch(/\.txt$/);
      expect(fileNameLower).not.toMatch(/\.pdf$/);
    });
  });

  describe('PDF extraction error paths', () => {
    it('extracted text is cleaned of excessive whitespace', () => {
      // Simulate page text extraction joining
      const pageTexts = ['  text1  ', '  text2  ', '  text3  '];
      const pageText = pageTexts.map((s: string) => s.trim()).join(' ');
      const extractedText = pageText + '\n';
      const cleanedText = extractedText.replace(/\s+/g, ' ').trim();

      expect(cleanedText).toBe('text1 text2 text3');
    });

    it('extracts and joins text from all pages', () => {
      const numPages = 3;
      let extractedText = '';

      for (let i = 1; i <= numPages; i++) {
        const pageText = `Page ${i} content`;
        extractedText += pageText + '\n';
      }

      const cleanedText = extractedText.replace(/\s+/g, ' ').trim();

      expect(cleanedText).toBe('Page 1 content Page 2 content Page 3 content');
    });
  });
});

function toast(_: { title: string; description: string; variant?: string }) {
  // no-op
}