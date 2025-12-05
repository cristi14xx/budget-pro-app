// ============================================
// FEATURES.JS - Funcționalități extra
// 1. Tranzacții recurente
// 2. Obiective de economisire  
// 3. Alerte buget
// ============================================

// ============================================
// STATE EXTENSION
// ============================================
if (!state.recurring) state.recurring = JSON.parse(localStorage.getItem('recurring') || '[]');
if (!state.goals) state.goals = JSON.parse(localStorage.getItem('goals') || '[]');
if (!state.alertsShown) state.alertsShown = {};

// ============================================
// 1. TRANZACȚII RECURENTE
// ============================================

function openRecurringModal(item = null) {
    const modal = document.getElementById('recurring-modal');
    const form = document.getElementById('recurring-form');
    form.reset();
    
    // Populate categories
    const catSelect = document.getElementById('recurring-category');
    catSelect.innerHTML = '<option value="">Selectează...</option>';
    Object.entries(CATEGORIES.expense).forEach(([name, data]) => {
        catSelect.innerHTML += `<option value="${name}">${data.icon} ${name}</option>`;
    });
    
    if (item) {
        document.getElementById('recurring-modal-title').textContent = 'Editează recurent';
        document.getElementById('recurring-id').value = item.id;
        document.getElementById('recurring-name').value = item.name;
        document.getElementById('recurring-amount').value = item.amount;
        document.getElementById('recurring-category').value = item.category;
        updateRecurringSubcategories();
        document.getElementById('recurring-subcategory').value = item.subcategory;
        document.getElementById('recurring-day').value = item.day;
        document.getElementById('recurring-active').checked = item.active !== false;
    } else {
        document.getElementById('recurring-modal-title').textContent = 'Adaugă plată recurentă';
        document.getElementById('recurring-id').value = '';
        document.getElementById('recurring-active').checked = true;
    }
    
    modal.classList.add('open');
}

function closeRecurringModal() {
    document.getElementById('recurring-modal').classList.remove('open');
}

function updateRecurringSubcategories() {
    const cat = document.getElementById('recurring-category').value;
    const subSelect = document.getElementById('recurring-subcategory');
    subSelect.innerHTML = '<option value="">Selectează...</option>';
    
    if (cat && CATEGORIES.expense[cat]) {
        CATEGORIES.expense[cat].subs.forEach(sub => {
            subSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    }
}

function handleRecurringSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('recurring-id').value || 'rec_' + Date.now();
    const item = {
        id: id,
        name: document.getElementById('recurring-name').value,
        amount: parseFloat(document.getElementById('recurring-amount').value),
        category: document.getElementById('recurring-category').value,
        subcategory: document.getElementById('recurring-subcategory').value,
        day: parseInt(document.getElementById('recurring-day').value),
        active: document.getElementById('recurring-active').checked
    };
    
    const existingIdx = state.recurring.findIndex(r => r.id === id);
    if (existingIdx !== -1) {
        state.recurring[existingIdx] = item;
        toast('Recurent actualizat!', 'success');
    } else {
        state.recurring.push(item);
        toast('Recurent adăugat!', 'success');
    }
    
    localStorage.setItem('recurring', JSON.stringify(state.recurring));
    closeRecurringModal();
    renderRecurring();
}

function deleteRecurring(id) {
    if (!confirm('Ștergi această plată recurentă?')) return;
    state.recurring = state.recurring.filter(r => r.id !== id);
    localStorage.setItem('recurring', JSON.stringify(state.recurring));
    renderRecurring();
    toast('Șters!', 'success');
}

function toggleRecurring(id) {
    const item = state.recurring.find(r => r.id === id);
    if (item) {
        item.active = !item.active;
        localStorage.setItem('recurring', JSON.stringify(state.recurring));
        renderRecurring();
    }
}

function renderRecurring() {
    const container = document.getElementById('recurring-list');
    if (!container) return;
    
    if (state.recurring.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <div>🔄</div>
                <p>Nicio plată recurentă</p>
            </div>
        `;
        return;
    }
    
    // Sort by day
    const sorted = [...state.recurring].sort((a, b) => a.day - b.day);
    
    container.innerHTML = sorted.map(item => {
        const icon = CATEGORIES.expense[item.category]?.icon || '📦';
        const today = new Date().getDate();
        const isPast = item.day < today;
        const isToday = item.day === today;
        
        return `
            <div class="recurring-item ${item.active ? '' : 'inactive'}" onclick="openRecurringModal(state.recurring.find(r=>r.id==='${item.id}'))">
                <div class="recurring-icon">${icon}</div>
                <div class="recurring-info">
                    <div class="recurring-name">${item.name}</div>
                    <div class="recurring-meta">
                        ${item.subcategory} • Ziua ${item.day}
                        ${isToday ? '<span class="badge today">Azi</span>' : ''}
                        ${isPast ? '<span class="badge past">Plătit</span>' : ''}
                    </div>
                </div>
                <div class="recurring-amount">-${formatMoney(item.amount)}</div>
                <div class="recurring-actions">
                    <button class="toggle-btn ${item.active ? 'active' : ''}" onclick="event.stopPropagation();toggleRecurring('${item.id}')" title="${item.active ? 'Dezactivează' : 'Activează'}">
                        ${item.active ? '✓' : '○'}
                    </button>
                    <button class="delete-btn-small" onclick="event.stopPropagation();deleteRecurring('${item.id}')">×</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Update total
    const totalRecurring = state.recurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0);
    const totalEl = document.getElementById('recurring-total');
    if (totalEl) totalEl.textContent = formatMoney(totalRecurring);
}

// Auto-add recurring transactions
function processRecurringTransactions() {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthKey = `${currentYear}-${currentMonth}`;
    
    state.recurring.forEach(rec => {
        if (!rec.active) return;
        
        // Check if already added this month
        const alreadyAdded = state.transactions.some(t => {
            const d = new Date(t.date);
            return t.recurringId === rec.id && 
                   d.getMonth() === currentMonth && 
                   d.getFullYear() === currentYear;
        });
        
        if (!alreadyAdded && rec.day <= currentDay) {
            // Add the transaction
            const trans = {
                id: 'auto_' + Date.now() + '_' + rec.id,
                recurringId: rec.id,
                date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(rec.day).padStart(2, '0')}`,
                type: 'Cheltuială',
                category: rec.category,
                subcategory: rec.subcategory,
                description: rec.name + ' (recurent)',
                amount: -rec.amount
            };
            
            state.transactions.push(trans);
            localStorage.setItem('transactions', JSON.stringify(state.transactions));
        }
    });
}

// ============================================
// 2. OBIECTIVE DE ECONOMISIRE
// ============================================

function openGoalModal(goal = null) {
    const modal = document.getElementById('goal-modal');
    const form = document.getElementById('goal-form');
    form.reset();
    
    if (goal) {
        document.getElementById('goal-modal-title').textContent = 'Editează obiectiv';
        document.getElementById('goal-id').value = goal.id;
        document.getElementById('goal-name').value = goal.name;
        document.getElementById('goal-icon').value = goal.icon || '🎯';
        document.getElementById('goal-target').value = goal.target;
        document.getElementById('goal-saved').value = goal.saved || 0;
        document.getElementById('goal-deadline').value = goal.deadline;
    } else {
        document.getElementById('goal-modal-title').textContent = 'Obiectiv nou';
        document.getElementById('goal-id').value = '';
        document.getElementById('goal-icon').value = '🎯';
        document.getElementById('goal-saved').value = 0;
    }
    
    modal.classList.add('open');
}

function closeGoalModal() {
    document.getElementById('goal-modal').classList.remove('open');
}

function handleGoalSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('goal-id').value || 'goal_' + Date.now();
    const goal = {
        id: id,
        name: document.getElementById('goal-name').value,
        icon: document.getElementById('goal-icon').value || '🎯',
        target: parseFloat(document.getElementById('goal-target').value),
        saved: parseFloat(document.getElementById('goal-saved').value) || 0,
        deadline: document.getElementById('goal-deadline').value
    };
    
    const existingIdx = state.goals.findIndex(g => g.id === id);
    if (existingIdx !== -1) {
        state.goals[existingIdx] = goal;
        toast('Obiectiv actualizat!', 'success');
    } else {
        state.goals.push(goal);
        toast('Obiectiv adăugat!', 'success');
    }
    
    localStorage.setItem('goals', JSON.stringify(state.goals));
    closeGoalModal();
    renderGoals();
}

function deleteGoal(id) {
    if (!confirm('Ștergi acest obiectiv?')) return;
    state.goals = state.goals.filter(g => g.id !== id);
    localStorage.setItem('goals', JSON.stringify(state.goals));
    renderGoals();
    toast('Șters!', 'success');
}

function addToGoal(id, amount) {
    const goal = state.goals.find(g => g.id === id);
    if (goal) {
        goal.saved = (goal.saved || 0) + amount;
        if (goal.saved > goal.target) goal.saved = goal.target;
        localStorage.setItem('goals', JSON.stringify(state.goals));
        renderGoals();
        
        if (goal.saved >= goal.target) {
            toast(`🎉 Felicitări! Ai atins obiectivul "${goal.name}"!`, 'success');
        } else {
            toast(`+${formatMoney(amount)} adăugat la ${goal.name}`, 'success');
        }
    }
}

function renderGoals() {
    const container = document.getElementById('goals-list');
    if (!container) return;
    
    if (state.goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <div>🎯</div>
                <p>Niciun obiectiv setat</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.goals.map(goal => {
        const percent = Math.min(Math.round((goal.saved / goal.target) * 100), 100);
        const remaining = goal.target - goal.saved;
        
        // Calculate monthly needed
        const deadline = new Date(goal.deadline);
        const today = new Date();
        const monthsLeft = Math.max(1, 
            (deadline.getFullYear() - today.getFullYear()) * 12 + 
            (deadline.getMonth() - today.getMonth())
        );
        const monthlyNeeded = remaining > 0 ? Math.ceil(remaining / monthsLeft) : 0;
        
        const isCompleted = goal.saved >= goal.target;
        const deadlineStr = deadline.toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' });
        
        return `
            <div class="goal-card ${isCompleted ? 'completed' : ''}" onclick="openGoalModal(state.goals.find(g=>g.id==='${goal.id}'))">
                <div class="goal-header">
                    <div class="goal-icon">${goal.icon}</div>
                    <div class="goal-info">
                        <div class="goal-name">${goal.name}</div>
                        <div class="goal-deadline">Termen: ${deadlineStr}</div>
                    </div>
                    <button class="delete-btn-small" onclick="event.stopPropagation();deleteGoal('${goal.id}')">×</button>
                </div>
                <div class="goal-progress">
                    <div class="goal-progress-bar">
                        <div class="goal-progress-fill ${isCompleted ? 'complete' : ''}" style="width: ${percent}%"></div>
                    </div>
                    <div class="goal-progress-text">${percent}%</div>
                </div>
                <div class="goal-stats">
                    <div class="goal-stat">
                        <span class="goal-stat-label">Economisit</span>
                        <span class="goal-stat-value success">${formatMoney(goal.saved)}</span>
                    </div>
                    <div class="goal-stat">
                        <span class="goal-stat-label">Țintă</span>
                        <span class="goal-stat-value">${formatMoney(goal.target)}</span>
                    </div>
                    <div class="goal-stat">
                        <span class="goal-stat-label">Rămas</span>
                        <span class="goal-stat-value ${remaining > 0 ? 'warning' : 'success'}">${formatMoney(remaining)}</span>
                    </div>
                </div>
                ${!isCompleted ? `
                    <div class="goal-monthly">
                        💡 Trebuie să pui <strong>${formatMoney(monthlyNeeded)}</strong>/lună
                    </div>
                    <div class="goal-actions">
                        <button class="goal-add-btn" onclick="event.stopPropagation();addToGoal('${goal.id}', 100)">+100</button>
                        <button class="goal-add-btn" onclick="event.stopPropagation();addToGoal('${goal.id}', 500)">+500</button>
                        <button class="goal-add-btn" onclick="event.stopPropagation();addToGoal('${goal.id}', 1000)">+1000</button>
                    </div>
                ` : `
                    <div class="goal-completed-badge">🎉 Obiectiv atins!</div>
                `}
            </div>
        `;
    }).join('');
}

// ============================================
// 3. ALERTE BUGET
// ============================================

function checkBudgetAlerts() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get current month transactions
    const monthTransactions = state.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && 
               d.getFullYear() === currentYear && 
               t.type === 'Cheltuială';
    });
    
    // Group by category
    const spentByCategory = {};
    monthTransactions.forEach(t => {
        if (!spentByCategory[t.category]) spentByCategory[t.category] = 0;
        spentByCategory[t.category] += Math.abs(t.amount);
    });
    
    // Get budgets by category
    const budgetByCategory = {};
    state.budgets.forEach(b => {
        if (!budgetByCategory[b.category]) budgetByCategory[b.category] = 0;
        budgetByCategory[b.category] += b.budget || 0;
    });
    
    const alerts = [];
    const alertKey = `${currentYear}-${currentMonth}`;
    
    Object.entries(spentByCategory).forEach(([category, spent]) => {
        const budget = budgetByCategory[category];
        if (!budget) return;
        
        const percent = (spent / budget) * 100;
        const alertId = `${alertKey}-${category}`;
        
        if (percent >= 100 && !state.alertsShown[`${alertId}-100`]) {
            alerts.push({
                type: 'danger',
                icon: '🚨',
                title: `Buget depășit: ${category}`,
                message: `Ai cheltuit ${formatMoney(spent)} din ${formatMoney(budget)} (${Math.round(percent)}%)`
            });
            state.alertsShown[`${alertId}-100`] = true;
        } else if (percent >= 80 && percent < 100 && !state.alertsShown[`${alertId}-80`]) {
            alerts.push({
                type: 'warning',
                icon: '⚠️',
                title: `Aproape de limită: ${category}`,
                message: `Ai folosit ${Math.round(percent)}% din buget (${formatMoney(spent)} din ${formatMoney(budget)})`
            });
            state.alertsShown[`${alertId}-80`] = true;
        }
    });
    
    // Total budget alert
    const totalSpent = Object.values(spentByCategory).reduce((s, v) => s + v, 0);
    const totalBudget = Object.values(budgetByCategory).reduce((s, v) => s + v, 0);
    
    if (totalBudget > 0) {
        const totalPercent = (totalSpent / totalBudget) * 100;
        const totalAlertId = `${alertKey}-total`;
        
        if (totalPercent >= 100 && !state.alertsShown[`${totalAlertId}-100`]) {
            alerts.push({
                type: 'danger',
                icon: '💸',
                title: 'Buget total depășit!',
                message: `Ai cheltuit ${formatMoney(totalSpent)} din ${formatMoney(totalBudget)}`
            });
            state.alertsShown[`${totalAlertId}-100`] = true;
        } else if (totalPercent >= 90 && totalPercent < 100 && !state.alertsShown[`${totalAlertId}-90`]) {
            alerts.push({
                type: 'warning',
                icon: '📊',
                title: 'Atenție la buget!',
                message: `Ai folosit ${Math.round(totalPercent)}% din bugetul total`
            });
            state.alertsShown[`${totalAlertId}-90`] = true;
        }
    }
    
    // Show alerts
    alerts.forEach((alert, i) => {
        setTimeout(() => showAlert(alert), i * 500);
    });
    
    // Render alerts panel
    renderAlerts(spentByCategory, budgetByCategory);
}

function showAlert(alert) {
    const container = document.getElementById('toast-container');
    const alertEl = document.createElement('div');
    alertEl.className = `toast ${alert.type}`;
    alertEl.innerHTML = `
        <span class="toast-icon">${alert.icon}</span>
        <div class="toast-content">
            <div class="toast-title">${alert.title}</div>
            <div class="toast-message">${alert.message}</div>
        </div>
    `;
    container.appendChild(alertEl);
    
    setTimeout(() => alertEl.remove(), 5000);
}

function renderAlerts(spentByCategory, budgetByCategory) {
    const container = document.getElementById('alerts-list');
    if (!container) return;
    
    const alerts = [];
    
    Object.entries(budgetByCategory).forEach(([category, budget]) => {
        if (!budget) return;
        const spent = spentByCategory[category] || 0;
        const percent = (spent / budget) * 100;
        const remaining = budget - spent;
        
        if (percent >= 50) {
            alerts.push({
                category,
                spent,
                budget,
                percent,
                remaining,
                icon: CATEGORIES.expense[category]?.icon || '📦'
            });
        }
    });
    
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <div>✅</div>
                <p>Toate bugetele sunt OK!</p>
            </div>
        `;
        return;
    }
    
    // Sort by percent descending
    alerts.sort((a, b) => b.percent - a.percent);
    
    container.innerHTML = alerts.map(a => {
        const status = a.percent >= 100 ? 'danger' : a.percent >= 80 ? 'warning' : 'normal';
        return `
            <div class="alert-item ${status}">
                <div class="alert-icon">${a.icon}</div>
                <div class="alert-info">
                    <div class="alert-category">${a.category}</div>
                    <div class="alert-bar">
                        <div class="alert-bar-fill ${status}" style="width: ${Math.min(a.percent, 100)}%"></div>
                    </div>
                </div>
                <div class="alert-stats">
                    <div class="alert-percent ${status}">${Math.round(a.percent)}%</div>
                    <div class="alert-remaining">${a.remaining >= 0 ? formatMoney(a.remaining) + ' rămas' : formatMoney(Math.abs(a.remaining)) + ' depășit'}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// INIT FEATURES
// ============================================

function initFeatures() {
    // Process recurring transactions on load
    processRecurringTransactions();
    
    // Render all feature sections
    renderRecurring();
    renderGoals();
    
    // Check alerts after a short delay
    setTimeout(checkBudgetAlerts, 1000);
    
    // Add event listeners for modals
    document.getElementById('recurring-category')?.addEventListener('change', updateRecurringSubcategories);
    document.getElementById('recurring-form')?.addEventListener('submit', handleRecurringSubmit);
    document.getElementById('goal-form')?.addEventListener('submit', handleGoalSubmit);
    
    // Close modals on backdrop click
    document.querySelectorAll('.feature-modal .modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            backdrop.closest('.feature-modal').classList.remove('open');
        });
    });
}

// Make functions global
window.openRecurringModal = openRecurringModal;
window.closeRecurringModal = closeRecurringModal;
window.deleteRecurring = deleteRecurring;
window.toggleRecurring = toggleRecurring;
window.openGoalModal = openGoalModal;
window.closeGoalModal = closeGoalModal;
window.deleteGoal = deleteGoal;
window.addToGoal = addToGoal;
window.initFeatures = initFeatures;
window.renderRecurring = renderRecurring;
window.renderGoals = renderGoals;
window.checkBudgetAlerts = checkBudgetAlerts;

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeatures);
} else {
    setTimeout(initFeatures, 100);
}
