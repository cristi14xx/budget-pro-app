// ============================================
// BUDGET TRACKER APP - Main JavaScript
// ============================================

// ⚠️ IMPORTANT: Înlocuiește URL-ul de mai jos cu cel primit de la Google Apps Script
const API_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE';

// ============================================
// DATA & STATE
// ============================================

const CATEGORIES = {
    expense: {
        'Locuință': { icon: '🏠', subcategories: ['Chirie', 'Utilități', 'Întreținere', 'Mobilă'] },
        'Abonamente': { icon: '📱', subcategories: ['YouTube Premium', 'Apple Music', 'Netflix', 'Spotify', 'Vodafone', 'Comedy Box', 'Abonament Solo', 'Alte abonamente'] },
        'Mâncare': { icon: '🍽️', subcategories: ['Supermarket', 'Restaurante', 'Livrări', 'Cafea'] },
        'Transport': { icon: '🚗', subcategories: ['Benzină', 'Transport public', 'Taxi/Uber', 'Parcare', 'Întreținere auto'] },
        'Sport': { icon: '💪', subcategories: ['Sala', 'Suplimente', 'Dansuri', 'Echipament'] },
        'Sănătate': { icon: '🏥', subcategories: ['Farmacie', 'Medic', 'Analize', 'Stomatolog'] },
        'Divertisment': { icon: '🎬', subcategories: ['Cinema', 'Concerte', 'Jocuri', 'Ieșiri'] },
        'Investiții': { icon: '📈', subcategories: ['Bursă', 'Crypto', 'Economii'] },
        'Îmbrăcăminte': { icon: '👕', subcategories: ['Haine', 'Încălțăminte', 'Accesorii'] },
        'Educație': { icon: '📚', subcategories: ['Cursuri', 'Cărți', 'Subscripții'] },
        'Altele': { icon: '📦', subcategories: ['Cadouri', 'Diverse'] }
    },
    income: {
        'Salariu': { icon: '💼', subcategories: ['Salariu net', 'Bonusuri', 'Prime'] },
        'Freelance': { icon: '💻', subcategories: ['Proiecte', 'Consultanță'] },
        'Investiții': { icon: '📊', subcategories: ['Dividende', 'Dobânzi', 'Câștiguri'] },
        'Alte venituri': { icon: '💰', subcategories: ['Vânzări', 'Rambursări', 'Diverse'] }
    }
};

const MONTHS_RO = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 
                   'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

let state = {
    transactions: [],
    budgets: [],
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    currentType: 'expense',
    editingId: null,
    theme: localStorage.getItem('theme') || 'dark',
    isOnline: navigator.onLine
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventListeners();
    loadData();
    registerServiceWorker();
    
    // Check online status
    window.addEventListener('online', () => {
        state.isOnline = true;
        syncData();
        showToast('Conectat! Sincronizare...', 'success');
    });
    
    window.addEventListener('offline', () => {
        state.isOnline = false;
        showToast('Offline - datele se salvează local', 'info');
    });
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
    }
}

// ============================================
// THEME
// ============================================

function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
}

// ============================================
// DATA LOADING & SYNCING
// ============================================

async function loadData() {
    // Try to load from localStorage first
    const cachedTransactions = localStorage.getItem('transactions');
    const cachedBudgets = localStorage.getItem('budgets');
    
    if (cachedTransactions) {
        state.transactions = JSON.parse(cachedTransactions);
    }
    if (cachedBudgets) {
        state.budgets = JSON.parse(cachedBudgets);
    }
    
    // Initial render with cached data
    render();
    hideLoading();
    
    // Then sync with server if online
    if (state.isOnline && API_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        await syncData();
    }
}

async function syncData() {
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.classList.add('syncing');
    
    try {
        // Fetch transactions
        const transResponse = await fetch(`${API_URL}?action=getTransactions`);
        const transData = await transResponse.json();
        if (transData.success) {
            state.transactions = transData.data.map(t => ({
                ...t,
                amount: parseFloat(t.amount)
            }));
            localStorage.setItem('transactions', JSON.stringify(state.transactions));
        }
        
        // Fetch budgets
        const budgetResponse = await fetch(`${API_URL}?action=getBudgets`);
        const budgetData = await budgetResponse.json();
        if (budgetData.success) {
            state.budgets = budgetData.data.map(b => ({
                ...b,
                budget: parseFloat(b.budget)
            }));
            localStorage.setItem('budgets', JSON.stringify(state.budgets));
        }
        
        render();
    } catch (error) {
        console.error('Sync error:', error);
        showToast('Eroare la sincronizare', 'error');
    } finally {
        syncBtn.classList.remove('syncing');
    }
}

function hideLoading() {
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
    }, 500);
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // Theme toggle
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    
    // Sync button
    document.getElementById('sync-btn').addEventListener('click', syncData);
    
    // Month navigation
    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));
    
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Add button
    document.getElementById('add-btn').addEventListener('click', openModal);
    
    // Modal
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    
    // Type selector
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => selectType(btn.dataset.type));
    });
    
    // Category change
    document.getElementById('category').addEventListener('change', updateSubcategories);
    
    // Form submit
    document.getElementById('transaction-form').addEventListener('submit', handleSubmit);
}

// ============================================
// NAVIGATION
// ============================================

function changeMonth(delta) {
    state.currentMonth += delta;
    
    if (state.currentMonth > 11) {
        state.currentMonth = 0;
        state.currentYear++;
    } else if (state.currentMonth < 0) {
        state.currentMonth = 11;
        state.currentYear--;
    }
    
    render();
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// ============================================
// MODAL
// ============================================

function openModal(transaction = null) {
    const modal = document.getElementById('transaction-modal');
    const form = document.getElementById('transaction-form');
    
    form.reset();
    state.editingId = null;
    
    if (transaction) {
        // Edit mode
        state.editingId = transaction.id;
        document.getElementById('modal-title').textContent = 'Editează tranzacție';
        document.getElementById('submit-text').textContent = 'Salvează';
        
        const type = transaction.type === 'Venit' ? 'income' : 'expense';
        selectType(type);
        
        document.getElementById('amount').value = Math.abs(transaction.amount);
        document.getElementById('category').value = transaction.category;
        updateSubcategories();
        document.getElementById('subcategory').value = transaction.subcategory;
        document.getElementById('description').value = transaction.description || '';
        
        // Format date
        const date = new Date(transaction.date);
        document.getElementById('date').value = date.toISOString().split('T')[0];
    } else {
        // Add mode
        document.getElementById('modal-title').textContent = 'Adaugă tranzacție';
        document.getElementById('submit-text').textContent = 'Adaugă';
        selectType('expense');
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
    }
    
    updateCategoryOptions();
    modal.classList.add('open');
}

function closeModal() {
    document.getElementById('transaction-modal').classList.remove('open');
    state.editingId = null;
}

function selectType(type) {
    state.currentType = type;
    
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    
    updateCategoryOptions();
}

function updateCategoryOptions() {
    const categorySelect = document.getElementById('category');
    const categories = CATEGORIES[state.currentType];
    
    categorySelect.innerHTML = '<option value="">Selectează...</option>';
    
    Object.keys(categories).forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = `${categories[cat].icon} ${cat}`;
        categorySelect.appendChild(option);
    });
    
    document.getElementById('subcategory').innerHTML = '<option value="">Selectează...</option>';
}

function updateSubcategories() {
    const category = document.getElementById('category').value;
    const subcategorySelect = document.getElementById('subcategory');
    const categories = CATEGORIES[state.currentType];
    
    subcategorySelect.innerHTML = '<option value="">Selectează...</option>';
    
    if (category && categories[category]) {
        categories[category].subcategories.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub;
            option.textContent = sub;
            subcategorySelect.appendChild(option);
        });
    }
}

// ============================================
// FORM HANDLING
// ============================================

async function handleSubmit(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const subcategory = document.getElementById('subcategory').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('date').value;
    
    const transaction = {
        date: date,
        type: state.currentType === 'income' ? 'Venit' : 'Cheltuială',
        category: category,
        subcategory: subcategory,
        description: description,
        amount: state.currentType === 'income' ? amount : -amount
    };
    
    if (state.editingId) {
        await updateTransaction({ ...transaction, id: state.editingId });
    } else {
        await addTransaction(transaction);
    }
    
    closeModal();
}

async function addTransaction(transaction) {
    // Generate local ID
    const localId = 'local_' + Date.now();
    const newTransaction = { ...transaction, id: localId };
    
    // Add to local state immediately
    state.transactions.push(newTransaction);
    localStorage.setItem('transactions', JSON.stringify(state.transactions));
    render();
    showToast('Tranzacție adăugată!', 'success');
    
    // Sync with server if online
    if (state.isOnline && API_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        try {
            const params = new URLSearchParams({
                action: 'addTransaction',
                ...transaction
            });
            
            const response = await fetch(`${API_URL}?${params}`);
            const data = await response.json();
            
            if (data.success) {
                // Update local ID with server ID
                const index = state.transactions.findIndex(t => t.id === localId);
                if (index !== -1) {
                    state.transactions[index].id = data.id;
                    localStorage.setItem('transactions', JSON.stringify(state.transactions));
                }
            }
        } catch (error) {
            console.error('Add error:', error);
        }
    }
}

async function updateTransaction(transaction) {
    // Update locally
    const index = state.transactions.findIndex(t => t.id === transaction.id);
    if (index !== -1) {
        state.transactions[index] = transaction;
        localStorage.setItem('transactions', JSON.stringify(state.transactions));
        render();
        showToast('Tranzacție actualizată!', 'success');
    }
    
    // Sync with server
    if (state.isOnline && API_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        try {
            const params = new URLSearchParams({
                action: 'updateTransaction',
                ...transaction
            });
            await fetch(`${API_URL}?${params}`);
        } catch (error) {
            console.error('Update error:', error);
        }
    }
}

async function deleteTransaction(id) {
    if (!confirm('Ștergi această tranzacție?')) return;
    
    // Delete locally
    state.transactions = state.transactions.filter(t => t.id !== id);
    localStorage.setItem('transactions', JSON.stringify(state.transactions));
    render();
    showToast('Tranzacție ștearsă!', 'success');
    
    // Sync with server
    if (state.isOnline && API_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        try {
            const params = new URLSearchParams({ action: 'deleteTransaction', id });
            await fetch(`${API_URL}?${params}`);
        } catch (error) {
            console.error('Delete error:', error);
        }
    }
}

// ============================================
// RENDERING
// ============================================

function render() {
    renderMonth();
    renderStats();
    renderTransactions();
    renderCategories();
    renderBudgets();
}

function renderMonth() {
    document.getElementById('current-month').textContent = 
        `${MONTHS_RO[state.currentMonth]} ${state.currentYear}`;
}

function renderStats() {
    const filtered = getFilteredTransactions();
    
    const income = filtered
        .filter(t => t.type === 'Venit')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const expenses = filtered
        .filter(t => t.type === 'Cheltuială')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const balance = income - expenses;
    
    const totalBudget = state.budgets.reduce((sum, b) => sum + b.budget, 0);
    const budgetPercent = totalBudget > 0 ? Math.round((expenses / totalBudget) * 100) : 0;
    
    document.getElementById('total-income').textContent = formatMoney(income);
    document.getElementById('total-expenses').textContent = formatMoney(expenses);
    document.getElementById('balance').textContent = formatMoney(balance);
    document.getElementById('budget-percent').textContent = `${budgetPercent}%`;
    
    const budgetFill = document.getElementById('budget-fill');
    budgetFill.style.width = `${Math.min(budgetPercent, 100)}%`;
    budgetFill.classList.remove('warning', 'danger');
    if (budgetPercent > 100) budgetFill.classList.add('danger');
    else if (budgetPercent > 80) budgetFill.classList.add('warning');
}

function renderTransactions() {
    const container = document.getElementById('transactions-list');
    const emptyState = document.getElementById('empty-transactions');
    const filtered = getFilteredTransactions();
    
    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    container.innerHTML = filtered.map(t => {
        const isIncome = t.type === 'Venit';
        const categories = CATEGORIES[isIncome ? 'income' : 'expense'];
        const icon = categories[t.category]?.icon || '📦';
        const date = new Date(t.date);
        const dateStr = `${date.getDate()} ${MONTHS_RO[date.getMonth()].slice(0, 3)}`;
        
        return `
            <div class="transaction-item ${isIncome ? 'income' : 'expense'}" data-id="${t.id}">
                <div class="transaction-icon">${icon}</div>
                <div class="transaction-info">
                    <div class="transaction-category">${t.subcategory || t.category}</div>
                    <div class="transaction-meta">${t.description || t.category} • ${dateStr}</div>
                </div>
                <div class="transaction-amount">${isIncome ? '+' : ''}${formatMoney(t.amount)}</div>
                <div class="transaction-actions">
                    <button class="transaction-action" onclick="editTransaction('${t.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="transaction-action" onclick="deleteTransaction('${t.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderCategories() {
    const container = document.getElementById('categories-grid');
    const filtered = getFilteredTransactions().filter(t => t.type === 'Cheltuială');
    
    // Group by category
    const byCategory = {};
    filtered.forEach(t => {
        if (!byCategory[t.category]) {
            byCategory[t.category] = { total: 0, subcategories: {} };
        }
        byCategory[t.category].total += Math.abs(t.amount);
        
        if (!byCategory[t.category].subcategories[t.subcategory]) {
            byCategory[t.category].subcategories[t.subcategory] = 0;
        }
        byCategory[t.category].subcategories[t.subcategory] += Math.abs(t.amount);
    });
    
    // Calculate budgets by category
    const budgetByCategory = {};
    state.budgets.forEach(b => {
        if (!budgetByCategory[b.category]) {
            budgetByCategory[b.category] = 0;
        }
        budgetByCategory[b.category] += b.budget;
    });
    
    container.innerHTML = Object.entries(byCategory)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([category, data]) => {
            const icon = CATEGORIES.expense[category]?.icon || '📦';
            const budget = budgetByCategory[category] || 0;
            const percent = budget > 0 ? Math.round((data.total / budget) * 100) : 0;
            const progressClass = percent > 100 ? 'danger' : percent > 80 ? 'warning' : '';
            
            const subcatHtml = Object.entries(data.subcategories)
                .sort((a, b) => b[1] - a[1])
                .map(([sub, amount]) => `
                    <div class="subcategory-item">
                        <span class="subcategory-name">${sub}</span>
                        <span class="subcategory-amount">${formatMoney(amount)}</span>
                    </div>
                `).join('');
            
            return `
                <div class="category-card" onclick="toggleCategory(this)">
                    <div class="category-header">
                        <div class="category-main">
                            <div class="category-icon">${icon}</div>
                            <span class="category-name">${category}</span>
                        </div>
                        <div class="category-stats">
                            <div class="category-spent">${formatMoney(data.total)}</div>
                            ${budget > 0 ? `<div class="category-budget">din ${formatMoney(budget)}</div>` : ''}
                        </div>
                        <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </div>
                    <div class="category-progress">
                        <div class="category-progress-fill ${progressClass}" style="width: ${Math.min(percent, 100)}%"></div>
                    </div>
                    <div class="category-subcategories">
                        ${subcatHtml}
                    </div>
                </div>
            `;
        }).join('');
}

function renderBudgets() {
    const container = document.getElementById('budgets-list');
    
    // Get all subcategories from expense categories
    const allBudgets = [];
    Object.entries(CATEGORIES.expense).forEach(([category, data]) => {
        data.subcategories.forEach(subcategory => {
            const existing = state.budgets.find(b => 
                b.category === category && b.subcategory === subcategory
            );
            allBudgets.push({
                category,
                subcategory,
                budget: existing?.budget || 0,
                icon: data.icon
            });
        });
    });
    
    container.innerHTML = allBudgets.map(b => `
        <div class="budget-item">
            <div class="budget-info">
                <div class="budget-category">${b.icon} ${b.category}</div>
                <div class="budget-subcategory">${b.subcategory}</div>
            </div>
            <div class="budget-value">
                <input type="number" class="budget-input" 
                    value="${b.budget}" 
                    data-category="${b.category}"
                    data-subcategory="${b.subcategory}"
                    onchange="updateBudget(this)">
                <span class="budget-currency">RON</span>
            </div>
        </div>
    `).join('');
}

// ============================================
// HELPERS
// ============================================

function getFilteredTransactions() {
    return state.transactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === state.currentMonth && 
               date.getFullYear() === state.currentYear;
    });
}

function formatMoney(amount) {
    const absAmount = Math.abs(amount);
    return new Intl.NumberFormat('ro-RO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(absAmount) + ' RON';
}

function toggleCategory(element) {
    element.classList.toggle('expanded');
}

function editTransaction(id) {
    const transaction = state.transactions.find(t => t.id === id);
    if (transaction) {
        openModal(transaction);
    }
}

async function updateBudget(input) {
    const category = input.dataset.category;
    const subcategory = input.dataset.subcategory;
    const budget = parseFloat(input.value) || 0;
    
    // Update local state
    const existingIndex = state.budgets.findIndex(b => 
        b.category === category && b.subcategory === subcategory
    );
    
    if (existingIndex !== -1) {
        state.budgets[existingIndex].budget = budget;
    } else {
        state.budgets.push({ category, subcategory, budget });
    }
    
    localStorage.setItem('budgets', JSON.stringify(state.budgets));
    renderStats();
    renderCategories();
    
    // Sync with server
    if (state.isOnline && API_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        try {
            const params = new URLSearchParams({
                action: 'updateBudget',
                category,
                subcategory,
                budget
            });
            await fetch(`${API_URL}?${params}`);
        } catch (error) {
            console.error('Budget update error:', error);
        }
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Make functions available globally
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.toggleCategory = toggleCategory;
window.updateBudget = updateBudget;
