import asyncio
import logging
import re
from typing import Dict
from collections import defaultdict
import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

# Adjust imports as per the existing codebase
try:
    from app.core.database import AsyncSessionLocal
    from app.models.bond import Bond
except ImportError:
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
    from app.core.database import AsyncSessionLocal
    from app.models.bond import Bond

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def fetch_smartlab_ratings() -> Dict[str, str]:
    """
    Parses smart-lab.ru/q/bonds to extract ISIN -> Rating mapping.
    """
    base_url = "https://smart-lab.ru/q/bonds/"
    ratings_map = {}
    
    # Use a normal user-agent to avoid simple blocks
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
    }
    
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=20.0) as client:
        # First page
        logger.info(f"Fetching Smart-Lab bonds list: {base_url}")
        response = await client.get(base_url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Find pagination max
        pages_links = soup.select(".quotes-wrapper a.page-link, .quotes-wrapper span.page-link, .wrapper a.page-link")
        max_page = 1
        for a in pages_links:
            try:
                page_num = int(a.text.strip())
                if page_num > max_page:
                    max_page = page_num
            except ValueError:
                pass
                
        # To be safe in case pagination parses wrong (e.g. they use a different class), typical smart lab bonds have around 25-35 pages.
        if max_page < 2:
            # Maybe the layout changed, try finding pagination inside typical smartlab pagination container
            pager = soup.find(class_="pagination")
            if pager:
                links = pager.find_all("a")
                for link in links:
                    if link.get("href", "").find("page") != -1:
                        try:
                            # order_by_val_to_day/desc/page2/
                            p = re.search(r"page(\d+)", link.get("href"))
                            if p:
                                p_num = int(p.group(1))
                                if p_num > max_page: max_page = p_num
                        except Exception:
                            pass

        if max_page == 1:
            max_page = 35 # safe fallback if pagination not found but there are indeed pages
            
        logger.info(f"Found {max_page} pages of bonds to parse.")
        
        # Function to parse one page's HTML
        def parse_page(html_text: str):
            page_soup = BeautifulSoup(html_text, "html.parser")
            table = page_soup.find("table", class_="trades-table")
            if not table:
                # smart-lab might not have a class, try searching for the first table
                table = page_soup.find("table")
            if not table:
                return 0
                
            rows = table.find_all("tr")
            parsed_count = 0
            # Usually the table has column headers in the first tr, let's find the rating column index
            # The columns change order sometimes, but currently rating_ru is in 'sm_rating'
            # Let's map headers to find rating. Or simplify: rating is usually in a <td> with string starting with "ru" or "A..."
            # Wait, Smart-Lab has a specific standard. Let's look for link to bond ISIN in the row.
            
            for row in rows:
                cols = row.find_all("td")
                if not cols:
                    continue
                
                # ISIN is typically in the URL of the name link: <a href="/q/bonds/RU000A10EST2/">
                name_link = row.select_one("td a[href^='/q/bonds/RU']")
                if not name_link:
                    continue
                    
                href = name_link.get("href", "")
                isin_match = re.search(r"/q/bonds/(RU[A-Z0-9]+)/", href)
                if not isin_match:
                    continue
                    
                isin = isin_match.group(1)
                
                # Now find rating. It's often in a column with text like ruAAA, ruBB+, A+(RU) etc.
                # We can just check all columns for rating patterns.
                rating = None
                for col in cols:
                    text = col.get_text(strip=True)
                    # Rating usually matches ruAAA, ruA+, BB-(RU) etc. Or just one of the standard rating strings.
                    if text and re.match(r"^(ru|RU|A|B|C|D).*?(AAA|AA|A|BBB|BB|B|CCC|CC|C|D).*?", text, re.IGNORECASE):
                        if len(text) <= 8 and text != "RU": # "RU" alone is country, etc. "ruAAA" is length 5.
                            rating = text
                            break
                            
                if rating:
                    ratings_map[isin] = rating
                    parsed_count += 1
            return parsed_count
            
        # Parse first page
        parsed = parse_page(response.text)
        logger.info(f"Page 1: parsed {parsed} ratings.")
        
        # Iterate over the rest of the pages concurrently or sequentially
        # Smart-Lab limits requests, so we do it sequentially with a small delay
        for page in range(2, max_page + 1):
            url = f"{base_url}order_by_val_to_day/desc/page{page}/"
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                parsed = parse_page(resp.text)
                logger.info(f"Page {page}: parsed {parsed} ratings. Total so far: {len(ratings_map)}")
                await asyncio.sleep(0.5) # Be polite
            except Exception as e:
                logger.error(f"Error fetching page {page}: {e}")
                break
                
    return ratings_map

async def run_sync():
    """Main loop logic to fetch from smart-lab and save to DB."""
    logger.info("Starting bond ratings synchronization...")
    try:
        ratings_map = await fetch_smartlab_ratings()
        if not ratings_map:
            logger.warning("No ratings found on Smart-Lab. Perhaps layout changed?")
            return
            
        logger.info(f"Successfully scraped {len(ratings_map)} bond ratings. Updating DB...")
        
        # Update database in chunks
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Bond))
            bonds = result.scalars().all()
            
            updated_count = 0
            for b in bonds:
                if b.isin in ratings_map:
                    if b.rating_ru != ratings_map[b.isin]:
                        b.rating_ru = ratings_map[b.isin]
                        updated_count += 1
            
            if updated_count > 0:
                await db.commit()
                logger.info(f"Updated {updated_count} bond records with new ratings.")
            else:
                logger.info("All bond ratings are already up to date.")
                
    except Exception as e:
        logger.exception(f"Fatal error in bond ratings synchronization: {e}")

if __name__ == "__main__":
    asyncio.run(run_sync())
