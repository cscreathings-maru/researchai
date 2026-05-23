import Shell from "@/components/Shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Papers — ResearchAI",
  description: "Upload and manage your scientific PDF library.",
};

export default function PapersLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
