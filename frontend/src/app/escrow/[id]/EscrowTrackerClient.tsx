"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Circle, Truck, PackageCheck, AlertCircle, ShieldCheck } from "lucide-react";

type EscrowStatus = 'AWAITING_PAYMENT' | 'FUNDED' | 'SHIPPED' | 'AWAITING_BUYER_CONFIRMATION' | 'COMPLETED' | 'DISPUTED';

export default function EscrowTrackerClient() {
  const params = useParams();
  const id = params.id as string;
  
  const [status, setStatus] = useState<EscrowStatus>('AWAITING_PAYMENT');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTransition = (nextStatus: EscrowStatus) => {
    setIsProcessing(true);
    setTimeout(() => {
      setStatus(nextStatus);
      setIsProcessing(false);
    }, 1000);
  };

  const steps = [
    { key: 'AWAITING_PAYMENT', label: 'Ожидает оплаты', icon: Circle },
    { key: 'FUNDED', label: 'Средства защищены', icon: ShieldCheck },
    { key: 'SHIPPED', label: 'Товар отправлен', icon: Truck },
    { key: 'COMPLETED', label: 'Сделка завершена', icon: PackageCheck },
  ];

  const getStepIndex = (s: EscrowStatus) => {
    if (s === 'AWAITING_BUYER_CONFIRMATION') return 2;
    if (s === 'DISPUTED') return -1;
    return steps.findIndex(step => step.key === s);
  };

  const currentIndex = getStepIndex(status);

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center pt-24 px-6 pb-24">
      <div className="max-w-3xl w-full">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-extrabold mb-2">Статус демо-сделки</h1>
            <p className="text-neutral-400 font-mono text-sm opacity-80">ID: {id}</p>
          </div>
          <div className="text-right">
            <p className="text-neutral-400 text-sm">Сумма сделки</p>
            <p className="text-2xl font-bold text-emerald-400">1 775 743 ₸</p>
          </div>
        </div>

        <div className="bg-neutral-800 rounded-2xl border border-neutral-700/50 p-8 shadow-xl mb-8 relative overflow-hidden">
          <div className="flex justify-between relative z-10">
            {steps.map((step, index) => {
              const isCompleted = index <= currentIndex;
              const isCurrent = index === currentIndex;
              const Icon = isCompleted ? CheckCircle2 : step.icon;
              return (
                <div key={step.key} className="flex flex-col items-center gap-3 w-1/4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500
                    ${isCompleted ? 'bg-emerald-500 border-emerald-500/30 text-neutral-950' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}
                    ${isCurrent && 'ring-4 ring-emerald-500/20 scale-110'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`text-sm font-semibold text-center transition-colors ${isCompleted ? 'text-emerald-400' : 'text-neutral-500'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="absolute top-14 left-[12%] right-[12%] h-1 bg-neutral-700 -z-0 rounded-full">
            <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out rounded-full"
              style={{ width: `${Math.max(0, (currentIndex / (steps.length - 1)) * 100)}%` }} />
          </div>
        </div>

        {status === 'DISPUTED' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-8 flex items-start gap-4">
            <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-1">Открыт спор</h3>
              <p className="text-red-200/80">В рабочем сценарии оператор проверит материалы и примет решение по сделке.</p>
            </div>
          </div>
        )}

        <div className="bg-neutral-800/50 border border-dashed border-neutral-700 rounded-2xl p-6">
          <h3 className="text-neutral-400 font-semibold mb-4 uppercase text-sm tracking-wider">Демо-управление — без реальных операций</h3>
          <div className="grid grid-cols-2 gap-4">
            <button disabled={status !== 'AWAITING_PAYMENT' || isProcessing}
              onClick={() => handleTransition('FUNDED')}
              className="px-4 py-3 bg-indigo-500/20 text-indigo-300 rounded-lg hover:bg-indigo-500/30 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-600 border border-indigo-500/30 transition-all font-medium">
              Имитировать оплату
            </button>
            <button disabled={status !== 'FUNDED' || isProcessing}
              onClick={() => handleTransition('SHIPPED')}
              className="px-4 py-3 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-600 border border-blue-500/30 transition-all font-medium">
              Продавец: отправлено
            </button>
            <button disabled={status !== 'SHIPPED' || isProcessing}
              onClick={() => handleTransition('COMPLETED')}
              className="px-4 py-3 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-600 border border-emerald-500/30 transition-all font-medium">
              Покупатель: получено
            </button>
            <button disabled={['COMPLETED', 'DISPUTED'].includes(status) || isProcessing}
              onClick={() => handleTransition('DISPUTED')}
              className="px-4 py-3 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-600 border border-red-500/30 transition-all font-medium">
              Открыть демо-спор
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
