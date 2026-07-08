"use client";

import { useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, Save, X, Edit2, RotateCcw, Search, Filter } from "lucide-react";
import { MOCK_PROPOSED_ROOMS, MOCK_SUMMARY, MOCK_LOGS } from "../../lib/mock-data";

export function ActionReview({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) {
  const [data, setData] = useState(MOCK_PROPOSED_ROOMS);
  
  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 font-sans overflow-hidden">
      
      {/* Sidebar: Agent Activity Panel */}
      <aside className="w-80 border-r border-slate-800 flex flex-col bg-slate-950/30">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-semibold">Agent Activity</h2>
          <p className="text-xs text-slate-500">Execution Plan & Logs</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <h3 className="text-[10px] uppercase text-slate-500 mb-3 font-bold">Risk Assessment</h3>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between items-center mb-2">
                <span>Requested:</span><span className="text-slate-200">Update Prices</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span>Target:</span><span className="text-slate-200">{MOCK_SUMMARY.targetModel}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span>Affected:</span><span className="text-amber-400 font-bold">{MOCK_SUMMARY.totalEdited} edited</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span>Added:</span><span className="text-emerald-400 font-bold">{MOCK_SUMMARY.totalAdded}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span>Risk Level:</span><span className="text-amber-400 font-bold">{MOCK_SUMMARY.riskLevel}</span>
              </div>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-3">
              <div className="w-3/5 h-full bg-amber-500"></div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-800" />
            <div className="space-y-4">
              {MOCK_LOGS.map((log, i) => (
                <div key={i} className="relative flex items-start gap-3">
                  <div className="bg-[#020617] relative z-10 py-1">
                    {log.status === "Completed" ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center">
                        <CheckCircle2 size={12} className="text-emerald-400" strokeWidth={3} />
                      </div>
                    ) : log.status === "Warning" ? (
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center">
                        <AlertTriangle size={12} className="text-amber-400" strokeWidth={3} />
                      </div>
                    ) : log.status === "Needs Review" ? (
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center">
                        <div className="w-1 h-1 bg-slate-500 rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                  <div className="pt-1">
                    <p className="text-xs font-medium text-white">{log.step}</p>
                    <p className="text-[10px] text-slate-500">{log.time} • <span className={log.status === "Needs Review" ? "text-cyan-400" : ""}>{log.status}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="text-[10px] uppercase text-slate-500 mb-2 font-bold">Request Modification</div>
          <textarea
            placeholder="Ask AI to adjust these changes..."
            className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none h-20 placeholder:text-slate-600"
          />
          <button className="w-full mt-2 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-bold transition-colors">
            Send Request
          </button>
        </div>
      </aside>

      {/* Main Section: Decision & Diff Review */}
      <main className="flex-1 flex flex-col bg-[#050810]">
        <header className="p-6 border-b border-slate-800 flex justify-between items-end bg-transparent">
          <div>
            <h1 className="text-2xl font-bold text-white">Action Review: <span className="text-cyan-400">Pricing & Inventory Update</span></h1>
            <p className="text-slate-400 text-sm mt-1">Please review and edit the affected records before confirming submission.</p>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Edits</div>
              <div className="text-xl font-bold text-amber-400">40</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">New</div>
              <div className="text-xl font-bold text-emerald-400">10</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Deleted</div>
              <div className="text-xl font-bold text-rose-500">01</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {/* Controls */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex p-0.5 bg-slate-900 rounded-lg border border-slate-800">
              <button className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-md shadow-sm">All Changes</button>
              <button className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-white">Edited</button>
              <button className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-white">Added</button>
              <button className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-white">Warnings</button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <input type="text" placeholder="Search rooms..." className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs w-64 focus:outline-none focus:border-cyan-500 text-slate-200" />
              </div>
            </div>
          </div>

          {/* Diff Table */}
          <div className="flex-1 border border-slate-800 rounded-xl overflow-auto bg-slate-950/50">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-slate-900/80 sticky top-0 z-10 backdrop-blur-md text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-800">Room ID</th>
                  <th className="px-4 py-3 border-b border-slate-800">Room Name</th>
                  <th className="px-4 py-3 border-b border-slate-800 text-center">Status</th>
                  <th className="px-4 py-3 border-b border-slate-800">Board Price</th>
                  <th className="px-4 py-3 border-b border-slate-800 text-cyan-400">Payable Price</th>
                  <th className="px-4 py-3 border-b border-slate-800 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {data.map((row, i) => {
                  const isEdited = row.changeType === "edited";
                  const isAdded = row.changeType === "added";
                  const isDeleted = row.changeType === "deleted";

                  let rowClass = "border-t border-slate-800/50 hover:bg-slate-900/30 transition-colors group";
                  if (isEdited) rowClass = "border-t border-slate-800/50 bg-amber-500/5 hover:bg-amber-500/10 transition-colors group";
                  if (isAdded) rowClass = "border-t border-slate-800/50 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors group";
                  if (isDeleted) rowClass = "border-t border-slate-800/50 bg-rose-500/5 hover:bg-rose-500/10 transition-colors group";

                  return (
                    <tr key={i} className={rowClass}>
                      <td className={`px-4 py-3 font-mono ${isDeleted ? 'text-rose-300' : isAdded ? 'text-emerald-300 italic' : 'text-slate-500'}`}>{row.id}</td>
                      <td className={`px-4 py-3 font-medium ${isDeleted ? 'text-rose-200' : isAdded ? 'text-emerald-200' : ''}`}>{row.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border font-bold uppercase ${isDeleted ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : isAdded ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : row.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                          {isDeleted ? 'To Delete' : isAdded ? 'New' : row.status}
                        </span>
                      </td>
                      
                      {/* Board Price Diff */}
                      <td className="px-4 py-3">
                         {isAdded ? (
                            <span className="text-emerald-400 font-bold">${row.boardPrice}</span>
                         ) : isDeleted ? (
                            <span className="text-rose-400 font-bold">REMOVED</span>
                         ) : isEdited ? (
                            <div className="flex items-center gap-2">
                               <span className="text-slate-500 line-through">${row.boardPrice - 20}</span>
                               <span className="text-slate-500 text-[10px] opacity-50">→</span>
                               <span className="text-amber-400 font-bold">${row.boardPrice}</span>
                               <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1 rounded">MODIFIED</span>
                            </div>
                         ) : (
                            <span className="text-slate-200">${row.boardPrice}</span>
                         )}
                      </td>

                      {/* Payable Price Diff */}
                      <td className="px-4 py-3">
                         {isAdded ? (
                            <span className="text-emerald-400 font-bold">${row.payablePrice}</span>
                         ) : isDeleted ? (
                            <span className="text-rose-400 font-bold">REMOVED</span>
                         ) : isEdited ? (
                            <div className="flex items-center gap-2">
                               <span className="text-slate-500 line-through">${row.payablePrice - 22}</span>
                               <span className="text-slate-500 text-[10px] opacity-50">→</span>
                               <span className="text-amber-400 font-bold">${row.payablePrice}</span>
                               <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1 rounded">+10%</span>
                            </div>
                         ) : (
                            <span className="text-white">${row.payablePrice}</span>
                         )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isDeleted && <button className="p-1.5 text-slate-500 hover:text-white rounded-md hover:bg-slate-800 transition-colors"><Edit2 size={14} /></button>}
                          {(isEdited || isDeleted || isAdded) && (
                            <button className="p-1.5 text-slate-500 hover:text-white rounded-md hover:bg-slate-800 transition-colors"><RotateCcw size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="h-20 border-t border-slate-800 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-8 mt-auto">
          <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm font-medium flex items-center gap-2">
            <X size={16} />
            Cancel
          </button>
          <div className="flex items-center gap-4">
            <button onClick={onConfirm} className="px-8 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all">Submit Changes</button>
          </div>
        </footer>
      </main>
    </div>
  );
}
