"use client";

import { useState } from "react";
import { MessageSquare, FileText, Settings, Upload, ArrowRight, ArrowUp, Plus, Sparkles, SlidersHorizontal, AlertCircle } from "lucide-react";

export function ChatLanding({ onSubmit }: { onSubmit: (msg: string) => void }) {
  const [input, setInput] = useState("");

  const examples = [
    "Increase all Deluxe Room prices by 10% for next weekend.",
    "Add 10 new rooms from this uploaded Excel file.",
    "Show me how to create a seasonal pricing package.",
    "Compare this rate sheet with current room prices."
  ];

  const actions = [
    { label: "Guide Me", icon: Sparkles },
    { label: "Update Room Prices", icon: SlidersHorizontal },
    { label: "Add New Rooms", icon: Plus },
    { label: "Delete Rooms", icon: AlertCircle },
    { label: "Analyze File", icon: FileText }
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950/30 flex flex-col p-4">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            OP
          </div>
          <span className="font-semibold tracking-tight text-lg text-white">OPS<span className="text-cyan-400 font-light">AGENT</span></span>
        </div>
        
        <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 mb-6 text-sm font-medium">
          <Plus size={16} />
          New Chat
        </button>

        <div className="flex-1 overflow-y-auto space-y-1">
          <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Recent</div>
          {["Price Update (Q3)", "Room Expansion", "Rate Comparison"].map((chat, i) => (
            <button key={i} className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-900/50 text-sm text-slate-400 transition-colors">
              <MessageSquare size={14} className="opacity-50" />
              {chat}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col relative bg-[#050810]">
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
          
          <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-12 text-center text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
            What would you like to manage today?
          </h1>

          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {actions.map((action, i) => (
              <button key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-all text-xs font-medium text-slate-300">
                <action.icon size={14} className="text-cyan-400" />
                {action.label}
              </button>
            ))}
          </div>

          <div className="w-full max-w-2xl bg-slate-900/50 border border-slate-800 rounded-2xl p-2 backdrop-blur-md shadow-2xl focus-within:border-cyan-500/50 transition-colors">
            <div className="flex items-center gap-2 px-2 pb-2">
              <button className="p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800">
                <Upload size={20} />
              </button>
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSubmit(input || "Update room prices")}
                placeholder="Ask me to update records, compare files, or guide you..."
                className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-600 text-lg py-2"
              />
              <button 
                onClick={() => onSubmit(input || "Update room prices")}
                className="p-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl transition-colors shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              >
                <ArrowUp size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mt-8">
            {examples.map((example, i) => (
              <button 
                key={i} 
                onClick={() => setInput(example)}
                className="text-left px-4 py-3 rounded-xl bg-slate-900/50 hover:bg-slate-800 border border-slate-800 text-sm text-slate-400 hover:text-white transition-colors"
              >
                {example}
              </button>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
}
