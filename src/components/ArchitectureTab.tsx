import React from 'react';
import { Layers, ArrowDown, Shield, Cpu, Database, HardDrive, RefreshCw } from 'lucide-react';

export const ArchitectureTab: React.FC = () => {
  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Linux Character Device Subsystem Architecture</span>
        </div>
        <p className="text-zinc-400 text-[11px] leading-relaxed">
          The Linux Virtual File System (VFS) abstracts device interaction behind standard file descriptors.
          Here is how a user-space system call travels down into the <code className="text-emerald-400">vchar_dev</code> driver.
        </p>
      </div>

      {/* Layer-by-layer Interactive Stack */}
      <div className="space-y-3">
        {/* Layer 1: User Space */}
        <div className="p-4 bg-zinc-950 border border-blue-900/60 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-blue-400 uppercase tracking-wider text-[11px]">
              1. User Space (Ring 3 - Unprivileged)
            </span>
            <span className="px-2 py-0.5 bg-blue-950 text-blue-300 rounded text-[10px]">
              User Virtual Memory
            </span>
          </div>
          <div className="text-zinc-300 text-[11px] leading-relaxed">
            Application or runtime (<code className="text-blue-300">chardev_test</code>, or in GPU drivers: Vulkan, CUDA driver, Mesa) opens
            <code className="text-zinc-100"> /dev/vchar_dev</code> and issues standard POSIX syscalls:
            <code className="text-zinc-200 ml-1">open(), read(), write(), lseek(), ioctl(), close()</code>.
          </div>
        </div>

        <div className="flex justify-center text-zinc-600">
          <ArrowDown className="w-4 h-4 text-zinc-500 animate-pulse" />
        </div>

        {/* Layer 2: System Call Dispatch */}
        <div className="p-4 bg-zinc-950 border border-purple-900/60 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-purple-400 uppercase tracking-wider text-[11px]">
              2. System Call Trap & Privilege Transition (Ring 3 → Ring 0)
            </span>
            <span className="px-2 py-0.5 bg-purple-950 text-purple-300 rounded text-[10px]">
              CPU Trap / Syscall Table
            </span>
          </div>
          <div className="text-zinc-300 text-[11px] leading-relaxed">
            The CPU executes <code className="text-purple-300">syscall</code>, switches privilege levels to Ring 0, loads kernel stack pointers,
            and enters the system call handler: <code className="text-zinc-200">ksys_read()</code> or <code className="text-zinc-200">ksys_write()</code>.
          </div>
        </div>

        <div className="flex justify-center text-zinc-600">
          <ArrowDown className="w-4 h-4 text-zinc-500 animate-pulse" />
        </div>

        {/* Layer 3: VFS */}
        <div className="p-4 bg-zinc-950 border border-emerald-900/60 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
              3. Virtual File System (VFS Layer)
            </span>
            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 rounded text-[10px]">
              struct file & struct inode
            </span>
          </div>
          <div className="text-zinc-300 text-[11px] leading-relaxed">
            VFS locates the process's file descriptor in <code className="text-emerald-300">current-&gt;files-&gt;fdt[fd]</code>.
            The inode points to our character device abstraction <code className="text-zinc-100">inode-&gt;i_cdev</code>.
            The driver resolves the outer container using <code className="text-emerald-300">container_of()</code> and executes the registered
            function pointer in <code className="text-zinc-100">file-&gt;f_op</code>.
          </div>
        </div>

        <div className="flex justify-center text-zinc-600">
          <ArrowDown className="w-4 h-4 text-zinc-500 animate-pulse" />
        </div>

        {/* Layer 4: Character Driver Core */}
        <div className="p-4 bg-zinc-950 border border-amber-900/60 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
              4. vchar_dev Driver & Concurrency Core
            </span>
            <span className="px-2 py-0.5 bg-amber-950 text-amber-300 rounded text-[10px]">
              struct mutex & copy_to/from_user
            </span>
          </div>
          <div className="text-zinc-300 text-[11px] space-y-2 leading-relaxed">
            <div>
              ● <strong>Synchronization:</strong> Acquires <code className="text-amber-300">mutex_lock_interruptible(&dev-&gt;lock)</code> to serialize access.
            </div>
            <div>
              ● <strong>Boundary Protection:</strong> Safely accesses user memory using <code className="text-emerald-300">copy_to_user()</code> and <code className="text-emerald-300">copy_from_user()</code>.
              Never dereferences raw user pointers directly.
            </div>
            <div>
              ● <strong>Sleepability:</strong> Because user pages can trigger demand-page faults requiring disk I/O, using a sleepable mutex avoids the catastrophic
              <code className="text-rose-400 font-bold"> "scheduling while atomic"</code> panic of spinlocks.
            </div>
          </div>
        </div>

        <div className="flex justify-center text-zinc-600">
          <ArrowDown className="w-4 h-4 text-zinc-500 animate-pulse" />
        </div>

        {/* Layer 5: Kernel Memory & Physical RAM */}
        <div className="p-4 bg-zinc-950 border border-cyan-900/60 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-cyan-400 uppercase tracking-wider text-[11px]">
              5. Bounded Kernel Buffer & Physical Memory
            </span>
            <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 rounded text-[10px]">
              kzalloc (GFP_KERNEL) / Physical RAM
            </span>
          </div>
          <div className="text-zinc-300 text-[11px] leading-relaxed">
            The 4096-byte kernel memory page allocated with <code className="text-cyan-300">kzalloc()</code> stores payload bytes.
            In GPU drivers (DRM), this layer corresponds to GPU VRAM (BAR0) or pinned GTT system memory buffers mapped via <code className="text-cyan-300">mmap</code>.
          </div>
        </div>
      </div>

      {/* Connection to GPU Drivers */}
      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2">
        <div className="text-zinc-200 font-semibold text-[11px] flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>GPU Systems Engineering Context: From Character Driver to GPU Command Ring</span>
        </div>
        <p className="text-zinc-400 text-[11px] leading-relaxed">
          In production GPU drivers (e.g. AMDGPU, NVIDIA DRM, Intel Xe):
        </p>
        <ul className="list-disc pl-5 text-zinc-400 space-y-1 text-[11px]">
          <li><code className="text-zinc-200">/dev/dri/card0</code> and <code className="text-zinc-200">/dev/dri/renderD128</code> are registered as character devices via <code className="text-emerald-400">cdev_add()</code>.</li>
          <li>User space uses <code className="text-zinc-200">ioctl()</code> to submit command buffers (CS - Command Submission) rather than stream writes.</li>
          <li>Hardware DMA ring buffers copy vertices, textures, and compute kernels asynchronously, synchronized by <code className="text-emerald-400">dma_fence</code> and interrupt handlers.</li>
        </ul>
      </div>
    </div>
  );
};
