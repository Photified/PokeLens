"""Run the image encoder without network access on Linux (GitHub Actions).
Network is denied at the syscall layer before the native runtime is imported.
"""
import ctypes,ctypes.util,errno,runpy,sys

def deny_network():
 name=ctypes.util.find_library('seccomp')
 if not name:raise RuntimeError('Offline image indexing requires libseccomp (included in Ubuntu GitHub Actions).')
 lib=ctypes.CDLL(name,use_errno=True)
 lib.seccomp_init.argtypes=[ctypes.c_uint32];lib.seccomp_init.restype=ctypes.c_void_p
 lib.seccomp_syscall_resolve_name.argtypes=[ctypes.c_char_p];lib.seccomp_syscall_resolve_name.restype=ctypes.c_int
 lib.seccomp_rule_add.argtypes=[ctypes.c_void_p,ctypes.c_uint32,ctypes.c_int,ctypes.c_uint]
 lib.seccomp_load.argtypes=[ctypes.c_void_p];lib.seccomp_release.argtypes=[ctypes.c_void_p]
 ctx=lib.seccomp_init(0x7fff0000)
 if not ctx:raise RuntimeError('Cannot create offline index sandbox')
 for syscall in [b'socket',b'connect',b'sendto',b'sendmsg']:
  number=lib.seccomp_syscall_resolve_name(syscall)
  if number>=0 and lib.seccomp_rule_add(ctx,0x00050000|errno.EPERM,number,0)!=0:raise RuntimeError('Cannot restrict network')
 if lib.seccomp_load(ctx)!=0:raise RuntimeError('Cannot activate offline index sandbox')
 lib.seccomp_release(ctx)
if __name__=='__main__':
 deny_network();sys.argv=sys.argv[1:];runpy.run_path(sys.argv[0],run_name='__main__')
