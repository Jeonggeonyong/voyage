import fitz  # PyMuPDF
import pandas as pd

def risk_anal_dataFrameParsing(scaned_df_dict : dict) -> dict:
    
  
    return_dict = {}

    pdf_ident = "check_register_test"

    pandasDF_register_title_df = pd.DataFrame()
    pandasDF_register_1st_df = pd.DataFrame()
    pandasDF_register_2nd_df = pd.DataFrame()

    string_table_type = ""
    string_now_working_type = ""

    def returnTableType(string_column_2 : str) -> str:
        #return "title", "1st", "2nd" , or "normal"
        if "표 제 부" in pandasDF_working_df.columns[0] or "건물의 표시" in pandasDF_working_df.columns[0]:
            #표제부의 시작인 부분
                
            return "title"
        elif "갑 구" in pandasDF_working_df.columns[0] or "소유권에 관한 사항" in pandasDF_working_df.columns[0]:
            #갑구의 시작인 부분

            return "1st"
        elif "을 구" in pandasDF_working_df.columns[0] or "소유권 이외의 권리에 관한 사항" in pandasDF_working_df.columns[0]:
            
            return "2nd"
        else:
            return "normal"


    for arg_key, arg_df in scaned_df_dict.items():
        # print("key >>>" , arg_key)

        pandasDF_working_df = arg_df

        string_table_type = returnTableType(pandasDF_working_df.columns[0])
        if string_table_type == "normal":
            # print("concat in normal")
            if(string_now_working_type == "title"):
                # print("concat")
                # if(pd.isna(pandasDF_working_df.iloc[0,0])):
                if(pandasDF_working_df.iloc[0,0] == ""):
                    int_working_dataframe_index_length, int_working_dataframe_column_length = pandasDF_working_df.shape
                    int_target_dataframe_index_length, int_target_dataframe_column_length = pandasDF_register_title_df.shape
                    # print(">>>>>>>>>>>>>>>>> ",int_working_dataframe_index_length, int_working_dataframe_column_length)
                    # print(">>>>>>>>>>>>>>>>> origin",int_target_dataframe_index_length, int_target_dataframe_column_length)
                    for int_copy_colum in range(int_working_dataframe_column_length):
                        # print(">>colum >>>>>", int_copy_colum)
                        if(not pd.isna(pandasDF_working_df.iloc[0,int_copy_colum])):
                            pandasDF_register_title_df.iloc[int_target_dataframe_index_length-1, int_copy_colum] = pandasDF_register_title_df.iloc[int_target_dataframe_index_length-1, int_copy_colum] \
                            + "\n" +pandasDF_working_df.iloc[0,int_copy_colum]
                    pandasDF_working_df = pandasDF_working_df.drop(0).reset_index(drop=True)
                    pandasDF_register_title_df = pd.concat([pandasDF_register_title_df,pandasDF_working_df], ignore_index=True)
                else:
                    pandasDF_register_title_df = pd.concat([pandasDF_register_title_df,pandasDF_working_df], ignore_index=True)
            elif(string_now_working_type == "1st"):
                pandasDF_register_1st_df = pd.concat([pandasDF_register_1st_df,pandasDF_working_df], ignore_index=True)
            elif(string_now_working_type == "2nd"):
                pandasDF_register_2nd_df = pd.concat([pandasDF_register_2nd_df,pandasDF_working_df], ignore_index=True)
            else:
                print("For normal Page, Working Type Error")
                exit()
        else:
            string_now_working_type = string_table_type
            pandasDF_working_df.columns = pandasDF_working_df.iloc[0]
            pandasDF_working_df = pandasDF_working_df.drop(0).reset_index(drop= True)
            if(string_now_working_type == "title"):
                pandasDF_register_title_df = pandasDF_working_df.copy()
            elif string_now_working_type == "1st":
                pandasDF_register_1st_df = pandasDF_working_df.copy()
            elif string_now_working_type == "2nd":
                pandasDF_register_2nd_df = pandasDF_working_df.copy()
            else: 
                print("Error Working Type")
                exit()

    # print("DF >> tiltle", pandasDF_register_title_df)
    # print("DF >> 1st", pandasDF_register_1st_df)
    # print("DF >> 2nd", pandasDF_register_2nd_df)

    return_dict[pdf_ident + "_" + "merged_title"] = pandasDF_register_title_df
    return_dict[pdf_ident + "_" + "merged_1st"] = pandasDF_register_1st_df
    return_dict[pdf_ident + "_" + "merged_2nd"] = pandasDF_register_2nd_df

    return return_dict

    # pandasDF_register_title_df.to_csv("./parsing_csv/" + pdf_ident + "_" + "merged_title.csv", index=False)
    # pandasDF_register_1st_df.to_csv("./parsing_csv/" + pdf_ident + "_" + "merged_1st.csv", index=False)
    # pandasDF_register_2nd_df.to_csv("./parsing_csv/" + pdf_ident + "_" + "merged_2nd.csv", index=False)

