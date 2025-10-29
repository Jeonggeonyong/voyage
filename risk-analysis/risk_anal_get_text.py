import fitz  # PyMuPDF
import pandas as pd
import os

# pdf_path = "example.pdf"
# output_dir = "read_csv"

# #os.makedirs(output_dir, exist_ok=True)

# pdf_idet = input("enter the file name >>> ")

# pdf_path = pdf_idet

# pdf_path = pdf_path + ".pdf"

# doc = fitz.open(pdf_path)

# for page_num, page in enumerate(doc, start=1):
#     # find_tables() 실행
#     tables_info = page.find_tables()

#     # 버전에 따른 반환 형태 처리
#     if hasattr(tables_info, "tables"):
#         tables = tables_info.tables
#     elif isinstance(tables_info, list):
#         tables = tables_info
#     else:
#         tables = []

#     print(f"Page {page_num} — 감지된 표 개수: {len(tables)}")

#     for idx, table in enumerate(tables, start=1):
#         print(f"→ Page {page_num} / Table {idx} 추출 중...")

#         # DataFrame 변환
#         if hasattr(table, "to_pandas"):
#             df = table.to_pandas()
#         else:
#             df = pd.DataFrame(table.extract())

#         # 파일 이름 설정
#         base_name = f"page{page_num}_table{idx}"

#         base_name = pdf_idet + "_" + base_name

#         # #  텍스트 파일로 저장
#         # txt_path = os.path.join(output_dir, f"{base_name}.txt")
#         # with open(txt_path, "w", encoding="utf-8") as f:
#         #     f.write(df.to_string(index=False))
#         # print(f"   [✓] TXT 저장 완료 → {txt_path}")

#         #  CSV 파일로 저장
#         csv_path = os.path.join(output_dir, f"{base_name}.csv")
#         df.to_csv(csv_path, index=False, encoding="utf-8-sig")
#         print(f"   [✓] CSV 저장 완료 → {csv_path}")

# doc.close()
# print(" 모든 표 추출 및 저장 완료.")




def risk_anal_get_text(input_file, uid : str, dic : str) -> tuple:
    return_dict = {}
    # pdf_path = "example.pdf"
    # output_dir = "read_csv"

    #os.makedirs(output_dir, exist_ok=True)

    # pdf_idet = input("enter the file name >>> ")



    ###############
    #pdf file stream open
    pdf_bytes = input_file.read()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    ##############
    pdf_ident = uid +  "_" + dic
    pdf_path = pdf_ident
    # pdf_path = pdf_path + ".pdf"
    # doc = fitz.open(pdf_path)
    ##
    return_bulidng_info = ""
    for page_num, page in enumerate(doc):
        text = page.get_text("text")  # OCR 없이 실제 텍스트 추출
        text_pars = text.split('\n')
        for a in text_pars:
            if("[건물]" in a):
                return_bulidng_info = a.replace("[건물]","")
                return_bulidng_info = return_bulidng_info.strip()
                break     
        if(return_bulidng_info != ""):
            break
    ################    

    for page_num, page in enumerate(doc, start=1):
        


        # find_tables() 실행
        tables_info = page.find_tables()

        # 버전에 따른 반환 형태 처리
        if hasattr(tables_info, "tables"):
            tables = tables_info.tables
        elif isinstance(tables_info, list):
            tables = tables_info
        else:
            tables = []

        # print(f"Page {page_num} — 감지된 표 개수: {len(tables)}")

        for idx, table in enumerate(tables, start=1):
            # print(f"→ Page {page_num} / Table {idx} 추출 중...")

            # DataFrame 변환
            if hasattr(table, "to_pandas"):
                df = table.to_pandas()
            else:
                df = pd.DataFrame(table.extract())

            # 파일 이름 설정
            base_name = f"page{page_num}_table{idx}"

            base_name = pdf_ident + "_" + base_name

            # #  텍스트 파일로 저장
            # txt_path = os.path.join(output_dir, f"{base_name}.txt")
            # with open(txt_path, "w", encoding="utf-8") as f:
            #     f.write(df.to_string(index=False))
            # print(f"   [✓] TXT 저장 완료 → {txt_path}")

            #  CSV 파일로 저장
            # csv_path = os.path.join(output_dir, f"{base_name}.csv")

            return_dict[f"{base_name}"] = df

            # df.to_csv(csv_path, index=False, encoding="utf-8-sig")
            # print(f"   df 추출 및 저장 완료 {base_name}")
            # print(df)

    return (return_bulidng_info, return_dict)
        


    