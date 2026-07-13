"use client";

import { ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Checkout() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDemo = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const mockId = `demo_${crypto.randomUUID().slice(0, 8)}`;
      router.push(`/escrow/${mockId}`);
    }, 600);
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center pt-24 px-6">
      <div className="max-w-xl w-full">
        <h1 className="text-3xl font-extrabold mb-3 text-emerald-400 text-center">Демо оформления сделки</h1>
        <p className="mb-8 text-center text-sm text-amber-300">Платёж не выполняется, реальные деньги не списываются.</p>
        
        <div className="bg-neutral-800 rounded-2xl border border-neutral-700/50 p-6 shadow-xl mb-6">
          <div className="flex justify-between items-center border-b border-neutral-700/50 pb-6 mb-6">
            <div>
              <h2 className="text-xl font-semibold">MacBook Pro M3 Max</h2>
              <p className="text-neutral-400 text-sm mt-1">Состояние: как новый</p>
            </div>
            <span className="text-xl font-bold">1 749 500 ₸</span>
          </div>

          <div className="space-y-4 text-sm text-neutral-300">
            <div className="flex justify-between">
              <span>Стоимость товара</span>
              <span>1 749 500 ₸</span>
            </div>
            <div className="flex justify-between">
              <span>Комиссия escrow (1,5%)</span>
              <span>26 243 ₸</span>
            </div>
            <div className="flex justify-between font-bold text-white text-lg pt-4 border-t border-neutral-700/50">
              <span>Итого</span>
              <span className="text-emerald-400">1 775 743 ₸</span>
            </div>
          </div>
        </div>

        <div className="bg-emerald-400/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3 mb-8">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-100/80 leading-relaxed">
            В рабочей версии деньги удерживаются банковским партнёром и перечисляются продавцу только после подтверждения получения. Этот экран пока работает как демонстрация сценария.
          </p>
        </div>

        <button
          onClick={handleDemo}
          disabled={isProcessing}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold px-6 py-4 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Создаём демо-сделку…
            </>
          ) : (
            "Продолжить без оплаты"
          )}
        </button>
      </div>
    </main>
  );
}
