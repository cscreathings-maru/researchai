import Shell from "@/components/Shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ask — ResearchAI",
  description: "Ask natural language questions about your scientific paper library. Get cited, evidence-backed answers.",
};

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
