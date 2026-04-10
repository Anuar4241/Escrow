"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Circle, Truck, PackageCheck, AlertCircle, ShieldCheck, Bell } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type BackendStatus =
  | "awaiting_payment"
  | "funded"
  | "awaiting_seller_action"
  | "shipped"
  | "awaiting_buyer_confirmation"
  | "completed"
  | "dispute_opened"
  | "under_review"
  | "payout_approved"
  | "refund_approved"
  | "refunded"
  | "cancelled"
  | "expired";

interface EscrowDeal {
  id: string;
  status: BackendStatus;
  buyerId: string;
  sellerId: string;
  amount: string;
  applicationFee: string;
  totalEscrowed: string;
  currency: string;
  version: number;
}

function genIdempotencyKey() {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function apiPost(path: string, body: object): Promise<EscrowDeal> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-idempotency-key": genIdempotencyKey(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

const STEPS = [
  { key: "awaiting_payment", label: "Awaiting Payment", icon: Circle },
  { key: "funded", label: "Funds Secured", icon: ShieldCheck },
  { key: "awaiting_seller_action", label: "Seller Notified", icon: Bell },
  { key: "shipped", label: "Item Shipped", icon: Truck },
  { key: "completed", label: "Delivered & Released", icon: PackageCheck },
];

function getStepIndex(status: BackendStatus | undefined): number {
  if (!status) return 0;
  // AWAITING_BUYER_CONFIRMATION sits between shipped (index 3) and completed (index 4)
  if (status === "awaiting_buyer_confirmation") return 3;
  return STEPS.findIndex((s) => s.key === status);
}

const DISPUTED_STATUSES: BackendStatus[] = ["dispute_opened", "under_review"];
const TERMINAL_STATUSES: BackendStatus[] = [
  "completed", "payout_approved", "refunded", "cancelled", "expired",
];

export default function EscrowTrackerClient() {
  const params = useParams();
  const id = params.id as string;

  const [deal, setDeal] = useState<EscrowDeal | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeal = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/escrows/${id}`);
      if (!res.ok) throw new Error("Failed to load escrow deal");
      setDeal(await res.json());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    fetchDeal();
  }, [fetchDeal]);

  const transition = async (action: () => Promise<EscrowDeal>) => {
    setIsProcessing(true);
    setError(null);
    try {
      const updated = await action();
      setDeal(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const status = deal?.status;
  const version = deal?.version ?? 1;

  const currentIndex = getStepIndex(status);
  const isDisputed = status && DISPUTED_STATUSES.includes(status);
  const isTerminal = status && TERMINAL_STATUSES.includes(status);

  const totalAmount = deal
    ? `${deal.currency} ${parseFloat(deal.totalEscrowed).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "—";

  if (!deal && !error) {
    return (
      <main className="min-h-screen bg-neutral-900 text-white flex items-center justify-center">
        <p className="text-neutral-400 animate-pulse">Loading escrow...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center pt-24 px-6 pb-24">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-extrabold mb-2">Escrow Tracker</h1>
            <p className="text-neutral-400 font-mono text-sm opacity-80">ID: {id}</p>
          </div>
          <div className="text-right">
            <p className="text-neutral-400 text-sm">Escrow Amount</p>
            <p className="text-2xl font-bold text-emerald-400">{totalAmount}</p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Progress stepper */}
        <div className="bg-neutral-800 rounded-2xl border border-neutral-700/50 p-8 shadow-xl mb-8 relative overflow-hidden">
          <div className="flex justify-between relative z-10">
            {STEPS.map((step, index) => {
              const isCompleted = index <= currentIndex;
              const isCurrent = index === currentIndex;
              const Icon = isCompleted ? CheckCircle2 : step.icon;
              return (
                <div key={step.key} className="flex flex-col items-center gap-3 w-1/5">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500
                      ${isCompleted ? "bg-emerald-500 border-emerald-500/30 text-neutral-950" : "bg-neutral-800 border-neutral-700 text-neutral-500"}
                      ${isCurrent ? "ring-4 ring-emerald-500/20 scale-110" : ""}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-xs font-semibold text-center transition-colors ${
                      isCompleted ? "text-emerald-400" : "text-neutral-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="absolute top-14 left-[10%] right-[10%] h-1 bg-neutral-700 rounded-full">
            <div
              className="h-full bg-emerald-500 transition-all duration-1000 ease-out rounded-full"
              style={{ width: `${Math.max(0, (currentIndex / (STEPS.length - 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Dispute banner */}
        {isDisputed && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-8 flex items-start gap-4">
            <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-1">Dispute Opened</h3>
              <p className="text-red-200/80">
                The Revorus team is reviewing the case and will mediate between buyer and seller.
              </p>
            </div>
          </div>
        )}

        {/* Demo controls — hidden once terminal or disputed */}
        {!isTerminal && !isDisputed && (
          <div className="bg-neutral-800/50 border border-dashed border-neutral-700 rounded-2xl p-6">
            <h3 className="text-neutral-400 font-semibold mb-4 uppercase text-sm tracking-wider">
              Demo / Sandbox Controls
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Step 1: PSP funds the escrow */}
              <button
                disabled={status !== "awaiting_payment" || isProcessing}
                onClick={() =>
                  transition(() =>
                    apiPost(`/escrows/${id}/fund`, {
                      expectedVersion: version,
                      providerTxId: `demo_tx_${Date.now()}`,
                    })
                  )
                }
                className="px-4 py-3 bg-indigo-500/20 text-indigo-300 rounded-lg hover:bg-indigo-500/30 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-600 border border-indigo-500/30 transition-all font-medium"
              >
                Simulate: PSP Funded
              </button>

              {/* Step 2: Notify seller */}
              <button
                disabled={status !== "funded" || isProcessing}
                onClick={() =>
                  transition(() =>
                    apiPost(`/escrows/${id}/notify-seller`, { expectedVersion: version })
                  )
                }
                className="px-4 py-3 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-600 border border-purple-500/30 transition-all font-medium"
              >
                Notify Seller
              </button>

              {/* Step 3: Seller marks shipped */}
              <button
                disabled={status !== "awaiting_seller_action" || isProcessing}
                onClick={() =>
                  transition(() =>
                    apiPost(`/escrows/${id}/confirm-shipment`, { expectedVersion: version })
                  )
                }
                className="px-4 py-3 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-600 border border-blue-500/30 transition-all font-medium"
              >
                Seller: Mark Shipped
              </button>

              {/* Step 4: Delivery notification */}
              <button
                disabled={status !== "shipped" || isProcessing}
                onClick={() =>
                  transition(() =>
                    apiPost(`/escrows/${id}/mark-delivered`, { expectedVersion: version })
                  )
                }
                className="px-4 py-3 bg-sky-500/20 text-sky-300 rounded-lg hover:bg-sky-500/30 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-600 border border-sky-500/30 transition-all font-medium"
              >
                Mark Delivered
              </button>

              {/* Step 5: Buyer confirms receipt */}
              <button
                disabled={status !== "awaiting_buyer_confirmation" || isProcessing}
                onClick={() =>
                  transition(() =>
                    apiPost(`/escrows/${id}/release`, { expectedVersion: version })
                  )
                }
                className="px-4 py-3 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-600 border border-emerald-500/30 transition-all font-medium"
              >
                Buyer: Confirm Receipt
              </button>

              {/* Dispute (available from funded onwards) */}
              <button
                disabled={
                  !status ||
                  ["awaiting_payment", "completed", "dispute_opened", "under_review"].includes(status) ||
                  isProcessing
                }
                onClick={() =>
                  transition(() =>
                    apiPost(`/escrows/${id}/open-dispute`, {
                      expectedVersion: version,
                      reason: "Item not as described (demo)",
                      openedById: deal?.buyerId,
                    })
                  )
                }
                className="px-4 py-3 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-600 border border-red-500/30 transition-all font-medium"
              >
                Trigger Dispute
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
