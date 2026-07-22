import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Margia — A margin of your own',
  description: 'The family calendar that protects your time first.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        {/* Warm serif VOICE + clean sans UI. Working stand-ins per North Star §4. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-state="planning">{children}</body>
    </html>
  );
}
