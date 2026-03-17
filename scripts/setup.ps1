# Установка всего необходимого для MyLent (Windows PowerShell)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== MyLent: установка ===" -ForegroundColor Cyan

# 1. Backend
Write-Host "`n1. Backend (Python)..." -ForegroundColor Yellow
Set-Location $ProjectRoot\backend
if (-not (Test-Path .venv)) {
    python -m venv .venv
    Write-Host "   Создан venv"
}
.\.venv\Scripts\Activate.ps1
pip install -q -r requirements.txt
Write-Host "   Зависимости установлены"

# 2. Frontend
Write-Host "`n2. Frontend (Node)..." -ForegroundColor Yellow
Set-Location $ProjectRoot\frontend
npm install --silent 2>$null
if (-not (Test-Path .env.local)) {
    Set-Content -Path .env.local -Value "NEXT_PUBLIC_API_URL=http://localhost:8000"
    Write-Host "   Создан .env.local"
}
Write-Host "   Зависимости установлены"

# 3. .env в backend (если нет)
Set-Location $ProjectRoot\backend
if (-not (Test-Path .env)) {
    @"
DATABASE_URL=sqlite+aiosqlite:///./mylent.db
DATABASE_URL_SYNC=sqlite:///./mylent.db
SECRET_KEY=dev-secret-key-min-32-characters-long
"@ | Set-Content -Path .env
    Write-Host "`n3. Создан backend\.env" -ForegroundColor Yellow
}

# 4. Создать БД и пользователя по умолчанию
Write-Host "`n4. База данных и пользователь..." -ForegroundColor Yellow
.\.venv\Scripts\Activate.ps1
python -c "
import asyncio
from app.core.database import engine, Base
from sqlalchemy import select
from app.models.user import User
from app.core.security import get_password_hash

async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(User).where(User.email == 'admin@mylent.local'))
        if r.scalar_one_or_none() is None:
            u = User(email='admin@mylent.local', password_hash=get_password_hash('admin'))
            db.add(u)
            await db.commit()
            print('   Создан пользователь: admin@mylent.local / admin')
        else:
            print('   Пользователь admin@mylent.local уже есть')
asyncio.run(init())
"

Write-Host "`n=== Готово. ===" -ForegroundColor Green
Write-Host "Запуск backend:  cd backend && .\.venv\Scripts\Activate.ps1 && uvicorn app.main:app --reload --port 8000"
Write-Host "Запуск frontend: cd frontend && npm run dev"
Write-Host "Вход: http://localhost:3000  -> Вход -> admin@mylent.local / admin"
