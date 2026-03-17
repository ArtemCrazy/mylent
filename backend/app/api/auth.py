from fastapi import APIRouter, HTTPException, status
from app.schemas.user import Token, LoginRequest, UserResponse
from app.core.security import verify_password, create_access_token
from app.api.deps import CurrentUser, DbSession
from sqlalchemy import select
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_login(login: str) -> str:
    """Если в логине нет @, считаем коротким логином и дописываем @mylent.local"""
    login = (login or "").strip()
    if "@" in login:
        return login
    return f"{login}@mylent.local" if login else ""


@router.post("/login", response_model=Token)
async def login(data: LoginRequest, db: DbSession):
    email = _normalize_login(data.login)
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Login required")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect login or password",
        )
    token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser):
    return current_user
