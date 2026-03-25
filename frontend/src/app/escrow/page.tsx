import { Suspense } from "react";
import EscrowTrackerClient from "./[id]/EscrowTrackerClient";

export default function EscrowPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-900" />}>
      <EscrowTrackerClient />
    </Suspense>
  );
}
