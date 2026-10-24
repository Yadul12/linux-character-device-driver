# Linux Kernel Character Driver API Reference

A detailed guide to the essential Linux kernel APIs utilized in `vchar_dev`.

---

## 1. Character Device Registration APIs

### `alloc_chrdev_region`
```c
int alloc_chrdev_region(dev_t *dev, unsigned baseminor, unsigned count, const char *name);
```
- **Purpose**: Dynamically requests an unused major number and reserves a range of minor numbers.
- **Parameters**:
  - `dev`: Output parameter populated with the assigned `dev_t` (containing Major and Minor numbers).
  - `baseminor`: First minor number of the requested range (typically `0`).
  - `count`: Total count of consecutive minor numbers requested (`1`).
  - `name`: Label displayed in `/proc/devices`.
- **Return**: `0` on success, negative error code on failure.

### `cdev_init` & `cdev_add`
```c
void cdev_init(struct cdev *cdev, const struct file_operations *fops);
int cdev_add(struct cdev *p, dev_t dev, unsigned count);
```
- **Purpose**: Links the `struct cdev` instance with its `file_operations` dispatch table and informs the VFS that the device is live and ready to accept system calls.
- **Critical Invariant**: As soon as `cdev_add()` returns `0`, the device is **immediately active**! All internal driver data structures and mutexes must be fully initialized **before** calling `cdev_add()`.

### `cdev_del` & `unregister_chrdev_region`
```c
void cdev_del(struct cdev *p);
void unregister_chrdev_region(dev_t from, unsigned count);
```
- **Purpose**: Destroys the cdev registration and releases the device number back to the kernel pool during module unloading or cleanup unwind.

---

## 2. Sysfs and Device Class APIs

### `class_create`
```c
/* Linux < 6.4: */
struct class *class_create(struct module *owner, const char *name);

/* Linux >= 6.4: */
struct class *class_create(const char *name);
```
- **Version Difference Note**: Linux kernel 6.4 removed the `struct module *owner` parameter because class ownership was refactored internally.
- `vchar_dev` uses conditional compilation macros:
  ```c
  #if LINUX_VERSION_CODE >= KERNEL_VERSION(6, 4, 0)
      dev->class = class_create(CLASS_NAME);
  #else
      dev->class = class_create(THIS_MODULE, CLASS_NAME);
  #endif
  ```

### `device_create` & `device_destroy`
```c
struct device *device_create(struct class *cls, struct device *parent,
                             dev_t devt, void *drvdata, const char *fmt, ...);
void device_destroy(struct class *cls, dev_t devt);
```
- **Purpose**: Registers the individual device under sysfs (`/sys/devices/virtual/<class>/<name>`), triggering udev to automatically create `/dev/vchar_dev`.

---

## 3. Data Transfer & Memory Safety APIs

### `copy_to_user`
```c
unsigned long copy_to_user(void __user *to, const void *from, unsigned long n);
```
- **Purpose**: Safely copies data from a kernel buffer to a user-space memory buffer.
- **Return**: Returns the number of bytes that **could not be copied** (0 on full success).
- **Semantics**:
  ```c
  unsigned long uncopied = copy_to_user(buf, dev->buffer + *ppos, bytes_to_copy);
  if (uncopied != 0) {
      bytes_to_copy -= uncopied;
      if (bytes_to_copy == 0) return -EFAULT;
  }
  ```

### `copy_from_user`
```c
unsigned long copy_from_user(void *to, const void __user *from, unsigned long n);
```
- **Purpose**: Safely copies data from user space into a kernel buffer.
- **Return**: Returns number of uncopied bytes (0 on full success).

---

## 4. Synchronization APIs

### `mutex_lock_interruptible` & `mutex_unlock`
```c
int mutex_lock_interruptible(struct mutex *lock);
void mutex_unlock(struct mutex *lock);
```
- **Purpose**: Acquires a sleepable mutual exclusion lock. If the waiting thread receives a POSIX signal (such as `SIGINT` from Ctrl+C), the call aborts and returns `-ERESTARTSYS`, allowing the kernel system call restart mechanism to handle it cleanly.
