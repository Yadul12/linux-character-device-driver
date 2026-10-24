# Linux Kernel Driver Troubleshooting Guide

This guide covers real-world issues encountered when developing, building, loading, and debugging Linux kernel modules.

---

## 1. Missing Kernel Headers

### Symptom:
```
make -C /lib/modules/6.1.0-28-amd64/build M=... modules
make: *** /lib/modules/6.1.0-28-amd64/build: No such file or directory. Stop.
```

### Cause:
Kernel headers matching the exact running kernel release are not installed on the system.

### Solution:
Install the kernel headers package matching your current kernel release (`uname -r`):
- **Debian / Ubuntu**:
  ```bash
  sudo apt-get update
  sudo apt-get install -y build-essential linux-headers-$(uname -r)
  ```
- **Fedora / RHEL / CentOS**:
  ```bash
  sudo dnf install -y gcc make kernel-devel-$(uname -r)
  ```
- **Arch Linux**:
  ```bash
  sudo pacman -S linux-headers
  ```

---

## 2. Secure Boot Module Signature Rejection

### Symptom:
```
insmod: ERROR: could not insert module driver/vchar_dev.ko: Key was rejected by service
```
or in `dmesg`:
```
Loading of unsigned module is rejected: driver/vchar_dev.ko
```

### Cause:
UEFI Secure Boot is enabled on the machine. The kernel refuses to execute out-of-tree modules that lack a cryptographic signature signed by a trusted Machine Owner Key (MOK).

### Solution:
**Option A: Sign the module with a Machine Owner Key (Recommended)**
```bash
# 1. Generate an X.509 key pair
openssl req -new -x509 -newkey rsa:2048 -keyout MOK.priv -outform DER -out MOK.der -nodes -days 36500 -subj "/CN=KernelDev/"

# 2. Sign the .ko binary using the kernel's sign-file tool
/usr/src/linux-headers-$(uname -r)/scripts/sign-file sha256 MOK.priv MOK.der driver/vchar_dev.ko

# 3. Enroll the public key into the system MOK list
sudo mokutil --import MOK.der
# (Reboot machine and complete key enrollment in the blue Shim UEFI screen)
```

**Option B: Test in an unconstrained VM or disable Secure Boot in UEFI BIOS**
For rapid iterative prototyping, developers frequently use a QEMU/KVM virtual machine with Secure Boot disabled.

---

## 3. Permission Denied on `/dev/vchar_dev`

### Symptom:
```
[-] Failed to open '/dev/vchar_dev': Permission denied (errno: 13)
```

### Cause:
By default, newly created device nodes in `/dev` are owned by `root:root` with permissions `0600` or `0660`.

### Solution:
**Quick Test**:
```bash
sudo chmod 666 /dev/vchar_dev
```

**Production Permanent Fix (udev rule)**:
Create `/etc/udev/rules.d/99-vchar.rules`:
```udev
KERNEL=="vchar_dev", MODE="0666", GROUP="users"
```
Then reload udev:
```bash
sudo udevadm control --reload-rules && sudo udevadm trigger
```

---

## 4. Kernel Version Mismatch (`vermagic`)

### Symptom:
```
insmod: ERROR: could not insert module driver/vchar_dev.ko: Invalid module format
```
In `dmesg`:
```
vchar_dev: version magic '6.1.0-25-amd64 SMP preempt mod_unload ' should be '6.1.0-28-amd64 SMP preempt mod_unload '
```

### Cause:
The module was compiled against kernel headers of version X, but is being loaded into a running kernel of version Y.

### Solution:
Always compile against the active running kernel:
```bash
make clean
make KDIR=/lib/modules/$(uname -r)/build
```
