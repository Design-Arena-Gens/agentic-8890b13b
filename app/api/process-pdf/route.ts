import { NextRequest } from 'next/server';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window === 'undefined') {
  const workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

function detectMathPatterns(text: string): string {
  // Common math patterns to convert to LaTeX
  let processed = text;

  // Fractions: convert "a/b" to LaTeX when surrounded by spaces or operators
  processed = processed.replace(/(\d+)\/(\d+)/g, '\\frac{$1}{$2}');

  // Exponents: convert "x^2" to LaTeX
  processed = processed.replace(/([a-zA-Z0-9]+)\^(\d+)/g, '$1^{$2}');
  processed = processed.replace(/([a-zA-Z0-9]+)\^{([^}]+)}/g, '$1^{$2}');

  // Square roots
  processed = processed.replace(/√\(([^)]+)\)/g, '\\sqrt{$1}');
  processed = processed.replace(/√(\d+)/g, '\\sqrt{$1}');

  // Greek letters
  const greekLetters: Record<string, string> = {
    'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
    'ε': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
    'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
    'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho',
    'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi',
    'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
    'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda',
    'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Φ': '\\Phi',
    'Ψ': '\\Psi', 'Ω': '\\Omega'
  };

  Object.entries(greekLetters).forEach(([char, latex]) => {
    processed = processed.replace(new RegExp(char, 'g'), `$${latex}$`);
  });

  // Math operators and symbols
  processed = processed.replace(/≤/g, '$\\leq$');
  processed = processed.replace(/≥/g, '$\\geq$');
  processed = processed.replace(/≠/g, '$\\neq$');
  processed = processed.replace(/±/g, '$\\pm$');
  processed = processed.replace(/∞/g, '$\\infty$');
  processed = processed.replace(/∑/g, '$\\sum$');
  processed = processed.replace(/∫/g, '$\\int$');
  processed = processed.replace(/∂/g, '$\\partial$');
  processed = processed.replace(/∇/g, '$\\nabla$');
  processed = processed.replace(/×/g, '$\\times$');
  processed = processed.replace(/÷/g, '$\\div$');

  // Detect equation-like patterns (contains = with numbers/variables)
  const equationPattern = /([a-zA-Z0-9+\-*/^().\s]+=[a-zA-Z0-9+\-*/^().\s]+)/g;
  processed = processed.replace(equationPattern, (match) => {
    // Don't wrap if already in LaTeX
    if (match.includes('$')) return match;
    // Check if it looks like a math equation
    if (/[+\-*/^=]/.test(match) && /\d/.test(match)) {
      return `$$${match.trim()}$$`;
    }
    return match;
  });

  return processed;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await request.formData();
        const file = formData.get('pdf') as File;

        if (!file) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'No file provided' })}\n\n`)
          );
          controller.close();
          return;
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: 'Loading PDF...' })}\n\n`)
        );

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: `Processing ${numPages} pages...` })}\n\n`)
        );

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: `Processing page ${pageNum} of ${numPages}...` })}\n\n`)
          );

          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          // Extract text with positioning to maintain layout
          const textItems = textContent.items as any[];
          let pageText = '';
          let lastY = 0;

          textItems.forEach((item) => {
            if ('str' in item) {
              // Add line break if Y position changed significantly
              if (lastY && Math.abs(item.transform[5] - lastY) > 5) {
                pageText += '\n';
              }
              pageText += item.str + ' ';
              lastY = item.transform[5];
            }
          });

          // Clean up extra spaces
          pageText = pageText.replace(/ +/g, ' ').trim();

          // Detect and convert math patterns to LaTeX
          const processedText = detectMathPatterns(pageText);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'page',
              data: {
                pageNum,
                content: processedText
              }
            })}\n\n`)
          );
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'complete', message: 'Processing complete!' })}\n\n`)
        );

        controller.close();
      } catch (error) {
        console.error('Error processing PDF:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to process PDF'
          })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
