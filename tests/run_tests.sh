#!/usr/bin/env bash
# run_tests.sh - Test orchestrator for vchar_dev Linux character device driver
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=================================================================="
echo "  vchar_dev Linux Character Device Driver - Test Orchestrator"
echo "=================================================================="

# 1. Environment Detection
KERNEL_VER="$(uname -r 2>/dev/null || echo 'Unknown')"
OS_NAME="$(cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME=' | cut -d= -f2 | tr -d '\"' || echo 'Linux')"
HAS_GCC="$(which gcc 2>/dev/null || echo '')"
HAS_KHEADERS=""
if [ -d "/lib/modules/${KERNEL_VER}/build" ]; then
    HAS_KHEADERS="/lib/modules/${KERNEL_VER}/build"
fi

echo "[*] Host OS:           ${OS_NAME}"
echo "[*] Running Kernel:    ${KERNEL_VER}"
echo "[*] Compiler (gcc):    ${HAS_GCC:-Not found}"
echo "[*] Kernel Headers:    ${HAS_KHEADERS:-Not found}"
echo "[*] Current User:      $(id -un) (UID: $(id -u))"

# 2. Static Safety and AST Analysis
echo ""
echo "------------------------------------------------------------------"
echo " Phase 1: Static Code Analysis & Kernel Safety Verification"
echo "------------------------------------------------------------------"
python3 "${SCRIPT_DIR}/static_check.py"

# 3. Architectural Simulation and Logic Tests
echo ""
echo "------------------------------------------------------------------"
echo " Phase 2: Architectural Simulation & Concurrency Test Harness"
echo "------------------------------------------------------------------"
python3 "${SCRIPT_DIR}/sim_runner.py"

# 4. Kernel Module Build & Runtime Check (if environment supports)
echo ""
echo "------------------------------------------------------------------"
echo " Phase 3: Kernel Module Compilation & Device Node Status"
echo "------------------------------------------------------------------"
if [ -z "${HAS_GCC}" ]; then
    echo "[-] Native C compiler (gcc) is not installed in this environment."
    echo "    To compile on a developer workstation:"
    echo "      sudo apt-get install build-essential linux-headers-\$(uname -r)"
    echo "      make"
elif [ -z "${HAS_KHEADERS}" ]; then
    echo "[-] Linux kernel headers not found at /lib/modules/${KERNEL_VER}/build."
    echo "    Note: In containerized or gVisor sandbox environments, kernel module"
    echo "    loading is intentionally restricted for container security."
else
    echo "[+] Kernel headers and compiler detected. Running make..."
    make -C "${ROOT_DIR}/driver"
fi

if [ -c "/dev/vchar_dev" ]; then
    echo "[+] Detected live device node /dev/vchar_dev! Running user-space test suite..."
    if [ -x "${ROOT_DIR}/user/chardev_test" ]; then
        "${ROOT_DIR}/user/chardev_test"
    else
        echo "[-] user/chardev_test binary not built. Run 'make user' first."
    fi
else
    echo "[*] Device node /dev/vchar_dev is not currently loaded in /dev."
    echo "    To test on a target Linux machine with sudo privileges:"
    echo "      sudo insmod driver/vchar_dev.ko"
    echo "      ./user/chardev_test"
    echo "      sudo rmmod vchar_dev"
fi

echo ""
echo "=================================================================="
echo "  All available automated validation checks completed!"
echo "=================================================================="
