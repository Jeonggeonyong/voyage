#input arg => tuples(tuple tuple tuple)
# 표제부-주소  / 일치 불일치
# 표제부-건물목적 / 일치 불일치

# 갑구-현소유주 //일치 불일치
# 갑구-소유권 => 문제 존재시, 압류, 가압류, 경매, 신탁

# 을구- 존재/비존재 // 보통 근저당권, 있으면 집주인이 빚이 있는거(근저당 있으면 보증금이 후순위 될 가능성 있음)
def threat_classify(input_tuple : tuple, input_location : str, input_perpose : str, input_owner_name : str) -> dict[str : str]:
    #인자, 이전 단계에서 분석한 3개의 튜플을 가진 튜블
    #사용자가 전송한 주소, 목적, 소유주에 해당하는 입력값 문자열
    #반환값 : 정리된 딕셔너린
    
    #반환 딕셔너리의 키값 ==> 문제의 목록 / 키가 존재 == 문제가 있음
    #반환 딕셔너리의 밸류값 -=> 상세정보
    
    #second tuple ==> not tuple, just str
    t_list = []
    f_list = []
    s_list = []

    #########3

    title_tuple, first_tuple, second_tuple = input_tuple
    t_location, t_perpose, t_space, t_space_ratio, t_space_more = title_tuple
    f_first_date, f_owner_name, f_more = first_tuple
    s_more = second_tuple

#표제부

    # 표제부, 주소불일치
    if(t_location != input_location):
        t_list.append(1)
    
    #표제부, 건물목적불일치
    if(t_perpose != input_perpose):
        t_list.append(2)        

    if(t_space == "not_found" or t_space_ratio == "not_found" or t_space_more == "not_found"):
        #대지권 미등기
        t_list.append(3)

    #갑구, 소유주불일치
    if(f_owner_name != input_owner_name):
        f_list.append(4)

#########
#갑구

    #갑구, 소유권 문제
    if(f_more != "not_found"):
        #일단 가라코드, 5 ~~ 8번까지 각, 가처분, 압류/가압류, 경매, 신탁
        f_list.append(5)


#############
#을구 

    #을구, 뭔가 있음
    if(s_more != "not_found"):
        #해당 값은 임의 값, db페이지 맨아래참조
        s_list.append(9)
    
    return (t_list, f_list, s_list)

