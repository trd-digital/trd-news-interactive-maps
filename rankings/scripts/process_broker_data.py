#!/usr/bin/env python3
"""
NYC Top Brokers Ranking Data Processor

This script reads raw broker ranking data from CSV files and generates a formatted
dataset with configurable broker count for bump chart visualization.

Usage:
    python process_broker_data.py                # Process with default 10 brokers
    python process_broker_data.py --num 20       # Process with 20 brokers
    python process_broker_data.py --num 50       # Process with 50 brokers
"""

import pandas as pd
import os
from pathlib import Path
import glob
import argparse


def main():
    # Get the script's directory for relative path resolution
    script_dir = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.dirname(script_dir)

    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Process NYC broker ranking data")
    parser.add_argument(
        "--num",
        type=int,
        default=10,
        help="Number of top brokers to include (default: 10)",
    )
    args = parser.parse_args()

    NUM_BROKERS = args.num
    INPUT_FOLDER = os.path.join(PROJECT_ROOT, "raw_data_csv")
    OUTPUT_FILE = os.path.join(PROJECT_ROOT, "data", "top_brokers_rank.csv")

    print("\n" + "=" * 60)
    print("NYC Top Brokers Ranking Data Processor")
    print("=" * 60 + "\n")

    # Section 1: Import libraries
    print("✓ Libraries imported successfully\n")

    # Section 2: Configuration
    print(f"📊 Configuration:")
    print(f"  - Number of brokers: {NUM_BROKERS}")
    print(f"  - Input folder: {INPUT_FOLDER}")
    print(f"  - Output file: {OUTPUT_FILE}")
    print()

    # Section 3: Load raw broker data
    print("📁 Loading CSV files...")
    dfs = []
    csv_files = glob.glob(os.path.join(INPUT_FOLDER, "nyc_top_broker_*.csv"))

    if not csv_files:
        print(f"❌ No CSV files found in {INPUT_FOLDER}")
        return

    print(f"📁 Found {len(csv_files)} CSV file(s):\n")

    for csv_file in sorted(csv_files):
        filename = os.path.basename(csv_file)
        print(f"  Reading: {filename}")

        try:
            df = pd.read_csv(csv_file)

            # Extract year from filename (e.g., "nyc_top_broker_2026.csv" -> "2026")
            year = filename.replace("nyc_top_broker_", "").replace(".csv", "")

            # Keep only Rank and Agent/Team columns, rename Agent/Team to Person
            df_filtered = df[["Rank", "Agent/Team"]].copy()
            df_filtered.columns = ["Rank", "Person"]
            df_filtered["Year"] = year

            dfs.append(df_filtered)
            print(f"    ✓ Rows: {len(df_filtered)}")
        except Exception as e:
            print(f"    ❌ Error reading file: {e}")

    print(f"\n✓ Loaded {len(dfs)} dataset(s)\n")

    if not dfs:
        print("❌ No data to process")
        return

    # Section 4: Filter and rank brokers
    print("🔄 Processing data...\n")

    # Combine all DataFrames
    combined_df = pd.concat(dfs, ignore_index=True)
    print(f"📊 Combined Dataset:")
    print(f"  Total rows: {len(combined_df)}")
    print(f"  Columns: {', '.join(combined_df.columns)}")
    print(f"  Years: {sorted(combined_df['Year'].unique())}\n")

    # Identify the latest year
    latest_year = combined_df["Year"].max()
    print(f"📅 Latest Year: {latest_year}\n")

    # Filter for top N brokers based on latest year rankings
    top_brokers = (
        combined_df[combined_df["Year"] == latest_year]
        .nsmallest(NUM_BROKERS, "Rank")["Person"]
        .tolist()
    )
    print(f"🏆 Top {NUM_BROKERS} Brokers in {latest_year}:")
    for i, broker in enumerate(top_brokers, 1):
        print(f"  {i}. {broker}")
    print()

    # Filter combined dataset to only include top brokers
    filtered_df = combined_df[combined_df["Person"].isin(top_brokers)].copy()

    # Pivot to wide format (Person as rows, Years as columns)
    pivot_df = filtered_df.pivot_table(
        index="Person", columns="Year", values="Rank", aggfunc="first"
    )

    # Sort by latest year ranking
    pivot_df = pivot_df.sort_values(by=latest_year)

    print(
        f"✓ Filtered and pivoted to {len(pivot_df)} brokers × {len(pivot_df.columns)} years\n"
    )
    print(f"Data Preview:")
    print(pivot_df.to_string())
    print()

    # Section 5: Export to CSV
    print("💾 Exporting data...\n")

    # Reset index to make Person a column (required for CSV format)
    output_df = pivot_df.reset_index()

    # Write to CSV file
    output_df.to_csv(OUTPUT_FILE, index=False)
    print(f"✅ Successfully exported to: {OUTPUT_FILE}\n")

    # Verify the file
    if os.path.exists(OUTPUT_FILE):
        file_size = os.path.getsize(OUTPUT_FILE)
        print(f"📄 File Details:")
        print(f"  Size: {file_size} bytes")
        print(f"  Rows: {len(output_df)}")
        print(f"  Columns: {len(output_df.columns)}\n")

        print("=" * 60)
        print("✅ Processing complete!")
        print("=" * 60 + "\n")
    else:
        print(f"❌ Error: File not created at {OUTPUT_FILE}\n")


if __name__ == "__main__":
    main()
