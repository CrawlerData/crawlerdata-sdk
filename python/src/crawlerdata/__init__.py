"""CrawlerData: Google Search (SERP), AI Overview, News, Images, Local, Autocomplete and Google Shopping as JSON.

    from crawlerdata import CrawlerData

    cd = CrawlerData()  # reads CRAWLERDATA_API_KEY
    result = cd.search("best crm software", country="us")
    print(result["organic_results"][0]["title"])
    print(cd.ai_overview("what is a sitemap"))
"""
from .client import CrawlerData, CrawlerDataError

__all__ = ["CrawlerData", "CrawlerDataError"]
__version__ = "0.1.0"
