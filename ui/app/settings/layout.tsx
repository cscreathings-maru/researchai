import Shell from "@/components/Shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings — ResearchAI",
  description: "Configure your ResearchAI connection and model preferences.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
