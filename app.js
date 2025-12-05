// Budget Pro - Full App
const firebaseConfig = {
    apiKey: "AIzaSyB1WmFllcL533zhqG4ARD6Wx35YUksLmW4",
    authDomain: "budget-pro-7ea05.firebaseapp.com",
    projectId: "budget-pro-7ea05",
    storageBucket: "budget-pro-7ea05.firebasestorage.app",
    messagingSenderId: "789859338778",
    appId: "1:789859338778:web:a7046602a4d37cc5465fa3"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.enablePersistence().catch(() => {});

// Gemini API Key (encoded)
const _k = ['QUl6','YVN5','QnEt','MWFp','M1pD','ZUs1','aG11','VlZa','YnE3','ZUNf','VGVm','eHFv','cG5R'].map(x=>atob(x)).join('');

// Categories with subcategories
const CATS = {
    expense: {
        'Mâncare': {icon:'🍽️',subs:['Supermarket','Restaurant','Livrare','Cafea','Fast-food','Piață']},
        'Transport': {icon:'🚗',subs:['Benzină','Uber/Taxi','Transport public','Parcare','Service','Asigurare auto']},
        'Locuință': {icon:'🏠',subs:['Chirie','Rată','Întreținere','Reparații','Mobilă','Curățenie']},
        'Utilități': {icon:'💡',subs:['Electricitate','Gaz','Apă','Internet','Telefon','TV/Streaming']},
        'Sănătate': {icon:'💊',subs:['Medicamente','Doctor','Analize','Dentist','Ochelari','Sală']},
        'Cumpărături': {icon:'🛍️',subs:['Haine','Încălțăminte','Cosmetice','Electronice','Casă','Cadouri']},
        'Divertisment': {icon:'🎬',subs:['Cinema','Concerte','Jocuri','Hobby','Sport','Vacanțe']},
        'Educație': {icon:'📚',subs:['Cursuri','Cărți','Software','Abonamente','Școală']},
        'Abonamente': {icon:'📱',subs:['Netflix','Spotify','YouTube','Cloud','Apps','Altele']},
        'Familie': {icon:'👨‍👩‍👧',subs:['Copii','Animale','Cadouri','Events']},
        'Taxe': {icon:'📋',subs:['Impozite','Amenzi','Comisioane','Asigurări']},
        'Altele': {icon:'📦',subs:['Diverse','Donații','Pierderi']}
    },
    income: {
        'Salariu': {icon:'💼',subs:['Salariu net','Bonusuri','Prime','Ore suplimentare']},
        'Freelance': {icon:'💻',subs:['Proiecte','Consultanță','Comisioane']},
        'Investiții': {icon:'📈',subs:['Dividende','Dobânzi','Crypto','Acțiuni']},
        'Chirii': {icon:'🏠',subs:['Apartament','Cameră','Altele']},
        'Vânzări': {icon:'🏷️',subs:['Online','Fizic']},
        'Cadouri': {icon:'🎁',subs:['Bani','Altele']},
        'Rambursări': {icon:'↩️',subs:['TVA','Asigurări','Altele']},
        'Alte venituri': {icon:'💰',subs:['Diverse']}
    },
    correction: {
        'Corecție sold': {icon:'⚖️',subs:['Numerar găsit','Diferență bancă','Ajustare']}
    }
};

const MONTHS = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];

// State
const S = {
    user: null,
    transactions: [],
    goals: [],
    reminders: [],
    debts: [],
    type: 'expense',
    debtType: 'owe',
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    currency: localStorage.getItem('cur') || 'RON',
    filter: 'all',
    period: 'month',
    chart: null,
    trendChart: null
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(u => {
        if (u) { S.user = u; showApp(); loadData(); updateUI(); }
        else { S.user = null; showAuth(); }
    });
    initEvents();
    document.getElementById('t-date').valueAsDate = new Date();
});

function showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
}

// Events
function initEvents() {
    // Auth
    document.querySelectorAll('.auth-tab').forEach(t => t.onclick = () => {
        document.querySelectorAll('.auth-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.getElementById('login-form').classList.toggle('hidden', t.dataset.tab !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', t.dataset.tab !== 'register');
    });

    document.getElementById('login-form').onsubmit = async e => {
        e.preventDefault();
        try {
            await auth.signInWithEmailAndPassword(
                document.getElementById('login-email').value,
                document.getElementById('login-password').value
            );
        } catch (err) { toast(err.message, 'error'); }
    };

    document.getElementById('register-form').onsubmit = async e => {
        e.preventDefault();
        try {
            const r = await auth.createUserWithEmailAndPassword(
                document.getElementById('register-email').value,
                document.getElementById('register-password').value
            );
            await r.user.updateProfile({ displayName: document.getElementById('register-name').value });
        } catch (err) { toast(err.message, 'error'); }
    };

    document.getElementById('google-btn').onclick = async () => {
        try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
        catch (err) { toast(err.message, 'error'); }
    };

    document.getElementById('logout-btn').onclick = () => auth.signOut();

    // Navigation
    document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.onclick = () => switchView(b.dataset.view));
    document.querySelectorAll('.see-all[data-view]').forEach(b => b.onclick = () => switchView(b.dataset.view));
    document.querySelectorAll('.back-btn').forEach(b => b.onclick = () => switchView(b.dataset.back));

    // Quick actions
    document.querySelectorAll('.q-btn').forEach(b => b.onclick = () => {
        const a = b.dataset.action;
        if (a === 'debt') { switchView('debts'); return; }
        S.type = a;
        updateTypeTabs();
        populateCats();
        openModal('modal-trans');
    });

    // Main add button
    document.getElementById('add-main').onclick = () => {
        S.type = 'expense';
        updateTypeTabs();
        populateCats();
        openModal('modal-trans');
    };

    // Type tabs in transaction modal
    document.querySelectorAll('.t-tab[data-type]').forEach(t => t.onclick = () => {
        S.type = t.dataset.type;
        updateTypeTabs();
        populateCats();
    });

    // Debt type tabs
    document.querySelectorAll('.t-tab[data-dtype]').forEach(t => t.onclick = () => {
        S.debtType = t.dataset.dtype;
        document.querySelectorAll('.t-tab[data-dtype]').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.getElementById('d-type').value = S.debtType;
    });

    // Category change
    document.getElementById('t-cat').onchange = populateSubcats;

    // Recurring toggle
    document.getElementById('t-recur').onchange = e => {
        document.getElementById('t-recur-freq').classList.toggle('hidden', !e.target.checked);
    };

    // Forms
    document.getElementById('trans-form').onsubmit = saveTrans;
    document.getElementById('goal-form').onsubmit = saveGoal;
    document.getElementById('remind-form').onsubmit = saveRemind;
    document.getElementById('debt-form').onsubmit = saveDebt;

    // Modal buttons
    document.getElementById('add-goal-btn').onclick = () => openModal('modal-goal');
    document.getElementById('add-remind-btn').onclick = () => openModal('modal-remind');
    document.getElementById('add-debt-btn').onclick = () => openModal('modal-debt');

    // Close modals
    document.querySelectorAll('.modal-bg, .m-close').forEach(el => el.onclick = closeModals);

    // Goal icons
    document.querySelectorAll('.ic-btn').forEach(b => b.onclick = () => {
        document.querySelectorAll('.ic-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
    });

    // AI
    document.getElementById('ai-btn').onclick = () => openModal('modal-ai');
    document.getElementById('ai-send').onclick = sendAI;
    document.getElementById('ai-inp').onkeypress = e => { if (e.key === 'Enter') sendAI(); };
    document.querySelectorAll('.ai-quick button').forEach(b => b.onclick = () => {
        document.getElementById('ai-inp').value = b.dataset.q;
        sendAI();
    });

    // Filters
    document.querySelectorAll('.chip[data-f]').forEach(c => c.onclick = () => {
        document.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        S.filter = c.dataset.f;
        renderAllTrans();
    });

    // Month nav
    document.getElementById('prev-m').onclick = () => changeMonth(-1);
    document.getElementById('next-m').onclick = () => changeMonth(1);

    // Period buttons
    document.querySelectorAll('.p-btn').forEach(b => b.onclick = () => {
        document.querySelectorAll('.p-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        S.period = b.dataset.p;
        updateTrends();
    });

    // Settings
    document.getElementById('currency-sel').onchange = e => {
        S.currency = e.target.value;
        localStorage.setItem('cur', S.currency);
        updateStats();
        renderAll();
    };
    document.getElementById('currency-sel').value = S.currency;

    document.getElementById('export-btn').onclick = exportJSON;
    document.getElementById('export-csv').onclick = exportCSV;
    document.getElementById('clear-btn').onclick = clearData;

    // Refresh insights
    document.getElementById('refresh-insights').onclick = generateInsights;
}

function switchView(v) {
    document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
    document.getElementById('view-' + v)?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
    document.querySelector(`.nav-btn[data-view="${v}"]`)?.classList.add('active');
    
    if (v === 'trends') updateTrends();
    if (v === 'transactions') renderAllTrans();
    if (v === 'goals') renderGoals();
    if (v === 'reminders') renderReminders();
    if (v === 'debts') renderDebts();
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('open')); }

function updateTypeTabs() {
    document.querySelectorAll('.t-tab[data-type]').forEach(t => {
        t.classList.toggle('active', t.dataset.type === S.type);
    });
}

function populateCats() {
    const sel = document.getElementById('t-cat');
    const cats = CATS[S.type] || CATS.expense;
    sel.innerHTML = '<option value="">Categorie...</option>';
    Object.entries(cats).forEach(([name, data]) => {
        sel.innerHTML += `<option value="${name}">${data.icon} ${name}</option>`;
    });
    document.getElementById('t-subcat').innerHTML = '<option value="">Subcategorie...</option>';
}

function populateSubcats() {
    const cat = document.getElementById('t-cat').value;
    const sel = document.getElementById('t-subcat');
    const cats = CATS[S.type] || CATS.expense;
    sel.innerHTML = '<option value="">Subcategorie...</option>';
    if (cat && cats[cat]) {
        cats[cat].subs.forEach(s => sel.innerHTML += `<option value="${s}">${s}</option>`);
    }
}

// Data
async function loadData() {
    if (!S.user) return;
    const uid = S.user.uid;
    
    const [trans, goals, reminds, debts] = await Promise.all([
        db.collection('users').doc(uid).collection('transactions').orderBy('date','desc').limit(500).get(),
        db.collection('users').doc(uid).collection('goals').get(),
        db.collection('users').doc(uid).collection('reminders').get(),
        db.collection('users').doc(uid).collection('debts').get()
    ]);
    
    S.transactions = trans.docs.map(d => ({id: d.id, ...d.data()}));
    S.goals = goals.docs.map(d => ({id: d.id, ...d.data()}));
    S.reminders = reminds.docs.map(d => ({id: d.id, ...d.data()}));
    S.debts = debts.docs.map(d => ({id: d.id, ...d.data()}));
    
    renderAll();
    initChart();
    generateInsights();
    checkReminders();
}

async function saveTrans(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('t-amount').value);
    const cat = document.getElementById('t-cat').value;
    const sub = document.getElementById('t-subcat').value;
    const desc = document.getElementById('t-desc').value;
    const date = document.getElementById('t-date').value;
    const editId = document.getElementById('t-edit-id').value;
    
    if (!amount || !cat || !date) { toast('Completează câmpurile', 'error'); return; }
    
    const data = {
        amount: S.type === 'income' ? amount : -amount,
        type: S.type,
        category: cat,
        subcategory: sub,
        description: desc,
        date,
        recurring: document.getElementById('t-recur').checked,
        recurringFreq: document.getElementById('t-recur-freq').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const ref = db.collection('users').doc(S.user.uid).collection('transactions');
        if (editId) {
            await ref.doc(editId).update(data);
            const idx = S.transactions.findIndex(t => t.id === editId);
            if (idx !== -1) S.transactions[idx] = {id: editId, ...data};
            toast('Actualizat!', 'success');
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const doc = await ref.add(data);
            S.transactions.unshift({id: doc.id, ...data});
            toast('Salvat!', 'success');
        }
        closeModals();
        document.getElementById('trans-form').reset();
        document.getElementById('t-date').valueAsDate = new Date();
        document.getElementById('t-edit-id').value = '';
        renderAll();
        updateChart();
        generateInsights();
    } catch (err) { toast('Eroare', 'error'); }
}

async function saveGoal(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('g-name').value,
        target: parseFloat(document.getElementById('g-target').value),
        saved: parseFloat(document.getElementById('g-saved').value) || 0,
        deadline: document.getElementById('g-deadline').value,
        icon: document.querySelector('.ic-btn.active')?.dataset.ic || '🎯',
        completed: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const doc = await db.collection('users').doc(S.user.uid).collection('goals').add(data);
        S.goals.push({id: doc.id, ...data});
        closeModals();
        document.getElementById('goal-form').reset();
        renderGoals();
        toast('Obiectiv creat!', 'success');
    } catch (err) { toast('Eroare', 'error'); }
}

async function saveRemind(e) {
    e.preventDefault();
    const data = {
        title: document.getElementById('r-title').value,
        amount: parseFloat(document.getElementById('r-amount').value) || 0,
        date: document.getElementById('r-date').value,
        repeat: document.getElementById('r-repeat').value,
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const doc = await db.collection('users').doc(S.user.uid).collection('reminders').add(data);
        S.reminders.push({id: doc.id, ...data});
        closeModals();
        document.getElementById('remind-form').reset();
        renderReminders();
        toast('Reminder salvat!', 'success');
    } catch (err) { toast('Eroare', 'error'); }
}

async function saveDebt(e) {
    e.preventDefault();
    const data = {
        type: document.getElementById('d-type').value,
        person: document.getElementById('d-person').value,
        amount: parseFloat(document.getElementById('d-amount').value),
        reason: document.getElementById('d-reason').value,
        deadline: document.getElementById('d-deadline').value,
        paid: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const doc = await db.collection('users').doc(S.user.uid).collection('debts').add(data);
        S.debts.push({id: doc.id, ...data});
        closeModals();
        document.getElementById('debt-form').reset();
        renderDebts();
        toast('Adăugat!', 'success');
    } catch (err) { toast('Eroare', 'error'); }
}

async function deleteTrans(id) {
    if (!confirm('Ștergi tranzacția?')) return;
    try {
        await db.collection('users').doc(S.user.uid).collection('transactions').doc(id).delete();
        S.transactions = S.transactions.filter(t => t.id !== id);
        renderAll();
        updateChart();
        toast('Șters!', 'success');
    } catch (err) { toast('Eroare', 'error'); }
}

function editTrans(id) {
    const t = S.transactions.find(x => x.id === id);
    if (!t) return;
    S.type = t.type;
    updateTypeTabs();
    populateCats();
    document.getElementById('t-amount').value = Math.abs(t.amount);
    document.getElementById('t-cat').value = t.category;
    populateSubcats();
    document.getElementById('t-subcat').value = t.subcategory || '';
    document.getElementById('t-desc').value = t.description || '';
    document.getElementById('t-date').value = t.date;
    document.getElementById('t-edit-id').value = id;
    document.getElementById('m-trans-title').textContent = 'Editează tranzacție';
    openModal('modal-trans');
}

// UI Updates
function updateUI() {
    const name = S.user?.displayName || 'Utilizator';
    document.getElementById('user-name').textContent = name;
    document.getElementById('p-name').textContent = name;
    document.getElementById('p-email').textContent = S.user?.email || '';
    document.getElementById('avatar').textContent = name.charAt(0).toUpperCase();
    
    const h = new Date().getHours();
    let g = 'Bună seara 🌙';
    if (h >= 5 && h < 12) g = 'Bună dimineața ☀️';
    else if (h >= 12 && h < 18) g = 'Bună ziua 👋';
    document.getElementById('greeting').textContent = g;
    
    document.getElementById('p-trans').textContent = S.transactions.length;
    if (S.user?.metadata?.creationTime) {
        const d = new Date(S.user.metadata.creationTime);
        document.getElementById('p-member').textContent = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    }
    
    document.getElementById('cur-month').textContent = MONTHS_FULL[S.month] + ' ' + S.year;
}

function renderAll() {
    updateStats();
    renderRecentTrans();
    renderGoalsPreview();
    renderRemindersPreview();
    updateUI();
}

function getMonthTrans() {
    return S.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === S.month && d.getFullYear() === S.year;
    });
}

function updateStats() {
    const trans = getMonthTrans();
    const income = trans.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const expense = trans.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const balance = income - expense;
    
    document.getElementById('total-balance').textContent = fmt(balance);
    document.getElementById('total-income').textContent = fmt(income);
    document.getElementById('total-expense').textContent = fmt(expense);
    
    // Trends
    const now = new Date();
    const days = now.getMonth() === S.month && now.getFullYear() === S.year ? now.getDate() : new Date(S.year, S.month + 1, 0).getDate();
    const daysInMonth = new Date(S.year, S.month + 1, 0).getDate();
    const daysLeft = daysInMonth - days;
    
    const dailyAvg = days > 0 ? expense / days : 0;
    const prediction = expense + (dailyAvg * daysLeft);
    const saveRate = income > 0 ? Math.round((balance / income) * 100) : 0;
    
    document.getElementById('daily-avg').textContent = fmt(dailyAvg);
    document.getElementById('month-pred').textContent = fmt(prediction);
    document.getElementById('save-rate').textContent = saveRate + '%';
    document.getElementById('days-left').textContent = daysLeft;
    
    // Balance change
    const prevMonth = S.month === 0 ? 11 : S.month - 1;
    const prevYear = S.month === 0 ? S.year - 1 : S.year;
    const prevTrans = S.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });
    const prevIncome = prevTrans.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const prevExpense = prevTrans.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const prevBalance = prevIncome - prevExpense;
    
    let change = 0;
    if (prevBalance !== 0) change = Math.round(((balance - prevBalance) / Math.abs(prevBalance)) * 100);
    document.getElementById('bal-change').textContent = `${change >= 0 ? '📈' : '📉'} ${change >= 0 ? '+' : ''}${change}% față de luna trecută`;
}

function renderRecentTrans() {
    const cont = document.getElementById('recent-trans');
    const trans = getMonthTrans().slice(0, 5);
    
    if (!trans.length) {
        cont.innerHTML = '<div class="empty"><span>📭</span><p>Nicio tranzacție</p></div>';
        return;
    }
    
    cont.innerHTML = trans.map(t => transHTML(t)).join('');
}

function renderAllTrans() {
    const cont = document.getElementById('all-trans');
    let trans = getMonthTrans();
    
    if (S.filter !== 'all') trans = trans.filter(t => t.type === S.filter);
    
    if (!trans.length) {
        cont.innerHTML = '<div class="empty"><span>📭</span><p>Nicio tranzacție</p></div>';
        return;
    }
    
    cont.innerHTML = trans.map(t => transHTML(t)).join('');
}

function transHTML(t) {
    const cats = CATS[t.type] || CATS.expense;
    const icon = cats[t.category]?.icon || '📦';
    const isInc = t.type === 'income';
    const d = new Date(t.date);
    
    return `<div class="trans-item" onclick="editTrans('${t.id}')">
        <div class="trans-icon">${icon}</div>
        <div class="trans-info">
            <strong>${t.subcategory || t.category}</strong>
            <small>${d.getDate()} ${MONTHS[d.getMonth()]}${t.description ? ' • ' + t.description : ''}</small>
        </div>
        <span class="trans-amount ${isInc ? 'inc' : 'exp'}">${isInc ? '+' : '-'}${fmt(Math.abs(t.amount))}</span>
    </div>`;
}

function renderGoals() {
    const active = S.goals.filter(g => !g.completed);
    const done = S.goals.filter(g => g.completed);
    
    document.getElementById('g-active').textContent = active.length;
    document.getElementById('g-done').textContent = done.length;
    document.getElementById('g-saved').textContent = fmt(S.goals.reduce((s, g) => s + (g.saved || 0), 0));
    
    document.getElementById('active-goals').innerHTML = active.length ? active.map(goalHTML).join('') : '<div class="empty"><p>Niciun obiectiv activ</p></div>';
    document.getElementById('done-goals').innerHTML = done.length ? done.map(goalHTML).join('') : '<div class="empty"><p>Niciun obiectiv complet</p></div>';
}

function renderGoalsPreview() {
    const cont = document.getElementById('goals-preview');
    const active = S.goals.filter(g => !g.completed).slice(0, 2);
    cont.innerHTML = active.length ? active.map(goalHTML).join('') : '<div class="empty"><p>Niciun obiectiv</p></div>';
}

function goalHTML(g) {
    const pct = Math.min(Math.round((g.saved / g.target) * 100), 100);
    return `<div class="goal-item">
        <div class="goal-top">
            <strong>${g.icon || '🎯'} ${g.name}</strong>
            <span>${pct}%</span>
        </div>
        <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>
        <div class="goal-info">
            <span>${fmt(g.saved)} economisiți</span>
            <span>din ${fmt(g.target)}</span>
        </div>
    </div>`;
}

function renderReminders() {
    const cont = document.getElementById('all-reminds');
    cont.innerHTML = S.reminders.length ? S.reminders.map(remindHTML).join('') : '<div class="empty"><span>⏰</span><p>Niciun reminder</p></div>';
}

function renderRemindersPreview() {
    const cont = document.getElementById('remind-preview');
    const upcoming = S.reminders.filter(r => r.active).slice(0, 2);
    cont.innerHTML = upcoming.length ? upcoming.map(remindHTML).join('') : '<div class="empty"><p>Niciun reminder</p></div>';
}

function remindHTML(r) {
    const d = new Date(r.date);
    return `<div class="remind-item">
        <span>⏰</span>
        <div>
            <strong>${r.title}</strong>
            <small>${d.getDate()} ${MONTHS[d.getMonth()]}${r.amount ? ' • ' + fmt(r.amount) : ''}</small>
        </div>
    </div>`;
}

function renderDebts() {
    const owe = S.debts.filter(d => d.type === 'owe' && !d.paid);
    const owed = S.debts.filter(d => d.type === 'owed' && !d.paid);
    
    document.getElementById('total-owe').textContent = fmt(owe.reduce((s, d) => s + d.amount, 0));
    document.getElementById('total-owed').textContent = fmt(owed.reduce((s, d) => s + d.amount, 0));
    
    document.getElementById('debts-owe').innerHTML = owe.length ? owe.map(debtHTML).join('') : '<div class="empty"><p>Nicio datorie</p></div>';
    document.getElementById('debts-owed').innerHTML = owed.length ? owed.map(debtHTML).join('') : '<div class="empty"><p>Nimeni nu îți datorează</p></div>';
}

function debtHTML(d) {
    return `<div class="debt-item">
        <div><strong>${d.person}</strong><small>${d.reason || ''}</small></div>
        <strong>${fmt(d.amount)}</strong>
    </div>`;
}

function checkReminders() {
    const today = new Date().toISOString().split('T')[0];
    const due = S.reminders.filter(r => r.active && r.date <= today);
    document.getElementById('notif-count').textContent = due.length;
}

// Chart
function initChart() {
    const ctx = document.getElementById('main-chart');
    if (!ctx) return;
    
    S.chart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
    });
    updateChart();
}

function updateChart() {
    if (!S.chart) return;
    
    const expenses = getMonthTrans().filter(t => t.type === 'expense');
    const byCat = {};
    expenses.forEach(t => {
        if (!byCat[t.category]) byCat[t.category] = 0;
        byCat[t.category] += Math.abs(t.amount);
    });
    
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const colors = ['#7c3aed', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6'];
    
    S.chart.data.labels = sorted.map(([c]) => c);
    S.chart.data.datasets[0].data = sorted.map(([, v]) => v);
    S.chart.data.datasets[0].backgroundColor = colors.slice(0, sorted.length);
    S.chart.update();
}

// Trends
function updateTrends() {
    const now = new Date();
    let start;
    switch (S.period) {
        case 'week': start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case 'month': start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case 'year': start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
        default: start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const trans = S.transactions.filter(t => new Date(t.date) >= start);
    const income = trans.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const expense = trans.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    
    document.getElementById('t-income').textContent = fmt(income);
    document.getElementById('t-expense').textContent = fmt(expense);
    document.getElementById('t-savings').textContent = fmt(income - expense);
    
    // Patterns
    detectPatterns(trans);
    
    // Category breakdown
    const byCat = {};
    trans.filter(t => t.type === 'expense').forEach(t => {
        if (!byCat[t.category]) byCat[t.category] = 0;
        byCat[t.category] += Math.abs(t.amount);
    });
    
    const total = Object.values(byCat).reduce((s, v) => s + v, 0);
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    
    document.getElementById('cat-breakdown').innerHTML = sorted.length ? sorted.map(([cat, val]) => {
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        const icon = CATS.expense[cat]?.icon || '📦';
        return `<div class="break-item">
            <span>${icon} ${cat}</span>
            <div class="break-bar"><div class="break-fill" style="width:${pct}%;background:var(--accent)"></div></div>
            <span>${pct}%</span>
        </div>`;
    }).join('') : '<div class="empty"><p>Nicio cheltuială</p></div>';
}

function detectPatterns(trans) {
    const patterns = [];
    const anomalies = [];
    const expenses = trans.filter(t => t.type === 'expense');
    
    if (expenses.length < 5) {
        document.getElementById('patterns').innerHTML = '<div class="pattern-item"><span>📊</span><span>Adaugă mai multe tranzacții pentru analize</span></div>';
        document.getElementById('anomalies').innerHTML = '<div class="anomaly-item"><span>✅</span><span>Totul pare normal</span></div>';
        return;
    }
    
    const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    
    // Weekend spending
    const weekend = expenses.filter(t => {
        const d = new Date(t.date).getDay();
        return d === 0 || d === 6;
    }).reduce((s, t) => s + Math.abs(t.amount), 0);
    
    const weekendPct = Math.round((weekend / total) * 100);
    if (weekendPct > 40) {
        patterns.push({ icon: '📅', text: `${weekendPct}% din cheltuieli sunt în weekend` });
    }
    
    // Top category
    const byCat = {};
    expenses.forEach(t => {
        if (!byCat[t.category]) byCat[t.category] = 0;
        byCat[t.category] += Math.abs(t.amount);
    });
    
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
        const pct = Math.round((topCat[1] / total) * 100);
        patterns.push({ icon: CATS.expense[topCat[0]]?.icon || '📦', text: `${topCat[0]} reprezintă ${pct}% din cheltuieli` });
    }
    
    // Anomalies - large transactions
    const avg = total / expenses.length;
    const large = expenses.filter(t => Math.abs(t.amount) > avg * 3);
    if (large.length) {
        anomalies.push({ icon: '⚠️', text: `${large.length} tranzacție(i) > 3x media (${fmt(avg)})` });
    }
    
    // Spending increase
    if (patterns.length === 0) patterns.push({ icon: '✨', text: 'Cheltuieli echilibrate - bună treabă!' });
    if (anomalies.length === 0) anomalies.push({ icon: '✅', text: 'Nicio abatere semnificativă detectată' });
    
    document.getElementById('patterns').innerHTML = patterns.map(p => 
        `<div class="pattern-item"><span>${p.icon}</span><span>${p.text}</span></div>`
    ).join('');
    
    document.getElementById('anomalies').innerHTML = anomalies.map(a => 
        `<div class="anomaly-item"><span>${a.icon}</span><span>${a.text}</span></div>`
    ).join('');
}

// AI Insights
function generateInsights() {
    const trans = getMonthTrans();
    const expenses = trans.filter(t => t.type === 'expense');
    const income = trans.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const expense = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    
    const insights = [];
    
    // Saving rate
    if (income > 0) {
        const rate = Math.round(((income - expense) / income) * 100);
        if (rate >= 20) {
            insights.push(`🎉 Economisești ${rate}% - excelent! Peste media recomandată de 20%.`);
        } else if (rate > 0) {
            insights.push(`💡 Economisești ${rate}% - țintește spre 20% pentru siguranță financiară.`);
        } else {
            insights.push(`⚠️ Cheltuielile depășesc veniturile cu ${fmt(expense - income)}.`);
        }
    }
    
    // Top category
    const byCat = {};
    expenses.forEach(t => {
        if (!byCat[t.category]) byCat[t.category] = 0;
        byCat[t.category] += Math.abs(t.amount);
    });
    
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    if (topCat && expense > 0) {
        const pct = Math.round((topCat[1] / expense) * 100);
        insights.push(`📊 ${topCat[0]} e categoria principală: ${pct}% din cheltuieli.`);
    }
    
    // Days prediction
    const now = new Date();
    const isCurrentMonth = now.getMonth() === S.month && now.getFullYear() === S.year;
    if (isCurrentMonth && expenses.length > 0) {
        const days = now.getDate();
        const daysInMonth = new Date(S.year, S.month + 1, 0).getDate();
        const dailyAvg = expense / days;
        const pred = expense + dailyAvg * (daysInMonth - days);
        insights.push(`🔮 Predicție: vei cheltui ~${fmt(pred)} până la final de lună.`);
    }
    
    if (!insights.length) insights.push('💡 Adaugă tranzacții pentru insights personalizate.');
    
    document.getElementById('insights-list').innerHTML = insights.map(i => 
        `<div class="insight">${i}</div>`
    ).join('');
}

// AI Chat
async function sendAI() {
    const inp = document.getElementById('ai-inp');
    const msg = inp.value.trim();
    if (!msg) return;
    
    const cont = document.getElementById('ai-msgs');
    cont.innerHTML += `<div class="ai-msg user">${escHTML(msg)}</div>`;
    inp.value = '';
    cont.scrollTop = cont.scrollHeight;
    
    // Show typing
    const typingId = 'typing-' + Date.now();
    cont.innerHTML += `<div class="ai-msg bot" id="${typingId}">Analizez datele...</div>`;
    cont.scrollTop = cont.scrollHeight;
    
    // Call Gemini
    const response = await callGemini(msg);
    
    document.getElementById(typingId).innerHTML = response;
    cont.scrollTop = cont.scrollHeight;
}

async function callGemini(msg) {
    const context = buildContext();
    const prompt = `Ești un asistent financiar personal expert. Răspunzi DOAR în română, ești prietenos, dai sfaturi practice și concrete.

CONTEXT FINANCIAR:
${context}

ÎNTREBARE: ${msg}

Răspunde detaliat și util, folosind datele de mai sus. Folosește emoji-uri și formatare pentru claritate.`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${_k}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
            })
        });
        
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Nu am putut genera un răspuns.';
        return text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    } catch (err) {
        return localAI(msg);
    }
}

function buildContext() {
    const trans = getMonthTrans();
    const income = trans.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const expense = trans.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    
    const byCat = {};
    trans.filter(t => t.type === 'expense').forEach(t => {
        if (!byCat[t.category]) byCat[t.category] = 0;
        byCat[t.category] += Math.abs(t.amount);
    });
    
    const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    return `Luna: ${MONTHS_FULL[S.month]} ${S.year}
Venituri: ${income} ${S.currency}
Cheltuieli: ${expense} ${S.currency}
Balanță: ${income - expense} ${S.currency}
Tranzacții: ${trans.length}
Top categorii: ${topCats.map(([c, v]) => `${c}: ${v} ${S.currency}`).join(', ') || 'N/A'}
Obiective active: ${S.goals.filter(g => !g.completed).length}
Datorii de plătit: ${S.debts.filter(d => d.type === 'owe' && !d.paid).reduce((s, d) => s + d.amount, 0)} ${S.currency}`;
}

function localAI(msg) {
    const m = msg.toLowerCase();
    const trans = getMonthTrans();
    const income = trans.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const expense = trans.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    
    if (m.includes('cheltuieli') || m.includes('analiz')) {
        if (!expense) return '📊 Nu ai cheltuieli luna aceasta.';
        const byCat = {};
        trans.filter(t => t.type === 'expense').forEach(t => {
            if (!byCat[t.category]) byCat[t.category] = 0;
            byCat[t.category] += Math.abs(t.amount);
        });
        const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return `📊 <strong>Analiză cheltuieli: ${fmt(expense)}</strong><br><br>Top categorii:<br>${top.map(([c, v], i) => `${i + 1}. ${c}: ${fmt(v)} (${Math.round((v / expense) * 100)}%)`).join('<br>')}`;
    }
    
    if (m.includes('sfat') || m.includes('economis')) {
        const bal = income - expense;
        const rate = income > 0 ? Math.round((bal / income) * 100) : 0;
        if (bal > 0) {
            return `💰 Economisești <strong>${rate}%</strong> din venituri.<br><br>${rate >= 20 ? '🎉 Excelent!' : '💡 Țintește spre 20%.'}<br><br><strong>Sfaturi:</strong><br>• Verifică abonamentele lunare<br>• Setează bugete pe categorii<br>• Automatizează economiile`;
        }
        return `⚠️ Cheltuielile depășesc veniturile cu ${fmt(Math.abs(bal))}.<br><br><strong>Sfaturi urgente:</strong><br>• Identifică cheltuielile neesențiale<br>• Anulează abonamentele nefolosite<br>• Caută alternative mai ieftine`;
    }
    
    if (m.includes('predicție') || m.includes('predictie')) {
        const days = new Date().getDate();
        const daysLeft = new Date(S.year, S.month + 1, 0).getDate() - days;
        const daily = days > 0 ? expense / days : 0;
        return `🔮 <strong>Predicție:</strong><br>Media zilnică: ${fmt(daily)}<br>Estimate final lună: ${fmt(expense + daily * daysLeft)}<br>Zile rămase: ${daysLeft}`;
    }
    
    return `Te pot ajuta cu:<br>• "Analizează cheltuielile"<br>• "Sfaturi de economisire"<br>• "Predicție pentru lună"<br>• "Care sunt trendurile mele?"`;
}

// Month navigation
function changeMonth(delta) {
    S.month += delta;
    if (S.month > 11) { S.month = 0; S.year++; }
    if (S.month < 0) { S.month = 11; S.year--; }
    document.getElementById('cur-month').textContent = MONTHS_FULL[S.month] + ' ' + S.year;
    renderAll();
    updateChart();
}

// Utils
function fmt(n) {
    return new Intl.NumberFormat('ro-RO').format(Math.round(Math.abs(n))) + ' ' + S.currency;
}

function escHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function toast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.classList.remove('show'), 3000);
}

function exportJSON() {
    const data = { transactions: S.transactions, goals: S.goals, reminders: S.reminders, debts: S.debts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget-pro-export.json';
    a.click();
    toast('Exportat!', 'success');
}

function exportCSV() {
    let csv = 'Data,Tip,Categorie,Subcategorie,Descriere,Suma\n';
    S.transactions.forEach(t => {
        csv += `${t.date},${t.type},${t.category},${t.subcategory || ''},${t.description || ''},${t.amount}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget-pro-export.csv';
    a.click();
    toast('CSV exportat!', 'success');
}

async function clearData() {
    if (!confirm('Ștergi TOATE datele? Această acțiune nu poate fi anulată.')) return;
    if (!confirm('Ești sigur?')) return;
    
    try {
        const batch = db.batch();
        const uid = S.user.uid;
        
        const collections = ['transactions', 'goals', 'reminders', 'debts'];
        for (const col of collections) {
            const snap = await db.collection('users').doc(uid).collection(col).get();
            snap.forEach(doc => batch.delete(doc.ref));
        }
        
        await batch.commit();
        S.transactions = []; S.goals = []; S.reminders = []; S.debts = [];
        renderAll();
        updateChart();
        toast('Date șterse', 'success');
    } catch (err) { toast('Eroare', 'error'); }
}

// Global functions
window.editTrans = editTrans;
window.deleteTrans = deleteTrans;
