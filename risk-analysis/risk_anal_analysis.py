import fitz  # PyMuPDF
import pandas as pd
# import os
#파일 시작 부분 => 파일 명(및 경로) 입력받고 각 부분의 파일이 존재하는지 입력받음
# folder_ident = input("Enter the analysis target file's folder >>> ")

# pdf_ident = input("Enter the PDF' ident >>> ") 

#########



#
# string_building_perpose = ""

def analysisTitle(arg_df : pd.DataFrame) -> tuple:
    dictionary_title_building_perpose_dict = {
        "단독주택" : "단독주택",
        "아파트" : "아파트",
        "연립주택" : "연립주택",
        "교육연구시설" : "교육연구시설"
    }

    string_building_location_info = "not_found"
    string_perpose_of_building = "not_found"
    string_building_space = "not_found"
    string_building_land_ratio = "not_found"
    string_building_land_addtional_condition = "not_found"

    if(arg_df.empty == True):
        return (string_building_location_info, 
                string_perpose_of_building,
                string_building_space,
                string_building_land_ratio,
                string_building_land_addtional_condition)
    #read csv
    # string_file_path = folder_ident + "/" + pdf_ident + "_" + string_ident_file_id + "_" + string_ident_title + string_ident_file_type
    pandasDF_working_dataFrame = arg_df
    #read DataFrame Shape
    int_df_index, int_df_columns = pandasDF_working_dataFrame.shape
    
    string_last_building_perpose_infos = pandasDF_working_dataFrame.iloc[int_df_index-1, 3]
    # print("string >>> ", string_last_building_perpose_infos)
    for key, value in dictionary_title_building_perpose_dict.items():
        if key in string_last_building_perpose_infos:
            string_perpose_of_building = value
            break

    #각 건물 주소, 건축물 용도, 전유부분, 대지권, 대지권 특이사항
    return (string_building_location_info, 
            string_perpose_of_building,
            string_building_space,
            string_building_land_ratio,
            string_building_land_addtional_condition)
    

#
# string_first_registed_date = ""
# string_building_owner_name = ""
# string_additional_condition_of_1st = ""

def analysis1st(arg_df : pd.DataFrame) -> tuple:
    string_first_registed_date = "not_found"
    string_building_owner_name = "not_found"
    string_additional_condition_of_1st = "not_found"
    dictionary_1st_additional_data = {
        "압류" : "압류",
        "가압류" : "가압류",
        "강제 경매개시결정" : "강제 경매개시결정",
        "신탁" : "신탁"
    }

    if(arg_df.empty ==True) :
        return (string_first_registed_date, string_building_owner_name, string_additional_condition_of_1st)
    # string_file_path = folder_ident + "/" + pdf_ident + "_" + string_ident_file_id + "_" + string_ident_1st + string_ident_file_type
    pandasDF_working_dataFrame = arg_df

    int_dataFrame_index, int_dataFrame_columns = pandasDF_working_dataFrame.shape
    string_first_registed_date = pandasDF_working_dataFrame.iloc[0,2]

    last_registed_perpose = pandasDF_working_dataFrame.iloc[int_dataFrame_index-1, 1]
    for key, value in dictionary_1st_additional_data.items():
        if key in last_registed_perpose:
            #이거는 추가 사항이 하나인경우만 가정했으므로, 차후 수정이 필요해보임
            string_additional_condition_of_1st = value
            string_building_owner_name = pandasDF_working_dataFrame.ilocp[int_dataFrame_index-2, 4]
    # if(string_additional_condition_of_1st == ""):
    #     string_building_owner_name = pandasDF_working_dataFrame.iloc[int_dataFrame_index-1, 4]

###
    #"소유자 단어 찾기 및 실제 소유자 명만 추출"
    for i in range(int_dataFrame_index):
        st =pandasDF_working_dataFrame.iloc[i, int_dataFrame_columns -1]
        if("소유자" in st):
            parts = st.split()
            if "소유자" in parts:
                idx = parts.index("소유자")
                if idx + 1 < len(parts):
                    string_owenr_maybe = parts[idx + 1]

    if(string_additional_condition_of_1st == "not_found"):
        string_building_owner_name = pandasDF_working_dataFrame.iloc[int_dataFrame_index-1, 4]

    print("ower name maybe >>>>>> " ,string_owenr_maybe)
    print("ower long >>> ", string_building_owner_name)
    if string_owenr_maybe in string_building_owner_name:
        string_building_owner_name = string_owenr_maybe
####

    return (string_first_registed_date, string_building_owner_name, string_additional_condition_of_1st)


def analysis2nd(arg_df : pd.DataFrame) -> str:
    string_other_right = "not_found"
    if(arg_df.empty == True):
        return (string_other_right)
    else:
        string_other_right = "some_founded"
        return (string_other_right)
    



def risk_analysis_extract(arg_dict : dict, building_location_input : str) -> tuple:
    title_tuple = tuple()
    first_tuple = tuple()
    second_tuple = tuple()
    return_tuple = tuple()
    for key, running_df in arg_dict.items():
        if("title" in key):
            # if(running_df.empty == True):
            #     # empty df
            #     continue
            set_title_analysis = analysisTitle(running_df)
            title_tuple = set_title_analysis
            location_title, perpose_title, space_title, ratio_title, addtional_title = set_title_analysis

            #인자값으로 타이틀 튜플 갈아끼기
            title_tuple = (building_location_input, perpose_title, space_title, ratio_title, addtional_title)
            print(f"Location>>> {location_title}\nperpose>>> {perpose_title}\nSpace>>> {space_title}\nRatio>>> {ratio_title}\nAdditional >> {addtional_title}")
            
        elif("1st" in key):
            # if(running_df.empty == True):
            #     # empty df
            #     continue
            set_1st_analysis = analysis1st(running_df)
            first_tuple = set_1st_analysis
            first_registed_1st, owenr_1st, addtional_1st = set_1st_analysis
            print(f"First Registed Date >>> {first_registed_1st}\nOwner Name>>> {owenr_1st}\nAdditional>>> {addtional_1st}")
        elif("2nd" in key):
            # if(running_df.empty == True):
            #     # empty df
            #     continue
            second_other_right = analysis2nd(running_df)
            second_tuple = second_other_right
            print(f"Other Right >>> {second_other_right}")
        else:
            print("error in analysis")
            exit()
    return_tuple = (title_tuple, first_tuple, second_tuple)
    return return_tuple

    