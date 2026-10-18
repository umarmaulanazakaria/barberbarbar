// Read-only Windows process inspection. No injection, writes, or debug privilege.
// Relative legacy Node entrypoints need the process cwd, which CIM does not expose.
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace Barberbarbar {
    public static class IdentitasProses {
        [DllImport("shell32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern IntPtr CommandLineToArgvW(string command, out int count);
        [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr p);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
        [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool IsWow64Process(IntPtr h, out bool wow64);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool ReadProcessMemory(IntPtr h, IntPtr address, byte[] data, IntPtr size, out IntPtr read);
        [DllImport("ntdll.dll")]
        static extern int NtQueryInformationProcess(IntPtr h, int info, byte[] data, int size, out int length);

        public static string[] Argumen(string command) {
            int count; IntPtr p = CommandLineToArgvW(command, out count);
            if (p == IntPtr.Zero) throw new Win32Exception();
            try {
                string[] args = new string[count];
                for (int i = 0; i < count; i++) args[i] = Marshal.PtrToStringUni(Marshal.ReadIntPtr(p, i * IntPtr.Size));
                return args;
            } finally { LocalFree(p); }
        }
        static byte[] Baca(IntPtr h, IntPtr p, int size) {
            byte[] b = new byte[size]; IntPtr read;
            if (p == IntPtr.Zero || !ReadProcessMemory(h, p, b, new IntPtr(size), out read) || read.ToInt64() != size)
                throw new InvalidOperationException("Direktori kerja proses tidak dapat dibaca.");
            return b;
        }
        public static string DirektoriKerja(int pid) {
            // PEB/RTL_USER_PROCESS_PARAMETERS are Windows internals: only native
            // x64 layout is supported here; unknown layout/permissions fail closed.
            // Never read the environment block or enumerate unrelated memory.
            if (IntPtr.Size != 8 || !Environment.Is64BitOperatingSystem ||
                !String.Equals(Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE"), "AMD64", StringComparison.OrdinalIgnoreCase))
                throw new PlatformNotSupportedException("Pembacaan cwd relatif memerlukan Windows x64.");
            IntPtr h = OpenProcess(0x0400 | 0x0010, false, pid); // QUERY_INFORMATION | VM_READ
            if (h == IntPtr.Zero) throw new Win32Exception();
            try {
                bool wow64;
                if (!IsWow64Process(h, out wow64) || wow64) throw new PlatformNotSupportedException("Proses bukan native x64.");
                byte[] basic = new byte[48]; int returned;
                if (NtQueryInformationProcess(h, 0, basic, basic.Length, out returned) != 0 || returned != basic.Length)
                    throw new InvalidOperationException("Informasi proses tidak tersedia.");
                IntPtr peb = new IntPtr(BitConverter.ToInt64(basic, 8));
                IntPtr parameters = new IntPtr(BitConverter.ToInt64(Baca(h, IntPtr.Add(peb, 0x20), 8), 0));
                byte[] cwd = Baca(h, IntPtr.Add(parameters, 0x38), 16);
                int length = BitConverter.ToUInt16(cwd, 0), maximum = BitConverter.ToUInt16(cwd, 2);
                if (length < 6 || length > 32766 || length > maximum || length % 2 != 0)
                    throw new InvalidOperationException("Struktur cwd proses tidak valid.");
                return Encoding.Unicode.GetString(Baca(h, new IntPtr(BitConverter.ToInt64(cwd, 8)), length));
            } finally { CloseHandle(h); }
        }
    }
}
