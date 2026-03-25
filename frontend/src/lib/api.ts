const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://10.0.2.2:3001';

export async function analyzeDispute(escrowId: string) {
  const res = await fetch(`${BASE}/agents/disputes/${escrowId}/analyze`, { method: 'POST' });
  if (!res.ok) throw new Error(`Dispute analysis failed: ${res.status}`);
  return res.json();
}

export async function analyzeRisk(escrowId: string) {
  const res = await fetch(`${BASE}/agents/risk/${escrowId}/analyze`, { method: 'POST' });
  if (!res.ok) throw new Error(`Risk analysis failed: ${res.status}`);
  return res.json();
}

export async function querySupportAgent(escrowId: string, question: string, userId: string) {
  const res = await fetch(`${BASE}/agents/support/${escrowId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, userId }),
  });
  if (!res.ok) throw new Error(`Support query failed: ${res.status}`);
  return res.json();
}
