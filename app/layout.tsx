import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orrery — DataHub Estate Observatory",
  description:
    "An infinite-canvas observatory where every node of your DataHub lineage graph is a live data-profiling card, quality incidents propagate visually downstream, and findings are written back to DataHub through the official MCP server.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="starfield antialiased">{children}</body>
    </html>
  );
}
