import React, { useState } from 'react';
import { CODE_FILES } from '../data/driverCode';
import { FileCode, Info, Copy, Check } from 'lucide-react';

export const CodeBrowserTab: React.FC = () => {
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const currentFile = CODE_FILES[selectedFileIdx];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* File Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex bg-zinc-950 p-1 border border-zinc-800 rounded gap-1">
          {CODE_FILES.map((file, idx) => (
            <button
              key={file.path}
              onClick={() => setSelectedFileIdx(idx)}
              className={`px-3 py-1.5 rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
                selectedFileIdx === idx
                  ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>{file.filename}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleCopy}
          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-zinc-300 flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" /> Copy File
            </>
          )}
        </button>
      </div>

      <div className="text-zinc-400 text-[11px]">
        {currentFile.description} (<code className="text-zinc-300">{currentFile.path}</code>)
      </div>

      {/* Annotations Banner (if any) */}
      {currentFile.annotations && currentFile.annotations.length > 0 && (
        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded space-y-2">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold text-[11px]">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>Key Kernel Engineering Concepts in this File</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {currentFile.annotations.map(ann => (
              <div key={ann.title} className="p-2 bg-zinc-900/60 border border-zinc-800/80 rounded">
                <div className="text-emerald-400 font-bold text-[11px] mb-0.5">{ann.title}</div>
                <div className="text-zinc-400 text-[10px] leading-relaxed">{ann.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code Display */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-x-auto text-[11px] leading-relaxed select-text max-h-[600px] overflow-y-auto">
        <pre className="text-zinc-300 font-mono">
          {currentFile.content.split('\n').map((line, idx) => (
            <div key={idx} className="table-row hover:bg-zinc-900/40">
              <span className="table-cell pr-4 text-zinc-400 select-none text-right w-10">
                {idx + 1}
              </span>
              <span className="table-cell whitespace-pre">
                {line}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
};
