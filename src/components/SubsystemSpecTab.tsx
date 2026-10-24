import React, { useState } from 'react';
import { Cpu, Shield, Layers, HardDrive, Zap, Lock, Terminal, Activity, CheckCircle2 } from 'lucide-react';

export const SubsystemSpecTab: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'fsm' | 'memory' | 'concurrency' | 'syscalls' | 'gpu'>('fsm');

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Navigation Sub-bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex bg-zinc-950 p-1 border border-zinc-800 rounded gap-1">
          <button
            onClick={() => setActiveSection('fsm')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeSection === 'fsm'
                ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Subsystem FSM
          </button>
          <button
            onClick={() => setActiveSection('memory')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeSection === 'memory'
                ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Memory Model & MMU
          </button>
          <button
            onClick={() => setActiveSection('concurrency')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeSection === 'concurrency'
                ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Concurrency Architecture
          </button>
          <button
            onClick={() => setActiveSection('syscalls')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeSection === 'syscalls'
                ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Syscall Formal Invariants
          </button>
          <button
            onClick={() => setActiveSection('gpu')}
            className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${
              activeSection === 'gpu'
                ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            GPU DRM/KMS Mapping
          </button>
        </div>

        <div className="text-zinc-400 text-[11px] flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>vchar_dev Subsystem Specification v1.0.0</span>
        </div>
      </div>

      {/* Section 1: Finite State Machine */}
      {activeSection === 'fsm' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Kernel Driver Finite State Machine (FSM)</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              The driver implements deterministic lifecycle transitions. Module insertion executes sequential allocation steps;
              if any step fails, an exact reverse-order <code className="text-emerald-400">goto</code> unwind restores kernel state.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase font-bold">State 0</span>
                <div className="font-bold text-zinc-200">UNLOADED</div>
                <div className="text-zinc-400 text-[11px]">No kernel allocations. Device node does not exist in /dev.</div>
              </div>
              <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase font-bold">State 1</span>
                <div className="font-bold text-amber-400">INITIALIZING</div>
                <div className="text-zinc-400 text-[11px]">kzalloc → alloc_chrdev_region → cdev_init → cdev_add → class_create → device_create.</div>
              </div>
              <div className="p-3 bg-zinc-900/60 border border-emerald-800/80 rounded space-y-1 bg-emerald-950/20">
                <span className="text-emerald-400 text-[10px] uppercase font-bold">State 2</span>
                <div className="font-bold text-emerald-300">ACTIVE / READY</div>
                <div className="text-zinc-300 text-[11px]">/dev/vchar_dev live. Accepts concurrent open, read, write, lseek, ioctl.</div>
              </div>
              <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase font-bold">State 3</span>
                <div className="font-bold text-rose-400">TEARDOWN</div>
                <div className="text-zinc-400 text-[11px]">rmmod invoked. Blocks if open_count &gt; 0 (-EBUSY). Frees all resources cleanly.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Memory Model & MMU */}
      {activeSection === 'memory' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Hardware MMU Protections & Safe User-Kernel Boundary</span>
            </div>
            <div className="text-zinc-300 text-[11px] leading-relaxed space-y-2">
              <p>
                In production Linux kernel engineering, kernel code never directly dereferences user virtual addresses (<code className="text-zinc-100">*user_buf</code>).
                Direct dereference violates CPU hardware boundary enforcements:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                <li><strong className="text-zinc-200">SMAP (Supervisor Mode Access Prevention):</strong> Modern x86 processors block Ring 0 from reading or writing user pages unless the AC flag is explicitly toggled via <code className="text-cyan-300">stac</code> and <code className="text-cyan-300">clac</code> instructions.</li>
                <li><strong className="text-zinc-200">SMEP (Supervisor Mode Execution Prevention):</strong> Prevents Ring 0 from executing code residing in user pages, blocking privilege escalation exploits.</li>
                <li><strong className="text-zinc-200">Demand Paging & Exception Tables:</strong> User virtual pages are lazily allocated. When an unmapped page is accessed, the CPU triggers a page fault. <code className="text-cyan-300">copy_to_user()</code> registers with the kernel exception table (<code className="text-cyan-300">__ex_table</code>). If the fault cannot be serviced, the kernel catches it gracefully and returns uncopied byte counts, mapped to <code className="text-rose-400">-EFAULT</code>.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Concurrency */}
      {activeSection === 'concurrency' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Synchronization Primitives: Mutex vs. Spinlock Invariants</span>
            </div>
            <div className="p-3 bg-amber-950/20 border border-amber-900/60 rounded text-zinc-300 text-[11px] leading-relaxed">
              <strong className="text-amber-300 font-bold">The "Scheduling While Atomic" Rule:</strong>
              <div className="mt-1 text-zinc-400">
                Acquiring a <code className="text-zinc-200">spinlock_t</code> disables kernel preemption on the current CPU core.
                Because <code className="text-emerald-300">copy_to_user()</code> and <code className="text-emerald-300">copy_from_user()</code> access user virtual memory,
                they can trigger demand-page faults requiring disk I/O, which forces the kernel thread to sleep.
                Sleeping while preemption is disabled causes the Linux scheduler to trigger an immediate panic:
                <code className="text-rose-400 font-bold ml-1">BUG: scheduling while atomic</code>.
              </div>
              <div className="mt-2 text-zinc-200 font-medium">
                → Invariant: Character drivers serializing memory transfers between user and kernel space must strictly use sleepable <code className="text-emerald-400">struct mutex</code> with <code className="text-emerald-400">mutex_lock_interruptible()</code>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Syscall Contracts */}
      {activeSection === 'syscalls' && (
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Formal System Call Contracts & Invariants</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="pb-2 font-semibold">Syscall</th>
                  <th className="pb-2 font-semibold">Preconditions</th>
                  <th className="pb-2 font-semibold">Postconditions / State Delta</th>
                  <th className="pb-2 font-semibold">Error Codes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300">
                <tr>
                  <td className="py-2.5 font-bold text-emerald-400">open()</td>
                  <td>Valid device path</td>
                  <td>Increments dev-&gt;stats.open_count under mutex; sets file-&gt;private_data</td>
                  <td>-ERESTARTSYS, -EINVAL</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-cyan-400">read()</td>
                  <td>fd valid, buf != NULL</td>
                  <td>Copies min(count, data_size - *ppos) via copy_to_user; advances *ppos</td>
                  <td>-EFAULT, -EINVAL, -ERESTARTSYS</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-purple-400">write()</td>
                  <td>fd valid, buf != NULL</td>
                  <td>Copies min(count, capacity - *ppos) via copy_from_user; advances high-water mark</td>
                  <td>-ENOSPC, -EFAULT, -EINVAL</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-amber-400">lseek()</td>
                  <td>whence valid, offset in [0, capacity]</td>
                  <td>Updates file-&gt;f_pos to calculated target under mutex</td>
                  <td>-EINVAL, -ERESTARTSYS</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-blue-400">ioctl()</td>
                  <td>cmd recognized</td>
                  <td>VCHAR_IOC_RESET (clears buffer); VCHAR_IOC_GET_STATS (exports struct)</td>
                  <td>-ENOTTY, -EFAULT</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-zinc-400">close()</td>
                  <td>fd active</td>
                  <td>Decrements open_count under mutex</td>
                  <td>-EINVAL</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 5: GPU Mapping */}
      {activeSection === 'gpu' && (
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>GPU Systems Software Architecture: From cdev to DRM/KMS</span>
          </div>
          <div className="text-zinc-300 text-[11px] leading-relaxed space-y-2">
            <p>
              In production graphics architectures (NVIDIA proprietary drivers, AMDGPU, Intel Iris/Xe):
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Device Node Registration:</strong> GPU drivers register character device nodes such as <code className="text-zinc-200">/dev/dri/card0</code> (display modesetting) and <code className="text-zinc-200">/dev/dri/renderD128</code> (unprivileged 3D/compute dispatch) using the identical <code className="text-emerald-400">cdev_init()</code> and <code className="text-emerald-400">cdev_add()</code> APIs implemented in <code className="text-emerald-400">vchar_dev</code>.
              </li>
              <li>
                <strong className="text-zinc-200">IOCTL-Dominant Interface:</strong> Unlike filesystem drivers that stream data via <code className="text-zinc-200">write()</code>, user-space GPU runtimes (Vulkan, CUDA, OpenGL, Direct3D12) package command buffers and dispatch them via custom <code className="text-zinc-200">ioctl()</code> calls (e.g. <code className="text-zinc-200">DRM_IOCTL_SYNCOBJ_CREATE</code> or <code className="text-zinc-200">DRM_IOCTL_AMDGPU_CS</code>).
              </li>
              <li>
                <strong className="text-zinc-200">Zero-Copy Memory Mapping (mmap):</strong> GPU drivers implement <code className="text-zinc-200">fops-&gt;mmap</code> to map GPU BAR0 memory (VRAM) and host-coherent memory (GTT) directly into user virtual address space, enabling zero-copy command submission ring buffers.
              </li>
              <li>
                <strong className="text-zinc-200">Asynchronous Hardware Fences:</strong> Because GPU hardware engines execute independently from the CPU, drivers synchronize buffer sharing across engines using <code className="text-emerald-400">dma_fence</code> and timeline sync objects.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
