'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
}

export default function MathRenderer({ content }: MathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const lines = content.split('\n');

    lines.forEach((line) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'math-line';

      // Check if line contains LaTeX delimiters
      const displayMathRegex = /\$\$(.*?)\$\$/g;
      const inlineMathRegex = /\$(.*?)\$/g;

      let lastIndex = 0;
      let hasDisplayMath = false;
      let match;

      // First, handle display math ($$...$$)
      const tempLine = line;
      while ((match = displayMathRegex.exec(tempLine)) !== null) {
        hasDisplayMath = true;

        if (match.index > lastIndex) {
          const textSpan = document.createElement('span');
          textSpan.textContent = tempLine.substring(lastIndex, match.index);
          lineDiv.appendChild(textSpan);
        }

        const mathSpan = document.createElement('span');
        mathSpan.className = 'katex-display';
        try {
          katex.render(match[1], mathSpan, {
            displayMode: true,
            throwOnError: false,
          });
        } catch (e) {
          mathSpan.textContent = `$$${match[1]}$$`;
        }
        lineDiv.appendChild(mathSpan);

        lastIndex = match.index + match[0].length;
      }

      // If no display math, handle inline math
      if (!hasDisplayMath) {
        lastIndex = 0;
        while ((match = inlineMathRegex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            const textSpan = document.createElement('span');
            textSpan.textContent = line.substring(lastIndex, match.index);
            lineDiv.appendChild(textSpan);
          }

          const mathSpan = document.createElement('span');
          try {
            katex.render(match[1], mathSpan, {
              displayMode: false,
              throwOnError: false,
            });
          } catch (e) {
            mathSpan.textContent = `$${match[1]}$`;
          }
          lineDiv.appendChild(mathSpan);

          lastIndex = match.index + match[0].length;
        }
      }

      // Add remaining text
      if (lastIndex < line.length) {
        const textSpan = document.createElement('span');
        textSpan.textContent = line.substring(lastIndex);
        lineDiv.appendChild(textSpan);
      }

      // If no math was found, just add the plain text
      if (lineDiv.childNodes.length === 0) {
        lineDiv.textContent = line || '\u00A0'; // Non-breaking space for empty lines
      }

      container.appendChild(lineDiv);
    });
  }, [content]);

  return <div ref={containerRef} className="math-content" />;
}
