// 로그인
async function login(email, password){
    return sb.auth.signInWithPassword({ email, password });
}

// 비밀번호 재설정 이메일 요청
async function requestPasswordReset(email, redirectTo){
    return sb.auth.resetPasswordForEmail(email, { redirectTo });
}

// 복구 세션에서 새 비밀번호 저장
async function updatePassword(newPassword){
    return sb.auth.updateUser({ password: newPassword });
}

// 로그아웃
async function logout(){
    return sb.auth.signOut();
}

// 현재 세션 조회
async function getSession(){
    return sb.auth.getSession();
}

// 현재 로그인 사용자 조회
async function getCurrentUser(){
    return sb.auth.getUser();
}

// 프로필 조회
async function getProfile(userId){
    return sb
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
}

// 관리자 승인 여부 조회
async function getAdminApproval(userId){
    return sb
        .from("is_admin")
        .select("isadmin")
        .eq("id", userId)
        .maybeSingle();
}

// 비로그인 상태에서 로그인 페이지로
async function requireLogin(){
    const { data:{ session }, error } = await getSession();

    if(error || !session){
        location.replace("index.html");
        return null;
    }

    return session.user;
}

// 승인된 일반회원 전용 페이지
async function requireUser(){
    const user = await requireLogin();
    if(!user) return null;

    if(typeof requireCurrentPolicyConsent === "function"){
        const consentReady = await requireCurrentPolicyConsent(user);
        if(!consentReady) return null;
    }

    const { data:profile, error } = await getProfile(user.id);

    if(
        error ||
        !profile ||
        profile.role !== "user" ||
        profile.user_approved !== true ||
        profile.approval_status !== "approved"
    ){
        await logout();
        location.replace("index.html");
        return null;
    }

    return { user, profile };
}

// 개발자가 승인한 관리자 전용 페이지
async function requireAdmin(){
    const user = await requireLogin();
    if(!user) return null;

    if(typeof requireCurrentPolicyConsent === "function"){
        const consentReady = await requireCurrentPolicyConsent(user);
        if(!consentReady) return null;
    }

    const { data:profile, error:profileError } = await getProfile(user.id);

    if(profileError || !profile || profile.role !== "admin"){
        await logout();
        location.replace("index.html");
        return null;
    }

    const { data:admin, error:adminError } = await getAdminApproval(user.id);

    if(adminError || !admin?.isadmin){
        await logout();
        location.replace("index.html");
        return null;
    }

    return { user, profile, admin };
}
