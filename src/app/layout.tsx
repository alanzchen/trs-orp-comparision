import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TRS & ORP Comparison Tool',
  description: 'Visually compares TRS & ORP retirement plans',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={inter.className}>
        {children}
        <div className='flex items-center justify-center w-full h-24 border-t text-gray-700 font-semibold'>
            Disclaimer: this page does not provide any finanical advice.
        </div>
        <div className='flex items-center justify-center w-full h-24 border-t text-gray-700 font-semibold'>
            
            <a
              className='flex items-center justify-center'
              href='https://github.com/alanzchen/trs-orp-comparision'
              target='_blank'
              rel='noopener noreferrer'
            >
              Written by Claude Sonnet 3.5 & Zenan Chen
            </a>
        </div>
      </body>
    </html>
  );
}
