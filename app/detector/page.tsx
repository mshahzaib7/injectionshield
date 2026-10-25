import type { Metadata } from "next";
import { DetectorTool } from "@/components/detector/DetectorTool";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Container, Eyebrow, H1 } from "@/components/ui";

export const metadata: Metadata = {
  title: "Detector",
  description:
    "Check a prompt for injection attempts in English, Urdu, Roman Urdu or code-mixed text. Runs entirely in your browser; your text is never sent anywhere.",
};

export default function DetectorPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Eyebrow>The tool</Eyebrow>
      <div className="mt-4 mb-10 max-w-3xl">
        <H1>Detector</H1>
        <p className="mt-4 text-lg leading-relaxed">
          Paste a prompt and InjectionShield-Lite estimates how likely it is to be a prompt-injection attack. It works
          on English, Urdu script, Roman Urdu and mixed text, and runs <strong>entirely in your browser</strong>.
        </p>
      </div>
      <ErrorBoundary what="detector">
        <DetectorTool />
      </ErrorBoundary>
    </Container>
  );
}
