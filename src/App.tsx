import React, { useState, useEffect } from 'react';
import { Header, ActiveTab } from './components/Header';
import { MemoryInspector } from './components/MemoryInspector';
import { DmesgViewer } from './components/DmesgViewer';
import { SimulatorControls } from './components/SimulatorControls';
import { ConcurrencyVisualizer } from './components/ConcurrencyVisualizer';
import { TestSuiteTab } from './components/TestSuiteTab';
import { CodeBrowserTab } from './components/CodeBrowserTab';
import { ArchitectureTab } from './components/ArchitectureTab';
import { SubsystemSpecTab } from './components/SubsystemSpecTab';
import { driverSim, DriverState } from './simulator/driverSimulator';
import { Download, Check } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workbench');
  const [driverState, setDriverState] = useState<DriverState>(driverSim.getState());
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = driverSim.subscribe(newState => {
      setDriverState(newState);
    });
    return () => unsubscribe();
  }, []);

  const handleCopyInstallScript = () => {
    const script = `# 1. Install prerequisites (Debian/Ubuntu)
sudo apt-get update && sudo apt-get install -y build-essential linux-headers-$(uname -r)

# 2. Build kernel module and test suite
make all

# 3. Insert character driver into Linux kernel
sudo insmod driver/vchar_dev.ko

# 4. Verify dmesg and dev node
dmesg | tail -n 10
ls -la /dev/vchar_dev

# 5. Execute user-space test suite
./user/chardev_test

# 6. Unload module
sudo rmmod vchar_dev`;
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col selection:bg-emerald-900 selection:text-emerald-100">
      {/* Top Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openCount={driverState.stats.open_count}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {activeTab === 'workbench' && (
          <div className="space-y-6">
            {/* Quick Hero Banner */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-100 text-sm">
                    Interactive Kernel Character Driver Workbench
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[10px] uppercase font-bold">
                    POSIX + Ring 0 Emulator
                  </span>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Simulates user/kernel memory boundaries, dynamic cdev registration, mutex-protected page buffers, and fault injection in real-time.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyInstallScript}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-200 text-xs flex items-center gap-1.5 cursor-pointer font-mono"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Host Commands!
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" /> Copy Bare-Metal Load Script
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Top Row: Simulator Controls */}
            <SimulatorControls state={driverState} />

            {/* Bottom Row: Memory Hex/ASCII Inspector & Dmesg Console */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MemoryInspector
                buffer={driverState.buffer}
                dataSize={driverState.dataSize}
                capacity={driverState.capacity}
                activePos={driverState.handles[0]?.f_pos || 0}
              />
              <DmesgViewer
                logs={driverState.dmesg}
                onClear={() => {
                  driverSim.getState().dmesg.length = 0;
                  setDriverState({ ...driverSim.getState(), dmesg: [] });
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'concurrency' && <ConcurrencyVisualizer />}

        {activeTab === 'tests' && <TestSuiteTab />}

        {activeTab === 'code' && <CodeBrowserTab />}

        {activeTab === 'architecture' && <ArchitectureTab />}

        {activeTab === 'spec' && <SubsystemSpecTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-4 font-mono text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-zinc-300 font-semibold">vchar_dev</span>
            <span>—</span>
            <span>Linux Character Device Driver Subsystem</span>
            <span className="text-zinc-400">|</span>
            <span className="text-emerald-400">GPL v2 Licensed</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <span>Dynamic Major/Minor: <strong>alloc_chrdev_region</strong></span>
            <span>Sync: <strong>mutex_lock_interruptible</strong></span>
            <span>Sysfs: <strong>udev auto-node</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
