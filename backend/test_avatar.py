import asyncio
import os
from io import BytesIO

from telethon import TelegramClient
from app.core.config import get_settings
from app.services.telegram_preview import entity_has_public_link

async def main():
    print("Testing streetlapka avatar fetch...")
    settings = get_settings()
    session_path = settings.telegram_session_path or "./data/telegram_session"
    api_id_int = int(settings.telegram_api_id.strip())
    api_hash = settings.telegram_api_hash.strip()
    
    print(f"Session: {session_path}")
    client = TelegramClient(session_path, api_id_int, api_hash)
    await client.connect()
    if not await client.is_user_authorized():
        print("Not authorized!")
        return

    try:
        username = "streetlapka"
        print(f"Fetching entity for {username}...")
        entity = await client.get_entity(username)
        print(f"Entity: {entity}")
        
        has_link = entity_has_public_link(entity)
        print(f"Has public link: {has_link}")
        
        buf = BytesIO()
        print("Downloading profile photo...")
        photo = await client.download_profile_photo(entity, file=buf)
        print(f"Photo downloaded? {photo is not None}")
        
        if photo:
            buf.seek(0)
            data = buf.getvalue()
            print(f"Downloaded {len(data)} bytes of photo.")
        else:
            print("Profile photo returned None!")
            
    except Exception as e:
        print(f"Exception: {repr(e)}")
    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
