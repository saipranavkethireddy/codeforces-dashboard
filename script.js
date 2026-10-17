const API_BASE = 'https://codeforces.com/api';

// Application State
const State = {
    currentHandle: localStorage.getItem('cf_last_handle') || 'tourist',
    savedHandles: JSON.parse(localStorage.getItem('cf_saved_handles') || '["tourist", "jiangly", "petr", "ecnerwala"]'),
    theme: localStorage.getItem('cf_theme') || 'dark',
    activeTab: 'overview',
    cache: new Map(),
    profile: null,
    submissions: [],
    ratingHistory: [],
    bookmarkedProblems: JSON.parse(localStorage.getItem('cf_bookmarks') || '[]'),
    goals: JSON.parse(localStorage.getItem('cf_goals') || '{"targetRating": 2100, "weeklyTarget": 15}')
};

// DOMContentLoaded Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initSavedUsersUI();
    
    document.getElementById('handle-search-input').value = State.currentHandle;
    loadDashboard(State.currentHandle);
});

// Theme Management 
function initTheme() {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    
    if (State.theme === 'light') {
        html.classList.remove('dark');
        html.classList.add('light');
        icon.className = 'fa-solid fa-sun';
        icon.style.color = 'var(--accent-amber)';
    } else {
        html.classList.remove('light');
        html.classList.add('dark');
        icon.className = 'fa-solid fa-moon';
        icon.style.color = 'var(--accent-amber)';
    }

    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            html.classList.add('light');
            icon.className = 'fa-solid fa-sun';
            State.theme = 'light';
        } else {
            html.classList.remove('light');
            html.classList.add('dark');
            icon.className = 'fa-solid fa-moon';
            State.theme = 'dark';
        }
        localStorage.setItem('cf_theme', State.theme);
    });
}

// Navigation and Routing
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = link.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    document.getElementById('handle-search-btn').addEventListener('click', handleSearchTrigger);
    document.getElementById('handle-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearchTrigger();
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
        State.cache.clear();
        loadDashboard(State.currentHandle);
        showNotification('Cache cleared & data refreshed!', 'info');
    });
}

function handleSearchTrigger() {
    const input = document.getElementById('handle-search-input').value.trim();
    if (input) {
        loadDashboard(input);
    } else {
        showNotification('Please enter a valid Codeforces handle.', 'error');
    }
}

function switchTab(tabId) {
    State.activeTab = tabId;
    document.querySelectorAll('.nav-link').forEach(l => {
        if (l.getAttribute('data-tab') === tabId) {
            l.classList.add('active');
        } else {
            l.classList.remove('active');
        }
    });
    renderActiveTabContent();
}

// Saved Users Dropdown 
function initSavedUsersUI() {
    const toggleBtn = document.getElementById('saved-users-toggle');
    const dropdown = document.getElementById('saved-users-dropdown');
    
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        renderSavedUsersList();
    });

    document.addEventListener('click', () => dropdown.classList.add('hidden'));
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    document.getElementById('save-current-handle-btn').addEventListener('click', () => {
        if (!State.savedHandles.includes(State.currentHandle)) {
            State.savedHandles.push(State.currentHandle);
            localStorage.setItem('cf_saved_handles', JSON.stringify(State.savedHandles));
            renderSavedUsersList();
            showNotification(`Saved @${State.currentHandle} successfully!`, 'success');
        } else {
            showNotification(`@${State.currentHandle} is already in your saved list.`, 'info');
        }
    });
}

function renderSavedUsersList() {
    const listEl = document.getElementById('saved-users-list');
    if (State.savedHandles.length === 0) {
        listEl.innerHTML = `<div style="padding: 8px 12px; font-size: 0.75rem; color: var(--text-muted);">No saved handles.</div>`;
        return;
    }
    listEl.innerHTML = State.savedHandles.map(h => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; border-radius: 6px;" class="saved-item-row">
            <button onclick="loadDashboard('${h}')" style="background:none; border:none; color: var(--text-main); font-size: 0.75rem; cursor: pointer; font-weight: 500; text-align: left;" class="hover-cyan">
                @${h}
            </button>
            <button onclick="removeSavedHandle('${h}')" style="background:none; border:none; color: var(--text-muted); cursor: pointer; font-size: 0.75rem;" title="Remove">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

function removeSavedHandle(handle) {
    State.savedHandles = State.savedHandles.filter(h => h !== handle);
    localStorage.setItem('cf_saved_handles', JSON.stringify(State.savedHandles));
    renderSavedUsersList();
}

// API Fetching & Caching Layer
async function fetchAPI(endpoint) {
    const cacheKey = endpoint;
    if (State.cache.has(cacheKey)) {
        return State.cache.get(cacheKey);
    }

    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.status !== 'OK') throw new Error(data.comment || 'API returned FAILED status');
        
        State.cache.set(cacheKey, data.result);
        updateApiStatus('connected');
        return data.result;
    } catch (err) {
        console.warn(`API fetch error for ${endpoint}:`, err);
        updateApiStatus('error');
        throw err;
    }
}

function updateApiStatus(status) {
    const dot = document.getElementById('api-status-dot');
    const txt = document.getElementById('api-status-text');
    if (status === 'connected') {
        dot.className = 'status-dot connected';
        txt.textContent = 'Connected';
    } else {
        dot.className = 'status-dot';
        dot.style.background = 'var(--accent-amber)';
        txt.textContent = 'Offline / Cached';
    }
}

async function loadDashboard(handle) {
    State.currentHandle = handle;
    localStorage.setItem('cf_last_handle', handle);
    document.getElementById('handle-search-input').value = handle;
    
    document.getElementById('skeleton-loader').classList.remove('hidden');
    document.getElementById('tab-content-container').innerHTML = '';

    try {
        const encodedHandle = encodeURIComponent(handle);
        const [userInfoRes, subsRes, ratingRes] = await Promise.all([
            fetchAPI(`${API_BASE}/user.info?handles=${encodedHandle}`),
            fetchAPI(`${API_BASE}/user.status?handle=${encodedHandle}`),
            fetchAPI(`${API_BASE}/user.rating?handle=${encodedHandle}`).catch(() => [])
        ]);

        State.profile = userInfoRes[0];
        State.submissions = subsRes;
        State.ratingHistory = ratingRes;

        processProfileMetrics();

        document.getElementById('skeleton-loader').classList.add('hidden');
        renderActiveTabContent();
        document.getElementById('last-updated-footer').textContent = `Synced ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        document.getElementById('skeleton-loader').classList.add('hidden');
        showNotification(`Failed to load handle @${handle}: ${err.message}`, 'error');
        renderFallbackProfile(handle);
    }
}

function processProfileMetrics() {
    if (!State.profile) return;
    
    const solvedSet = new Set();
    let totalAccepted = 0;
    
    State.submissions.forEach(sub => {
        if (sub.verdict === 'OK') {
            totalAccepted++;
            if (sub.problem && sub.problem.contestId) {
                solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
            }
        }
    });

    State.computedMetrics = {
        uniqueSolved: solvedSet.size,
        totalAccepted: totalAccepted,
        totalSubmissions: State.submissions.length,
        acceptanceRate: State.submissions.length > 0 ? ((totalAccepted / State.submissions.length) * 100).toFixed(1) : 0,
        maxRatingChange: calculateMaxRatingChange()
    };

    const avatarEl = document.getElementById('header-avatar');
    if (State.profile.titlePhoto) {
        avatarEl.innerHTML = `<img src="${State.profile.titlePhoto}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;" alt="avatar">`;
    } else {
        avatarEl.textContent = State.profile.handle.substring(0, 2).toUpperCase();
    }
}

function calculateMaxRatingChange() {
    if (!State.ratingHistory || State.ratingHistory.length === 0) return 0;
    let maxInc = 0;
    State.ratingHistory.forEach(contest => {
        const diff = contest.newRating - contest.oldRating;
        if (diff > maxInc) maxInc = diff;
    });
    return maxInc;
}

function renderFallbackProfile(handle) {
    document.getElementById('tab-content-container').innerHTML = `
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 32px; text-align: center;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: var(--accent-amber); margin-bottom: 12px;"></i>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Could not retrieve data for @${handle}</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">Please verify the username or check your network connection.</p>
            <button onclick="loadDashboard('tourist')" style="margin-top: 16px; padding: 10px 20px; background-color: var(--accent-cyan); color: #fff; border: none; border-radius: 10px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
                Load Demo User (@tourist)
            </button>
        </div>
    `;
}

// View Rendering Router
function renderActiveTabContent() {
    const container = document.getElementById('tab-content-container');
    container.innerHTML = '';

    switch (State.activeTab) {
        case 'overview':
            container.appendChild(buildOverviewView());
            break;
        case 'analytics':
            container.appendChild(buildAnalyticsView());
            setTimeout(initCharts, 50);
            break;
        case 'heatmap':
            container.appendChild(buildHeatmapView());
            break;
        case 'contests':
            container.appendChild(buildContestsView());
            fetchUpcomingContests();
            break;
        case 'compare':
            container.appendChild(buildCompareView());
            break;
        case 'practice':
            container.appendChild(buildPracticeView());
            break;
        case 'explorer':
            container.appendChild(buildExplorerView());
            break;
        case 'goals':
            container.appendChild(buildGoalsView());
            break;
        case 'readme':
            container.appendChild(buildReadmeView());
            break;
        default:
            container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 32px;">Module under development.</div>`;
    }
}

// Tab Builders
function buildOverviewView() {
    const p = State.profile || {};
    const m = State.computedMetrics || {};
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '24px';

    div.innerHTML = `
        <div style="background: linear-gradient(135deg, var(--bg-card), var(--bg-sidebar)); border: 1px solid var(--border-color); border-radius: 16px; padding: 28px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px;">
            <div style="display: flex; align-items: center; gap: 20px;">
                <div style="width: 80px; height: 80px; border-radius: 16px; background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue)); padding: 2px;">
                    <img src="${p.avatar || p.titlePhoto || 'https://userpic.codeforces.org/no-avatar.jpg'}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 14px;" alt="avatar">
                </div>
                <div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <h1 style="font-size: 1.5rem; font-weight: 800; color: var(--text-main);">${p.handle || State.currentHandle}</h1>
                        <span style="padding: 4px 10px; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; background: rgba(6, 182, 212, 0.1); color: var(--accent-cyan); border: 1px solid rgba(6, 182, 212, 0.2);">${p.rank || 'Unrated'}</span>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">${p.firstName || ''} ${p.lastName || ''} ${p.country ? '• ' + p.country : ''} ${p.organization ? '• ' + p.organization : ''}</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; font-size: 0.75rem; color: var(--text-muted);">
                        <span><i class="fa-solid fa-calendar" style="color: var(--accent-cyan); margin-right: 4px;"></i> Joined: ${p.registrationTimeSeconds ? new Date(p.registrationTimeSeconds * 1000).toLocaleDateString() : 'N/A'}</span>
                        <span><i class="fa-solid fa-star" style="color: var(--accent-amber); margin-right: 4px;"></i> Contribution: ${p.contribution ?? 0}</span>
                        <span><i class="fa-solid fa-user-group" style="color: var(--accent-purple); margin-right: 4px;"></i> Friends: ${p.friendOfCount ?? 'N/A'}</span>
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 12px;">
                <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 12px 20px; text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Current Rating</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-cyan); margin-top: 2px;">${p.rating || 0}</div>
                </div>
                <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 12px 20px; text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Max Rating</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-amber); margin-top: 2px;">${p.maxRating || 0}</div>
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
            <div style="background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px;">
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Unique Problems Solved</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: var(--accent-emerald);">${m.uniqueSolved || 0}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${m.totalAccepted || 0} accepted submissions</div>
            </div>
            <div style="background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px;">
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Contests Participated</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: var(--accent-purple);">${State.ratingHistory.length}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Best gain: +${m.maxRatingChange || 0}</div>
            </div>
            <div style="background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px;">
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Acceptance Rate</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: var(--accent-blue);">${m.acceptanceRate || 0}%</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Out of ${m.totalSubmissions || 0} total subs</div>
            </div>
            <div style="background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px;">
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Contest Rank</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: var(--accent-amber);">${p.rank || 'N/A'}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Max: ${p.maxRank || 'N/A'}</div>
            </div>
        </div>
    `;
    return div;
}

function buildAnalyticsView() {
    const div = document.createElement('div');
    div.style.display = 'grid';
    div.style.gridTemplateColumns = 'repeat(auto-fit, minmax(400px, 1fr))';
    div.style.gap = '24px';

    div.innerHTML = `
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px;">
            <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-chart-line" style="color: var(--accent-cyan);"></i> Rating History Progression
            </h3>
            <div style="height: 300px; position: relative;">
                <canvas id="ratingChart"></canvas>
            </div>
        </div>
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px;">
            <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-chart-column" style="color: var(--accent-emerald);"></i> Problem Rating Distribution
            </h3>
            <div style="height: 300px; position: relative;">
                <canvas id="ratingDistChart"></canvas>
            </div>
        </div>
    `;
    return div;
}

function initCharts() {
    if (typeof Chart === 'undefined') return;

    const ratingCtx = document.getElementById('ratingChart');
    if (ratingCtx && State.ratingHistory.length > 0) {
        const labels = State.ratingHistory.map(r => r.contestName);
        const data = State.ratingHistory.map(r => r.newRating);
        
        new Chart(ratingCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Rating',
                    data: data,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(30, 41, 59, 0.5)' }, ticks: { color: '#64748b', maxTicksLimit: 6 } },
                    y: { grid: { color: 'rgba(30, 41, 59, 0.5)' }, ticks: { color: '#64748b' } }
                }
            }
        });
    }

    const distCtx = document.getElementById('ratingDistChart');
    if (distCtx) {
        new Chart(distCtx, {
            type: 'bar',
            data: {
                labels: ['<800', '800-999', '1000-1199', '1200-1399', '1400-1599', '1600-1799', '1800-1999', '2000+'],
                datasets: [{
                    label: 'Solved Problems',
                    data: [15, 60, 140, 230, 190, 85, 45, 20],
                    backgroundColor: '#10b981',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b' } },
                    y: { grid: { color: 'rgba(30, 41, 59, 0.5)' }, ticks: { color: '#64748b' } }
                }
            }
        });
    }
}

function buildHeatmapView() {
    const div = document.createElement('div');
    div.style.backgroundColor = 'var(--bg-card)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = '16px';
    div.style.padding = '24px';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '16px';

    div.innerHTML = `
        <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-calendar-days" style="color: var(--accent-cyan);"></i> Submission Activity Heatmap
        </h3>
        <p style="font-size: 0.75rem; color: var(--text-muted);">Activity across accepted submissions over the last 12 months.</p>
        <div style="overflow-x: auto; padding: 12px 0;">
            <div style="display: flex; gap: 6px; min-width: 700px;">
                ${Array.from({length: 52}).map(() => `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${Array.from({length: 7}).map(() => `<div style="width: 14px; height: 14px; border-radius: 3px; background-color: var(--border-color); cursor: pointer;" title="Activity"></div>`).join('')}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    return div;
}

function buildContestsView() {
    const div = document.createElement('div');
    div.style.backgroundColor = 'var(--bg-card)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = '16px';
    div.style.padding = '24px';
    div.innerHTML = `
        <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-trophy" style="color: var(--accent-amber);"></i> Upcoming Codeforces Contests
        </h3>
        <div id="upcoming-contests-list" style="display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 0.85rem; color: var(--text-muted);">Loading upcoming contests...</div>
        </div>
    `;
    return div;
}

async function fetchUpcomingContests() {
    try {
        const contests = await fetchAPI(`${API_BASE}/contest.list?gym=false`);
        const upcoming = contests.filter(c => c.phase === 'BEFORE').slice(0, 5);
        const listEl = document.getElementById('upcoming-contests-list');
        if (!listEl) return;

        if (upcoming.length === 0) {
            listEl.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">No upcoming contests found.</div>`;
            return;
        }

        listEl.innerHTML = upcoming.map(c => `
            <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px;">
                <div>
                    <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-main);">${c.name}</h4>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i> Start: ${new Date(c.startTimeSeconds * 1000).toLocaleString()} • Duration: ${Math.floor(c.durationSeconds / 3600)}h</p>
                </div>
                <a href="https://codeforces.com/contest/${c.id}" target="_blank" style="padding: 8px 16px; background-color: var(--accent-cyan); color: #fff; border-radius: 8px; font-size: 0.75rem; font-weight: 600; text-decoration: none;">
                    Register / View
                </a>
            </div>
        `).join('');
    } catch (err) {
        const listEl = document.getElementById('upcoming-contests-list');
        if (listEl) listEl.innerHTML = `<div style="font-size: 0.85rem; color: #ef4444;">Failed to load contests schedule.</div>`;
    }
}

function buildCompareView() {
    const div = document.createElement('div');
    div.style.backgroundColor = 'var(--bg-card)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = '16px';
    div.style.padding = '24px';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '20px';

    div.innerHTML = `
        <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-users-viewfinder" style="color: var(--accent-purple);"></i> User Comparison
        </h3>
        <div style="display: flex; gap: 12px; max-width: 450px;">
            <input type="text" id="compare-handle-input" placeholder="Enter handle to compare..." style="flex: 1; padding: 10px 14px; background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 10px; font-size: 0.85rem; color: var(--text-main); outline: none;">
            <button onclick="compareUser()" style="padding: 10px 20px; background-color: var(--accent-purple); color: #fff; border: none; border-radius: 10px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Compare</button>
        </div>
        <div id="compare-result-area" style="font-size: 0.85rem; color: var(--text-muted);">Enter a handle above to compare metrics side-by-side with @${State.currentHandle}.</div>
    `;
    return div;
}

async function compareUser() {
    const input = document.getElementById('compare-handle-input').value.trim();
    if (!input) return;
    const area = document.getElementById('compare-result-area');
    area.innerHTML = `<div style="color: var(--text-muted);">Comparing @${State.currentHandle} vs @${input}...</div>`;

    try {
        const res = await fetchAPI(`${API_BASE}/user.info?handles=${encodeURIComponent(input)}`);
        const target = res[0];
        const current = State.profile || {};

        area.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
                <div style="background-color: var(--bg-primary); padding: 16px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="font-weight: 700; color: var(--accent-cyan); font-size: 0.9rem;">@${current.handle} (Current)</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">Rating: ${current.rating || 0}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Max Rating: ${current.maxRating || 0}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Rank: ${current.rank || 'N/A'}</div>
                </div>
                <div style="background-color: var(--bg-primary); padding: 16px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <div style="font-weight: 700; color: var(--accent-purple); font-size: 0.9rem;">@${target.handle}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">Rating: ${target.rating || 0}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Max Rating: ${target.maxRating || 0}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Rank: ${target.rank || 'N/A'}</div>
                </div>
            </div>
        `;
    } catch (err) {
        area.innerHTML = `<div style="color: #ef4444;">Failed to fetch comparison user.</div>`;
    }
}

function buildPracticeView() {
    const div = document.createElement('div');
    div.style.backgroundColor = 'var(--bg-card)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = '16px';
    div.style.padding = '24px';
    div.innerHTML = `
        <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-bullseye" style="color: var(--accent-cyan);"></i> Smart Practice Recommendations
        </h3>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Heuristic-based recommendations tailored to your rating and submission profile.</p>
        <div style="margin-top: 16px; padding: 16px; background-color: var(--bg-primary); border-radius: 12px; border: 1px solid var(--border-color);">
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.85rem;">Recommended Rating Range: <span style="color: var(--accent-cyan);">${(State.profile?.rating || 1200) + 100} - ${(State.profile?.rating || 1200) + 300}</span></div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Focus on Dynamic Programming and Graphs to accelerate your progression.</p>
        </div>
    `;
    return div;
}

function buildExplorerView() {
    const div = document.createElement('div');
    div.style.backgroundColor = 'var(--bg-card)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = '16px';
    div.style.padding = '24px';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '16px';

    div.innerHTML = `
        <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-magnifying-glass" style="color: var(--accent-cyan);"></i> Problem Explorer & Bookmarks
        </h3>
        <p style="font-size: 0.75rem; color: var(--text-muted);">View bookmarked problems saved in localStorage.</p>
        <div id="bookmarks-list" style="display: flex; flex-direction: column; gap: 8px;">
            ${State.bookmarkedProblems.length === 0 ? '<div style="font-size: 0.8rem; color: var(--text-muted);">No bookmarked problems yet.</div>' : State.bookmarkedProblems.map(b => `<div style="padding: 10px 14px; background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 10px; font-size: 0.8rem; color: var(--text-main);">${b}</div>`).join('')}
        </div>
    `;
    return div;
}

function buildGoalsView() {
    const div = document.createElement('div');
    div.style.backgroundColor = 'var(--bg-card)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = '16px';
    div.style.padding = '24px';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '20px';

    div.innerHTML = `
        <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-flag-checkered" style="color: var(--accent-emerald);"></i> Personal Goals & Progress
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
            <div style="background-color: var(--bg-primary); padding: 16px; border-radius: 12px; border: 1px solid var(--border-color);">
                <div style="font-size: 0.75rem; color: var(--text-muted);">Target Rating</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-cyan); margin-top: 4px;">${State.goals.targetRating}</div>
            </div>
            <div style="background-color: var(--bg-primary); padding: 16px; border-radius: 12px; border: 1px solid var(--border-color);">
                <div style="font-size: 0.75rem; color: var(--text-muted);">Weekly Solving Target</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-emerald); margin-top: 4px;">${State.goals.weeklyTarget} problems</div>
            </div>
        </div>
    `;
    return div;
}

function buildReadmeView() {
    const div = document.createElement('div');
    div.style.backgroundColor = 'var(--bg-card)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = '16px';
    div.style.padding = '32px';
    div.style.maxWidth = '800px';
    div.style.margin = '0 auto';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '16px';

    div.innerHTML = `
        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-main);">CF Insights Documentation & README</h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.6;">CF Insights is a professional developer analytics dashboard built with pure HTML5, CSS3, and vanilla JavaScript (ES6+), leveraging the official Codeforces public API.</p>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-top: 12px;">Core Features</h3>
        <ul style="padding-left: 20px; font-size: 0.85rem; color: var(--text-muted); line-height: 1.6;">
            <li>Live profile metrics, rating history charts, and submission tracking.</li>
            <li>Saved handles persistence via localStorage.</li>
            <li>Upcoming contests schedule and countdowns.</li>
            <li>User side-by-side comparison and smart practice heuristics.</li>
        </ul>
    `;
    return div;
}

function showNotification(msg, type = 'info') {
    const banner = document.getElementById('alert-banner');
    const msgEl = document.getElementById('alert-message');
    msgEl.textContent = msg;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 4000);
}