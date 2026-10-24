import React, { useState } from 'react';
import { DmesgEntry } from '../simulator/driverSimulator';
import { Terminal, Trash2 } from 'lucide-react';

interface DmesgViewerProps {
  logs: DmesgEntry[];
  onClear?: () => void;
}

export const DmesgViewer: React.FC<DmesgViewerProps> = ({ logs, onClear }) => {
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'err'>('all');

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs flex flex-col h-[380px]">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-300">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-zinc-200 tracking-wide uppercase text-[11px]">
            Kernel Ring Buffer (dmesg)
          </span>
          <span className="text-zinc-400 text-[11px] ml-1">
            ({logs.length} entries)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 rounded p-0.5 border border-zinc-800 text-[11px]">
            {(['all', 'info', 'warn', 'err'] as const).map(lvl => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`px-2 py-0.5 rounded cursor-pointer uppercase ${
                  filter === lvl
                    ? 'bg-zinc-800 text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {onClear && (
            <button
              onClick={onClear}
              title="Clear ring buffer display"
              className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 select-text">
        {filteredLogs.length === 0 ? (
          <div className="text-zinc-400 py-8 text-center">
            No dmesg events matching current filter.
          </div>
        ) : (
          filteredLogs.map(log => {
            let color = 'text-zinc-300';
            let prefix = 'pr_info';
            if (log.level === 'warn') {
              color = 'text-amber-400';
              prefix = 'pr_warn';
            } else if (log.level === 'err') {
              color = 'text-rose-400 font-semibold';
              prefix = 'pr_err';
            }

            return (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed hover:bg-zinc-900/40 px-1 py-0.5 rounded">
                <span className="text-zinc-400 whitespace-nowrap select-none text-[11px]">
                  {log.time}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider select-none ${
                  log.level === 'warn' ? 'text-amber-400' : log.level === 'err' ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  [{prefix}]
                </span>
                <span className={`flex-1 break-all ${color}`}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="pt-2 border-t border-zinc-900 text-zinc-400 text-[11px] flex justify-between">
        <span>syslog facility: KERNEL | loglevel: KERN_DEBUG</span>
        <span>Auto-scroll: Enabled</span>
      </div>
    </div>
  );
};
