import subprocess
import sys

HOST = "155.212.219.106"
USER = "root"
PASS = "S2JNiq1r%dKR"

def run_ssh(command):
    try:
        import paramiko
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko"])
        import paramiko

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    stdin, stdout, stderr = client.exec_command(command)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    client.close()
    return out, err

def main():
    commands = [
        "docker ps",
        "systemctl -a | grep mylent || true",
        "ls -la /root/mylent",
        "screen -ls || true",
        "tmux ls || true"
    ]
    for cmd in commands:
        print(f"=== {cmd} ===")
        out, err = run_ssh(cmd)
        if out: print("STDOUT:\n" + out)
        if err: print("STDERR:\n" + err)

if __name__ == "__main__":
    main()
