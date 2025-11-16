// Firebase configuration - UPDATE WITH YOUR CREDENTIALS
const firebaseConfig = {
  apiKey: "AIzaSyB_Se07roHPMY4hdPPEDndrvU3jQ43Tqg0",
  authDomain: "chess-55332.firebaseapp.com",
  databaseURL: "https://chess-55332-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chess-55332",
  storageBucket: "chess-55332.firebasestorage.app",
  messagingSenderId: "290540980372",
  appId: "1:290540980372:web:065f40083d0cdc49674c81",
  measurementId: "G-RQFKCHZKY6"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Lichess API base URL
const LICHESS_API = 'https://lichess.org/api';

// Point system (F1 style)
const POINTS = {
    1: 25,
    2: 18,
    3: 15,
    4: 12,
    5: 10,
    6: 8,
    7: 6,
    8: 4,
    9: 2,
    10: 1
};

// Lichess API functions
async function fetchTournamentInfo(tournamentInfo) {
    try {
        let response;
        if (tournamentInfo.type === 'swiss') {
            response = await fetch(`${LICHESS_API}/swiss/${tournamentInfo.id}`);
        } else {
            response = await fetch(`${LICHESS_API}/tournament/${tournamentInfo.id}`);
        }
        
        if (!response.ok) throw new Error('Tournament not found');
        return await response.json();
    } catch (error) {
        console.error('Error fetching tournament:', error);
        return null;
    }
}

async function fetchTournamentStandings(tournamentInfo) {
    try {
        let response;
        if (tournamentInfo.type === 'swiss') {
            response = await fetch(`${LICHESS_API}/swiss/${tournamentInfo.id}/results?nb=200`);
        } else {
            response = await fetch(`${LICHESS_API}/tournament/${tournamentInfo.id}/results?nb=200`);
        }
        
        if (!response.ok) throw new Error('Standings not found');
        
        const text = await response.text();
        const standings = text.trim().split('\n')
            .filter(line => line)
            .map(line => JSON.parse(line));
        
        return standings;
    } catch (error) {
        console.error('Error fetching standings:', error);
        return [];
    }
}

function extractTournamentId(url) {
    // Extract tournament ID from Lichess URL
    // Supports both Swiss and Arena formats
    
    // Swiss format: https://lichess.org/swiss/TOURNAMENT_ID
    const swissMatch = url.match(/lichess\.org\/swiss\/([a-zA-Z0-9]+)/);
    if (swissMatch) {
        return { id: swissMatch[1], type: 'swiss' };
    }
    
    // Arena format: https://lichess.org/tournament/TOURNAMENT_ID
    const arenaMatch = url.match(/lichess\.org\/tournament\/([a-zA-Z0-9]+)/);
    if (arenaMatch) {
        return { id: arenaMatch[1], type: 'arena' };
    }
    
    return null;
}

async function updateTournamentLiveData() {
    const tournamentSnapshot = await database.ref('activeTournament').once('value');
    const tournament = tournamentSnapshot.val();
    
    if (!tournament || !tournament.active || !tournament.link) return;
    
    const tournamentInfo = extractTournamentId(tournament.link);
    if (!tournamentInfo) return;
    
    const info = await fetchTournamentInfo(tournamentInfo);
    if (info) {
        // Update tournament status indicator
        const statusBadge = document.querySelector('.live-badge');
        const formatBadge = document.querySelector('.format-badge');
        if (formatBadge) {
            formatBadge.textContent = (tournamentInfo.type === 'swiss' ? 'SWISS' : 'ARENA');
            formatBadge.style.display = 'inline-flex';
        }
        
        // Check status based on tournament type
        let isFinished, isStarted;
        if (tournamentInfo.type === 'swiss') {
            isFinished = info.status === 'finished';
            isStarted = info.status === 'started';
        } else {
            isFinished = info.isFinished;
            isStarted = info.isStarted;
        }
        
        if (isFinished) {
            statusBadge.textContent = 'FINISHED';
            statusBadge.style.background = '#888';
            await autoProcessIfFinished(tournament, tournamentInfo);
        } else if (isStarted) {
            statusBadge.textContent = 'LIVE NOW';
        } else {
            statusBadge.textContent = 'UPCOMING';
            statusBadge.style.background = '#ffb800';
        }
    }
}

async function autoProcessIfFinished(tournament, tournamentInfo) {
    if (tournament.processed) return;
    try {
        const results = await fetchTournamentStandings(tournamentInfo);
        if (!results || results.length === 0) return;
        const updates = {};
        const promises = [];
        // Top 10: award F1 points
        results.slice(0, 10).forEach((player, idx) => {
            const pos = idx + 1;
            const pts = getPointsForPosition(pos);
            const name = player.username;
            const playerRef = database.ref(`leaderboard/${name}`);
            promises.push(
                playerRef.once('value').then(s => {
                    const current = s.val() || { name, points: 0, wins: 0, tournaments: 0 };
                    updates[`leaderboard/${name}`] = {
                        name,
                        points: (current.points || 0) + pts,
                        wins: (current.wins || 0) + (pos === 1 ? 1 : 0),
                        tournaments: (current.tournaments || 0) + 1
                    };
                })
            );
        });
        // Remaining participants: ensure they exist with 0 points, increment tournaments
        if (results.length > 10) {
            results.slice(10).forEach(player => {
                const name = player.username;
                const playerRef = database.ref(`leaderboard/${name}`);
                promises.push(
                    playerRef.once('value').then(s => {
                        const current = s.val() || { name, points: 0, wins: 0, tournaments: 0 };
                        updates[`leaderboard/${name}`] = {
                            name,
                            points: current.points || 0,
                            wins: current.wins || 0,
                            tournaments: (current.tournaments || 0) + 1
                        };
                    })
                );
            });
        }
        await Promise.all(promises);
        await database.ref().update(updates);

        // Save tournament history with full results
        await saveTournamentHistory(tournament, tournamentInfo, results);

        // Mark processed and deactivate
        await database.ref('activeTournament/processed').set(true);
        await database.ref('activeTournament/active').set(false);
    } catch (e) {
        console.error('Auto process error:', e);
    }
}

// Load current tournament
function loadActiveTournament() {
    database.ref('activeTournament').on('value', (snapshot) => {
        const tournament = snapshot.val();
        
        if (tournament && tournament.active) {
            const variantText = tournament.variant && tournament.variant !== 'standard' 
                ? ` (${formatVariant(tournament.variant)})` 
                : '';
            document.getElementById('tournamentName').textContent = tournament.name + variantText;
            document.getElementById('tournamentTime').textContent = tournament.time;
            
            const linkBtn = document.getElementById('tournamentLink');
            linkBtn.href = tournament.link;
            linkBtn.classList.remove('disabled');
            
            document.querySelector('.live-badge').style.display = 'inline-block';
        } else {
            document.getElementById('tournamentName').textContent = 'No Active Tournament';
            document.getElementById('tournamentTime').textContent = 'Stay tuned for the next round!';
            document.getElementById('tournamentLink').classList.add('disabled');
            document.querySelector('.live-badge').style.display = 'none';
        }
    });
}

// (Removed) loadUpcomingTournaments - upcoming feature deprecated

// Pagination state
let currentPage = 1;
const playersPerPage = 10;
let allPlayers = [];

// Load leaderboard with pagination
function loadLeaderboard() {
    // Listen to both participants and leaderboard for a full roster view
    const leaderboardRef = database.ref('leaderboard');
    const participantsRef = database.ref('participants');

    const update = () => {
        Promise.all([
            leaderboardRef.once('value'),
            participantsRef.once('value')
        ]).then(([lbSnap, partSnap]) => {
            const lb = lbSnap.val() || {};
            const parts = partSnap.val() || {};
            const tbody = document.getElementById('leaderboardBody');

            // Build a map of all unique names from participants and leaderboard
            const names = new Set([
                ...Object.keys(lb),
                ...Object.keys(parts)
            ]);

            if (names.size === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="no-data">No participants yet</td></tr>';
                document.getElementById('paginationControls').style.display = 'none';
                return;
            }

            // Merge stats (default to zeros)
            allPlayers = Array.from(names).map(name => {
                const data = lb[name] || {};
                return {
                    name,
                    points: data.points || 0,
                    wins: data.wins || 0,
                    tournaments: data.tournaments || 0
                };
            }).sort((a, b) => b.points - a.points);

            renderLeaderboardPage();
        });
    };

    // Recompute whenever either node changes
    leaderboardRef.on('value', update);
    participantsRef.on('value', update);
}

function renderLeaderboardPage() {
    const tbody = document.getElementById('leaderboardBody');
    const totalPages = Math.ceil(allPlayers.length / playersPerPage);
    
    // Show pagination only if more than 10 players
    const paginationControls = document.getElementById('paginationControls');
    if (allPlayers.length > playersPerPage) {
        paginationControls.style.display = 'flex';
        document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
        document.getElementById('prevBtn').disabled = currentPage === 1;
        document.getElementById('nextBtn').disabled = currentPage === totalPages;
    } else {
        paginationControls.style.display = 'none';
    }
    
    // Calculate slice indexes
    const startIndex = (currentPage - 1) * playersPerPage;
    const endIndex = startIndex + playersPerPage;
    const pagePlayer = allPlayers.slice(startIndex, endIndex);
    
    tbody.innerHTML = '';
    pagePlayer.forEach((player, indexOnPage) => {
        const globalPosition = startIndex + indexOnPage + 1;
        const row = document.createElement('tr');
        
        // Add special styling for top 3
        if (globalPosition <= 3) {
            row.className = `pos-${globalPosition}`;
        }
        
        let medal = '';
        if (globalPosition === 1) medal = '#1';
        else if (globalPosition === 2) medal = '#2';
        else if (globalPosition === 3) medal = '#3';
        else medal = `#${globalPosition}`;
        
        row.innerHTML = `
            <td><span class="medal">${medal}</span></td>
            <td class="player-name">${player.name}</td>
            <td class="points-highlight">${player.points || 0}</td>
            <td>${player.wins || 0}</td>
            <td>${player.tournaments || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

function nextPage() {
    const totalPages = Math.ceil(allPlayers.length / playersPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderLeaderboardPage();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderLeaderboardPage();
    }
}

// Load season info
function loadSeasonInfo() {
    database.ref('seasonInfo').on('value', (snapshot) => {
        const info = snapshot.val();
        
        if (info) {
            document.getElementById('currentRound').textContent = 
                `Round ${info.currentRound || 0}/${info.totalRounds || 0}`;
            document.getElementById('seasonStatus').textContent = info.status || 'Season Active';
        }
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadActiveTournament();
    loadLeaderboard();
    loadSeasonInfo();
    loadPastTournaments();
    
    // Update live tournament data every 20 seconds
    setInterval(updateTournamentLiveData, 20000);
    updateTournamentLiveData();
});

// Helper function to calculate points for a position
function getPointsForPosition(position) {
    return POINTS[position] || 0;
}

// Helper function to format variant display names
function formatVariant(variant) {
    const variantNames = {
        'standard': 'Standard',
        'crazyhouse': 'Crazyhouse',
        'chess960': 'Chess960',
        'kingOfTheHill': 'King of the Hill',
        'threeCheck': 'Three-check',
        'antichess': 'Antichess',
        'atomic': 'Atomic',
        'horde': 'Horde',
        'racingKings': 'Racing Kings'
    };
    return variantNames[variant] || variant;
}

// Add smooth scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all sections
document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
});

// Export for admin panel usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { POINTS, getPointsForPosition, fetchTournamentInfo, fetchTournamentStandings };
}

// ========= Past Tournaments (History) =========
async function saveTournamentHistory(tournament, tournamentInfo, results) {
    try {
        const id = tournamentInfo.id;
        // Build normalized results with awarded points
        const normalized = results.map((p, idx) => ({
            rank: p.rank ?? (idx + 1),
            username: p.username,
            score: p.score ?? null,
            rating: p.rating ?? null,
            performance: p.performance ?? null,
            points: getPointsForPosition(idx + 1)
        }));

        // Compute summary
        const ratings = normalized.map(n => n.rating).filter(r => typeof r === 'number');
        const avgRating = ratings.length ? Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length) : null;

        const history = {
            id,
            name: tournament.name || 'Tournament',
            time: tournament.time || '',
            link: tournament.link || '',
            variant: tournament.variant || 'standard',
            type: tournamentInfo.type,
            finishedAt: Date.now(),
            participants: results.length,
            averageRating: avgRating,
            results: normalized
        };

        await database.ref(`tournamentsHistory/${id}`).set(history);
    } catch (e) {
        console.error('Failed saving history:', e);
    }
}

function loadPastTournaments() {
    const grid = document.getElementById('historyGrid');
    if (!grid) return;
    database.ref('tournamentsHistory').on('value', (snap) => {
        const data = snap.val();
        if (!data) {
            grid.innerHTML = '<p class="no-data">No finished tournaments yet</p>';
            return;
        }
        const items = Object.values(data).sort((a,b)=> (b.finishedAt||0) - (a.finishedAt||0));
        grid.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'history-card';
            const date = item.finishedAt ? new Date(item.finishedAt).toLocaleString() : (item.time || '');
            const variantText = item.variant && item.variant !== 'standard' ? ` • ${formatVariant(item.variant)}` : '';
            card.innerHTML = `
                <div class="history-title">${item.name}${variantText}</div>
                <div class="history-meta">${item.type?.toUpperCase() || ''} • ${date}</div>
                <div class="history-stats">
                    <span>${item.participants || 0} players</span>
                    <span>${item.averageRating ? ('Avg rating: ' + item.averageRating) : ''}</span>
                </div>
                <div class="history-actions">
                    <button class="btn btn-primary" data-tid="${item.id}">View Details</button>
                    ${item.link ? `<a class="btn btn-success" href="${item.link}" target="_blank" rel="noopener">Lichess</a>` : ''}
                </div>
            `;
            card.querySelector('button').addEventListener('click', ()=> openTournamentModal(item.id));
            grid.appendChild(card);
        });
    });
}

async function openTournamentModal(id) {
    const modal = document.getElementById('tournamentModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');
    const stats = document.getElementById('modalStats');
    if (!modal || !body) return;
    const snap = await database.ref(`tournamentsHistory/${id}`).once('value');
    const data = snap.val();
    if (!data) return;
    title.textContent = data.name;
    const avg = data.averageRating ? `Avg rating: ${data.averageRating}` : '';
    stats.innerHTML = `<div class="stat">Type: ${data.type?.toUpperCase() || ''}</div>
                       <div class="stat">Players: ${data.participants || 0}</div>
                       <div class="stat">${avg}</div>`;
    body.innerHTML = '';
    (data.results || []).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.rank}</td>
            <td class="player-name">${r.username}</td>
            <td>${r.score ?? ''}</td>
            <td>${r.points || 0}</td>
            <td>${r.rating ?? ''}</td>
            <td>${r.performance ?? ''}</td>
        `;
        body.appendChild(tr);
    });
    modal.style.display = 'flex';
}

function closeTournamentModal() {
    const modal = document.getElementById('tournamentModal');
    if (modal) modal.style.display = 'none';
}
