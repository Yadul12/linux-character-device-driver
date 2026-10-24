/**
 * @file chardev.h
 * @brief Common definitions, data structures, and IOCTL commands for the
 *        vchar_dev (Virtual Character Device) Linux Kernel Module.
 *
 * Designed for System Software & Kernel Driver Engineering education.
 */

#ifndef _CHARDEV_H_
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

/* Default bounded buffer size: 4096 bytes (1 standard Linux 4KB page) */
#define VCHAR_DEFAULT_BUFFER_SIZE 4096

/**
 * struct vchar_stats - Runtime statistics exported via IOCTL
 * @buffer_capacity: Maximum allocated capacity in bytes
 * @current_size:    Number of valid data bytes currently stored
 * @read_bytes:      Lifetime total bytes successfully copied to user space
 * @write_bytes:     Lifetime total bytes successfully written from user space
 * @open_count:      Number of concurrent active file descriptors open
 */
struct vchar_stats {
    uint32_t buffer_capacity;
    uint32_t current_size;
    uint64_t read_bytes;
    uint64_t write_bytes;
    uint32_t open_count;
};

/* IOCTL Magic number (arbitrary unique byte per Linux Documentation/userspace-api/ioctl/ioctl-number.rst) */
#define VCHAR_IOC_MAGIC 'v'

/* Flush/clear the kernel driver buffer */
#define VCHAR_IOC_RESET     _IO(VCHAR_IOC_MAGIC, 0)

/* Query driver statistics struct */
#define VCHAR_IOC_GET_STATS _IOR(VCHAR_IOC_MAGIC, 1, struct vchar_stats)

/* Resize active usable limit (within buffer_capacity) */
#define VCHAR_IOC_SET_LIMIT _IOW(VCHAR_IOC_MAGIC, 2, uint32_t)

#endif /* _CHARDEV_H_ */
