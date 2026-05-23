import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "ResearchAI — Scientific Paper Q&A",
  description:
    "A self-hosted AI research assistant. Upload PDFs and ask natural language questions — get cited, evidence-backed answers grounded in your paper library.",
  keywords: ["research", "AI", "PaperQA2", "scientific papers", "Q&A"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <TooltipProvider delayDuration={300}>
          {children}
        </TooltipProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
