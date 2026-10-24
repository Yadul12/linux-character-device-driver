# Test Suite Specification & Edge-Case Verification Matrix

This document defines the formal verification cases for the `vchar_dev` character device driver, covering life-cycle states, boundary limits, concurrency, and fault injection.

---

## 1. Test Case Matrix

| Case ID | Feature Tested | Input / Condition | System Call | Expected Return | Kernel Invariant / Behavior Verified |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Device Open | Path `/dev/vchar_dev`, `O_RDWR` | `open()` | `fd >= 0` | `vchar_open` invoked; resolves `vchar_device` via `container_of()`; increments `stats.open_count`. |
| **TC-02** | Device Close | Active `fd` | `close()` | `0` | `vchar_release` called; decrements `stats.open_count` under mutex. |
| **TC-03** | Read on Empty Device | Device immediately after reset or load | `read(fd, buf, 64)` | `0` (EOF) | `*ppos >= dev->data_size` detected; safe return 0 without blocking. |
| **TC-04** | Basic Write / Read Roundtrip | ASCII string (e.g. 64 bytes) | `write()` then `read()` | Exact length | `copy_from_user` stores bytes in kernel buffer; `lseek(0, SEEK_SET)` resets `f_pos`; `copy_to_user` retrieves identical payload. |
| **TC-05** | Streaming Chunked Read | 256-byte buffer written, read in 32-byte chunks | Sequential `read()` | 32 bytes each, ending with 0 | Driver advances `*ppos` by transfer count each invocation; signals EOF on reaching `data_size`. |
| **TC-06** | File Repositioning | `SEEK_SET`, `SEEK_CUR`, `SEEK_END` | `lseek()` | Updated byte offset | `vchar_llseek` calculates target; locks mutex; verifies `new_pos >= 0` and `new_pos <= buffer_capacity`. |
| **TC-07** | Out-of-Bounds Seek | Offset greater than `buffer_capacity` (e.g. 100,000) | `lseek(fd, 100000, SEEK_SET)` | `-1` with `errno == EINVAL` | Rejects invalid position before touching file pointer. |
| **TC-08** | Full Capacity Write | Payload exactly equal to 4096 bytes | `write(fd, buf, 4096)` | `4096` | High-water mark `data_size` updated to 4096. |
| **TC-09** | Capacity Overflow | Write attempted when `*ppos >= buffer_capacity` | `write(fd, "extra", 5)` | `-1` with `errno == ENOSPC` | Rejects write when zero remaining space in bounded kernel buffer. |
| **TC-10** | Fault Injection: NULL User Pointer | `buf = NULL` | `read(fd, NULL, 64)` | `-1` with `errno == EFAULT` or `EINVAL` | Trapped by validation before copying. |
| **TC-11** | Fault Injection: Unmapped Address | `buf = (void*)0x1` | `write(fd, 0x1, 64)` | `-1` with `errno == EFAULT` | `copy_from_user()` detects unmapped user page; returns uncopied byte count; driver translates to `-EFAULT`. |
| **TC-12** | IOCTL Statistics Query | `cmd = VCHAR_IOC_GET_STATS` | `ioctl()` | `0`, valid struct | Copies `struct vchar_stats` safely to user space; verifies counters. |
| **TC-13** | IOCTL Buffer Reset | `cmd = VCHAR_IOC_RESET` | `ioctl()` | `0` | Flushes kernel buffer with `memset(0)`; resets `data_size = 0` and `f_pos = 0`. |
| **TC-14** | Concurrent Readers/Writers | 4 threads performing rapid writes & reads | POSIX `pthread` pool | All succeed | Mutex serializes access; no race conditions, corrupted buffers, or deadlocks. |

---

## 2. Kernel Memory Boundary Safety Guarantees

1. **User Memory Dereference Rule**:
   Kernel code **never** directly dereferences a raw user-space pointer (e.g. `*buf = x`). Direct dereference bypasses MMU permission checks (such as SMAP - Supervisor Mode Access Prevention) and could trigger an unhandled kernel page fault crash (OOPS). All user transfers strictly use `copy_to_user()` and `copy_from_user()`.

2. **Sleepable Context Requirement**:
   `copy_to_user` and `copy_from_user` can cause the calling thread to sleep if the user-space page has been swapped to disk or has not yet been demand-paged into physical RAM. Therefore, these calls must be protected by sleep-capable primitives (`struct mutex`) rather than spinlocks (`spinlock_t`).
