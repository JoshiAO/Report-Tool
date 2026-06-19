import pandas as pd
import os
from openpyxl import load_workbook
from datetime import datetime
import asyncio
from etl_core import LegacyETL

class ETLJob:
    def __init__(self, report_date: datetime, settings, base_import_dir: str, base_export_dir: str, dummy_code="Y", 
                 send_progress=None, request_categories=None, request_missing_file=None):
        self.report_date = report_date
        self.settings = settings
        self.base_import_dir = base_import_dir
        self.base_export_dir = base_export_dir
        self.dummy_code = dummy_code
        async def dummy_progress(x): pass
        self.send_progress = send_progress or dummy_progress
        self.request_categories = request_categories
        self.request_missing_file = request_missing_file

    async def run(self):
        try:
            await self.send_progress("Starting ETL Process...")
            
            # Generate paths dynamically
            def generate_path(base_dir: str, date_obj: datetime, subfolder: str) -> str:
                year = date_obj.strftime("%Y")
                month_name = date_obj.strftime("%m.%B")
                month_check = date_obj.strftime("%m").lstrip('0')
                day_check = date_obj.strftime("%d").lstrip('0')
                year_check = date_obj.strftime("%Y")
                day_folder = f"{month_check}.{day_check}.{year_check[2:]}"
                return os.path.join(base_dir, year, month_name, day_folder, subfolder)
                
            import_path = generate_path(self.base_import_dir, self.report_date, "COB")
            self.export_path = generate_path(self.base_export_dir, self.report_date, "Exports")
            
            def generate_ci_path(base_dir: str, date_obj: datetime) -> str:
                year = date_obj.strftime("%Y")
                month_name = date_obj.strftime("%m.%B")
                return os.path.join(base_dir, year, month_name)
                
            self.ci_path = generate_ci_path(self.base_import_dir, self.report_date)
            
            self.import_files = {
                'invoice': os.path.join(import_path, "DMS-Invoice-on.xlsx"),
                'returns': os.path.join(import_path, "DMS-Customer Returns-on.xlsx"),
                'customer': os.path.join(import_path, "DMS-Customer-on.xlsx"),
                'route': os.path.join(import_path, "DMS-Route-on.xlsx"),
                'price': os.path.join(import_path, "DMS-Price-on.xlsx"),
                'sales_order': os.path.join(import_path, "DMS-Sales Order-on.xlsx"),
            }
            
            # Helper to check files with fallback to UI
            async def check_file(path, desc):
                if not path or not os.path.exists(path):
                    if self.request_missing_file:
                        await self.send_progress(f"File missing: {desc}. Waiting for user input...")
                        new_path = await self.request_missing_file(desc, path)
                        if new_path and os.path.exists(new_path):
                            await self.send_progress(f"Resolved {desc} -> {new_path}")
                            return new_path
                    raise FileNotFoundError(f"{desc} file not found: {path}")
                return path

            await self.send_progress("Validating reference paths...")
            self.settings.reference_path_category = await check_file(self.settings.reference_path_category, "CATEGORY")
            self.settings.reference_path_fs = await check_file(self.settings.reference_path_fs, "Field Supervisors")
            self.settings.reference_path_week = await check_file(self.settings.reference_path_week, "WEEK")
            self.settings.reference_path_cdam = await check_file(self.settings.reference_path_cdam, "CDAM")
            self.settings.reference_path_gt_channel = await check_file(self.settings.reference_path_gt_channel, "GT Channel")
            self.settings.reference_path_new_customer = await check_file(self.settings.reference_path_new_customer, "New Customer")
            
            for k, f in self.import_files.items():
                self.import_files[k] = await check_file(f, f"Import {k}")

            async def handle_missing_categories_wrapper(category_df, all_products, category_ref_path):
                # Similar to original edit_missing_categories but uses WebSockets to ask UI
                await self.send_progress("Checking for missing categories...")
                merged = all_products.copy()
                cat_map = category_df.set_index('SKU CODE')['CATEGORY']
                merged['CATEGORY'] = merged['SKU CODE'].map(cat_map)
                
                missing_mask = merged['CATEGORY'].isna() | merged['CATEGORY'].astype(str).str.strip().eq('')
                missing = merged.loc[missing_mask, ['SKU CODE', 'SKU NAME']].drop_duplicates().reset_index(drop=True)
                
                if missing.empty:
                    return category_df
                    
                if self.request_categories:
                    await self.send_progress("Waiting for UI input for missing categories...")
                    missing_list = missing.to_dict(orient='records')
                    existing_categories = sorted([c for c in category_df['CATEGORY'].dropna().astype(str).unique() if str(c).strip() != ''])
                    
                    new_mappings = await self.request_categories(missing_list, existing_categories)
                    
                    for mapping in new_mappings:
                        sku_str = str(mapping['SKU CODE'])
                        cat_val = mapping['CATEGORY']
                        mask = category_df['SKU CODE'] == sku_str
                        if mask.any():
                            category_df.loc[mask, 'CATEGORY'] = cat_val
                            category_df.loc[mask, 'SKU NAME'] = mapping['SKU NAME']
                        else:
                            new_row = {'SKU CODE': sku_str, 'SKU NAME': mapping['SKU NAME'], 'CATEGORY': cat_val}
                            category_df = pd.concat([category_df, pd.DataFrame([new_row])], ignore_index=True)
                    
                    # Write updated categories
                    cols_to_write = [c for c in ['SKU CODE', 'SKU NAME', 'CATEGORY'] if c in category_df.columns] + \
                                    [c for c in category_df.columns if c not in ['SKU CODE', 'SKU NAME', 'CATEGORY']]
                    category_df.to_excel(self.settings.reference_path_category, index=False, columns=cols_to_write)
                    
                    await self.send_progress("Categories saved.")
                    # Reload to ensure typing is correct
                    category_df = pd.read_excel(self.settings.reference_path_category, dtype={'SKU CODE': str})
                    
                return category_df

            await self.send_progress("Executing Pandas ETL steps...")
            
            legacy_etl = LegacyETL(
                settings=self.settings,
                report_date=self.report_date,
                dummy_code=self.dummy_code,
                import_files=self.import_files,
                export_path=self.export_path,
                ci_path=self.ci_path,
                send_progress=self.send_progress,
                handle_missing_categories=handle_missing_categories_wrapper
            )
            
            # The generated etl_core might have some missing imports since it runs globally
            # But python modules handle globals. We should check if it runs.
            await legacy_etl.execute()

            await self.send_progress("ETL successfully processed!")
            return {"status": "success"}

        except Exception as e:
            await self.send_progress(f"Error: {str(e)}")
            return {"status": "error", "message": str(e)}
