import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, Users, Play, Square, Activity } from 'lucide-react';

interface ThreadWorker {
  id: number;
  name: string;
  role: 'Writer' | 'Reader';
  status: 'Idle' | 'Waiting for Mutex' | 'Executing in Critical Section' | 'Yielding';
  transferredBytes: number;
  operationsCompleted: number;
}

export const ConcurrencyVisualizer: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [mutexHolder, setMutexHolder] = useState<number | null>(null);
  const [threads, setThreads] = useState<ThreadWorker[]>([
    { id: 0, name: 'Worker-0 (Writer)', role: 'Writer', status: 'Idle', transferredBytes: 0, operationsCompleted: 0 },
    { id: 1, name: 'Worker-1 (Reader)', role: 'Reader', status: 'Idle', transferredBytes: 0, operationsCompleted: 0 },
    { id: 2, name: 'Worker-2 (Writer)', role: 'Writer', status: 'Idle', transferredBytes: 0, operationsCompleted: 0 },
    { id: 3, name: 'Worker-3 (Reader)', role: 'Reader', status: 'Idle', transferredBytes: 0, operationsCompleted: 0 },
  ]);
  const [totalOps, setTotalOps] = useState<number>(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      setMutexHolder(null);
      setThreads(prev => prev.map(t => ({ ...t, status: 'Idle' })));
      return;
    }

    timerRef.current = setInterval(() => {
      // Pick a thread to grant the mutex to or cycle
      const candidateId = Math.floor(Math.random() * 4);
      setMutexHolder(candidateId);

      setThreads(prev =>
        prev.map(t => {
          if (t.id === candidateId) {
            const added = t.role === 'Writer' ? 48 : 32;
            return {
              ...t,
              status: 'Executing in Critical Section',
              transferredBytes: t.transferredBytes + added,
              operationsCompleted: t.operationsCompleted + 1
            };
          } else {
            return {
              ...t,
              status: 'Waiting for Mutex'
            };
          }
        })
      );

      setTotalOps(prev => prev + 1);
    }, 450);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 font-mono text-xs space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Multithreaded Concurrency & Mutex Contention Simulator</span>
          </div>
          <div className="text-zinc-400 text-[11px] mt-0.5">
            Simulates POSIX pthread workers executing concurrent read() and write() system calls
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer font-medium transition-colors ${
              isRunning
                ? 'bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-200'
                : 'bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 text-emerald-200'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" /> Stop Workers
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" /> Run Concurrency Test
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mutex Status Banner */}
      <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {mutexHolder !== null ? (
            <div className="flex items-center gap-2 text-amber-400">
              <Lock className="w-5 h-5 text-amber-400" />
              <div>
                <span className="font-bold uppercase tracking-wider text-[11px]">
                  MUTEX STATE: LOCKED
                </span>
                <div className="text-zinc-300 text-[11px]">
                  Acquired by <strong>Worker-{mutexHolder}</strong> via <code className="text-amber-300">mutex_lock_interruptible(&dev-&gt;lock)</code>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400">
              <Unlock className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="font-bold uppercase tracking-wider text-[11px]">
                  MUTEX STATE: UNLOCKED
                </span>
                <div className="text-zinc-400 text-[11px]">
                  Ready for acquisition; no thread currently in critical section
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-zinc-300">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Serialized Syscalls: <strong>{totalOps}</strong></span>
          </div>
          <div className="text-emerald-400 font-semibold">
            0 Data Races / 0 Torn Reads
          </div>
        </div>
      </div>

      {/* Thread Workers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {threads.map(t => {
          const isHoldingLock = mutexHolder === t.id;
          return (
            <div
              key={t.id}
              className={`p-3.5 rounded border transition-all ${
                isHoldingLock
                  ? 'bg-amber-950/30 border-amber-500 shadow-md ring-1 ring-amber-500/30'
                  : t.status === 'Waiting for Mutex'
                  ? 'bg-zinc-900/40 border-zinc-700'
                  : 'bg-zinc-900/20 border-zinc-800'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-zinc-200">{t.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                  t.role === 'Writer'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                }`}>
                  {t.role}
                </span>
              </div>

              <div className="space-y-1.5 text-zinc-400 text-[11px]">
                <div className="flex justify-between">
                  <span>State:</span>
                  <span className={`font-medium ${
                    isHoldingLock
                      ? 'text-amber-400 font-bold'
                      : t.status === 'Waiting for Mutex'
                      ? 'text-zinc-300'
                      : 'text-zinc-400'
                  }`}>
                    {t.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Transferred:</span>
                  <span className="text-zinc-200">{t.transferredBytes} B</span>
                </div>
                <div className="flex justify-between">
                  <span>Operations:</span>
                  <span className="text-zinc-200">{t.operationsCompleted}</span>
                </div>
              </div>

              {isHoldingLock && (
                <div className="mt-3 pt-2 border-t border-amber-900/50 text-[10px] text-amber-300 font-medium">
                  ● Inside Critical Section (copy_to/from_user safe)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Educational Note */}
      <div className="p-3 bg-zinc-900/40 border border-zinc-800/80 rounded text-zinc-400 text-[11px] leading-relaxed">
        <strong className="text-zinc-200">Kernel Engineering Takeaway:</strong> Why not use a <code>spinlock_t</code> here?
        Because <code>copy_to_user()</code> and <code>copy_from_user()</code> access user virtual memory which can trigger demand-page faults.
        Page faults require disk I/O and put the kernel thread to sleep. Holding a spinlock while sleeping panics the kernel with
        <code className="text-rose-400 font-bold"> "BUG: scheduling while atomic"</code>. Hence, character drivers serializing user copies
        must strictly use sleepable <code className="text-emerald-300">struct mutex</code>!
      </div>
    </div>
  );
};
