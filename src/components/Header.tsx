import React from 'react';
import { Terminal, ShieldCheck, CheckCircle2, Cpu } from 'lucide-react';

export type ActiveTab = 'workbench' | 'concurrency' | 'tests' | 'code' | 'architecture' | 'spec';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  openCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'workbench', label: 'Driver Workbench & Memory', icon: '⚡' },
    { id: 'concurrency', label: 'Concurrency & Mutex Engine', icon: '🔒' },
    { id: 'tests', label: 'Verification & AST Audit', icon: '✓' },
    { id: 'code', label: 'Annotated C Source', icon: '📄' },
    { id: 'architecture', label: 'Subsystem Architecture & VFS', icon: '☵' },
    { id: 'spec', label: 'Hardware & Subsystem Spec', icon: '⚙' },
  ];

  return (
    <header className="bg-zinc-950 border-b border-zinc-800 text-zinc-100 font-mono">
      {/* Top Branding Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-wide text-zinc-100">
                Linux Character Device Driver Workbench
              </h1>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                vchar_dev.ko
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>Linux Kernel 5.x / 6.x</span>
              <span>•</span>
              <span className="text-zinc-300">Ring 0 Character Device Subsystem & POSIX VFS Emulator</span>
            </div>
          </div>
        </div>

        {/* Quick Diagnostics Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Dev Node: <strong className="text-zinc-100">/dev/vchar_dev (248:0)</strong></span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/50 border border-emerald-800/80 rounded text-emerald-300 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Static AST: <strong>34/34 PASS</strong></span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/50 border border-emerald-800/80 rounded text-emerald-300 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sim Suite: <strong>12/12 PASS</strong></span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto gap-1 border-t border-zinc-900">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2.5 text-xs font-medium cursor-pointer border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-400 bg-zinc-900/40'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </header>
  );
};
