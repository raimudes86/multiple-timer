import type { Metadata } from "next";
import "./globals.css";
import ThemeRegistry from "./components/ThemeRegistry";

export const metadata: Metadata = {
  title: "Multiple Timer",
  description: "A simple multiple timer application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
