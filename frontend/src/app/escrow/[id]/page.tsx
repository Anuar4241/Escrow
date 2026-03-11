import EscrowTrackerClient from "./EscrowTrackerClient";

// Must be in same file as default export for Next.js static analysis
export function generateStaticParams() {
  return [];
}

export default function EscrowTrackerPage() {
  return <EscrowTrackerClient />;
}
