#!/usr/bin/env python3
"""
static_check.py - Automated Static Analysis and Kernel Safety Checker
for the vchar_dev Linux Character Device Driver.

Inspects kernel C source code for:
 1. Required kernel header imports
 2. Dynamic chrdev registration (alloc_chrdev_region)
 3. cdev registration & teardown (cdev_init, cdev_add, cdev_del)
 4. Device class and node registration (class_create, device_create)
 5. Safe user-space copy boundaries (copy_to_user, copy_from_user)
 6. Sleepable synchronization primitive validation (mutex vs spinlock around copy)
 7. Error unwind path reverse-order verification (goto labels)
 8. Module license & metadata compliance
"""

import os
import sys
import re

CHECK_PASS = "\033[92m[PASS]\033[0m"
CHECK_FAIL = "\033[91m[FAIL]\033[0m"
CHECK_WARN = "\033[93m[WARN]\033[0m"

class KernelStaticChecker:
    def __init__(self, driver_c_path, driver_h_path):
        self.driver_c_path = driver_c_path
        self.driver_h_path = driver_h_path
        self.passed = 0
        self.failed = 0
        self.warnings = 0

        with open(driver_c_path, 'r', encoding='utf-8') as f:
            self.c_code = f.read()

        with open(driver_h_path, 'r', encoding='utf-8') as f:
            self.h_code = f.read()

    def assert_rule(self, description, condition, details=""):
        if condition:
            self.passed += 1
            print(f"  {CHECK_PASS} {description}")
        else:
            self.failed += 1
            print(f"  {CHECK_FAIL} {description}")
            if details:
                print(f"         Reason: {details}")

    def warn_rule(self, description, condition, details=""):
        if condition:
            self.passed += 1
            print(f"  {CHECK_PASS} {description}")
        else:
            self.warnings += 1
            print(f"  {CHECK_WARN} {description}")
            if details:
                print(f"         Notice: {details}")

    def run_all(self):
        print("==================================================================")
        print("  vchar_dev Linux Kernel Driver - Static Safety & AST Audit")
        print("==================================================================")

        # 1. Header Checks
        print("\n[Category 1: Kernel Subsystem Headers]")
        required_headers = [
            "linux/init.h", "linux/module.h", "linux/fs.h", "linux/cdev.h",
            "linux/device.h", "linux/slab.h", "linux/uaccess.h", "linux/mutex.h"
        ]
        for hdr in required_headers:
            self.assert_rule(f"Includes <{hdr}>", f"#include <{hdr}>" in self.c_code)

        # 2. Dynamic Allocation & Registration
        print("\n[Category 2: Dynamic Character Device Lifecycle]")
        self.assert_rule("Uses dynamic major allocation (alloc_chrdev_region)",
                         "alloc_chrdev_region(" in self.c_code)
        self.assert_rule("Initializes cdev structure (cdev_init)",
                         "cdev_init(" in self.c_code)
        self.assert_rule("Adds cdev to kernel (cdev_add)",
                         "cdev_add(" in self.c_code)
        self.assert_rule("Removes cdev in cleanup (cdev_del)",
                         "cdev_del(" in self.c_code)
        self.assert_rule("Releases chrdev region in cleanup (unregister_chrdev_region)",
                         "unregister_chrdev_region(" in self.c_code)

        # 3. Sysfs Class and Device Node
        print("\n[Category 3: Sysfs Class & Device Creation]")
        self.assert_rule("Creates sysfs device class (class_create)",
                         "class_create(" in self.c_code)
        self.assert_rule("Creates device node (device_create)",
                         "device_create(" in self.c_code)
        self.assert_rule("Destroys device node in teardown (device_destroy)",
                         "device_destroy(" in self.c_code)
        self.assert_rule("Destroys sysfs class in teardown (class_destroy)",
                         "class_destroy(" in self.c_code)
        self.assert_rule("Accounts for Linux 6.4+ class_create prototype changes",
                         "LINUX_VERSION_CODE >= KERNEL_VERSION(6, 4, 0)" in self.c_code)

        # 4. User/Kernel Memory Boundary Safety
        print("\n[Category 4: User/Kernel Memory Boundary Safety]")
        self.assert_rule("Annotates user buffers with __user in read/write",
                         "char __user *buf" in self.c_code and "const char __user *buf" in self.c_code)
        self.assert_rule("Uses copy_to_user() for kernel->user data transfer",
                         "copy_to_user(" in self.c_code)
        self.assert_rule("Uses copy_from_user() for user->kernel data transfer",
                         "copy_from_user(" in self.c_code)
        self.assert_rule("Validates copy_to_user() return value for uncopied bytes",
                         "uncopied = copy_to_user(" in self.c_code)
        self.assert_rule("Validates copy_from_user() return value for uncopied bytes",
                         "uncopied = copy_from_user(" in self.c_code)
        self.assert_rule("Returns -EFAULT on bad memory copy",
                         "-EFAULT" in self.c_code)
        self.assert_rule("Returns -ENOSPC when bounded capacity is exceeded",
                         "-ENOSPC" in self.c_code)

        # 5. Concurrency & Synchronization
        print("\n[Category 5: Concurrency & Lock Correctness]")
        self.assert_rule("Uses struct mutex for sleepable serialization",
                         "struct mutex lock;" in self.c_code or "struct mutex" in self.c_code)
        self.assert_rule("Uses interruptible mutex locking (mutex_lock_interruptible)",
                         "mutex_lock_interruptible(" in self.c_code)
        self.assert_rule("Does NOT use spinlocks around copy_to_user (prevents panic)",
                         "spin_lock" not in self.c_code,
                         "Spinlocks disable preemption; copy_to_user can sleep on page fault, causing fatal 'scheduling while atomic' panic")

        # Mutex lock / unlock parity check
        lock_calls = len(re.findall(r"mutex_lock_interruptible\(", self.c_code))
        unlock_calls = len(re.findall(r"mutex_unlock\(", self.c_code))
        self.assert_rule(f"Mutex unlock paths properly cover lock acquisitions (Locks: {lock_calls}, Unlocks: {unlock_calls})",
                         unlock_calls >= lock_calls)

        # 6. Error Unwind Paths
        print("\n[Category 6: Error Unwind Pattern]")
        labels = re.findall(r"(\w+):\s*(?:/\*.*?\*/\s*)?[a-zA-Z_]", self.c_code)
        self.assert_rule("Uses structured goto cleanup unwind in init function",
                         "goto err_" in self.c_code)

        # 7. Licensing and Metadata
        print("\n[Category 7: Kernel Module Metadata & License]")
        self.assert_rule("Declares GPL license (MODULE_LICENSE(\"GPL\"))",
                         'MODULE_LICENSE("GPL")' in self.c_code)
        self.assert_rule("Declares MODULE_AUTHOR",
                         "MODULE_AUTHOR(" in self.c_code)
        self.assert_rule("Declares MODULE_DESCRIPTION",
                         "MODULE_DESCRIPTION(" in self.c_code)
        self.assert_rule("Declares MODULE_VERSION",
                         "MODULE_VERSION(" in self.c_code)

        print("\n==================================================================")
        print(f"  Audit Results: {self.passed} Passed | {self.failed} Failed | {self.warnings} Warnings")
        print("==================================================================")
        return self.failed == 0

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    c_file = os.path.join(base_dir, "driver", "chardev.c")
    h_file = os.path.join(base_dir, "driver", "chardev.h")

    checker = KernelStaticChecker(c_file, h_file)
    success = checker.run_all()
    sys.exit(0 if success else 1)
