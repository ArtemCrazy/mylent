# Запуск MyLent на вашем VPS (155.212.219.106)

---

## Вариант «Всё одной командой»

1. **Сначала залейте проект на GitHub** (если ещё не залили): в папке проекта выполните `git add -A && git commit -m "deploy" && git push`.
2. **Подключитесь к VPS:** откройте терминал на своём компьютере или **Терминал / VNC** в панели хостинга.
3. Подключитесь по SSH (с компьютера):
   ```bash
   ssh root@155.212.219.106
   ```
   Введите пароль от root.
4. **Скопируйте и вставьте в терминал одну команду** (вся строка целиком):

```bash
apt-get update && apt-get install -y git && git clone https://github.com/ArtemCrazy/mylent.git /root/mylent && bash /root/mylent/scripts/server-setup.sh
```

5. Дождитесь окончания (установка Docker, сборка, запуск). В конце будет написано, что открыть в браузере и какие три команды выполнить дальше (создать пользователя, Telegram, импорт).

После этого сайт будет доступен по адресу **http://155.212.219.106:3000**.

---

## Пошаговый вариант (если хотите делать вручную)

### Шаг 1. Подключиться к VPS

**С вашего компьютера (PowerShell или CMD):**
```bash
ssh root@155.212.219.106
```
Введите пароль от root (тот, что даёт хостинг).

**Либо** в панели хостинга откройте **Терминал** или **VNC** — вы окажетесь в консоли сервера.

---

## Шаг 2. Установить Docker (если ещё не стоит)

Выполните по очереди:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

Проверка: `docker --version` — должна появиться версия.

---

## Шаг 3. Склонировать проект на сервер

```bash
cd /root
git clone https://github.com/ArtemCrazy/mylent.git
cd mylent
```

(Если репозиторий приватный — настройте SSH-ключ на сервере и клонируйте по SSH-URL.)

---

## Шаг 4. Создать файл .env на сервере

```bash
nano /root/mylent/.env
```

Вставьте (подставьте свои значения):

```env
SECRET_KEY=придумайте-длинную-случайную-строку-минимум-32-символа
NEXT_PUBLIC_API_URL=http://155.212.219.106:8000
CORS_ORIGINS=http://155.212.219.106:3000,http://155.212.219.106
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash
```

Сохраните: `Ctrl+O`, Enter, выход: `Ctrl+X`.

Позже, когда будет домен и Nginx, замените адреса на `https://ваш-домен.ru` и `https://ваш-домен.ru/api`.

---

## Шаг 5. Запустить контейнеры

```bash
cd /root/mylent/docker
docker compose build
docker compose up -d
```

Проверка: в браузере откройте **http://155.212.219.106:3000** — должен открыться сайт. API: **http://155.212.219.106:8000**.

---

## Шаг 6. Создать пользователя для входа

```bash
cd /root/mylent/docker
docker compose exec backend python -m scripts.create_user
```

Введите логин (email или короткий логин) и пароль — ими вы будете входить на сайт.

---

## Шаг 7. Один раз войти в Telegram (для импорта каналов)

```bash
docker compose exec -it backend python -m scripts.telegram_sync
```

Введите номер телефона и код из приложения Telegram. После успешного входа сессия сохранится, дальше скрипт можно не запускать.

---

## Шаг 8. Включить периодический импорт постов

Чтобы посты из каналов подтягивались раз в 10 минут:

```bash
docker compose exec -d backend python -m scripts.telegram_sync_loop
```

Либо добавьте в cron (редактор: `crontab -e`):

```cron
*/10 * * * * cd /root/mylent/docker && docker compose exec -T backend python -m scripts.telegram_sync
```

---

## Итог

- Сайт: **http://155.212.219.106:3000**
- API: **http://155.212.219.106:8000**
- Доступ никому не передаётся — все команды выполняете вы на своём VPS.

Когда появится домен, настройте Nginx (прокси на 3000 и 8000) и поменяйте в `.env` значения `NEXT_PUBLIC_API_URL` и `CORS_ORIGINS` на ваш домен.
