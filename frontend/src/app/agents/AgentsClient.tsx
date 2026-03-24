'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Bot, MessageSquare, ShieldAlert, AlertTriangle,
  Loader2, Send, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { analyzeDispute, analyzeRisk, querySupportAgent } from '@/lib/api';

type Tab = 'support' | 'risk' | 'dispute';

interface RiskResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  flags: string[];
  reasoning: string;
  recommendedAction: string;
}

interface DisputeResult {
  recommendation: 'PAYOUT_SELLER' | 'REFUND_BUYER';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  keyFactors: string[];
}

interface SupportResult {
  message: string;
  suggestedNextSteps: string[];
  escalationRequired: boolean;
}

export default function AgentsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const escrowId = searchParams.get('id') ?? 'demo';

  const [activeTab, setActiveTab] = useState<Tab>('support');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Support state
  const [question, setQuestion] = useState('');
  const [supportResult, setSupportResult] = useState<SupportResult | null>(null);

  // Risk state
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);

  // Dispute state
  const [disputeResult, setDisputeResult] = useState<DisputeResult | null>(null);

  const handleSupport = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await querySupportAgent(escrowId, question, 'user-demo');
      setSupportResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect to support agent');
    } finally {
      setLoading(false);
    }
  };

  const handleRisk = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeRisk(escrowId);
      setRiskResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to run risk analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeDispute(escrowId);
      setDisputeResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to run dispute analysis');
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (level: string) => {
    if (level === 'LOW') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (level === 'MEDIUM') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    if (level === 'HIGH') return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    return 'text-red-400 bg-red-500/10 border-red-500/30';
  };

  const confidenceColor = (c: string) => {
    if (c === 'HIGH') return 'text-emerald-400';
    if (c === 'MEDIUM') return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col pb-8">
      {/* Header */}
      <div className="bg-neutral-800/80 border-b border-neutral-700/50 px-4 pt-12 pb-4 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.push(`/escrow?id=${escrowId}`)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Tracker</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold">AI Agents</h1>
              <p className="text-neutral-400 font-mono text-xs">ID: {escrowId}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full px-4 pt-6">
        {/* Tab selector */}
        <div className="grid grid-cols-3 gap-2 mb-6 bg-neutral-800/50 p-1 rounded-xl border border-neutral-700/50">
          {([
            { id: 'support', label: 'Support', Icon: MessageSquare, color: 'emerald' },
            { id: 'risk', label: 'Risk', Icon: ShieldAlert, color: 'yellow' },
            { id: 'dispute', label: 'Dispute', Icon: AlertTriangle, color: 'red' },
          ] as const).map(({ id, label, Icon, color }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setError(null); }}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all
                ${activeTab === id
                  ? color === 'emerald' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : color === 'yellow' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-semibold text-sm mb-1">Agent Error</p>
              <p className="text-red-200/70 text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* ─── SUPPORT TAB ─── */}
        {activeTab === 'support' && (
          <div className="space-y-4">
            <div className="bg-neutral-800/60 border border-neutral-700/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-white">Ask the Support Agent</h2>
              </div>
              <p className="text-neutral-400 text-sm mb-4">
                Claude will check your escrow status and answer your question instantly.
              </p>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Why is my escrow still in funded status? When will I get paid?"
                rows={3}
                className="w-full bg-neutral-700/50 border border-neutral-600/50 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
              <button
                onClick={handleSupport}
                disabled={loading || !question.trim()}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-neutral-950 font-bold py-3 rounded-xl transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {loading ? 'Thinking...' : 'Ask Claude'}
              </button>
            </div>

            {supportResult && (
              <div className="bg-neutral-800/60 border border-emerald-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-emerald-300">Claude&apos;s Response</span>
                  {supportResult.escalationRequired && (
                    <span className="ml-auto text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
                      Escalation Required
                    </span>
                  )}
                </div>
                <p className="text-neutral-200 text-sm leading-relaxed">{supportResult.message}</p>
                {supportResult.suggestedNextSteps.length > 0 && (
                  <div>
                    <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Suggested Next Steps</p>
                    <ul className="space-y-2">
                      {supportResult.suggestedNextSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── RISK TAB ─── */}
        {activeTab === 'risk' && (
          <div className="space-y-4">
            <div className="bg-neutral-800/60 border border-neutral-700/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-5 h-5 text-yellow-400" />
                <h2 className="font-bold text-white">Risk Analysis Agent</h2>
              </div>
              <p className="text-neutral-400 text-sm mb-4">
                Claude will analyze the buyer and seller history, transaction patterns, and deal data to produce a risk score.
              </p>
              <button
                onClick={handleRisk}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-neutral-950 font-bold py-3 rounded-xl transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
                {loading ? 'Analyzing...' : 'Run Risk Analysis'}
              </button>
            </div>

            {riskResult && (
              <div className="bg-neutral-800/60 border border-neutral-700/50 rounded-2xl p-5 space-y-4">
                {/* Score header */}
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="#404040" strokeWidth="8" />
                      <circle cx="40" cy="40" r="32" fill="none"
                        stroke={riskResult.riskLevel === 'LOW' ? '#4ade80' : riskResult.riskLevel === 'MEDIUM' ? '#facc15' : riskResult.riskLevel === 'HIGH' ? '#fb923c' : '#f87171'}
                        strokeWidth="8"
                        strokeDasharray={`${(riskResult.riskScore / 100) * 201} 201`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center font-extrabold text-lg text-white">
                      {riskResult.riskScore}
                    </span>
                  </div>
                  <div>
                    <p className="text-neutral-400 text-xs mb-1">Risk Level</p>
                    <span className={`text-xl font-extrabold px-3 py-1 rounded-lg border ${riskColor(riskResult.riskLevel)}`}>
                      {riskResult.riskLevel}
                    </span>
                  </div>
                </div>

                {riskResult.flags.length > 0 && (
                  <div>
                    <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Risk Flags</p>
                    <div className="flex flex-wrap gap-2">
                      {riskResult.flags.map((flag, i) => (
                        <span key={i} className="text-xs bg-red-500/10 text-red-300 border border-red-500/20 px-2 py-1 rounded-lg">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Analysis</p>
                  <p className="text-neutral-300 text-sm leading-relaxed">{riskResult.reasoning}</p>
                </div>

                <div className="bg-neutral-700/40 rounded-xl p-3">
                  <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-1">Recommended Action</p>
                  <p className="text-white text-sm font-medium">{riskResult.recommendedAction}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── DISPUTE TAB ─── */}
        {activeTab === 'dispute' && (
          <div className="space-y-4">
            <div className="bg-neutral-800/60 border border-neutral-700/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h2 className="font-bold text-white">Dispute Resolution Agent</h2>
              </div>
              <p className="text-neutral-400 text-sm mb-4">
                Claude will review the full dispute evidence, payment records, and transaction timeline to recommend a resolution.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4">
                <p className="text-yellow-200/80 text-xs">
                  This AI recommendation is for moderator guidance only. Final decisions require human review.
                </p>
              </div>
              <button
                onClick={handleDispute}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-bold py-3 rounded-xl transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
                {loading ? 'Reviewing dispute...' : 'Get AI Recommendation'}
              </button>
            </div>

            {disputeResult && (
              <div className="bg-neutral-800/60 border border-neutral-700/50 rounded-2xl p-5 space-y-4">
                {/* Recommendation */}
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                  disputeResult.recommendation === 'PAYOUT_SELLER'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}>
                  {disputeResult.recommendation === 'PAYOUT_SELLER'
                    ? <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                    : <XCircle className="w-8 h-8 text-blue-400 shrink-0" />
                  }
                  <div>
                    <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Recommendation</p>
                    <p className={`text-xl font-extrabold ${
                      disputeResult.recommendation === 'PAYOUT_SELLER' ? 'text-emerald-300' : 'text-blue-300'
                    }`}>
                      {disputeResult.recommendation === 'PAYOUT_SELLER' ? 'Release to Seller' : 'Refund Buyer'}
                    </p>
                    <p className={`text-xs mt-0.5 ${confidenceColor(disputeResult.confidence)}`}>
                      {disputeResult.confidence} Confidence
                    </p>
                  </div>
                </div>

                {/* Key Factors */}
                {disputeResult.keyFactors.length > 0 && (
                  <div>
                    <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Key Factors</p>
                    <ul className="space-y-2">
                      {disputeResult.keyFactors.map((factor, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                          <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                            {i + 1}
                          </span>
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Reasoning</p>
                  <p className="text-neutral-300 text-sm leading-relaxed">{disputeResult.reasoning}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
