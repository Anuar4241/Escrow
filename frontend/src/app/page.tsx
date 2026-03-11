import Link from "next/link";
import { ShieldCheck, ChevronRight } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center pt-24">
      <div className="max-w-4xl w-full px-6">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
            Revorus Marketplace
          </h1>
          <p className="text-neutral-400 text-lg">
            The next generation of high-trust trading.
          </p>
        </header>

        <div className="bg-neutral-800 rounded-2xl border border-neutral-700/50 p-6 shadow-2xl overflow-hidden hover:border-neutral-600 transition-all group">
          <div className="flex justify-between items-start">
            <div className="w-1/3 bg-neutral-700 aspect-video rounded-xl" />
            
            <div className="w-2/3 pl-8 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold">MacBook Pro M3 Max</h2>
                <span className="text-2xl font-semibold">$3,499.00</span>
              </div>
              <p className="text-neutral-400 mb-6">Condition: Like New. Original box included.</p>
              
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full w-fit mb-8">
                <ShieldCheck className="w-4 h-4" />
                <span>Revorus Escrow Eligible</span>
              </div>

              <div className="mt-auto self-end">
                <Link 
                  href="/checkout"
                  className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors"
                >
                  Buy Safely
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
