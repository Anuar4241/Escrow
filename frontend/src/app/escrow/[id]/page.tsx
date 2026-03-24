import { Suspense } from "react";
import EscrowTrackerClient from "./EscrowTrackerClient";

// Required for next export with dynamic routes
export function generateStaticParams() {
  return [{ id: "demo" }];
}

export default function EscrowTrackerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-900" />}>
      <EscrowTrackerClient />
    </Suspense>
  );
}
