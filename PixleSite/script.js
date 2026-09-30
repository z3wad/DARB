import {
    initializeFirebaseSession,
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    fetchSignInMethodsForEmail,
    sendEmailVerification,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut,
    getFirestore,
    doc,
    setDoc,
    onSnapshot,
} from './firebase.js';

const { auth, db, firebaseActive } = initializeFirebaseSession();

let currentUser = null;
let selectedDuration = 7;
let selectedBudget = 2;
let localStamps = { petra: true, wadirum: true, shobak: false };

function isValidEmailFormat(email) {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}

document.addEventListener('DOMContentLoaded', () => {
    const budgetSlider = document.getElementById('budget-slider');
    const budgetLabel = document.getElementById('budget-label');

    budgetSlider.addEventListener('input', (e) => {
        selectedBudget = parseInt(e.target.value, 10);
        if (selectedBudget === 1) budgetLabel.innerText = 'ميزانية اقتصادية';
        else if (selectedBudget === 2) budgetLabel.innerText = 'ميزانية متوسطة';
        else if (selectedBudget === 3) budgetLabel.innerText = 'ميزانية فاخرة';
    });

    document.getElementById('logo-btn').addEventListener('click', () => switchView('home'));
    document.getElementById('btn-save-plan').addEventListener('click', saveAndGeneratePlan);
    document.getElementById('btn-claim-stamp').addEventListener('click', claimGPSStamp);

    const modal = document.getElementById('auth-modal');
    document.getElementById('btn-login-trigger').addEventListener('click', () => openAuthModal(false));
    document.getElementById('close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('auth-email');
        const passInput = document.getElementById('auth-password');
        const emailError = document.getElementById('email-error');
        const passError = document.getElementById('pass-error');

        emailError.style.display = 'none';
        passError.style.display = 'none';

        const email = emailInput.value.trim();
        const password = passInput.value;

        if (!isValidEmailFormat(email)) {
            emailError.innerText = 'صيغة البريد الإلكتروني غير صحيحة!';
            emailError.style.display = 'block';
            return;
        }

        if (password.length < 6) {
            passError.style.display = 'block';
            return;
        }

        if (firebaseActive && auth) {
            try {
                const existingMethods = await fetchSignInMethodsForEmail(auth, email);

                if (existingMethods.length > 0) {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    const userCred = await createUserWithEmailAndPassword(auth, email, password);
                    await sendEmailVerification(userCred.user);
                    alert('تم إنشاء حساب جديد! تم إرسال رابط تأكيد إلى بريدك الإلكتروني للتحقق منه.');
                }
                modal.classList.remove('active');
            } catch (err) {
                if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    passError.innerText = 'كلمة المرور غير صحيحة!';
                    passError.style.display = 'block';
                } else if (err.code === 'auth/invalid-email') {
                    emailError.innerText = 'البريد الإلكتروني غير صحيح أو غير موجود!';
                    emailError.style.display = 'block';
                } else {
                    alert('حدث خطأ: ' + err.message);
                }
            }
        } else {
            setUserState(email.split('@')[0], true);
            modal.classList.remove('active');
        }
    });

    document.getElementById('btn-google-auth').addEventListener('click', () => {
        if (firebaseActive && auth) {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider)
                .then(() => modal.classList.remove('active'))
                .catch((err) => alert('خطأ في تسجيل Google: ' + err.message));
        } else {
            setUserState('مستخدم Google', true);
            modal.classList.remove('active');
        }
    });

    renderStamps(localStamps);
    renderItineraryUI({ duration: 7, budget: 2 });
});

if (firebaseActive && auth) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            setUserState(user.displayName || user.email || 'مستخدم', true);
            listenToUserData(user.uid);
        } else {
            currentUser = null;
            setUserState('زائر', false);
        }
    });
}

window.logoutUser = async function () {
    if (firebaseActive && auth) {
        await signOut(auth);
    }
    currentUser = null;
    setUserState('زائر', false);
    switchView('home');
};

function openAuthModal(triggeredByPlanner = false) {
    const modal = document.getElementById('auth-modal');
    const notice = document.getElementById('auth-notice');
    if (triggeredByPlanner) {
        notice.style.display = 'block';
    } else {
        notice.style.display = 'none';
    }
    modal.classList.add('active');
}

function setUserState(name, isLoggedIn) {
    document.getElementById('user-display-name').innerText = name;
    document.getElementById('profile-name').innerText = name;

    const loginBtn = document.getElementById('btn-login-trigger');
    const logoutBtn = document.getElementById('btn-logout');
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    const lockIcon = document.getElementById('btn-lock-icon');

    if (isLoggedIn) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        if (sidebarLogoutBtn) sidebarLogoutBtn.style.display = 'block';
        if (lockIcon) lockIcon.style.display = 'none';
    } else {
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        if (sidebarLogoutBtn) sidebarLogoutBtn.style.display = 'none';
        if (lockIcon) lockIcon.style.display = 'inline-block';
    }

    document.getElementById('sync-status').innerText = isLoggedIn
        ? (firebaseActive ? 'متصل بـ Firebase ✅' : 'حساب تجريبي محلي')
        : 'وضع العرض المحلي';
}

function listenToUserData(userId) {
    if (!db) return;
    const userRef = doc(db, 'users', userId);
    onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.stamps) renderStamps(data.stamps);
            if (data.currentPlan) renderItineraryUI(data.currentPlan);
        } else {
            setDoc(userRef, {
                stamps: { petra: true, wadirum: true, shobak: false },
                currentPlan: { duration: 7, budget: 2 },
            });
        }
    });
}

async function saveAndGeneratePlan() {
    if (!currentUser && document.getElementById('user-display-name').innerText === 'زائر') {
        openAuthModal(true);
        return;
    }

    const planData = {
        duration: selectedDuration,
        budget: selectedBudget,
        updatedAt: new Date().toISOString(),
    };

    if (firebaseActive && currentUser && db) {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, { currentPlan: planData }, { merge: true });
    }

    renderItineraryUI(planData);
    switchView('route');
}

async function claimGPSStamp() {
    if (!currentUser && document.getElementById('user-display-name').innerText === 'زائر') {
        openAuthModal(true);
        return;
    }

    localStamps.shobak = true;
    renderStamps(localStamps);

    if (firebaseActive && currentUser && db) {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, { stamps: { shobak: true } }, { merge: true });
    }

    alert('تهانينا! تم الحصول على ختم قلعة الشوبك بنجاح.');
}

function renderStamps(stamps) {
    const container = document.getElementById('stamps-container');
    container.innerHTML = `
        <div class="stamp-card stamp-petra ${stamps.petra ? '' : 'locked'}">
            <div class="stamp-icon"><i class="fa-solid fa-gem"></i></div>
            <div class="stamp-title">المدينة الوردية</div>
            <div class="stamp-loc">البتراء</div>
        </div>
        <div class="stamp-card stamp-wadirum ${stamps.wadirum ? '' : 'locked'}">
            <div class="stamp-icon"><i class="fa-solid fa-campground"></i></div>
            <div class="stamp-title">بدو الصحراء</div>
            <div class="stamp-loc">وادي رم</div>
        </div>
        <div class="stamp-card stamp-shobak ${stamps.shobak ? '' : 'locked'}">
            <div class="stamp-icon"><i class="fa-solid ${stamps.shobak ? 'fa-shield-halved' : 'fa-lock'}"></i></div>
            <div class="stamp-title">حارس البوابة</div>
            <div class="stamp-loc">قلعة الشوبك / جرش</div>
        </div>
    `;
}

function renderItineraryUI(plan) {
    const container = document.getElementById('itinerary-list');
    document.getElementById('route-subtitle').innerText = `${plan.duration || 7} أيام • مسار مخصص محفوظ`;

    container.innerHTML = `
        <div class="day-box">
            <div style="font-weight:900; color:var(--darb-red); font-size: 1.05rem;">اليوم ١: استكشاف البتراء والجواهر المجاورة</div>
            <div class="event-card"><strong>السيق البارد (Little Petra)</strong><br><span style="color:var(--text-muted);">زيارة هادئة بعيداً عن الاكتظاظ</span></div>
            <div class="event-card"><strong>عشاء ومطبخ محلي</strong><br><span style="color:var(--text-muted);">تجربة طعام تقليدية من إعداد أهل المنطقة</span></div>
        </div>
        <div class="day-box">
            <div style="font-weight:900; color:var(--darb-red); font-size: 1.05rem;">اليوم ٢: ليلة نجوم وادي رم</div>
            <div class="event-card"><strong>جولة سيارات الصحراء</strong><br><span style="color:var(--text-muted);">تتبع المسارات البدوية والتخييم الجبلي</span></div>
        </div>
    `;
}

window.switchView = function (viewName) {
    document.querySelectorAll('.view-section').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('nav a').forEach((a) => a.classList.remove('active'));
    document.getElementById('view-' + viewName).classList.add('active');
    if (document.getElementById('nav-' + viewName)) {
        document.getElementById('nav-' + viewName).classList.add('active');
    }
};

window.selectDuration = function (btn, days) {
    btn.parentElement.querySelectorAll('.option-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedDuration = days;
};

window.toggleTag = function (btn) {
    btn.classList.toggle('selected');
};
