import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { AuthProvider } from '@/lib/auth-context';
import { RoleGuard } from '@/components/RoleGuard';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Connect Transport TMS | ระบบบริหารจัดการรถบรรทุกตู้คอนเทนเนอร์',
  description: 'Transport Management System (TMS) สำหรับ บริษัท คอนเนค ทรานสปอร์ต จำกัด',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex bg-slate-50 text-slate-900 font-sans">
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
            <RoleGuard>
              {children}
            </RoleGuard>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
