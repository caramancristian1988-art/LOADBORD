import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: { default: "LoadDesk — Dispatcher Training Load Board", template: "%s · LoadDesk" },
  description: "Practice US truck dispatching: search loads, negotiate with brokers, book and manage your fleet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${roboto.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
