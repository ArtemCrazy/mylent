"""
Скрипт: проверяет git log на сервере и сравнивает с локальным.
Запуск: python check_server.py
"""
import subprocess
import sys

HOST = "155.212.219.106"
USER = "root"
PASS = "S2JNiq1r%dKR"

def run_ssh(command):
    try:
        import paramiko
    except ImportError:
        print("Устанавливаю paramiko...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko"])
        import paramiko

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Подключаюсь к {HOST}...")
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    stdin, stdout, stderr = client.exec_command(command)
    out = stdout.read().decode()
    err = stderr.read().decode()
    client.close()
    return out, err

def main():
    print("=== Git log на СЕРВЕРЕ (последние 10 коммитов) ===")
    # Ищем папку mylent на сервере
    out, err = run_ssh(
        "find /root /var/www /home -maxdepth 3 -name '.git' -type d 2>/dev/null | head -10"
    )
    print("Найденные git-репозитории на сервере:")
    print(out if out else "(ничего не найдено)")

    if out.strip():
        # Берём первый найденный путь
        git_dir = out.strip().split("\n")[0]
        project_dir = git_dir.replace("/.git", "")
        print(f"\n=== Git log в {project_dir} ===")
        out2, _ = run_ssh(f"cd {project_dir} && git log --oneline -10")
        print(out2)

    print("\n=== Git log ЛОКАЛЬНО (последние 10 коммитов) ===")
    result = subprocess.run(["git", "log", "--oneline", "-10"], capture_output=True, text=True)
    print(result.stdout)

if __name__ == "__main__":
    main()
