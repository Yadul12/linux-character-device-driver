# Kernel Module Makefile for vchar_dev
# Builds out-of-tree against the running kernel headers

KDIR ?= /lib/modules/$(shell uname -r)/build
PWD  := $(shell pwd)

.PHONY: all clean help

all:
	@if [ ! -d "$(KDIR)" ]; then \
		echo "[-] Kernel headers not found at $(KDIR)."; \
		echo "    Install with: sudo apt-get install linux-headers-\$$(uname -r) (Debian/Ubuntu)"; \
		echo "    or: sudo dnf install kernel-devel-\$$(uname -r) (Fedora/RHEL)"; \
		echo "    For simulated user-space validation, run: make test-sim at root."; \
		exit 1; \
	fi
	$(MAKE) -C $(KDIR) M=$(PWD) modules

clean:
	@if [ -d "$(KDIR)" ]; then \
		$(MAKE) -C $(KDIR) M=$(PWD) clean; \
	else \
		rm -f *.o *.ko *.mod.c *.mod *.order *.symvers .*.cmd; \
		rm -rf .tmp_versions; \
	fi

help:
	@echo "Targets:"
	@echo "  all    - Compile the vchar_dev.ko kernel module"
	@echo "  clean  - Clean build artifacts"
