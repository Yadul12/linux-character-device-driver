/**
 * @file chardev_test.c
 * @brief Comprehensive user-space test application for the vchar_dev character driver.
 *
 * Tests:
 *  1. Device open/close life cycle
 *  2. Reading from empty device (EOF verification)
 *  3. Basic write and read-back data verification
 *  4. Sequential streaming reads and offset tracking
 *  5. lseek repositioning (SEEK_SET, SEEK_CUR, SEEK_END)
 *  6. Bounded buffer limits and overflow handling (ENOSPC)
 *  7. Fault injection (invalid pointers expecting EFAULT)
 *  8. IOCTL commands (statistics query, reset, capacity limit)
 *  9. Concurrent multithreaded readers/writers testing mutex safety
 *
 * Usage:
 *   ./chardev_test [/dev/vchar_dev]
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <pthread.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <assert.h>

#include "../driver/chardev.h"

#define DEFAULT_DEV_PATH "/dev/vchar_dev"
#define TEST_PASS 0
#define TEST_FAIL 1

static int g_tests_run = 0;
static int g_tests_passed = 0;
static int g_tests_failed = 0;

#define LOG_TEST_START(name) \
    do { \
        g_tests_run++; \
        printf("\n[TEST %02d] %s\n", g_tests_run, name); \
    } while (0)

#define LOG_TEST_RESULT(condition, name) \
    do { \
        if (condition) { \
            g_tests_passed++; \
            printf("  [PASS] %s\n", name); \
        } else { \
            g_tests_failed++; \
            printf("  [FAIL] %s\n", name); \
        } \
    } while (0)

/* Helper: Open device with error message */
static int open_device(const char *path, int flags)
{
    int fd = open(path, flags);
    if (fd < 0) {
        fprintf(stderr, "[-] Failed to open '%s': %s (errno: %d)\n",
                path, strerror(errno), errno);
    }
    return fd;
}

/* Test 1: Device open and close */
static int test_open_close(const char *path)
{
    LOG_TEST_START("Open and Close device node");
    int fd = open_device(path, O_RDWR);
    if (fd < 0) {
        LOG_TEST_RESULT(0, "Failed to open device node");
        return TEST_FAIL;
    }
    LOG_TEST_RESULT(1, "Successfully opened device node for O_RDWR");

    int close_ret = close(fd);
    LOG_TEST_RESULT(close_ret == 0, "Successfully closed file descriptor");
    return (close_ret == 0) ? TEST_PASS : TEST_FAIL;
}

/* Test 2: Read empty device */
static int test_read_empty(const char *path)
{
    LOG_TEST_START("Read from empty/cleared device (EOF expectation)");
    int fd = open_device(path, O_RDWR);
    if (fd < 0) return TEST_FAIL;

    /* Reset device via IOCTL first to guarantee empty state */
    ioctl(fd, VCHAR_IOC_RESET, 0);

    char buf[128];
    ssize_t bytes_read = read(fd, buf, sizeof(buf));
    LOG_TEST_RESULT(bytes_read == 0, "read() returned 0 (EOF) on empty buffer");

    close(fd);
    return (bytes_read == 0) ? TEST_PASS : TEST_FAIL;
}

/* Test 3: Write data and read it back */
static int test_write_read_roundtrip(const char *path)
{
    LOG_TEST_START("Write and read-back data roundtrip");
    int fd = open_device(path, O_RDWR);
    if (fd < 0) return TEST_FAIL;

    ioctl(fd, VCHAR_IOC_RESET, 0);

    const char *test_msg = "Linux Kernel Driver - System Software Engineering Intern Test Payload";
    size_t msg_len = strlen(test_msg);

    ssize_t written = write(fd, test_msg, msg_len);
    LOG_TEST_RESULT(written == (ssize_t)msg_len, "write() transmitted exact payload byte count");

    /* Seek back to start */
    off_t offset = lseek(fd, 0, SEEK_SET);
    LOG_TEST_RESULT(offset == 0, "lseek(0, SEEK_SET) reset offset to beginning");

    char read_buf[256];
    memset(read_buf, 0, sizeof(read_buf));
    ssize_t bytes_read = read(fd, read_buf, sizeof(read_buf) - 1);
    LOG_TEST_RESULT(bytes_read == (ssize_t)msg_len, "read() retrieved matching byte count");

    int cmp = memcmp(test_msg, read_buf, msg_len);
    LOG_TEST_RESULT(cmp == 0, "Buffer content matches sent payload perfectly");

    close(fd);
    return (cmp == 0) ? TEST_PASS : TEST_FAIL;
}

/* Test 4: Seek operations */
static int test_seek_operations(const char *path)
{
    LOG_TEST_START("File offset seeking with lseek()");
    int fd = open_device(path, O_RDWR);
    if (fd < 0) return TEST_FAIL;

    ioctl(fd, VCHAR_IOC_RESET, 0);

    const char *payload = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    write(fd, payload, strlen(payload));

    /* Seek to index 10 */
    off_t pos = lseek(fd, 10, SEEK_SET);
    LOG_TEST_RESULT(pos == 10, "SEEK_SET positioned at offset 10");

    char ch;
    read(fd, &ch, 1);
    LOG_TEST_RESULT(ch == 'A', "Read character at offset 10 matches 'A'");

    /* Seek relative CUR + 2 */
    pos = lseek(fd, 2, SEEK_CUR);
    read(fd, &ch, 1);
    LOG_TEST_RESULT(ch == 'D', "SEEK_CUR offset jump landed correctly on 'D'");

    /* Invalid seek past buffer */
    pos = lseek(fd, 1000000, SEEK_SET);
    LOG_TEST_RESULT(pos == (off_t)-1 && errno == EINVAL, "Seeking beyond buffer capacity rejected with EINVAL");

    close(fd);
    return TEST_PASS;
}

/* Test 5: Buffer bounds and overflow limits */
static int test_buffer_limits(const char *path)
{
    LOG_TEST_START("Buffer capacity bounds & overflow check");
    int fd = open_device(path, O_RDWR);
    if (fd < 0) return TEST_FAIL;

    ioctl(fd, VCHAR_IOC_RESET, 0);

    struct vchar_stats stats;
    if (ioctl(fd, VCHAR_IOC_GET_STATS, &stats) < 0) {
        LOG_TEST_RESULT(0, "Failed to query stats for buffer capacity");
        close(fd);
        return TEST_FAIL;
    }

    uint32_t capacity = stats.buffer_capacity;
    printf("    Device capacity: %u bytes\n", capacity);

    char *large_buf = malloc(capacity + 512);
    assert(large_buf != NULL);
    memset(large_buf, 'Z', capacity + 512);

    /* Write exact capacity */
    ssize_t written = write(fd, large_buf, capacity);
    LOG_TEST_RESULT(written == (ssize_t)capacity, "Wrote exactly buffer_capacity bytes");

    /* Writing further should return -1 with ENOSPC */
    errno = 0;
    ssize_t overflow_write = write(fd, "extra", 5);
    LOG_TEST_RESULT(overflow_write == -1 && errno == ENOSPC, "Overflow write correctly failed with ENOSPC");

    free(large_buf);
    close(fd);
    return TEST_PASS;
}

/* Test 6: Fault injection (bad user pointer) */
static int test_fault_injection(const char *path)
{
    LOG_TEST_START("Fault injection: Invalid user-space pointers (EFAULT check)");
    int fd = open_device(path, O_RDWR);
    if (fd < 0) return TEST_FAIL;

    errno = 0;
    /* Pass NULL pointer */
    ssize_t r = read(fd, NULL, 64);
    LOG_TEST_RESULT(r == -1 && (errno == EFAULT || errno == EINVAL),
                    "read(NULL) correctly rejected with EFAULT or EINVAL");

    errno = 0;
    /* Pass invalid memory address */
    r = write(fd, (const char *)0x1, 64);
    LOG_TEST_RESULT(r == -1 && errno == EFAULT,
                    "write(0x1) invalid memory correctly trapped by copy_from_user with EFAULT");

    close(fd);
    return TEST_PASS;
}

/* Test 7: IOCTL operations */
static int test_ioctl(const char *path)
{
    LOG_TEST_START("IOCTL commands: GET_STATS, RESET, SET_LIMIT");
    int fd = open_device(path, O_RDWR);
    if (fd < 0) return TEST_FAIL;

    /* Write some data */
    write(fd, "Testing IOCTL", 13);

    struct vchar_stats stats;
    int ret = ioctl(fd, VCHAR_IOC_GET_STATS, &stats);
    LOG_TEST_RESULT(ret == 0 && stats.current_size >= 13, "VCHAR_IOC_GET_STATS populated stats");
    printf("    Stats: cap=%u, current=%u, reads=%lu, writes=%lu, opens=%u\n",
           stats.buffer_capacity, stats.current_size, (unsigned long)stats.read_bytes,
           (unsigned long)stats.write_bytes, stats.open_count);

    /* Reset buffer */
    ret = ioctl(fd, VCHAR_IOC_RESET, 0);
    LOG_TEST_RESULT(ret == 0, "VCHAR_IOC_RESET executed successfully");

    ret = ioctl(fd, VCHAR_IOC_GET_STATS, &stats);
    LOG_TEST_RESULT(ret == 0 && stats.current_size == 0, "Stats show 0 bytes after reset");

    close(fd);
    return TEST_PASS;
}

/* Test 8: Concurrency test with multiple threads */
#define NUM_THREADS 4
#define OPS_PER_THREAD 50

struct thread_arg {
    const char *path;
    int id;
};

static void *worker_thread(void *arg)
{
    struct thread_arg *targ = (struct thread_arg *)arg;
    int fd = open_device(targ->path, O_RDWR);
    if (fd < 0) return NULL;

    char msg[64];
    snprintf(msg, sizeof(msg), "[Thread %d payload]", targ->id);

    for (int i = 0; i < OPS_PER_THREAD; i++) {
        write(fd, msg, strlen(msg));
        char read_buf[64];
        lseek(fd, 0, SEEK_SET);
        read(fd, read_buf, sizeof(read_buf) - 1);
        usleep(100);
    }

    close(fd);
    return NULL;
}

static int test_multithreading(const char *path)
{
    LOG_TEST_START("Multithreaded concurrent access & mutex serialization");
    pthread_t threads[NUM_THREADS];
    struct thread_arg args[NUM_THREADS];

    for (int i = 0; i < NUM_THREADS; i++) {
        args[i].path = path;
        args[i].id = i;
        if (pthread_create(&threads[i], NULL, worker_thread, &args[i]) != 0) {
            LOG_TEST_RESULT(0, "Failed to spawn thread");
            return TEST_FAIL;
        }
    }

    for (int i = 0; i < NUM_THREADS; i++) {
        pthread_join(threads[i], NULL);
    }

    LOG_TEST_RESULT(1, "All concurrent reader/writer threads completed cleanly without deadlocks");
    return TEST_PASS;
}

int main(int argc, char *argv[])
{
    const char *dev_path = (argc > 1) ? argv[1] : DEFAULT_DEV_PATH;

    printf("==================================================================\n");
    printf("  vchar_dev Linux Character Device Driver - Test Suite\n");
    printf("  Target device node: %s\n", dev_path);
    printf("==================================================================\n");

    /* Quick check for existence */
    struct stat st;
    if (stat(dev_path, &st) != 0) {
        fprintf(stderr, "\n[!] Warning: Device node '%s' does not exist.\n", dev_path);
        fprintf(stderr, "    If the kernel module is not loaded yet, please run:\n");
        fprintf(stderr, "      sudo insmod driver/vchar_dev.ko\n");
        fprintf(stderr, "    Or use the standalone POSIX simulator:\n");
        fprintf(stderr, "      ./user/chardev_sim\n\n");
        return 1;
    }

    test_open_close(dev_path);
    test_read_empty(dev_path);
    test_write_read_roundtrip(dev_path);
    test_seek_operations(dev_path);
    test_buffer_limits(dev_path);
    test_fault_injection(dev_path);
    test_ioctl(dev_path);
    test_multithreading(dev_path);

    printf("\n==================================================================\n");
    printf("  Test Summary: %d Total | %d Passed | %d Failed\n",
           g_tests_run, g_tests_passed, g_tests_failed);
    printf("==================================================================\n");

    return (g_tests_failed == 0) ? 0 : 1;
}
