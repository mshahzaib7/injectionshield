import { Container, PillLink } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-start justify-center py-16">
      <p className="font-display text-8xl leading-none text-brand sm:text-9xl">404</p>
      <h1 className="mt-4 text-2xl font-bold">This page slipped past the shield.</h1>
      <p className="mt-2 text-muted">The page you are looking for does not exist.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <PillLink href="/" solid>
          Back home
        </PillLink>
        <PillLink href="/detector/">Try the detector</PillLink>
      </div>
    </Container>
  );
}
