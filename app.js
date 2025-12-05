// ==========================================
// BUDGET PRO - MAIN APP
// ==========================================

// Firebase Config
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

// Categories
const CATEGORIES = {
    expense: {
        'Mâncare': '🍽️',
        'Transport': '🚗',
        'Locuință': '🏠',
        'Utilități': '💡',
        'Cumpărături': '🛍️',
        'Divertisment': '🎬',
        'Sănătate': '💊',
        'Educație': '📚',
        'Abonamente': '📱',
        'Altele': '📦'
    },
    income: {
        'Salariu': '💼',
        'Freelance': '💻',
        'Investiții': '📈',
        'Cadouri': '🎁',
        'Alte venituri': '💰'
    }
};

// State
const state = {
    user: null,
    transactions: [],
    goals: [],
    currentType: 'expense',
    currency: localStorage.getItem('currency') || 'RON',
    geminiKey: localStorage.getItem('geminiKey') || '',
    chart: null
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initEventListeners();
});

function initAuth() {
    auth.onAuthStateChanged(user => {
        if (user) {
            state.user = user;
            showApp();
            loadData();
            updateUserUI();
        } else {
            state.user = null;
            showAuthScreen();
        }
    });
}

function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function initEventListeners() {
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const isLogin = tab.dataset.tab === 'login';
            document.getElementById('login-form').classList.toggle('hidden', !isLogin);
            document.getElementById('register-form').classList.toggle('hidden', isLogin);
        });
    });

    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (err) {
            alert('Eroare: ' + err.message);
        }
    });

    // Register
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            await result.user.updateProfile({ displayName: name });
        } catch (err) {
            alert('Eroare: ' + err.message);
        }
    });

    // Google login
    document.getElementById('google-btn').addEventListener('click', async () => {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
        } catch (err) {
            alert('Eroare: ' + err.message);
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

    // Add transaction button
    document.getElementById('add-btn').addEventListener('click', () => openModal('transaction-modal'));
    
    // Quick buttons
    document.querySelectorAll('.quick-btn[data-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentType = btn.dataset.type;
            updateTypeToggle();
            populateCategories();
            openModal('transaction-modal');
        });
    });

    // Close modals
    document.querySelectorAll('.modal-overlay, .close-btn').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        });
    });

    // Type toggle
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentType = btn.dataset.type;
            updateTypeToggle();
            populateCategories();
        });
    });

    // Transaction form
    document.getElementById('transaction-form').addEventListener('submit', saveTransaction);

    // AI button
    document.getElementById('ai-btn').addEventListener('click', () => openModal('ai-modal'));
    
    // AI suggestions
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('ai-input').value = btn.dataset.q;
            sendAIMessage();
        });
    });

    // AI send
    document.getElementById('ai-send').addEventListener('click', sendAIMessage);
    document.getElementById('ai-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAIMessage();
    });

    // Profile
    document.getElementById('profile-btn').addEventListener('click', () => openModal('profile-modal'));
    
    // Goals
    document.getElementById('goals-btn').addEventListener('click', () => openModal('goals-modal'));
    
    // Analytics
    document.getElementById('analytics-btn').addEventListener('click', () => {
        openModal('analytics-modal');
        updateAnalytics();
    });

    // See all transactions
    document.getElementById('see-all-btn').addEventListener('click', () => {
        openModal('all-transactions-modal');
        renderAllTransactions();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderAllTransactions(btn.dataset.filter);
        });
    });

    // Settings
    document.getElementById('currency-select').addEventListener('change', (e) => {
        state.currency = e.target.value;
        localStorage.setItem('currency', e.target.value);
        updateStats();
        renderTransactions();
    });

    document.getElementById('gemini-key').addEventListener('change', (e) => {
        state.geminiKey = e.target.value;
        localStorage.setItem('geminiKey', e.target.value);
    });

    // Load saved settings
    document.getElementById('currency-select').value = state.currency;
    document.getElementById('gemini-key').value = state.geminiKey;

    // Add goal
    document.getElementById('add-goal-btn').addEventListener('click', addGoal);

    // Set default date
    document.getElementById('date').valueAsDate = new Date();
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function updateTypeToggle() {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === state.currentType);
    });
}

function populateCategories() {
    const select = document.getElementById('category');
    const cats = CATEGORIES[state.currentType];
    select.innerHTML = '<option value="">Selectează...</option>';
    Object.entries(cats).forEach(([name, icon]) => {
        select.innerHTML += `<option value="${name}">${icon} ${name}</option>`;
    });
}

// ==========================================
// DATA OPERATIONS
// ==========================================
async function loadData() {
    if (!state.user) return;
    
    try {
        // Load transactions
        const transSnap = await db.collection('users').doc(state.user.uid)
            .collection('transactions')
            .orderBy('date', 'desc')
            .limit(100)
            .get();
        
        state.transactions = transSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Load goals
        const goalsSnap = await db.collection('users').doc(state.user.uid)
            .collection('goals')
            .get();
        
        state.goals = goalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        updateStats();
        renderTransactions();
        initChart();
        renderGoals();
        
    } catch (err) {
        console.error('Load error:', err);
    }
}

async function saveTransaction(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('date').value;
    
    if (!amount || !category || !date) {
        alert('Completează toate câmpurile obligatorii');
        return;
    }
    
    const transaction = {
        amount: state.currentType === 'income' ? amount : -amount,
        type: state.currentType,
        category,
        description,
        date,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const doc = await db.collection('users').doc(state.user.uid)
            .collection('transactions')
            .add(transaction);
        
        state.transactions.unshift({ id: doc.id, ...transaction });
        
        closeModal('transaction-modal');
        document.getElementById('transaction-form').reset();
        document.getElementById('date').valueAsDate = new Date();
        
        updateStats();
        renderTransactions();
        updateChart();
        
    } catch (err) {
        alert('Eroare la salvare');
    }
}

async function deleteTransaction(id) {
    if (!confirm('Ștergi această tranzacție?')) return;
    
    try {
        await db.collection('users').doc(state.user.uid)
            .collection('transactions')
            .doc(id)
            .delete();
        
        state.transactions = state.transactions.filter(t => t.id !== id);
        updateStats();
        renderTransactions();
        updateChart();
        
    } catch (err) {
        alert('Eroare la ștergere');
    }
}

// ==========================================
// UI UPDATES
// ==========================================
function updateUserUI() {
    const name = state.user.displayName || 'Utilizator';
    document.getElementById('user-name').textContent = name;
    document.getElementById('profile-name').textContent = name;
    document.getElementById('profile-email').textContent = state.user.email;
    document.getElementById('profile-avatar').textContent = name.charAt(0).toUpperCase();
    
    updateGreeting();
}

function updateGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Bună seara';
    if (hour >= 5 && hour < 12) greeting = 'Bună dimineața';
    else if (hour >= 12 && hour < 18) greeting = 'Bună ziua';
    document.getElementById('greeting-text').textContent = greeting + ' 👋';
}

function updateStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthTransactions = state.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    
    const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const expense = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const balance = income - expense;
    
    document.getElementById('total-balance').textContent = formatMoney(balance);
    document.getElementById('total-income').textContent = formatMoney(income);
    document.getElementById('total-expense').textContent = formatMoney(expense);
}

function renderTransactions() {
    const container = document.getElementById('transactions-list');
    const recent = state.transactions.slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>Nicio tranzacție încă</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recent.map(t => createTransactionHTML(t)).join('');
}

function renderAllTransactions(filter = 'all') {
    const container = document.getElementById('all-transactions-list');
    let filtered = [...state.transactions];
    
    if (filter === 'expense') {
        filtered = filtered.filter(t => t.type === 'expense');
    } else if (filter === 'income') {
        filtered = filtered.filter(t => t.type === 'income');
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>Nicio tranzacție</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(t => createTransactionHTML(t)).join('');
}

function createTransactionHTML(t) {
    const icon = CATEGORIES[t.type]?.[t.category] || '📦';
    const isIncome = t.type === 'income';
    const date = new Date(t.date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
    
    return `
        <div class="transaction-item" onclick="deleteTransaction('${t.id}')">
            <div class="transaction-icon">${icon}</div>
            <div class="transaction-info">
                <div class="transaction-category">${t.category}</div>
                <div class="transaction-date">${date}${t.description ? ' • ' + t.description : ''}</div>
            </div>
            <div class="transaction-amount ${isIncome ? 'income' : 'expense'}">
                ${isIncome ? '+' : '-'}${formatMoney(Math.abs(t.amount))}
            </div>
        </div>
    `;
}

function formatMoney(amount) {
    return new Intl.NumberFormat('ro-RO').format(Math.round(amount)) + ' ' + state.currency;
}

// ==========================================
// CHART
// ==========================================
function initChart() {
    const ctx = document.getElementById('chart');
    if (!ctx) return;
    
    state.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#7c3aed', '#f59e0b', '#10b981', '#ef4444', 
                    '#06b6d4', '#ec4899', '#8b5cf6', '#f97316'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false }
            }
        }
    });
    
    updateChart();
}

function updateChart() {
    if (!state.chart) return;
    
    const now = new Date();
    const expenses = state.transactions.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && 
               d.getMonth() === now.getMonth() && 
               d.getFullYear() === now.getFullYear();
    });
    
    const byCategory = {};
    expenses.forEach(t => {
        if (!byCategory[t.category]) byCategory[t.category] = 0;
        byCategory[t.category] += Math.abs(t.amount);
    });
    
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
    
    state.chart.data.labels = sorted.map(([cat]) => cat);
    state.chart.data.datasets[0].data = sorted.map(([, val]) => val);
    state.chart.update();
}

// ==========================================
// GOALS
// ==========================================
function renderGoals() {
    const container = document.getElementById('goals-list');
    
    if (state.goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🎯</span>
                <p>Niciun obiectiv setat</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.goals.map(g => {
        const percent = Math.min(Math.round((g.saved / g.target) * 100), 100);
        return `
            <div class="goal-item">
                <div class="goal-header">
                    <div class="goal-name">${g.icon || '🎯'} ${g.name}</div>
                    <span>${percent}%</span>
                </div>
                <div class="goal-progress">
                    <div class="goal-fill" style="width: ${percent}%"></div>
                </div>
                <div class="goal-info">
                    <span>${formatMoney(g.saved)} economisiți</span>
                    <span>din ${formatMoney(g.target)}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function addGoal() {
    const name = prompt('Nume obiectiv:');
    if (!name) return;
    
    const target = parseFloat(prompt('Sumă țintă (RON):'));
    if (!target || isNaN(target)) return;
    
    const goal = {
        name,
        target,
        saved: 0,
        icon: '🎯',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const doc = await db.collection('users').doc(state.user.uid)
            .collection('goals')
            .add(goal);
        
        state.goals.push({ id: doc.id, ...goal });
        renderGoals();
        
    } catch (err) {
        alert('Eroare la creare obiectiv');
    }
}

// ==========================================
// ANALYTICS
// ==========================================
function updateAnalytics() {
    const now = new Date();
    const monthExpenses = state.transactions.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && 
               d.getMonth() === now.getMonth() && 
               d.getFullYear() === now.getFullYear();
    });
    
    const total = monthExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const days = now.getDate();
    const dailyAvg = days > 0 ? total / days : 0;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const prediction = total + (dailyAvg * (daysInMonth - days));
    
    document.getElementById('daily-avg').textContent = formatMoney(dailyAvg);
    document.getElementById('month-prediction').textContent = formatMoney(prediction);
    
    // Patterns
    const patterns = [];
    
    if (monthExpenses.length >= 3) {
        const byCategory = {};
        monthExpenses.forEach(t => {
            if (!byCategory[t.category]) byCategory[t.category] = 0;
            byCategory[t.category] += Math.abs(t.amount);
        });
        
        const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
        if (topCat) {
            const percent = Math.round((topCat[1] / total) * 100);
            patterns.push({
                icon: CATEGORIES.expense[topCat[0]] || '📦',
                text: `${topCat[0]} reprezintă ${percent}% din cheltuieli`
            });
        }
        
        // Weekend spending
        const weekendTotal = monthExpenses.filter(t => {
            const day = new Date(t.date).getDay();
            return day === 0 || day === 6;
        }).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        const weekendPercent = Math.round((weekendTotal / total) * 100);
        if (weekendPercent > 35) {
            patterns.push({
                icon: '📅',
                text: `${weekendPercent}% din cheltuieli sunt în weekend`
            });
        }
    }
    
    const patternsContainer = document.getElementById('patterns-list');
    if (patterns.length === 0) {
        patternsContainer.innerHTML = `
            <div class="pattern-item">
                <span class="pattern-icon">📊</span>
                <span class="pattern-text">Adaugă mai multe tranzacții pentru analize</span>
            </div>
        `;
    } else {
        patternsContainer.innerHTML = patterns.map(p => `
            <div class="pattern-item">
                <span class="pattern-icon">${p.icon}</span>
                <span class="pattern-text">${p.text}</span>
            </div>
        `).join('');
    }
}

// ==========================================
// AI CHAT
// ==========================================
async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message) return;
    
    const container = document.getElementById('ai-messages');
    
    // User message
    container.innerHTML += `
        <div class="ai-message user">
            <div class="message-bubble">${escapeHtml(message)}</div>
        </div>
    `;
    
    input.value = '';
    container.scrollTop = container.scrollHeight;
    
    // Generate response
    let response;
    if (state.geminiKey) {
        response = await callGeminiAPI(message);
    } else {
        response = generateLocalResponse(message);
    }
    
    // Bot response
    container.innerHTML += `
        <div class="ai-message bot">
            <div class="message-bubble">${response}</div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;
}

function generateLocalResponse(message) {
    const msg = message.toLowerCase();
    
    const now = new Date();
    const monthExpenses = state.transactions.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && 
               d.getMonth() === now.getMonth() && 
               d.getFullYear() === now.getFullYear();
    });
    
    const monthIncome = state.transactions.filter(t => {
        const d = new Date(t.date);
        return t.type === 'income' && 
               d.getMonth() === now.getMonth() && 
               d.getFullYear() === now.getFullYear();
    });
    
    const totalExpense = monthExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalIncome = monthIncome.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    if (msg.includes('cheltuieli') || msg.includes('cheltuit')) {
        if (totalExpense === 0) {
            return '📊 Nu ai cheltuieli înregistrate luna aceasta.';
        }
        
        const byCategory = {};
        monthExpenses.forEach(t => {
            if (!byCategory[t.category]) byCategory[t.category] = 0;
            byCategory[t.category] += Math.abs(t.amount);
        });
        
        const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
        let r = `📊 <b>Total cheltuieli:</b> ${formatMoney(totalExpense)}<br><br><b>Top categorii:</b><br>`;
        top.forEach(([cat, val], i) => {
            const percent = Math.round((val / totalExpense) * 100);
            r += `${i + 1}. ${cat}: ${formatMoney(val)} (${percent}%)<br>`;
        });
        return r;
    }
    
    if (msg.includes('economisi') || msg.includes('sfat')) {
        const balance = totalIncome - totalExpense;
        const rate = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0;
        
        if (balance > 0) {
            return `💰 Economisești <b>${rate}%</b> din venituri (${formatMoney(balance)})<br><br>${rate >= 20 ? '🎉 Excelent! Ești peste media recomandată de 20%.' : '💡 Sfat: Țintește spre 20% economii din venituri.'}`;
        } else {
            return `⚠️ Cheltuielile depășesc veniturile cu ${formatMoney(Math.abs(balance))}.<br><br><b>Sfaturi:</b><br>• Verifică abonamentele nefolosite<br>• Setează un buget pentru fiecare categorie<br>• Folosește regula 50/30/20`;
        }
    }
    
    if (msg.includes('trend') || msg.includes('tendință')) {
        const days = now.getDate();
        const dailyAvg = days > 0 ? totalExpense / days : 0;
        return `📈 <b>Tendințe luna aceasta:</b><br><br>Media zilnică: ${formatMoney(dailyAvg)}<br>Total venituri: ${formatMoney(totalIncome)}<br>Total cheltuieli: ${formatMoney(totalExpense)}<br>Balanță: ${formatMoney(totalIncome - totalExpense)}`;
    }
    
    return `👋 Te pot ajuta cu:<br>• <b>"Top cheltuieli"</b> - vezi pe ce cheltui<br>• <b>"Sfaturi economisire"</b> - cum să economisești<br>• <b>"Analizează trendurile"</b> - vezi tendințele`;
}

async function callGeminiAPI(message) {
    const context = `Sunt un utilizator român și am:
- Cheltuieli luna aceasta: ${state.transactions.filter(t => t.type === 'expense').reduce((s,t) => s + Math.abs(t.amount), 0)} RON
- Venituri luna aceasta: ${state.transactions.filter(t => t.type === 'income').reduce((s,t) => s + Math.abs(t.amount), 0)} RON
- ${state.transactions.length} tranzacții totale`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${state.geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${context}\n\nÎntrebare: ${message}\n\nRăspunde concis în română, cu sfaturi practice.`
                    }]
                }]
            })
        });
        
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || generateLocalResponse(message);
    } catch (err) {
        return generateLocalResponse(message);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.deleteTransaction = deleteTransaction;
