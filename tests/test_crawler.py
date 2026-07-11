from playground.webtest import crawler


def test_crawl_discovers_linked_pages(local_server):
    pages = crawler.crawl(local_server + "/", max_pages=10)
    assert local_server + "/" in pages
    assert local_server + "/about" in pages
