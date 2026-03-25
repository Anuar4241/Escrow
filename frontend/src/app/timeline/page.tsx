"use client";

import { useState } from "react";
import { Package, Truck, CheckCircle2, ShieldAlert, BadgeCheck } from "lucide-react";

type EscrowState = "DRAFT" | "FUNDED" | "SHIPPED" | "DELIVERED";

export default function Timeline() {
  const [status, setStatus] = useState<EscrowState>("FUNDED");
  
  // This simulates the backend ACIDs `transitionState` methods
  const handleSellerShip = () => setStatus("SHIPPED");
  const handleBuyerConfirm = () => setStatus("DELIVERED");

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex justify-center py-20 px-6">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Deal Hub #4819A</h1>
            <p className="text-neutral-400 flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-emerald-500" />
              $3,649.00 locked in Revorus Escrow
            </p>
          </div>
          
          {status === "DELIVERED" && (
            <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
              Payout Released
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Action Panel */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-fit">
            <h3 className="text-xl font-medium mb-6">Actions Required</h3>
            
            {status === "FUNDED" && (
              <div className="space-y-4">
                <p className="text-sm text-neutral-400 bg-neutral-800 p-4 rounded-lg">
                  <strong className="text-white block mb-1">Seller Notice:</strong>
                  Funds are secured. Please ship the item and provide tracking.
                </p>
                <button 
                  onClick={handleSellerShip}
                  className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-medium transition-colors"
                >
                  Mark as Shipped
                </button>
              </div>
            )}

            {status === "SHIPPED" && (
              <div className="space-y-4">
                <p className="text-sm text-neutral-400 bg-neutral-800 p-4 rounded-lg">
                  <strong className="text-white block mb-1">Buyer Notice:</strong>
                  The item is in transit. Only confirm once you have inspected the goods.
                </p>
                <button 
                  onClick={handleBuyerConfirm}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-medium transition-colors"
                >
                  Confirm Delivery
                </button>
                <button className="w-full border border-red-500/50 text-red-400 hover:bg-red-500/10 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Open Dispute
                </button>
              </div>
            )}

            {status === "DELIVERED" && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h4 className="font-medium text-lg text-emerald-400">Transaction Complete</h4>
                <p className="text-neutral-500 text-sm mt-2">Funds have been routed to the Seller&apos;s bank account.</p>
              </div>
            )}
          </div>

          {/* Timeline Audit History */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-xl font-medium mb-8">Audit Trail</h3>
            
            <div className="relative border-l-2 border-neutral-800 ml-4 space-y-10">
              
              {/* Event 1: Funded */}
              <div className="relative">
                <span className="absolute -left-3.5 top-1 bg-neutral-900 p-1 rounded-full">
                  <Package className={`w-4 h-4 ${status !== "DRAFT" ? "text-emerald-400" : "text-neutral-600"}`} />
                </span>
                <div className="pl-6">
                  <h4 className={`font-medium ${status !== "DRAFT" ? "text-neutral-200" : "text-neutral-500"}`}>Funds Secured</h4>
                  <p className="text-xs text-neutral-500 mt-1">Stripe tx_1Nf8p...</p>
                </div>
              </div>

              {/* Event 2: Shipped */}
              <div className="relative">
                <span className="absolute -left-3.5 top-1 bg-neutral-900 p-1 rounded-full">
                  <Truck className={`w-4 h-4 ${(status === "SHIPPED" || status === "DELIVERED") ? "text-blue-400" : "text-neutral-600"}`} />
                </span>
                <div className="pl-6">
                  <h4 className={`font-medium ${(status === "SHIPPED" || status === "DELIVERED") ? "text-neutral-200" : "text-neutral-500"}`}>Item Shipped</h4>
                  <p className="text-xs text-neutral-500 mt-1">Awaiting Buyer signature</p>
                </div>
              </div>

              {/* Event 3: Delivered (Terminal) */}
              <div className="relative">
                <span className="absolute -left-3.5 top-1 bg-neutral-900 p-1 rounded-full">
                  <CheckCircle2 className={`w-4 h-4 ${status === "DELIVERED" ? "text-emerald-400" : "text-neutral-600"}`} />
                </span>
                <div className="pl-6">
                  <h4 className={`font-medium ${status === "DELIVERED" ? "text-neutral-200" : "text-neutral-500"}`}>Delivery Confirmed</h4>
                  <p className="text-xs text-neutral-500 mt-1">Payout initiated automatically</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
