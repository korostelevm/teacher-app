import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { connectDB } from "@/lib/mongodb";
import { LogRocketProvider } from "@/components/logrocket-provider";

// Initialize database connection at app level
if (typeof window === "undefined") {
  connectDB().catch(console.error);
}

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Magic School RAG Take Home",
  description: "Magic School RAG Take Home",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LogRocketProvider />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
