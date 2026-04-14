#!/usr/bin/env python3
"""
NYC Brokerage Rankings Data Processor

This script reads raw brokerage ranking data from CSV files by borough and generates
formatted datasets with configurable brokerage count for bump chart visualization.

Usage:
    python process_brokerage_data.py                # Process all boroughs with default 10 brokerages
    python process_brokerage_data.py --num 20       # Process all boroughs with 20 brokerages
    python process_brokerage_data.py --num 50       # Process all boroughs with 50 brokerages
"""

import pandas as pd
import os
from pathlib import Path
import glob
import argparse


def process_borough(borough_name, csv_files, num_brokerages, project_root):
    """Process brokerage data for a single borough."""

    dfs = []

    print(f"\n🏙️  Processing {borough_name.upper()}:")
    for csv_file in sorted(csv_files):
        filename = os.path.basename(csv_file)
        print(f"  Reading: {filename}")

        try:
            df = pd.read_csv(csv_file)

            # Extract year from filename (e.g., "nyc_top_brokerage_2026_brooklyn.csv" -> "2026")
            year = filename.replace("nyc_top_brokerage_", "").replace(
                f"_{borough_name}.csv", ""
            )

            # Keep only Rank and Brokerage Firm columns, rename to Person for consistency
            df_filtered = df[["Rank", "Brokerage Firm"]].copy()
            df_filtered.columns = ["Rank", "Person"]
            # Normalize company names: remove "The" prefix and convert to uppercase
            df_filtered["Person"] = (
                df_filtered["Person"]
                .str.replace(r"^The\s+", "", regex=True)
                .str.upper()
            )
            df_filtered["Year"] = year

            dfs.append(df_filtered)
            print(f"    ✓ Rows: {len(df_filtered)}")
        except Exception as e:
            print(f"    ❌ Error reading file: {e}")

    if not dfs:
        print(f"  ❌ No data processed for {borough_name}")
        return False

    # Combine all DataFrames for this borough
    combined_df = pd.concat(dfs, ignore_index=True)
    print(
        f"  📊 Combined: {len(combined_df)} rows, Years: {sorted(combined_df['Year'].unique())}"
    )

    # Identify the latest year
    latest_year = combined_df["Year"].max()

    # Filter for top N brokerages based on latest year rankings
    top_brokerages = (
        combined_df[combined_df["Year"] == latest_year]
        .nsmallest(num_brokerages, "Rank")["Person"]
        .tolist()
    )
    print(f"  🏆 Top {num_brokerages} Brokerages in {latest_year}:")
    for i, brokerage in enumerate(top_brokerages, 1):
        print(f"    {i}. {brokerage}")

    # Filter combined dataset to only include top brokerages
    filtered_df = combined_df[combined_df["Person"].isin(top_brokerages)].copy()

    # Pivot to wide format (Person as rows, Years as columns)
    pivot_df = filtered_df.pivot_table(
        index="Person", columns="Year", values="Rank", aggfunc="first"
    )

    # Sort by latest year ranking
    pivot_df = pivot_df.sort_values(by=latest_year)

    # Fill missing values with dropped ranks (lower than existing ranks)
    # For each year, fill NaN with values starting after the max existing rank
    for year_col in pivot_df.columns:
        max_rank = pivot_df[year_col].max()
        next_rank = int(max_rank) + 1

        # Get indices of missing values
        missing_mask = pivot_df[year_col].isna()
        missing_count = missing_mask.sum()

        if missing_count > 0:
            # Fill missing values with sequential dropped ranks
            pivot_df.loc[missing_mask, year_col] = range(
                next_rank, next_rank + missing_count
            )

    # Reset index to make Person a column (required for CSV format)
    output_df = pivot_df.reset_index()

    # Write to CSV file
    output_filename = f"{borough_name}_top_brokerages.csv"
    output_path = os.path.join(project_root, "data", output_filename)
    output_df.to_csv(output_path, index=False)

    print(f"  ✅ Exported {len(output_df)} brokerages to: {output_filename}")

    return True


def main():
    # Get the script's directory for relative path resolution
    script_dir = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.dirname(script_dir)

    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Process NYC brokerage ranking data by borough"
    )
    parser.add_argument(
        "--num",
        type=int,
        default=10,
        help="Number of top brokerages to include (default: 10)",
    )
    args = parser.parse_args()

    NUM_BROKERAGES = args.num
    INPUT_FOLDER = os.path.join(PROJECT_ROOT, "raw_data_csv")

    print("\n" + "=" * 60)
    print("NYC Brokerage Rankings Data Processor")
    print("=" * 60)

    print(f"\n📊 Configuration:")
    print(f"  - Number of brokerages: {NUM_BROKERAGES}")
    print(f"  - Input folder: {INPUT_FOLDER}")
    print()

    # Define boroughs to process
    boroughs = ["brooklyn", "manhattan", "queens"]
    processed_count = 0

    for borough in boroughs:
        # Find CSV files for this borough
        pattern = os.path.join(INPUT_FOLDER, f"nyc_top_brokerage_*_{borough}.csv")
        csv_files = glob.glob(pattern)

        if csv_files:
            if process_borough(borough, csv_files, NUM_BROKERAGES, PROJECT_ROOT):
                processed_count += 1
        else:
            print(f"\n🏙️  {borough.upper()}: ❌ No CSV files found")

    print("\n" + "=" * 60)
    if processed_count > 0:
        print(f"✅ Processing complete! ({processed_count} borough(s) processed)")
    else:
        print("❌ No data was processed")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
