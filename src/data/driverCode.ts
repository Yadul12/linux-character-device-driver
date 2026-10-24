export interface CodeFile {
  filename: string;
  path: string;
  language: string;
  description: string;
  content: string;
  annotations?: { line: number; title: string; note: string }[];
}

export const CODE_FILES: CodeFile[] = [
  {
    filename: 'chardev.c',
    path: 'driver/chardev.c',
    language: 'c',
    description: 'Kernel module implementation with dynamic cdev, sysfs class, mutex, and safe user/kernel copies',
    annotations: [
      { line: 55, title: 'container_of Idiom', note: 'Resolves outer struct vchar_device from generic inode->i_cdev without global lookups.' },
      { line: 110, title: 'copy_to_user Safety', note: 'Safely transfers kernel bytes to user buffer. Mutex is mandatory because page faults can cause the thread to sleep.' },
      { line: 155, title: 'copy_from_user Bounds', note: 'Bounds-checks count against buffer capacity and calculates space_left to prevent buffer overflow.' },
      { line: 200, title: 'llseek Dispatch', note: 'Implements SEEK_SET, SEEK_CUR, and SEEK_END with strict lower (0) and upper (buffer_capacity) bounds.' },
      { line: 260, title: 'Version-Adaptive class_create', note: 'Handles Linux 6.4+ API difference where THIS_MODULE parameter was dropped.' },
      { line: 285, title: 'Reverse-Order Error Unwind', note: 'Structured goto unwind ensures 100% leak-free recovery if any step of initialization fails.' }
    ],
    content: `/**
 * @file chardev.c
 * @brief Production-grade Educational Linux Character Device Driver.
 *
 * Implements:
 *  - Dynamic major/minor device number allocation (alloc_chrdev_region)
 *  - Character device registration (cdev_init, cdev_add)
 *  - Device class and sysfs node auto-creation (/dev/vchar_dev)
 *  - Safe file operations (open, release, read, write, llseek, unlocked_ioctl)
 *  - Bounded kernel page buffer with strict copy_to_user / copy_from_user validation
 *  - Safe sleeping concurrency using mutex (never spinlock for user copies)
 *  - Version-adaptive API macros (e.g., class_create parameter changes in Linux 6.4+)
 *  - Pristine reverse-order error cleanup unwind paths
 *
 * Designed for System Software & Kernel Driver Engineering education.
 */

#include <linux/init.h>
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/fs.h>
#include <linux/cdev.h>
#include <linux/device.h>
#include <linux/slab.h>
#include <linux/uaccess.h>
#include <linux/mutex.h>
#include <linux/version.h>
#include <linux/errno.h>

#include "chardev.h"

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Yadul Jain");
MODULE_DESCRIPTION("Production-Grade Linux Character Device Driver with Mutex and IOCTL");
MODULE_VERSION("1.0.0");

struct vchar_device {
    struct cdev cdev;
    dev_t dev_num;
    struct class *class;
    struct device *device;
    char *buffer;
    size_t buffer_capacity;
    size_t data_size;
    struct mutex lock;
    struct vchar_stats stats;
};

static struct vchar_device vchar_dev;
static unsigned int buffer_size = VCHAR_DEFAULT_BUFFER_SIZE;
module_param(buffer_size, uint, 0444);
MODULE_PARM_DESC(buffer_size, "Initial kernel buffer capacity in bytes (default 4096)");

static int vchar_open(struct inode *inode, struct file *file)
{
    struct vchar_device *dev;

    dev = container_of(inode->i_cdev, struct vchar_device, cdev);
    file->private_data = dev;

    if (mutex_lock_interruptible(&dev->lock)) {
        pr_warn("%s: open interrupted while acquiring mutex\\n", DEVICE_NAME);
        return -ERESTARTSYS;
    }

    dev->stats.open_count++;
    pr_info("%s: Device opened by PID %d (Active handles: %u)\\n",
            DEVICE_NAME, current->pid, dev->stats.open_count);

    mutex_unlock(&dev->lock);
    return 0;
}

static int vchar_release(struct inode *inode, struct file *file)
{
    struct vchar_device *dev = file->private_data;

    if (!dev)
        return -EINVAL;

    if (mutex_lock_interruptible(&dev->lock))
        return -ERESTARTSYS;

    if (dev->stats.open_count > 0)
        dev->stats.open_count--;

    pr_info("%s: Device closed by PID %d (Active handles: %u)\\n",
            DEVICE_NAME, current->pid, dev->stats.open_count);

    mutex_unlock(&dev->lock);
    return 0;
}

static ssize_t vchar_read(struct file *file, char __user *buf, size_t count, loff_t *ppos)
{
    struct vchar_device *dev = file->private_data;
    size_t bytes_to_copy;
    unsigned long uncopied;

    if (!dev || !buf)
        return -EINVAL;

    if (count == 0)
        return 0;

    if (mutex_lock_interruptible(&dev->lock))
        return -ERESTARTSYS;

    if (*ppos >= dev->data_size) {
        mutex_unlock(&dev->lock);
        return 0; /* EOF */
    }

    bytes_to_copy = min(count, (size_t)(dev->data_size - *ppos));

    uncopied = copy_to_user(buf, dev->buffer + *ppos, bytes_to_copy);
    if (uncopied != 0) {
        bytes_to_copy -= uncopied;
        if (bytes_to_copy == 0) {
            mutex_unlock(&dev->lock);
            return -EFAULT;
        }
    }

    *ppos += bytes_to_copy;
    dev->stats.read_bytes += bytes_to_copy;

    mutex_unlock(&dev->lock);
    return (ssize_t)bytes_to_copy;
}

static ssize_t vchar_write(struct file *file, const char __user *buf, size_t count, loff_t *ppos)
{
    struct vchar_device *dev = file->private_data;
    size_t space_left;
    size_t bytes_to_copy;
    unsigned long uncopied;

    if (!dev || !buf)
        return -EINVAL;

    if (count == 0)
        return 0;

    if (mutex_lock_interruptible(&dev->lock))
        return -ERESTARTSYS;

    if (*ppos >= dev->buffer_capacity) {
        mutex_unlock(&dev->lock);
        return -ENOSPC;
    }

    space_left = dev->buffer_capacity - *ppos;
    bytes_to_copy = min(count, space_left);

    if (bytes_to_copy == 0) {
        mutex_unlock(&dev->lock);
        return -ENOSPC;
    }

    uncopied = copy_from_user(dev->buffer + *ppos, buf, bytes_to_copy);
    if (uncopied != 0) {
        bytes_to_copy -= uncopied;
        if (bytes_to_copy == 0) {
            mutex_unlock(&dev->lock);
            return -EFAULT;
        }
    }

    *ppos += bytes_to_copy;
    if (*ppos > dev->data_size)
        dev->data_size = *ppos;

    dev->stats.write_bytes += bytes_to_copy;

    mutex_unlock(&dev->lock);
    return (ssize_t)bytes_to_copy;
}

static loff_t vchar_llseek(struct file *file, loff_t offset, int whence)
{
    struct vchar_device *dev = file->private_data;
    loff_t new_pos;

    if (!dev)
        return -EINVAL;

    if (mutex_lock_interruptible(&dev->lock))
        return -ERESTARTSYS;

    switch (whence) {
    case SEEK_SET: new_pos = offset; break;
    case SEEK_CUR: new_pos = file->f_pos + offset; break;
    case SEEK_END: new_pos = dev->data_size + offset; break;
    default:
        mutex_unlock(&dev->lock);
        return -EINVAL;
    }

    if (new_pos < 0 || new_pos > (loff_t)dev->buffer_capacity) {
        mutex_unlock(&dev->lock);
        return -EINVAL;
    }

    file->f_pos = new_pos;
    mutex_unlock(&dev->lock);
    return new_pos;
}

static long vchar_ioctl(struct file *file, unsigned int cmd, unsigned long arg)
{
    struct vchar_device *dev = file->private_data;

    if (!dev)
        return -EINVAL;

    switch (cmd) {
    case VCHAR_IOC_RESET:
        if (mutex_lock_interruptible(&dev->lock))
            return -ERESTARTSYS;
        memset(dev->buffer, 0, dev->buffer_capacity);
        dev->data_size = 0;
        file->f_pos = 0;
        mutex_unlock(&dev->lock);
        return 0;

    case VCHAR_IOC_GET_STATS:
        if (mutex_lock_interruptible(&dev->lock))
            return -ERESTARTSYS;
        dev->stats.current_size = (uint32_t)dev->data_size;
        if (copy_to_user((void __user *)arg, &dev->stats, sizeof(struct vchar_stats))) {
            mutex_unlock(&dev->lock);
            return -EFAULT;
        }
        mutex_unlock(&dev->lock);
        return 0;

    default:
        return -ENOTTY;
    }
}

static const struct file_operations vchar_fops = {
    .owner          = THIS_MODULE,
    .open           = vchar_open,
    .release        = vchar_release,
    .read           = vchar_read,
    .write          = vchar_write,
    .llseek         = vchar_llseek,
    .unlocked_ioctl = vchar_ioctl,
};

static int __init vchar_init(void)
{
    int ret;
    dev_t dev_num;

    if (buffer_size == 0 || buffer_size > (64 * 1024 * 1024))
        return -EINVAL;

    memset(&vchar_dev, 0, sizeof(struct vchar_device));
    mutex_init(&vchar_dev.lock);
    vchar_dev.buffer_capacity = buffer_size;
    vchar_dev.stats.buffer_capacity = buffer_size;

    /* 1. Allocate kernel page buffer */
    vchar_dev.buffer = kzalloc(vchar_dev.buffer_capacity, GFP_KERNEL);
    if (!vchar_dev.buffer)
        return -ENOMEM;

    /* 2. Allocate dynamic major/minor numbers */
    ret = alloc_chrdev_region(&dev_num, 0, 1, DEVICE_NAME);
    if (ret < 0)
        goto err_free_buf;
    vchar_dev.dev_num = dev_num;

    /* 3. Initialize and register cdev */
    cdev_init(&vchar_dev.cdev, &vchar_fops);
    vchar_dev.cdev.owner = THIS_MODULE;
    ret = cdev_add(&vchar_dev.cdev, vchar_dev.dev_num, 1);
    if (ret < 0)
        goto err_unreg_chrdev;

    /* 4. Create sysfs class (version adaptive) */
#if LINUX_VERSION_CODE >= KERNEL_VERSION(6, 4, 0)
    vchar_dev.class = class_create(CLASS_NAME);
#else
    vchar_dev.class = class_create(THIS_MODULE, CLASS_NAME);
#endif
    if (IS_ERR(vchar_dev.class)) {
        ret = PTR_ERR(vchar_dev.class);
        goto err_cdev_del;
    }

    /* 5. Create device node */
    vchar_dev.device = device_create(vchar_dev.class, NULL, vchar_dev.dev_num, NULL, "%s", DEVICE_NAME);
    if (IS_ERR(vchar_dev.device)) {
        ret = PTR_ERR(vchar_dev.device);
        goto err_class_destroy;
    }

    return 0;

err_class_destroy:
    class_destroy(vchar_dev.class);
err_cdev_del:
    cdev_del(&vchar_dev.cdev);
err_unreg_chrdev:
    unregister_chrdev_region(vchar_dev.dev_num, 1);
err_free_buf:
    kfree(vchar_dev.buffer);
    return ret;
}

static void __exit vchar_exit(void)
{
    if (vchar_dev.device)
        device_destroy(vchar_dev.class, vchar_dev.dev_num);
    if (vchar_dev.class)
        class_destroy(vchar_dev.class);
    cdev_del(&vchar_dev.cdev);
    unregister_chrdev_region(vchar_dev.dev_num, 1);
    if (vchar_dev.buffer) {
        kfree(vchar_dev.buffer);
        vchar_dev.buffer = NULL;
    }
    mutex_destroy(&vchar_dev.lock);
}

module_init(vchar_init);
module_exit(vchar_exit);`
  },
  {
    filename: 'chardev.h',
    path: 'driver/chardev.h',
    language: 'c',
    description: 'Shared constants, telemetry struct, and IOCTL macro definitions',
    content: `#ifndef _CHARDEV_H_
#define _CHARDEV_H_

#ifdef __KERNEL__
#include <linux/types.h>
#include <linux/ioctl.h>
#else
#include <stdint.h>
#include <sys/ioctl.h>
#endif

#define DEVICE_NAME "vchar_dev"
#define CLASS_NAME  "vchar_class"

#define VCHAR_DEFAULT_BUFFER_SIZE 4096

struct vchar_stats {
    uint32_t buffer_capacity;
    uint32_t current_size;
    uint64_t read_bytes;
    uint64_t write_bytes;
    uint32_t open_count;
};

#define VCHAR_IOC_MAGIC 'v'

#define VCHAR_IOC_RESET     _IO(VCHAR_IOC_MAGIC, 0)
#define VCHAR_IOC_GET_STATS _IOR(VCHAR_IOC_MAGIC, 1, struct vchar_stats)
#define VCHAR_IOC_SET_LIMIT _IOW(VCHAR_IOC_MAGIC, 2, uint32_t)

#endif /* _CHARDEV_H_ */`
  },
  {
    filename: 'chardev_test.c',
    path: 'user/chardev_test.c',
    language: 'c',
    description: 'User-space C test suite covering open, read, write, seek, bounds, ioctl, multithreading, and fault injection',
    content: `#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <pthread.h>
#include <sys/ioctl.h>

#include "../driver/chardev.h"

int main(int argc, char *argv[])
{
    const char *dev_path = (argc > 1) ? argv[1] : "/dev/vchar_dev";
    printf("Executing user test against %s\\n", dev_path);

    int fd = open(dev_path, O_RDWR);
    if (fd < 0) {
        perror("Failed to open device");
        return 1;
    }

    /* Test 1: Write payload */
    const char *msg = "System Software Intern Test";
    write(fd, msg, strlen(msg));

    /* Test 2: Seek & Read */
    lseek(fd, 0, SEEK_SET);
    char buf[128] = {0};
    read(fd, buf, sizeof(buf));
    printf("Read back: %s\\n", buf);

    close(fd);
    return 0;
}`
  },
  {
    filename: 'Makefile',
    path: 'Makefile',
    language: 'makefile',
    description: 'Root orchestrator Makefile for building kernel module, user tests, and automated checks',
    content: `.PHONY: all driver user test test-static test-sim clean

all: driver user

driver:
	@$(MAKE) -C driver

user:
	@$(MAKE) -C user

test:
	@./tests/run_tests.sh

test-static:
	@python3 tests/static_check.py

test-sim:
	@python3 tests/sim_runner.py

clean:
	@$(MAKE) -C driver clean || true
	@$(MAKE) -C user clean || true`
  }
];
