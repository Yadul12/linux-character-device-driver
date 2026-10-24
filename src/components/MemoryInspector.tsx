import React, { useState } from 'react';

interface MemoryInspectorProps {
  buffer: Uint8Array;
  dataSize: number;
  capacity: number;
  activePos?: number;
}

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({
  buffer,
  dataSize,
  capacity,
  activePos = 0,
}) => {
  const [rowOffset, setRowOffset] = useState<number>(0);
  const bytesPerRow = 16;
  const rowsToShow = 16; // 256 bytes per window
  const maxRows = Math.ceil(capacity / bytesPerRow);

  const startRow = Math.max(0, Math.min(rowOffset, maxRows - rowsToShow));
  const displayedBytesStart = startRow * bytesPerRow;
  const displayedBytesEnd = Math.min(capacity, displayedBytesStart + rowsToShow * bytesPerRow);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-zinc-800 gap-2">
        <div className="flex items-center gap-3">
          <span className="text-zinc-200 font-semibold tracking-wide uppercase text-[11px]">
            Kernel Page Buffer (4096 B / 1 Page)
          </span>
          <span className="text-zinc-400">
            Stored: <span className="text-emerald-400 font-medium">{dataSize} B</span> / {capacity} B
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Offset Window:</span>
          <button
            onClick={() => setRowOffset(prev => Math.max(0, prev - 16))}
            disabled={startRow === 0}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-30 cursor-pointer"
          >
            ▲ Prev 256B
          </button>
          <span className="text-zinc-300">
            0x{displayedBytesStart.toString(16).padStart(4, '0')} - 0x{(displayedBytesEnd - 1).toString(16).padStart(4, '0')}
          </span>
          <button
            onClick={() => setRowOffset(prev => Math.min(maxRows - rowsToShow, prev + 16))}
            disabled={displayedBytesEnd >= capacity}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-30 cursor-pointer"
          >
            ▼ Next 256B
          </button>
        </div>
      </div>

      {/* Progress Bar of Page Utilization */}
      <div className="w-full bg-zinc-900 rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className="bg-emerald-500 h-1.5 transition-all duration-300"
          style={{ width: `${Math.min(100, (dataSize / capacity) * 100)}%` }}
        />
      </div>

      {/* Hex Grid */}
      <div className="overflow-x-auto select-none">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-zinc-400 text-left border-b border-zinc-900 pb-1">
              <th className="pr-4 pb-1 font-normal">OFFSET</th>
              <th className="pr-4 pb-1 font-normal tracking-wider">HEX (00 - 0F)</th>
              <th className="pb-1 font-normal tracking-wider">ASCII</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowsToShow }).map((_, rIdx) => {
              const rowByteStart = displayedBytesStart + rIdx * bytesPerRow;
              if (rowByteStart >= capacity) return null;

              const rowBytes: number[] = [];
              for (let i = 0; i < bytesPerRow; i++) {
                const byteIdx = rowByteStart + i;
                if (byteIdx < capacity) {
                  rowBytes.push(buffer[byteIdx]);
                }
              }

              return (
                <tr key={rowByteStart} className="hover:bg-zinc-900/60 transition-colors">
                  {/* Offset header */}
                  <td className="pr-4 text-zinc-400 select-all font-mono">
                    0x{rowByteStart.toString(16).padStart(4, '0')}
                  </td>

                  {/* Hex bytes */}
                  <td className="pr-4 font-mono">
                    <div className="flex gap-1.5">
                      {rowBytes.map((b, bIdx) => {
                        const globalIdx = rowByteStart + bIdx;
                        const isWritten = globalIdx < dataSize;
                        const isActive = globalIdx === activePos;
                        return (
                          <span
                            key={bIdx}
                            className={`w-5 text-center transition-colors ${
                              isActive
                                ? 'bg-cyan-500/20 text-cyan-300 font-bold border-b border-cyan-400'
                                : isWritten
                                ? b !== 0
                                  ? 'text-emerald-400 font-medium'
                                  : 'text-zinc-400'
                                : 'text-zinc-400'
                            }`}
                          >
                            {b.toString(16).padStart(2, '0').toUpperCase()}
                          </span>
                        );
                      })}
                    </div>
                  </td>

                  {/* ASCII representation */}
                  <td className="font-mono text-zinc-300 tracking-widest">
                    {rowBytes.map((b, bIdx) => {
                      const globalIdx = rowByteStart + bIdx;
                      const isWritten = globalIdx < dataSize;
                      const char = b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
                      return (
                        <span
                          key={bIdx}
                          className={isWritten && b !== 0 ? 'text-zinc-200' : 'text-zinc-400'}
                        >
                          {char}
                        </span>
                      );
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-zinc-900 text-zinc-400 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500 inline-block" />
          <span>Valid Data Bytes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/30 border border-cyan-400 inline-block" />
          <span>Current Cursor (f_pos)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-zinc-800 border border-zinc-700 inline-block" />
          <span>Unwritten Page Memory</span>
        </div>
      </div>
    </div>
  );
};
