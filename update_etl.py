import sys

path = r'backend/etl_core.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Load Freegoods
ci_str = """        #Reading MONTHLY WRONG C.I. MONITORING"""
fg_str = """        # Load Freegoods Reference
        freegoods_ref_path = self.settings.reference_path_freegoods
        if freegoods_ref_path:
            await self.send_progress(f"Reading Freegoods reference data from {freegoods_ref_path}...")
            try:
                freegoods_df = pd.read_excel(freegoods_ref_path)
                freegoods_df = freegoods_df[['Product Code', 'Case']].rename(columns={'Product Code': 'SKU CODE', 'Case': 'FG_CASE_REF'})
                freegoods_df['SKU CODE'] = freegoods_df['SKU CODE'].astype(str)
            except Exception as e:
                await self.send_progress(f"Warning: Failed to load Freegoods reference: {e}")
                freegoods_df = pd.DataFrame(columns=['SKU CODE', 'FG_CASE_REF'])
        else:
            freegoods_df = pd.DataFrame(columns=['SKU CODE', 'FG_CASE_REF'])

        #Reading MONTHLY WRONG C.I. MONITORING"""
content = content.replace(ci_str, fg_str)

# 2. dfc1
dfc1_target = """        dfc1 = df1[['Invoice Date', 'Sold To Customer Number',
        'Product Code', 'Product/Item Description',
        'Total Item amount with Tax and Discount', 'Invoice Item Type','Invoice number']]"""
dfc1_repl = """        dfc1 = df1[['Invoice Date', 'Sold To Customer Number',
        'Product Code', 'Product/Item Description', 'Product UOM', 'Quantity',
        'Total Item amount with Tax and Discount', 'Invoice Item Type','Invoice number']]"""
content = content.replace(dfc1_target, dfc1_repl)

# 3. inv_f rename
inv_f_target = """        inv_f.rename(columns={
        'Invoice Date': 'DATE',
        'Sold To Customer Number': 'ACCOUNT CODE',
        # 'Sold To Customer Name': 'ACCOUNT NAME',
        'Product Code': 'SKU CODE',
        'Product/Item Description': 'SKU NAME',
        'Total Item amount with Tax and Discount': 'SERVED INVOICE',
        'BO': 'BAD RETURNS',
        'FG': 'GOOD RETURNS'
        }, inplace=True)"""
inv_f_repl = """        inv_f.rename(columns={
        'Invoice Date': 'DATE',
        'Sold To Customer Number': 'ACCOUNT CODE',
        # 'Sold To Customer Name': 'ACCOUNT NAME',
        'Product Code': 'SKU CODE',
        'Product/Item Description': 'SKU NAME',
        'Product UOM': 'UOM',
        'Quantity': 'QTY',
        'Total Item amount with Tax and Discount': 'SERVED INVOICE',
        'BO': 'BAD RETURNS',
        'FG': 'GOOD RETURNS'
        }, inplace=True)"""
content = content.replace(inv_f_target, inv_f_repl)

# 4. dfc2
dfc2_target = """        dfc2 = df2[['Customer Return Date', 'Sold To Customer Number', 'Product Code',
                    'Product Description', 'Facility Name', 'Estimated Product Return Amount','Customer Return Number']].copy()"""
dfc2_repl = """        dfc2 = df2[['Customer Return Date', 'Sold To Customer Number', 'Product Code',
                    'Product Description', 'Facility Name', 'Estimated Product Return Amount','Customer Return Number', 'UOM', 'Return/ QC Quantity']].copy()"""
content = content.replace(dfc2_target, dfc2_repl)

# 5. cust_ret pivot
cust_ret_target = """        cust_ret = dfc3.pivot_table(index=['Customer Return Date', 'Sold To Customer Number', 
        'Product Code', 'Product Description', 'Total Item amount with Tax and Discount'], columns='Facility Name', values='with vat', aggfunc=sum)"""
cust_ret_repl = """        cust_ret = dfc3.pivot_table(index=['Customer Return Date', 'Sold To Customer Number', 
        'Product Code', 'Product Description', 'UOM', 'Return/ QC Quantity', 'Total Item amount with Tax and Discount'], columns='Facility Name', values='with vat', aggfunc=sum)"""
content = content.replace(cust_ret_target, cust_ret_repl)

# 6. ret_f rename
ret_f_target = """        ret_f.rename(columns={
        'Customer Return Date': 'DATE',
        'Sold To Customer Number': 'ACCOUNT CODE',
        'Product Code': 'SKU CODE', 
        'Product Description': 'SKU NAME',
        'Total Item amount with Tax and Discount': 'SERVED INVOICE',
        'BO': 'BAD RETURNS',
        'FG': 'GOOD RETURNS'
        }, inplace=True)"""
ret_f_repl = """        ret_f.rename(columns={
        'Customer Return Date': 'DATE',
        'Sold To Customer Number': 'ACCOUNT CODE',
        'Product Code': 'SKU CODE', 
        'Product Description': 'SKU NAME',
        'UOM': 'UOM',
        'Return/ QC Quantity': 'QTY',
        'Total Item amount with Tax and Discount': 'SERVED INVOICE',
        'BO': 'BAD RETURNS',
        'FG': 'GOOD RETURNS'
        }, inplace=True)"""
content = content.replace(ret_f_target, ret_f_repl)

# 7. dfc3
dfc3_target = """        dfc3 = df3[['Last Modified Date', 'Sold To Customer number',
         'Product Code', 'Product Description', 'Total Product Amount', 'SO status', 'SO Number']]"""
dfc3_repl = """        dfc3 = df3[['Last Modified Date', 'Sold To Customer number',
         'Product Code', 'Product Description', 'UOM', 'Quantity', 'Total Product Amount', 'SO status', 'SO Number']]"""
content = content.replace(dfc3_target, dfc3_repl)

# 8. Net Invoice Volume (net_inv_f_l4)
net_inv_vol_target = """        net_inv_f_l4['VOLUME'] = 0.0
        van_mask = net_inv_f_l4['CHANNEL'] == 'VAN(EXTRUCK)'
        book_mask = net_inv_f_l4['CHANNEL'] == 'BOOK(Booking)'
        
        # Use the proper price reference for each channel
        van_price_mask = van_mask & (net_inv_f_l4['SKU PRICE REFERENCE_M2'] != 0)
        net_inv_f_l4.loc[van_price_mask, 'VOLUME'] = (
            net_inv_f_l4.loc[van_price_mask, 'VALUE'] /
            net_inv_f_l4.loc[van_price_mask, 'SKU PRICE REFERENCE_M2']
        )
        
        book_price_mask = book_mask & (net_inv_f_l4['SKU PRICE REFERENCE_M0'] != 0)
        net_inv_f_l4.loc[book_price_mask, 'VOLUME'] = (
            net_inv_f_l4.loc[book_price_mask, 'VALUE'] /
            net_inv_f_l4.loc[book_price_mask, 'SKU PRICE REFERENCE_M0']
        )"""

net_inv_vol_repl = """        net_inv_f_l4['VOLUME'] = 0.0
        van_mask = net_inv_f_l4['CHANNEL'] == 'VAN(EXTRUCK)'
        book_mask = net_inv_f_l4['CHANNEL'] == 'BOOK(Booking)'
        
        # Merge Freegoods reference
        net_inv_f_l4 = net_inv_f_l4.merge(freegoods_df, on='SKU CODE', how='left')
        
        # Use the proper price reference for each channel
        van_price_mask = van_mask & (net_inv_f_l4['SKU PRICE REFERENCE_M2'] != 0)
        net_inv_f_l4.loc[van_price_mask, 'VOLUME'] = (
            net_inv_f_l4.loc[van_price_mask, 'VALUE'] /
            net_inv_f_l4.loc[van_price_mask, 'SKU PRICE REFERENCE_M2']
        )
        
        book_price_mask = book_mask & (net_inv_f_l4['SKU PRICE REFERENCE_M0'] != 0)
        net_inv_f_l4.loc[book_price_mask, 'VOLUME'] = (
            net_inv_f_l4.loc[book_price_mask, 'VALUE'] /
            net_inv_f_l4.loc[book_price_mask, 'SKU PRICE REFERENCE_M0']
        )
        
        # OVERRIDE VOLUME FOR FREEGOODS
        freegoods_mask = net_inv_f_l4['FG_CASE_REF'].notna()
        fg_case_mask = freegoods_mask & (net_inv_f_l4['UOM'].isin(['Case', 'INF_PROD_CAS']))
        net_inv_f_l4.loc[fg_case_mask, 'VOLUME'] = net_inv_f_l4.loc[fg_case_mask, 'QTY']
        
        fg_other_mask = freegoods_mask & (~net_inv_f_l4['UOM'].isin(['Case', 'INF_PROD_CAS'])) & (net_inv_f_l4['FG_CASE_REF'] > 0)
        net_inv_f_l4.loc[fg_other_mask, 'VOLUME'] = (
            net_inv_f_l4.loc[fg_other_mask, 'QTY'] / net_inv_f_l4.loc[fg_other_mask, 'FG_CASE_REF']
        )"""
content = content.replace(net_inv_vol_target, net_inv_vol_repl)

# 9. Sales Orders Volume (sales_orders_df5)
so_vol_target = """        sales_orders_df5['VOLUME'] = 0.0
        van_mask = sales_orders_df5['CHANNEL'] == 'VAN(EXTRUCK)'
        book_mask = sales_orders_df5['CHANNEL'] == 'BOOK(Booking)'
        
        van_price_mask = van_mask & (sales_orders_df5['SKU PRICE REFERENCE_M2'] != 0)
        sales_orders_df5.loc[van_price_mask, 'VOLUME'] = (
            sales_orders_df5.loc[van_price_mask, 'with vat'] /
            sales_orders_df5.loc[van_price_mask, 'SKU PRICE REFERENCE_M2']
        )
        
        book_price_mask = book_mask & (sales_orders_df5['SKU PRICE REFERENCE_M0'] != 0)
        sales_orders_df5.loc[book_price_mask, 'VOLUME'] = (
            sales_orders_df5.loc[book_price_mask, 'with vat'] /
            sales_orders_df5.loc[book_price_mask, 'SKU PRICE REFERENCE_M0']
        )"""

so_vol_repl = """        sales_orders_df5['VOLUME'] = 0.0
        van_mask = sales_orders_df5['CHANNEL'] == 'VAN(EXTRUCK)'
        book_mask = sales_orders_df5['CHANNEL'] == 'BOOK(Booking)'
        
        # Merge Freegoods reference
        freegoods_df_so = freegoods_df.rename(columns={'SKU CODE': 'Product Code'})
        sales_orders_df5 = sales_orders_df5.merge(freegoods_df_so, on='Product Code', how='left')

        van_price_mask = van_mask & (sales_orders_df5['SKU PRICE REFERENCE_M2'] != 0)
        sales_orders_df5.loc[van_price_mask, 'VOLUME'] = (
            sales_orders_df5.loc[van_price_mask, 'with vat'] /
            sales_orders_df5.loc[van_price_mask, 'SKU PRICE REFERENCE_M2']
        )
        
        book_price_mask = book_mask & (sales_orders_df5['SKU PRICE REFERENCE_M0'] != 0)
        sales_orders_df5.loc[book_price_mask, 'VOLUME'] = (
            sales_orders_df5.loc[book_price_mask, 'with vat'] /
            sales_orders_df5.loc[book_price_mask, 'SKU PRICE REFERENCE_M0']
        )
        
        # OVERRIDE VOLUME FOR FREEGOODS
        freegoods_mask_so = sales_orders_df5['FG_CASE_REF'].notna()
        fg_case_mask_so = freegoods_mask_so & (sales_orders_df5['UOM'].isin(['Case', 'INF_PROD_CAS']))
        sales_orders_df5.loc[fg_case_mask_so, 'VOLUME'] = sales_orders_df5.loc[fg_case_mask_so, 'Quantity']

        fg_other_mask_so = freegoods_mask_so & (~sales_orders_df5['UOM'].isin(['Case', 'INF_PROD_CAS'])) & (sales_orders_df5['FG_CASE_REF'] > 0)
        sales_orders_df5.loc[fg_other_mask_so, 'VOLUME'] = (
            sales_orders_df5.loc[fg_other_mask_so, 'Quantity'] / sales_orders_df5.loc[fg_other_mask_so, 'FG_CASE_REF']
        )"""
content = content.replace(so_vol_target, so_vol_repl)

# 10. Served Invoice Volume (ser_inv_f_l4)
si_vol_target = """        ser_inv_f_l4['VOLUME'] = 0.0
        van_mask = ser_inv_f_l4['CHANNEL'] == 'VAN(EXTRUCK)'
        book_mask = ser_inv_f_l4['CHANNEL'] == 'BOOK(Booking)'
        
        van_price_mask = van_mask & (ser_inv_f_l4['SKU PRICE REFERENCE_M2'] != 0)
        ser_inv_f_l4.loc[van_price_mask, 'VOLUME'] = (
            ser_inv_f_l4.loc[van_price_mask, 'SERVED INVOICE'] /
            ser_inv_f_l4.loc[van_price_mask, 'SKU PRICE REFERENCE_M2']
        )
        
        book_price_mask = book_mask & (ser_inv_f_l4['SKU PRICE REFERENCE_M0'] != 0)
        ser_inv_f_l4.loc[book_price_mask, 'VOLUME'] = (
            ser_inv_f_l4.loc[book_price_mask, 'SERVED INVOICE'] /
            ser_inv_f_l4.loc[book_price_mask, 'SKU PRICE REFERENCE_M0']
        )"""

si_vol_repl = """        ser_inv_f_l4['VOLUME'] = 0.0
        van_mask = ser_inv_f_l4['CHANNEL'] == 'VAN(EXTRUCK)'
        book_mask = ser_inv_f_l4['CHANNEL'] == 'BOOK(Booking)'
        
        # Merge Freegoods reference
        ser_inv_f_l4 = ser_inv_f_l4.merge(freegoods_df, on='SKU CODE', how='left')

        van_price_mask = van_mask & (ser_inv_f_l4['SKU PRICE REFERENCE_M2'] != 0)
        ser_inv_f_l4.loc[van_price_mask, 'VOLUME'] = (
            ser_inv_f_l4.loc[van_price_mask, 'SERVED INVOICE'] /
            ser_inv_f_l4.loc[van_price_mask, 'SKU PRICE REFERENCE_M2']
        )
        
        book_price_mask = book_mask & (ser_inv_f_l4['SKU PRICE REFERENCE_M0'] != 0)
        ser_inv_f_l4.loc[book_price_mask, 'VOLUME'] = (
            ser_inv_f_l4.loc[book_price_mask, 'SERVED INVOICE'] /
            ser_inv_f_l4.loc[book_price_mask, 'SKU PRICE REFERENCE_M0']
        )
        
        # OVERRIDE VOLUME FOR FREEGOODS
        freegoods_mask_si = ser_inv_f_l4['FG_CASE_REF'].notna()
        fg_case_mask_si = freegoods_mask_si & (ser_inv_f_l4['UOM'].isin(['Case', 'INF_PROD_CAS']))
        ser_inv_f_l4.loc[fg_case_mask_si, 'VOLUME'] = ser_inv_f_l4.loc[fg_case_mask_si, 'QTY']

        fg_other_mask_si = freegoods_mask_si & (~ser_inv_f_l4['UOM'].isin(['Case', 'INF_PROD_CAS'])) & (ser_inv_f_l4['FG_CASE_REF'] > 0)
        ser_inv_f_l4.loc[fg_other_mask_si, 'VOLUME'] = (
            ser_inv_f_l4.loc[fg_other_mask_si, 'QTY'] / ser_inv_f_l4.loc[fg_other_mask_si, 'FG_CASE_REF']
        )"""
content = content.replace(si_vol_target, si_vol_repl)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Changes successfully applied to etl_core.py.")
