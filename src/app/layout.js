import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import '@/styles/custom.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from 'sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'Wehoware Technologies- Software Development & Marketing',
  description: 'Full-service website design, development, and digital marketing company specializing in SEO and content marketing that grows brands.',
  keywords: 'software development, web design, digital marketing, SEO, content marketing, brand growth, web development',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans min-h-screen flex flex-col`}>
        <AuthProvider>
          <Header />
          <main className="flex-grow overflow-hidden">{children}</main>
          <Footer />
          <Toaster position="top-right" richColors expand={false} />
        </AuthProvider>
      </body>
    </html>
  );
}
