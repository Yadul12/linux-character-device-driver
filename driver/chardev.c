/**
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

/**
 * struct vchar_device - Encapsulates all driver state and synchronization
 * @cdev:            Embedded character device abstraction
 * @dev_num:         Dynamically assigned major/minor device numbers
 * @class:           sysfs class for udev automatic node generation
 * @device:          Device object registered in sysfs
 * @buffer:          Dynamically allocated kernel-space payload buffer
 * @buffer_capacity: Maximum allocated capacity of the buffer
 * @data_size:       Current high-water mark of valid data stored in buffer
 * @lock:            Mutex serializing read, write, seek, and ioctl access
 * @stats:           Operational counters accessible via IOCTL
 */
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

/* Singleton driver device instance */
static struct vchar_device vchar_dev;

/* Module parameter: configurable buffer capacity at load time */
static unsigned int buffer_size = VCHAR_DEFAULT_BUFFER_SIZE;
module_param(buffer_size, uint, 0444);
MODULE_PARM_DESC(buffer_size, "Initial kernel buffer capacity in bytes (default 4096)");

/**
 * vchar_open() - Invoked when user space performs open("/dev/vchar_dev", ...)
 * @inode: Inode pointer containing major/minor numbers and cdev reference
 * @file:  File structure representing the opened instance
 *
 * Return: 0 on success, or negative errno on failure.
 */
static int vchar_open(struct inode *inode, struct file *file)
{
    struct vchar_device *dev;

    /*
     * container_of resolves the enclosing struct vchar_device from the
     * generic struct cdev pointer stored in inode->i_cdev.
     */
    dev = container_of(inode->i_cdev, struct vchar_device, cdev);
    file->private_data = dev;

    if (mutex_lock_interruptible(&dev->lock)) {
        pr_warn("%s: open interrupted while acquiring mutex\n", DEVICE_NAME);
        return -ERESTARTSYS;
    }

    dev->stats.open_count++;
    pr_info("%s: Device opened by PID %d (Active handles: %u)\n",
            DEVICE_NAME, current->pid, dev->stats.open_count);

    mutex_unlock(&dev->lock);
    return 0;
}

/**
 * vchar_release() - Invoked when user space performs close(fd)
 * @inode: Inode pointer
 * @file:  File structure
 *
 * Return: 0 on success.
 */
static int vchar_release(struct inode *inode, struct file *file)
{
    struct vchar_device *dev = file->private_data;

    if (!dev)
        return -EINVAL;

    if (mutex_lock_interruptible(&dev->lock))
        return -ERESTARTSYS;

    if (dev->stats.open_count > 0)
        dev->stats.open_count--;

    pr_info("%s: Device closed by PID %d (Active handles: %u)\n",
            DEVICE_NAME, current->pid, dev->stats.open_count);

    mutex_unlock(&dev->lock);
    return 0;
}

/**
 * vchar_read() - Read data from kernel buffer into user-space buffer
 * @file:  File structure (contains private_data)
 * @buf:   User-space destination pointer (__user annotated)
 * @count: Requested number of bytes to read
 * @ppos:  Current file read/write position pointer
 *
 * Return: Number of bytes successfully transferred, 0 on EOF, or -EFAULT/-EINVAL.
 */
static ssize_t vchar_read(struct file *file, char __user *buf, size_t count, loff_t *ppos)
{
    struct vchar_device *dev = file->private_data;
    size_t bytes_to_copy;
    unsigned long uncopied;

    if (!dev || !buf)
        return -EINVAL;

    if (count == 0)
        return 0;

    /* Serialize access to shared buffer and metadata */
    if (mutex_lock_interruptible(&dev->lock))
        return -ERESTARTSYS;

    /* Check for EOF (end of valid stored data) */
    if (*ppos >= dev->data_size) {
        mutex_unlock(&dev->lock);
        return 0; /* EOF */
    }

    /* Bound the read to available data from current position */
    bytes_to_copy = min(count, (size_t)(dev->data_size - *ppos));

    /*
     * copy_to_user copies data safely across the user/kernel memory boundary.
     * Note: copy_to_user may trigger page faults in user space, causing the
     * calling thread to sleep. Hence, this MUST NEVER be executed while holding
     * a spinlock or with interrupts disabled. Mutex is mandatory here.
     */
    uncopied = copy_to_user(buf, dev->buffer + *ppos, bytes_to_copy);
    if (uncopied != 0) {
        bytes_to_copy -= uncopied;
        if (bytes_to_copy == 0) {
            mutex_unlock(&dev->lock);
            return -EFAULT;
        }
    }

    /* Advance the file offset */
    *ppos += bytes_to_copy;
    dev->stats.read_bytes += bytes_to_copy;

    pr_debug("%s: read %zu bytes at offset %lld (data_size: %zu)\n",
             DEVICE_NAME, bytes_to_copy, *ppos - bytes_to_copy, dev->data_size);

    mutex_unlock(&dev->lock);
    return (ssize_t)bytes_to_copy;
}

/**
 * vchar_write() - Write data from user-space buffer into kernel buffer
 * @file:  File structure (contains private_data)
 * @buf:   User-space source pointer (__user annotated)
 * @count: Requested number of bytes to write
 * @ppos:  Current file read/write position pointer
 *
 * Return: Number of bytes successfully transferred, or -ENOSPC/-EFAULT/-EINVAL.
 */
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

    /* Check if current position has reached buffer capacity */
    if (*ppos >= dev->buffer_capacity) {
        mutex_unlock(&dev->lock);
        return -ENOSPC;
    }

    /* Calculate remaining space in the bounded buffer */
    space_left = dev->buffer_capacity - *ppos;
    bytes_to_copy = min(count, space_left);

    if (bytes_to_copy == 0) {
        mutex_unlock(&dev->lock);
        return -ENOSPC;
    }

    /*
     * copy_from_user safely copies user memory into kernel memory.
     * Returns number of uncopied bytes if a fault occurs.
     */
    uncopied = copy_from_user(dev->buffer + *ppos, buf, bytes_to_copy);
    if (uncopied != 0) {
        bytes_to_copy -= uncopied;
        if (bytes_to_copy == 0) {
            mutex_unlock(&dev->lock);
            return -EFAULT;
        }
    }

    /* Advance file offset and update data high-water mark */
    *ppos += bytes_to_copy;
    if (*ppos > dev->data_size)
        dev->data_size = *ppos;

    dev->stats.write_bytes += bytes_to_copy;

    pr_debug("%s: wrote %zu bytes at offset %lld (new data_size: %zu)\n",
             DEVICE_NAME, bytes_to_copy, *ppos - bytes_to_copy, dev->data_size);

    mutex_unlock(&dev->lock);
    return (ssize_t)bytes_to_copy;
}

/**
 * vchar_llseek() - Reposition read/write file offset
 * @file:   File structure
 * @offset: Target offset
 * @whence: Reference origin (SEEK_SET, SEEK_CUR, SEEK_END)
 *
 * Return: New file offset, or negative error code.
 */
static loff_t vchar_llseek(struct file *file, loff_t offset, int whence)
{
    struct vchar_device *dev = file->private_data;
    loff_t new_pos;

    if (!dev)
        return -EINVAL;

    if (mutex_lock_interruptible(&dev->lock))
        return -ERESTARTSYS;

    switch (whence) {
    case SEEK_SET:
        new_pos = offset;
        break;
    case SEEK_CUR:
        new_pos = file->f_pos + offset;
        break;
    case SEEK_END:
        new_pos = dev->data_size + offset;
        break;
    default:
        mutex_unlock(&dev->lock);
        return -EINVAL;
    }

    /* Disallow negative seek positions or seeking beyond buffer capacity */
    if (new_pos < 0 || new_pos > (loff_t)dev->buffer_capacity) {
        mutex_unlock(&dev->lock);
        return -EINVAL;
    }

    file->f_pos = new_pos;
    mutex_unlock(&dev->lock);

    return new_pos;
}

/**
 * vchar_ioctl() - Handle device-specific control commands
 * @file: File structure
 * @cmd:  IOCTL command code
 * @arg:  User-space argument pointer or integer parameter
 *
 * Return: 0 on success, or negative error code.
 */
static long vchar_ioctl(struct file *file, unsigned int cmd, unsigned long arg)
{
    struct vchar_device *dev = file->private_data;
    uint32_t new_limit;

    if (!dev)
        return -EINVAL;

    switch (cmd) {
    case VCHAR_IOC_RESET:
        if (mutex_lock_interruptible(&dev->lock))
            return -ERESTARTSYS;

        memset(dev->buffer, 0, dev->buffer_capacity);
        dev->data_size = 0;
        file->f_pos = 0;
        pr_info("%s: Buffer reset via IOCTL\n", DEVICE_NAME);

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

    case VCHAR_IOC_SET_LIMIT:
        if (copy_from_user(&new_limit, (void __user *)arg, sizeof(new_limit)))
            return -EFAULT;

        if (mutex_lock_interruptible(&dev->lock))
            return -ERESTARTSYS;

        if (new_limit == 0 || new_limit > dev->buffer_capacity) {
            mutex_unlock(&dev->lock);
            return -EINVAL;
        }

        /* If shrinking active ceiling below current data_size, truncate */
        if (dev->data_size > new_limit)
            dev->data_size = new_limit;

        mutex_unlock(&dev->lock);
        return 0;

    default:
        pr_warn("%s: Unknown IOCTL cmd 0x%x\n", DEVICE_NAME, cmd);
        return -ENOTTY; /* Inappropriate ioctl for device per POSIX */
    }
}

/* File operations dispatch table */
static const struct file_operations vchar_fops = {
    .owner          = THIS_MODULE,
    .open           = vchar_open,
    .release        = vchar_release,
    .read           = vchar_read,
    .write          = vchar_write,
    .llseek         = vchar_llseek,
    .unlocked_ioctl = vchar_ioctl,
};

/**
 * vchar_init() - Driver initialization entry point (insmod / modprobe)
 *
 * Implements reverse-order cleanup unwind on every possible failure path.
 *
 * Return: 0 on success, or negative error code on failure.
 */
static int __init vchar_init(void)
{
    int ret;
    dev_t dev_num;

    pr_info("%s: Initializing Linux Character Device Module\n", DEVICE_NAME);

    /* Enforce sane bounds on buffer size parameter */
    if (buffer_size == 0 || buffer_size > (64 * 1024 * 1024)) {
        pr_err("%s: Invalid buffer_size parameter (%u)\n", DEVICE_NAME, buffer_size);
        return -EINVAL;
    }

    memset(&vchar_dev, 0, sizeof(struct vchar_device));
    mutex_init(&vchar_dev.lock);
    vchar_dev.buffer_capacity = buffer_size;
    vchar_dev.stats.buffer_capacity = buffer_size;

    /* Step 1: Allocate kernel memory buffer using kzalloc (GFP_KERNEL) */
    vchar_dev.buffer = kzalloc(vchar_dev.buffer_capacity, GFP_KERNEL);
    if (!vchar_dev.buffer) {
        pr_err("%s: Failed to allocate %zu bytes for kernel buffer\n",
               DEVICE_NAME, vchar_dev.buffer_capacity);
        return -ENOMEM;
    }

    /* Step 2: Dynamically allocate major/minor character device region */
    ret = alloc_chrdev_region(&dev_num, 0, 1, DEVICE_NAME);
    if (ret < 0) {
        pr_err("%s: alloc_chrdev_region failed with error %d\n", DEVICE_NAME, ret);
        goto err_free_buf;
    }
    vchar_dev.dev_num = dev_num;

    /* Step 3: Initialize and register cdev structure */
    cdev_init(&vchar_dev.cdev, &vchar_fops);
    vchar_dev.cdev.owner = THIS_MODULE;

    ret = cdev_add(&vchar_dev.cdev, vchar_dev.dev_num, 1);
    if (ret < 0) {
        pr_err("%s: cdev_add failed with error %d\n", DEVICE_NAME, ret);
        goto err_unreg_chrdev;
    }

    /*
     * Step 4: Create sysfs class for automatic /dev node creation via udev.
     * Note: Linux kernel 6.4 removed the 'owner' argument from class_create().
     */
#if LINUX_VERSION_CODE >= KERNEL_VERSION(6, 4, 0)
    vchar_dev.class = class_create(CLASS_NAME);
#else
    vchar_dev.class = class_create(THIS_MODULE, CLASS_NAME);
#endif

    if (IS_ERR(vchar_dev.class)) {
        ret = PTR_ERR(vchar_dev.class);
        pr_err("%s: class_create failed with error %d\n", DEVICE_NAME, ret);
        goto err_cdev_del;
    }

    /* Step 5: Create device node /dev/vchar_dev */
    vchar_dev.device = device_create(vchar_dev.class, NULL, vchar_dev.dev_num, NULL, "%s", DEVICE_NAME);
    if (IS_ERR(vchar_dev.device)) {
        ret = PTR_ERR(vchar_dev.device);
        pr_err("%s: device_create failed with error %d\n", DEVICE_NAME, ret);
        goto err_class_destroy;
    }

    pr_info("%s: Device created successfully. Major: %d, Minor: %d, Buffer: %zu bytes\n",
            DEVICE_NAME, MAJOR(vchar_dev.dev_num), MINOR(vchar_dev.dev_num), vchar_dev.buffer_capacity);

    return 0;

/* Clean reverse unwind path */
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

/**
 * vchar_exit() - Driver exit and cleanup entry point (rmmod)
 *
 * Tears down resources in strict reverse order of allocation.
 */
static void __exit vchar_exit(void)
{
    pr_info("%s: Cleaning up module\n", DEVICE_NAME);

    /* 1. Remove sysfs device node */
    if (vchar_dev.device)
        device_destroy(vchar_dev.class, vchar_dev.dev_num);

    /* 2. Destroy sysfs class */
    if (vchar_dev.class)
        class_destroy(vchar_dev.class);

    /* 3. Delete cdev */
    cdev_del(&vchar_dev.cdev);

    /* 4. Release character device numbers */
    unregister_chrdev_region(vchar_dev.dev_num, 1);

    /* 5. Free allocated kernel buffer memory */
    if (vchar_dev.buffer) {
        kfree(vchar_dev.buffer);
        vchar_dev.buffer = NULL;
    }

    mutex_destroy(&vchar_dev.lock);

    pr_info("%s: Module unloaded cleanly\n", DEVICE_NAME);
}

module_init(vchar_init);
module_exit(vchar_exit);
