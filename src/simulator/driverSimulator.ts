export interface DmesgEntry {
  id: string;
  time: string;
  level: 'info' | 'warn' | 'err';
  message: string;
}

export interface FileHandle {
  id: string;
  pid: number;
  f_pos: number;
  mode: string;
}

export interface DriverState {
  isLoaded: boolean;
  major: number;
  minor: number;
  capacity: number;
  dataSize: number;
  buffer: Uint8Array;
  handles: FileHandle[];
  mutexLocked: boolean;
  lockedBy: string | null;
  stats: {
    buffer_capacity: number;
    current_size: number;
    read_bytes: number;
    write_bytes: number;
    open_count: number;
  };
  dmesg: DmesgEntry[];
}

export const INITIAL_CAPACITY = 4096;

export class DriverSimulator {
  private state: DriverState;
  private listeners: ((state: DriverState) => void)[] = [];

  constructor() {
    this.state = {
      isLoaded: true,
      major: 248,
      minor: 0,
      capacity: INITIAL_CAPACITY,
      dataSize: 0,
      buffer: new Uint8Array(INITIAL_CAPACITY),
      handles: [],
      mutexLocked: false,
      lockedBy: null,
      stats: {
        buffer_capacity: INITIAL_CAPACITY,
        current_size: 0,
        read_bytes: 0,
        write_bytes: 0,
        open_count: 0,
      },
      dmesg: [
        {
          id: 'log-1',
          time: '[    0.000000]',
          level: 'info',
          message: 'vchar_dev: Initializing Linux Character Device Module'
        },
        {
          id: 'log-2',
          time: '[    0.000042]',
          level: 'info',
          message: 'vchar_dev: alloc_chrdev_region assigned Major: 248, Minor: 0'
        },
        {
          id: 'log-3',
          time: '[    0.000078]',
          level: 'info',
          message: 'vchar_dev: cdev_init & cdev_add bound to file_operations table'
        },
        {
          id: 'log-4',
          time: '[    0.000105]',
          level: 'info',
          message: 'vchar_dev: class_create & device_create registered /dev/vchar_dev (4096 B buffer)'
        }
      ]
    };

    // Pre-populate with initial demonstration text
    const initPayload = "Linux Kernel vchar_dev ready for I/O operations.";
    const encoder = new TextEncoder();
    const encoded = encoder.encode(initPayload);
    this.state.buffer.set(encoded, 0);
    this.state.dataSize = encoded.length;
    this.state.stats.current_size = encoded.length;
    this.state.stats.write_bytes = encoded.length;
  }

  public getState(): DriverState {
    return { ...this.state, buffer: new Uint8Array(this.state.buffer), handles: [...this.state.handles] };
  }

  public subscribe(cb: (state: DriverState) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach(cb => cb(s));
  }

  private log(level: 'info' | 'warn' | 'err', message: string) {
    const now = (performance.now() / 1000).toFixed(6);
    this.state.dmesg.unshift({
      id: `log-${Date.now()}-${Math.random()}`,
      time: `[   ${now}]`,
      level,
      message
    });
    if (this.state.dmesg.length > 50) {
      this.state.dmesg.pop();
    }
  }

  public insmod(capacity: number = INITIAL_CAPACITY): { success: boolean; msg: string } {
    if (this.state.isLoaded) {
      this.log('warn', 'vchar_dev: Module already loaded (EEXIST)');
      this.notify();
      return { success: false, msg: 'Module already inserted' };
    }

    this.state.isLoaded = true;
    this.state.capacity = capacity;
    this.state.buffer = new Uint8Array(capacity);
    this.state.dataSize = 0;
    this.state.handles = [];
    this.state.mutexLocked = false;
    this.state.lockedBy = null;
    this.state.stats = {
      buffer_capacity: capacity,
      current_size: 0,
      read_bytes: 0,
      write_bytes: 0,
      open_count: 0
    };

    this.log('info', `vchar_dev: Initialized module. Major: 248, Minor: 0, Buffer: ${capacity} bytes`);
    this.notify();
    return { success: true, msg: 'Module loaded successfully' };
  }

  public rmmod(): { success: boolean; msg: string } {
    if (!this.state.isLoaded) {
      this.log('warn', 'rmmod: Module vchar_dev is not loaded');
      this.notify();
      return { success: false, msg: 'Module is not loaded' };
    }

    if (this.state.handles.length > 0) {
      this.log('err', `rmmod: Module vchar_dev is in use by ${this.state.handles.length} active process(es) (EBUSY)`);
      this.notify();
      return { success: false, msg: 'Device is busy with active open file handles' };
    }

    this.state.isLoaded = false;
    this.state.dataSize = 0;
    this.state.buffer = new Uint8Array(this.state.capacity);
    this.log('info', 'vchar_dev: device_destroy & class_destroy completed');
    this.log('info', 'vchar_dev: cdev_del & unregister_chrdev_region completed');
    this.log('info', 'vchar_dev: kfree(buffer) & mutex_destroy completed. Module unloaded.');
    this.notify();
    return { success: true, msg: 'Module unloaded cleanly' };
  }

  public open(pid: number = Math.floor(1000 + Math.random() * 9000)): { success: boolean; handleId?: string; msg: string } {
    if (!this.state.isLoaded) {
      return { success: false, msg: 'No such device (/dev/vchar_dev not loaded)' };
    }

    const handle: FileHandle = {
      id: `fd-${Date.now().toString(36)}`,
      pid,
      f_pos: 0,
      mode: 'O_RDWR'
    };

    this.state.handles.push(handle);
    this.state.stats.open_count = this.state.handles.length;
    this.log('info', `vchar_dev: Device opened by PID ${pid} (Active handles: ${this.state.stats.open_count})`);
    this.notify();
    return { success: true, handleId: handle.id, msg: `Opened handle fd: ${handle.id} (PID ${pid})` };
  }

  public close(handleId: string): { success: boolean; msg: string } {
    const idx = this.state.handles.findIndex(h => h.id === handleId);
    if (idx === -1) {
      return { success: false, msg: 'Invalid file descriptor' };
    }

    const handle = this.state.handles[idx];
    this.state.handles.splice(idx, 1);
    this.state.stats.open_count = this.state.handles.length;
    this.log('info', `vchar_dev: Device closed by PID ${handle.pid} (Active handles: ${this.state.stats.open_count})`);
    this.notify();
    return { success: true, msg: 'Closed file handle' };
  }

  public write(handleId: string, text: string): { success: boolean; bytesWritten: number; msg: string } {
    if (!this.state.isLoaded) return { success: false, bytesWritten: 0, msg: 'Driver not loaded' };

    const handle = this.state.handles.find(h => h.id === handleId);
    if (!handle) return { success: false, bytesWritten: 0, msg: 'EBADF: Bad file descriptor' };

    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    if (handle.f_pos >= this.state.capacity) {
      this.log('warn', `vchar_dev: write rejected at offset ${handle.f_pos} >= capacity ${this.state.capacity} (ENOSPC)`);
      this.notify();
      return { success: false, bytesWritten: 0, msg: 'ENOSPC: No space left on device' };
    }

    const spaceLeft = this.state.capacity - handle.f_pos;
    const bytesToCopy = Math.min(data.length, spaceLeft);

    this.state.buffer.set(data.subarray(0, bytesToCopy), handle.f_pos);
    handle.f_pos += bytesToCopy;
    if (handle.f_pos > this.state.dataSize) {
      this.state.dataSize = handle.f_pos;
    }

    this.state.stats.current_size = this.state.dataSize;
    this.state.stats.write_bytes += bytesToCopy;

    this.log('info', `vchar_dev: wrote ${bytesToCopy} bytes from PID ${handle.pid} at offset ${handle.f_pos - bytesToCopy}`);
    this.notify();
    return { success: true, bytesWritten: bytesToCopy, msg: `Wrote ${bytesToCopy} bytes` };
  }

  public read(handleId: string, count: number): { success: boolean; data: string; bytesRead: number; isEof: boolean; msg: string } {
    if (!this.state.isLoaded) return { success: false, data: '', bytesRead: 0, isEof: false, msg: 'Driver not loaded' };

    const handle = this.state.handles.find(h => h.id === handleId);
    if (!handle) return { success: false, data: '', bytesRead: 0, isEof: false, msg: 'EBADF: Bad file descriptor' };

    if (handle.f_pos >= this.state.dataSize) {
      this.log('info', `vchar_dev: read at offset ${handle.f_pos} >= data_size ${this.state.dataSize} returned 0 (EOF)`);
      this.notify();
      return { success: true, data: '', bytesRead: 0, isEof: true, msg: 'EOF: 0 bytes' };
    }

    const bytesToCopy = Math.min(count, this.state.dataSize - handle.f_pos);
    const slice = this.state.buffer.subarray(handle.f_pos, handle.f_pos + bytesToCopy);
    const decoder = new TextDecoder();
    const str = decoder.decode(slice);

    handle.f_pos += bytesToCopy;
    this.state.stats.read_bytes += bytesToCopy;

    this.log('info', `vchar_dev: read ${bytesToCopy} bytes by PID ${handle.pid} at offset ${handle.f_pos - bytesToCopy}`);
    this.notify();
    return { success: true, data: str, bytesRead: bytesToCopy, isEof: false, msg: `Read ${bytesToCopy} bytes` };
  }

  public llseek(handleId: string, offset: number, whence: 'SEEK_SET' | 'SEEK_CUR' | 'SEEK_END'): { success: boolean; newPos: number; msg: string } {
    const handle = this.state.handles.find(h => h.id === handleId);
    if (!handle) return { success: false, newPos: -1, msg: 'EBADF: Bad file descriptor' };

    let target = 0;
    if (whence === 'SEEK_SET') target = offset;
    else if (whence === 'SEEK_CUR') target = handle.f_pos + offset;
    else if (whence === 'SEEK_END') target = this.state.dataSize + offset;

    if (target < 0 || target > this.state.capacity) {
      this.log('warn', `vchar_dev: llseek rejected target offset ${target} (EINVAL)`);
      this.notify();
      return { success: false, newPos: handle.f_pos, msg: 'EINVAL: Seek position out of bounds' };
    }

    handle.f_pos = target;
    this.log('info', `vchar_dev: llseek updated f_pos to ${target} via ${whence}`);
    this.notify();
    return { success: true, newPos: target, msg: `Seek successful to offset ${target}` };
  }

  public ioctlReset(): { success: boolean; msg: string } {
    if (!this.state.isLoaded) return { success: false, msg: 'Driver not loaded' };
    this.state.buffer.fill(0);
    this.state.dataSize = 0;
    this.state.handles.forEach(h => { h.f_pos = 0; });
    this.state.stats.current_size = 0;
    this.log('info', 'vchar_dev: VCHAR_IOC_RESET executed; buffer flushed, all offsets reset');
    this.notify();
    return { success: true, msg: 'Buffer cleared' };
  }

  public injectFault(faultType: 'bad_pointer' | 'buffer_overflow'): { code: string; message: string } {
    if (faultType === 'bad_pointer') {
      this.log('err', 'vchar_dev: copy_to_user failed on unmapped address 0x00000000; returning -EFAULT (14)');
      this.notify();
      return { code: '-EFAULT (errno: 14)', message: 'Bad address: copy_to_user trapped unmapped user address' };
    } else {
      this.log('warn', `vchar_dev: write attempt past capacity ${this.state.capacity}; returning -ENOSPC (28)`);
      this.notify();
      return { code: '-ENOSPC (errno: 28)', message: 'No space left on device: bounded buffer limit hit' };
    }
  }
}

export const driverSim = new DriverSimulator();
