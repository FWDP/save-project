import type { Metadata } from "next";
import "./globals.css";
// Auth availability and session redirects must be evaluated per request.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "SAVE — Your money, in focus", template: "%s · SAVE" },
  description: "A clear view of your personal and business finances.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
