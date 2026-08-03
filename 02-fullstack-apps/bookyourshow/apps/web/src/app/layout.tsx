import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Providers } from "@/components/Providers";
import AiChat from "@/components/AiChat";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BookYourShow — Book Movie Tickets Online",
    template: "%s | BookYourShow",
  },
  description:
    "Book movie tickets online for the latest Bollywood, Hollywood, and regional films. Select seats, pay securely with Razorpay, and enjoy the show!",
  keywords: ["book movie tickets", "cinema", "Bollywood", "BookMyShow alternative", "online booking"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <AiChat />
        </Providers>
      </body>
    </html>
  );
}
