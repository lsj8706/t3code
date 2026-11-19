"""Swaps a staged T3 Code Custom build into /Applications once the running app quits.

Run by a one-shot launchd job that update-app.sh registers. Arguments: the inode
of the installed app when the update was staged, the running app's pid (0 for
none), and the version the staged build must carry.
"""

from contextlib import closing
from pathlib import Path
import ctypes
import os
import plistlib
import select
import shutil
import subprocess
import sys

BUNDLE_ID = "com.lsj8706.t3code.custom"
TARGET = Path("/Applications/T3 Code Custom.app")
RENAME_SWAP = 2
LSREGISTER = (
    "/System/Library/Frameworks/CoreServices.framework/Frameworks/"
    "LaunchServices.framework/Support/lsregister"
)


def install(candidate, inode, pid, ready):
    with closing(select.kqueue()) as queue:
        if pid:
            watch = select.kevent(
                pid,
                filter=select.KQ_FILTER_PROC,
                flags=select.KQ_EV_ADD | select.KQ_EV_ONESHOT,
                fflags=select.KQ_NOTE_EXIT,
            )
            try:
                done = queue.control([watch], 1, 0)
            except ProcessLookupError:
                done = True
            ready.touch()
            if not done:
                queue.control(None, 1, None)
    if TARGET.stat().st_ino != inode:
        raise RuntimeError("Target changed; leaving both versions in place")
    swap = ctypes.CDLL(None, use_errno=True).renamex_np
    swap.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
    if swap(os.fsencode(candidate), os.fsencode(TARGET), RENAME_SWAP) != 0:
        raise OSError(ctypes.get_errno(), "Could not atomically replace custom app")
    if candidate.stat().st_ino == inode:
        shutil.rmtree(candidate)


if __name__ == "__main__":
    stage = Path(__file__).resolve().parent
    candidate = stage / TARGET.name
    inode, pid, version = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    with (candidate / "Contents/Info.plist").open("rb") as file:
        info = plistlib.load(file)
    assert info["CFBundleIdentifier"] == BUNDLE_ID
    assert info["CFBundleShortVersionString"] == version
    install(candidate, inode, pid, stage / "waiting")
    subprocess.run([LSREGISTER, "-f", str(TARGET)], check=True)
    (stage / "waiting").unlink(missing_ok=True)
    (stage / "job.plist").unlink()
    Path(__file__).unlink()
    stage.rmdir()
