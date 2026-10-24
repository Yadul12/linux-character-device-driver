import React, { useState } from 'react';
import { DriverState, driverSim } from '../simulator/driverSimulator';
import { Play, RotateCcw, AlertTriangle, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';

interface SimulatorControlsProps {
  state: DriverState;
}

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({ state }) => {
  const [selectedHandleId, setSelectedHandleId] = useState<string>('');
  const [writeText, setWriteText] = useState<string>('Test payload from userspace process');
  const [readCount, setReadCount] = useState<number>(64);
  const [lastReadResult, setLastReadResult] = useState<{ data: string; bytes: number; isEof: boolean } | null>(null);
  const [seekOffset, setSeekOffset] = useState<number>(0);
  const [seekWhence, setSeekWhence] = useState<'SEEK_SET' | 'SEEK_CUR' | 'SEEK_END'>('SEEK_SET');
  const [faultAlert, setFaultAlert] = useState<{ code: string; message: string } | null>(null);

  // Auto-select first handle if available
  React.useEffect(() => {
    if (state.handles.length > 0 && (!selectedHandleId || !state.handles.find(h => h.id === selectedHandleId))) {
      setSelectedHandleId(state.handles[0].id);
    } else if (state.handles.length === 0) {
      setSelectedHandleId('');
    }
  }, [state.handles, selectedHandleId]);

  const activeHandle = state.handles.find(h => h.id === selectedHandleId);

  const handleOpen = () => {
    const res = driverSim.open();
    if (res.success && res.handleId) {
      setSelectedHandleId(res.handleId);
    }
  };

  const handleClose = () => {
    if (!selectedHandleId) return;
    driverSim.close(selectedHandleId);
  };

  const handleWrite = () => {
    if (!selectedHandleId || !writeText) return;
    setFaultAlert(null);
    driverSim.write(selectedHandleId, writeText);
  };

  const handleRead = () => {
    if (!selectedHandleId) return;
    setFaultAlert(null);
    const res = driverSim.read(selectedHandleId, readCount);
    if (res.success) {
      setLastReadResult({ data: res.data, bytes: res.bytesRead, isEof: res.isEof });
    }
  };

  const handleSeek = () => {
    if (!selectedHandleId) return;
    setFaultAlert(null);
    driverSim.llseek(selectedHandleId, seekOffset, seekWhence);
  };

  const handleIoctlReset = () => {
    driverSim.ioctlReset();
    setLastReadResult(null);
  };

  const handleFault = (type: 'bad_pointer' | 'buffer_overflow') => {
    const res = driverSim.injectFault(type);
    setFaultAlert(res);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 font-mono text-xs space-y-5">
      {/* Module Lifecycle & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-zinc-100 text-sm">
              /dev/vchar_dev
            </span>
          </div>
          <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[11px] rounded">
            Major: {state.major} | Minor: {state.minor}
          </span>
          <span className={`px-2 py-0.5 text-[11px] rounded border ${
            state.isLoaded
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
              : 'bg-zinc-900 border-zinc-700 text-zinc-400'
          }`}>
            {state.isLoaded ? '● MODULE LOADED (Ring 0)' : '○ UNLOADED'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {state.isLoaded ? (
            <button
              onClick={() => driverSim.rmmod()}
              className="px-3 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded cursor-pointer transition-colors"
            >
              sudo rmmod vchar_dev
            </button>
          ) : (
            <button
              onClick={() => driverSim.insmod()}
              className="px-3 py-1 bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 text-emerald-200 rounded cursor-pointer transition-colors"
            >
              sudo insmod driver/vchar_dev.ko
            </button>
          )}
        </div>
      </div>

      {/* Fault Alert Box */}
      {faultAlert && (
        <div className="bg-rose-950/60 border border-rose-800/80 rounded p-3 flex items-start gap-3 text-rose-200">
          <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-rose-300">
              Trap Condition Returned: {faultAlert.code}
            </div>
            <div className="text-zinc-300 text-[11px]">
              {faultAlert.message}
            </div>
          </div>
        </div>
      )}

      {/* Active File Descriptors */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-zinc-300">
          <span className="font-semibold text-zinc-200 uppercase tracking-wide text-[11px]">
            Active File Handles (Open Descriptors)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpen}
              disabled={!state.isLoaded}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded cursor-pointer disabled:opacity-30"
            >
              + open(/dev/vchar_dev, O_RDWR)
            </button>
            {activeHandle && (
              <button
                onClick={handleClose}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-rose-400 rounded cursor-pointer"
              >
                close({activeHandle.id})
              </button>
            )}
          </div>
        </div>

        {state.handles.length === 0 ? (
          <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded text-zinc-400 text-center">
            No open file descriptors. Click <span className="text-emerald-400">+ open(...)</span> to simulate a user process accessing the driver.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {state.handles.map(h => (
              <button
                key={h.id}
                onClick={() => setSelectedHandleId(h.id)}
                className={`p-2.5 text-left rounded border transition-all cursor-pointer ${
                  selectedHandleId === h.id
                    ? 'bg-zinc-900 border-emerald-500 shadow-sm'
                    : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex justify-between items-center text-zinc-200 font-semibold mb-1">
                  <span>Handle: {h.id}</span>
                  <span className="text-emerald-400 text-[10px]">PID: {h.pid}</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px]">
                  <span>Mode: {h.mode}</span>
                  <span className="text-cyan-300">f_pos: {h.f_pos}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Syscall Operations Box */}
      {activeHandle ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-zinc-800">
          {/* Write Operation */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded p-3 space-y-2">
            <div className="flex justify-between items-center text-zinc-300">
              <span className="font-semibold text-emerald-400">
                write(fd, buf, count)
              </span>
              <span className="text-zinc-400 text-[11px]">Current f_pos: {activeHandle.f_pos}</span>
            </div>
            <textarea
              value={writeText}
              onChange={e => setWriteText(e.target.value)}
              rows={2}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-xs"
              placeholder="Enter bytes to write to driver buffer..."
            />
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-[11px]">{new TextEncoder().encode(writeText).length} bytes</span>
              <button
                onClick={handleWrite}
                className="px-3 py-1 bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 text-emerald-200 rounded flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Execute write()
              </button>
            </div>
          </div>

          {/* Read Operation */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded p-3 space-y-2">
            <div className="flex justify-between items-center text-zinc-300">
              <span className="font-semibold text-cyan-400">
                read(fd, buf, count)
              </span>
              <span className="text-zinc-400 text-[11px]">Data stored: {state.dataSize} B</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-[11px]">Count (bytes):</span>
              <input
                type="number"
                min="1"
                max="4096"
                value={readCount}
                onChange={e => setReadCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 bg-zinc-950 border border-zinc-800 rounded p-1.5 text-zinc-200 text-xs"
              />
              <button
                onClick={handleRead}
                className="flex-1 px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-200 rounded flex items-center justify-center gap-1.5 cursor-pointer font-medium"
              >
                <Play className="w-3.5 h-3.5" /> Execute read()
              </button>
            </div>

            {lastReadResult && (
              <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2 mt-2">
                <div className="flex justify-between text-[11px] text-zinc-400 border-b border-zinc-900 pb-1 mb-1">
                  <span>Bytes Retrieved: <strong className="text-cyan-300">{lastReadResult.bytes}</strong></span>
                  {lastReadResult.isEof && <span className="text-amber-400 font-bold">[EOF REACHED]</span>}
                </div>
                <div className="text-zinc-200 break-all select-all font-mono text-[11px]">
                  {lastReadResult.bytes > 0 ? lastReadResult.data : '<0 bytes returned (EOF)>'}
                </div>
              </div>
            )}
          </div>

          {/* Lseek Operation */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded p-3 space-y-2">
            <span className="font-semibold text-purple-400">
              lseek(fd, offset, whence)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                value={seekOffset}
                onChange={e => setSeekOffset(parseInt(e.target.value) || 0)}
                className="w-24 bg-zinc-950 border border-zinc-800 rounded p-1.5 text-zinc-200 text-xs"
                placeholder="Offset"
              />
              <select
                value={seekWhence}
                onChange={e => setSeekWhence(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-800 rounded p-1.5 text-zinc-200 text-xs"
              >
                <option value="SEEK_SET">SEEK_SET (Origin: 0)</option>
                <option value="SEEK_CUR">SEEK_CUR (Relative)</option>
                <option value="SEEK_END">SEEK_END (EOF: {state.dataSize})</option>
              </select>
              <button
                onClick={handleSeek}
                className="px-3 py-1.5 bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-200 rounded cursor-pointer font-medium"
              >
                Seek
              </button>
            </div>
          </div>

          {/* IOCTL & Maintenance */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded p-3 space-y-2">
            <span className="font-semibold text-amber-400">
              ioctl(fd, cmd, arg)
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleIoctlReset}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> VCHAR_IOC_RESET (Flush)
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edge-Case Fault Injection Simulator */}
      <div className="pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-2 mb-2 text-zinc-300">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-zinc-200 uppercase tracking-wide text-[11px]">
            Fault Injection & Kernel Safety Tests
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleFault('bad_pointer')}
            className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded cursor-pointer transition-colors"
          >
            Inject NULL/Unmapped User Pointer (Expect EFAULT)
          </button>
          <button
            onClick={() => handleFault('buffer_overflow')}
            className="px-3 py-1.5 bg-amber-950/70 hover:bg-amber-900 border border-amber-800/80 text-amber-300 rounded cursor-pointer transition-colors"
          >
            Attempt 4097+ Byte Overflow Write (Expect ENOSPC)
          </button>
        </div>
      </div>
    </div>
  );
};
