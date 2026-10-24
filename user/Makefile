# Makefile for user-space test suite and architectural simulator

CC ?= gcc
CFLAGS ?= -Wall -Wextra -O2 -pthread -I../driver

TARGET_TEST = chardev_test
TARGET_SIM  = chardev_sim

.PHONY: all clean help

all: $(TARGET_TEST) $(TARGET_SIM)

$(TARGET_TEST): chardev_test.c ../driver/chardev.h
	@which $(CC) >/dev/null 2>&1 || { echo "[-] Compiler '$(CC)' not found. Install gcc or clang."; exit 1; }
	$(CC) $(CFLAGS) -o $@ chardev_test.c

$(TARGET_SIM): chardev_sim.c ../driver/chardev.h
	@which $(CC) >/dev/null 2>&1 || { echo "[-] Compiler '$(CC)' not found. Install gcc or clang."; exit 1; }
	$(CC) $(CFLAGS) -o $@ chardev_sim.c

clean:
	rm -f $(TARGET_TEST) $(TARGET_SIM) *.o

help:
	@echo "Targets:"
	@echo "  all          - Build chardev_test and chardev_sim"
	@echo "  chardev_test - Build driver test against real /dev/vchar_dev"
	@echo "  chardev_sim  - Build standalone architectural simulator"
	@echo "  clean        - Remove compiled binaries"
