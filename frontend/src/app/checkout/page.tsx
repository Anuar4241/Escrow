"use client";

import Link from "next/link";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Checkout() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = () => {
    setIsProcessing(true);
    // Simulate API call to create escrow
    setTimeout(() => {
      // Mock generated escrow ID
      const mockId = "esc_" + Math.random().toString(36).substr(2, 9);
      router.push(`/escrow/${mockId}`);
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center pt-24 px-6">
      <div className="max-w-xl w-full">
        <h1 className="text-3xl font-extrabold mb-8 text-emerald-400 text-center">Secure Checkout</h1>
        
        <div className="bg-neutral-800 rounded-2xl border border-neutral-700/50 p-6 shadow-xl mb-6">
          <div className="flex justify-between items-center border-b border-neutral-700/50 pb-6 mb-6">
            <div>
              <h2 className="text-xl font-semibold">MacBook Pro M3 Max</h2>
              <p className="text-neutral-400 text-sm mt-1">Condition: Like New</p>
            </div>
            <span className="text-xl font-bold">$3,499.00</span>
          </div>

          <div className="space-y-4 text-sm text-neutral-300">
            <div className="flex justify-between">
              <span>Item Price</span>
              <span>$3,499.00</span>
            </div>
            <div className="flex justify-between">
              <span>Escrow Fee (1.5%)</span>
              <span>$52.48</span>
            </div>
            <div className="flex justify-between font-bold text-white text-lg pt-4 border-t border-neutral-700/50">
              <span>Total to secure</span>
              <span className="text-emerald-400">$3,551.48</span>
            </div>
          </div>
        </div>

        <div className="bg-emerald-400/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3 mb-8">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-100/80 leading-relaxed">
            Your funds will be held securely by Revorus Escrow. They will only be released to the seller once you receive the item and confirm you are satisfied.
          </p>
        </div>

        <button
          onClick={handlePurchase}
          disabled={isProcessing}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold px-6 py-4 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Securing Custom Escrow...
            </>
          ) : (
            "Pay with Secure Escrow"
          )}
        </button>
      </div>
    </main>
  );
}
