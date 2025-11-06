'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const MathRenderer = dynamic(() => import('./components/MathRenderer'), {
  ssr: false,
});

interface ProcessedPage {
  pageNum: number;
  content: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<ProcessedPage[]>([]);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setError('');
        setResults([]);
      } else {
        setError('Please select a PDF file');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setProcessing(true);
    setError('');
    setProgress('Uploading PDF...');
    setResults([]);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process PDF');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'progress') {
                setProgress(parsed.message);
              } else if (parsed.type === 'page') {
                setResults((prev) => [...prev, parsed.data]);
              } else if (parsed.type === 'complete') {
                setProgress('Complete!');
              } else if (parsed.type === 'error') {
                setError(parsed.message);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const downloadResults = () => {
    const content = results
      .map((page) => `\n\n=== Page ${page.pageNum} ===\n\n${page.content}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted-math-content.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Math OCR
          </h1>
          <p className="text-xl text-gray-700">
            Extract text and LaTeX equations from PDF documents
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Unlimited pages • Mathematical notation support
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex flex-col items-center gap-4">
            <label className="w-full max-w-md cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            <button
              onClick={handleUpload}
              disabled={!file || processing}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {processing ? 'Processing...' : 'Extract Text & Equations'}
            </button>

            {progress && (
              <div className="w-full max-w-md">
                <p className="text-sm text-gray-600 text-center">{progress}</p>
              </div>
            )}

            {error && (
              <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>

        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                Extracted Content ({results.length} pages)
              </h2>
              <button
                onClick={downloadResults}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Download as Text
              </button>
            </div>

            <div className="space-y-8">
              {results.map((page) => (
                <div key={page.pageNum} className="border-b border-gray-200 pb-8 last:border-b-0">
                  <h3 className="text-lg font-semibold mb-4 text-gray-700">
                    Page {page.pageNum}
                  </h3>
                  <MathRenderer content={page.content} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
