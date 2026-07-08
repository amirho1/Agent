"use client";

import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

export function ConfirmationModal({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-[480px] bg-[#0B1020] border border-slate-800 rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500 flex items-center justify-center text-cyan-400 mb-6">
          <AlertTriangle size={24} />
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">Proceed with Batch Update?</h3>
        <p className="text-slate-400 text-sm mb-6">You are about to modify 51 records in the global inventory. This will affect real-time booking engines and seasonal pricing models.</p>
        
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 mb-8">
           <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="text-slate-500">Modified Records: <span className="text-white font-bold">40</span></div>
              <div className="text-slate-500">New Additions: <span className="text-white font-bold">10</span></div>
              <div className="text-slate-500">Deletions: <span className="text-white font-bold">01</span></div>
              <div className="text-slate-500">Affected Fields: <span className="text-white font-bold">153</span></div>
           </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-slate-800 text-slate-400 font-bold hover:bg-slate-800/50 transition-colors">Go Back</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors">Confirm & Submit</button>
        </div>
      </div>
    </div>
  );
}

export function SuccessState({ onDone }: { onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500 bg-[#0B1020] border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <CheckCircle2 size={40} />
        </div>
        
        <h2 className="text-2xl font-bold mb-2 text-white">Changes Submitted</h2>
        <p className="text-slate-400 text-sm mb-8">Operation ID: <span className="font-mono text-slate-300">OP-89241B</span></p>

        <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-8 text-left space-y-2">
          <p className="text-xs text-slate-300"><span className="text-emerald-400 mr-2">✓</span>Updated 40 Room records</p>
          <p className="text-xs text-slate-300"><span className="text-emerald-400 mr-2">✓</span>Added 10 Room records</p>
          <p className="text-xs text-slate-300"><span className="text-emerald-400 mr-2">✓</span>Deleted 1 Room record</p>
          <p className="text-xs text-cyan-400 mt-3 pt-3 border-t border-slate-800">Syncing to external systems in background...</p>
        </div>

        <div className="flex flex-col w-full gap-3">
          <button onClick={onDone} className="w-full py-3 rounded-xl font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors">
            Back to Chat
          </button>
          <button className="w-full py-3 rounded-xl font-bold border border-slate-800 hover:bg-slate-800/50 text-slate-400 transition-colors">
            View Audit Log
          </button>
        </div>
      </div>
    </div>
  );
}
