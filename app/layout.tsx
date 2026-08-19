import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daymark",
  description: "A transparent seven-day weather suitability guide for outdoor plans.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
