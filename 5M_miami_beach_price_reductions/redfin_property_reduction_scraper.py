from playwright.sync_api import Playwright, sync_playwright, expect
from bs4 import BeautifulSoup


def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()

    # Open new page
    page = context.new_page()

    # Go to https://www.redfin.com/FL/Miami-Beach/140-S-Hibiscus-Dr-33139/home/42789091
    page.goto("https://www.redfin.com/FL/Miami-Beach/140-S-Hibiscus-Dr-33139/home/42789091")

    x = page.content()

    soup = BeautifulSoup(x, 'html.parser')
    timeline = soup.find('div', {'class': 'timeline-content'})

    print(timeline.text.strip())

    # ---------------------
    context.close()
    browser.close()


with sync_playwright() as playwright:
    run(playwright)
