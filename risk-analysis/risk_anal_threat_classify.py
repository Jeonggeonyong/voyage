#input arg => tuples(tuple tuple tuple)
# 표제부-주소  / 일치 불일치
# 표제부-건물목적 / 일치 불일치

# 갑구-현소유주 //일치 불일치
# 갑구-소유권 => 문제 존재시, 압류, 가압류, 경매, 신탁

# 을구- 존재/비존재 // 보통 근저당권, 있으면 집주인이 빚이 있는거(근저당 있으면 보증금이 후순위 될 가능성 있음)

def riskevalCorrectness(location_tuple : tuple, perpose_tuple : tuple, owner_tuple : tuple, input_dict : dict):
    
    if(location_tuple[0] != location_tuple[1]):
        input_dict["건물주소"] = "불일치"
    if(perpose_tuple[0] != perpose_tuple[1]):
        input_dict["건물목적"] = "불일치"
    if(owner_tuple[0] != owner_tuple[1]):
        input_dict["소유주"] = "불일치"

    return

def riskevalOwnership(ownership_more, dic : dict):
    if(ownership_more != " not_found"):
        dic["소유권"] = ownership_more       
        return
    else:
        return 

def riskevalSecond(second_data, dic : dict):
    if(second_data != "not_found"):
        dic["소유권이외권리"] = "문제존재"
        return
    else:
        return


def threat_classify(input_tuple : tuple, input_location : str, input_perpose : str, input_owner_name : str) -> dict[str : str]:
    #인자, 이전 단계에서 분석한 3개의 튜플을 가진 튜블
    #사용자가 전송한 주소, 목적, 소유주에 해당하는 입력값 문자열
    #반환값 : 정리된 딕셔너린
    
    #반환 딕셔너리의 키값 ==> 문제의 목록 / 키가 존재 == 문제가 있음
    #반환 딕셔너리의 밸류값 -=> 상세정보
    
    #second tuple ==> not tuple, just str

    title_tuple, first_tuple, second_tuple = input_tuple
    t_location, t_perpose, t_space, t_space_ratio, t_space_more = title_tuple
    f_first_date, f_owner_name, f_more = first_tuple
    s_more = second_tuple

    return_dict = dict()
    location_tuple = (t_location, input_location)
    perpose_tuple = (t_perpose, input_perpose)
    owner_tuple = (f_owner_name, input_owner_name)


    riskevalCorrectness(location_tuple, perpose_tuple, owner_tuple, return_dict)
    riskevalOwnership(f_more, return_dict)
    riskevalSecond(s_more, return_dict)

    return return_dict

