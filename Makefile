# Root Makefile for Linux Character Device Driver Project (vchar_dev)
# Designed for System Software Engineer Intern Portfolio

SHELL := /bin/bash

.PHONY: all driver user test test-static test-sim clean help

all: driver user

driver:
	@echo "==> Building Linux Kernel Module (driver/vchar_dev.ko)..."
	@$(MAKE) -C driver

user:
	@echo "==> Building User-Space Test Suite..."
	@$(MAKE) -C user

test:
	@echo "==> Executing Automated Test Suite..."
	@./tests/run_tests.sh

test-static:
	@echo "==> Running Static Code Analysis & Kernel AST Check..."
	@python3 tests/static_check.py

test-sim:
	@echo "==> Running Architectural Logic Simulation..."
	@python3 tests/sim_runner.py

clean:
	@echo "==> Cleaning driver and user build artifacts..."
	@$(MAKE) -C driver clean || true
	@$(MAKE) -C user clean || true

help:
	@echo "Linux Character Device Driver (vchar_dev) Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all          - Build driver kernel module and user test application"
	@echo "  driver       - Build driver/vchar_dev.ko (requires kernel headers)"
	@echo "  user         - Build user/chardev_test and user/chardev_sim"
	@echo "  test         - Run full test orchestrator (tests/run_tests.sh)"
	@echo "  test-static  - Run static safety audit (tests/static_check.py)"
	@echo "  test-sim     - Run logic simulation suite (tests/sim_runner.py)"
	@echo "  clean        - Remove all generated binaries and kernel object files"
	@echo "  help         - Display this help message"
