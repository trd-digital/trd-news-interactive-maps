from playwright.sync_api import Playwright, sync_playwright, expect
import pandas as pd
import time
from datetime import datetime, timedelta
from io import StringIO
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# Set up credentials for Google Sheets access.
scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
creds = ServiceAccountCredentials.from_json_keyfile_name('autoscraper-380600-0d0c84856d6b.json', scope)
client = gspread.authorize(creds)

# Open the spreadsheet by key and select the worksheet.
sheet = client.open_by_key('1PcmZjexOybXbr3BL43K3oL_6bVAOcW96t8fIoqX3sI0')
worksheet = sheet.worksheet('DOGE')

today = datetime.today().strftime('%Y-%m-%d')
yesterday = (datetime.today() - timedelta(days=1)).strftime('%Y-%m-%d')

def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()

    # Navigate to the target website.
    page.goto("https://doge.gov/savings")
    time.sleep(5)

    # Click the "see more" button (third occurrence).
    page.locator("text=see more").nth(2).click()

    # Parse tables from the page.
    dfs = pd.read_html(StringIO(page.content()))
    df_value = dfs[1]
    df_value.to_csv(f'{today}_value.csv', index=False)

    # Click on Savings (fifth occurrence in the main content).
    page.locator('[aria-label="Main content"] >> text=Savings').nth(4).click()
    time.sleep(5)

    dfs = pd.read_html(StringIO(page.content()))
    df_savings = dfs[1]
    df_savings.to_csv(f'{today}_savings.csv', index=False)

    # Merge the two dataframes side by side and remove duplicate columns.
    df_concat = pd.concat([df_value, df_savings], axis=1)
    df_final = df_concat.loc[:, ~df_concat.columns.duplicated()]

    # Add collection metadata.
    df_final["Collection Date"] = today
    df_final["Collection Time"] = time.strftime("%H:%M:%S")
    df_final["Collection Timestamp"] = time.time()

    # Ensure all data is string type.
    df_final = df_final.astype(str)
    df_final.to_csv(f'{today}_final.csv', index=False)
    df_final.to_csv('DOGE_Velocity_Tracker.csv', index=False)

    print("Columns in df_final:", df_final.columns.tolist())


    # Create a composite key using multiple columns.
    # Adjust the list below to include all columns that make a row unique.
    unique_columns = ["Main Agency","Location","Sq Ft","Annual Lease","Saved"]
    df_final["composite_key"] = df_final[unique_columns].apply(lambda x: "_".join(x.values.astype(str)), axis=1)

    # Retrieve existing data from the Google Sheet as a DataFrame.
    existing_records = worksheet.get_all_records()
    if existing_records:
        df_existing = pd.DataFrame(existing_records)
        # If your sheet doesn't have the composite_key column, create it.
        if all(col in df_existing.columns for col in unique_columns):
            df_existing["composite_key"] = df_existing[unique_columns].apply(lambda x: "_".join(x.values.astype(str)), axis=1)
        else:
            # In case headers differ, assume no matching key exists.
            df_existing["composite_key"] = ""
    else:
        df_existing = pd.DataFrame(columns=df_final.columns)

    # Filter out rows from df_final that already exist in the sheet based on the composite key.
    df_new = df_final[~df_final["composite_key"].isin(df_existing["composite_key"])]

    # Convert new rows to a list of lists.
    data = df_new.drop(columns=["composite_key"]).values.tolist()

    # Insert new rows at row 2 if any new data exists.
    if data:
        worksheet.insert_rows(data, row=2)
        print(f"Inserted {len(data)} new rows.")
    else:
        print("No new data to insert.")

    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
