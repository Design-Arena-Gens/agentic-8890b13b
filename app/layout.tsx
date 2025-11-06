import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Math OCR - Extract LaTeX from PDFs",
  description: "Extract text and mathematical equations from PDF documents with unlimited pages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
