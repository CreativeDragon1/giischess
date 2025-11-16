// Firebase configuration - UPDATE WITH YOUR CREDENTIALS (same as app.js)
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

// Lichess API
const LICHESS_API = 'https://lichess.org/api';

// Point system
const POINTS = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6: 8, 7: 6, 8: 4, 9: 2, 10: 1
};

// Extract tournament ID from URL (supports both arena and swiss)
function extractTournamentId(input) {
    if (!input) return null;
    
    // If it's already just an ID (8 characters)
    if (input.length === 8 && /^[a-zA-Z0-9]+$/.test(input)) {
        return { id: input, type: 'arena' };
    }
    
    // Extract from Swiss URL
    const swissMatch = input.match(/lichess\.org\/swiss\/([a-zA-Z0-9]+)/);
    if (swissMatch) {
        return { id: swissMatch[1], type: 'swiss' };
    }
    
    // Extract from Arena URL
    const arenaMatch = input.match(/lichess\.org\/tournament\/([a-zA-Z0-9]+)/);
    if (arenaMatch) {
        return { id: arenaMatch[1], type: 'arena' };
    }
    
    return null;
}

// Fetch tournament results from Lichess API (supports both arena and swiss)
async function fetchLichessResults(tournamentId, tournamentType) {
    try {
        showAlert('Fetching results from Lichess...', 'success');
        
        let response;
        if (tournamentType === 'swiss') {
            // Swiss tournament endpoint
            response = await fetch(`${LICHESS_API}/swiss/${tournamentId}/results?nb=20`);
        } else {
            // Arena tournament endpoint
            response = await fetch(`${LICHESS_API}/tournament/${tournamentId}/results?nb=20`);
        }
        
        if (!response.ok) throw new Error('Failed to fetch results');
        
        const text = await response.text();
        const results = text.trim().split('\n')
            .filter(line => line)
            .map(line => JSON.parse(line));
        
        return results;
    } catch (error) {
        showAlert('Error fetching from Lichess: ' + error.message, 'error');
        return null;
    }
}

// Fetch full results (up to 200) for history backfill
async function fetchFullLichessResults(tournamentId, tournamentType) {
    try {
        let response;
        if (tournamentType === 'swiss') {
            response = await fetch(`${LICHESS_API}/swiss/${tournamentId}/results?nb=200`);
        } else {
            response = await fetch(`${LICHESS_API}/tournament/${tournamentId}/results?nb=200`);
        }
        if (!response.ok) throw new Error('Failed to fetch full results');
        const text = await response.text();
        return text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    } catch (e) {
        showAlert('Error fetching full results: ' + e.message, 'error');
        return null;
    }
}

// Fetch tournament info (name, timings)
async function fetchLichessInfo(tournamentId, tournamentType) {
    try {
        const url = tournamentType === 'swiss'
            ? `${LICHESS_API}/swiss/${tournamentId}`
            : `${LICHESS_API}/tournament/${tournamentId}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch tournament info');
        return await resp.json();
    } catch (e) {
        showAlert('Error fetching tournament info: ' + e.message, 'error');
        return null;
    }
}

// Backfill History from Lichess
async function backfillHistoryFromLichess() {
    const input = document.getElementById('historyUrl').value.trim();
    const info = extractTournamentId(input);
    if (!info) {
        showAlert('Please enter a valid Lichess tournament URL (Swiss or Arena)', 'error');
        return;
    }
    showAlert('Backfilling history from Lichess…', 'success');
    const [meta, results] = await Promise.all([
        fetchLichessInfo(info.id, info.type),
        fetchFullLichessResults(info.id, info.type)
    ]);
    if (!results || results.length === 0) {
        showAlert('No results found or tournament not finished yet', 'error');
        return;
    }
    const normalized = results.map((p, idx) => ({
        rank: p.rank ?? (idx + 1),
        username: p.username,
        score: p.score ?? null,
        rating: p.rating ?? null,
        performance: p.performance ?? null,
        points: POINTS[idx + 1] || 0
    }));
    const ratings = normalized.map(n => n.rating).filter(r => typeof r === 'number');
    const avgRating = ratings.length ? Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length) : null;
    const name = meta?.name || 'Tournament';
    const variant = meta?.variant || 'standard';
    const link = info.type === 'swiss' ? `https://lichess.org/swiss/${info.id}` : `https://lichess.org/tournament/${info.id}`;
    const finishedAt = Date.now();
    const history = {
        id: info.id,
        name,
        time: (meta?.startsAt || meta?.createdAt) ? new Date(meta.startsAt || meta.createdAt).toLocaleString() : '',
        link,
        variant,
        type: info.type,
        finishedAt,
        participants: results.length,
        averageRating: avgRating,
        results: normalized
    };
    try {
        await database.ref(`tournamentsHistory/${info.id}`).set(history);
        showAlert('✅ History saved. Check Past Tournaments on the main site.');
        document.getElementById('historyUrl').value = '';
    } catch (e) {
        showAlert('Error saving history: ' + e.message, 'error');
    }
}

// Import results from Lichess
async function importFromLichess() {
    const input = document.getElementById('lichessUrl').value.trim();
    const tournamentInfo = extractTournamentId(input);
    
    if (!tournamentInfo) {
        showAlert('Please enter a valid Lichess tournament URL (Swiss or Arena)', 'error');
        return;
    }
    
    const results = await fetchLichessResults(tournamentInfo.id, tournamentInfo.type);
    
    if (!results || results.length === 0) {
        showAlert('No results found or tournament is not finished yet', 'error');
        return;
    }
    
    // Fill in the form with the results (top 10)
    results.slice(0, 10).forEach((player, index) => {
        const position = index + 1;
        const inputField = document.getElementById(`pos${position}`);
        if (inputField) {
            inputField.value = player.username;
        }
    });
    
    const tournamentTypeText = tournamentInfo.type === 'swiss' ? 'Swiss' : 'Arena';
    showAlert(`✅ Successfully imported top ${Math.min(results.length, 10)} players from ${tournamentTypeText} tournament!`, 'success');
    document.getElementById('lichessUrl').value = '';
}

// Tab switching
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
}

// Alert system
function showAlert(message, type = 'success') {
    const alertBox = document.getElementById('alertBox');
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.style.display = 'block';
    
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 5000);
}

// Set active tournament
function setActiveTournament() {
    const name = document.getElementById('activeName').value.trim();
    const dateVal = document.getElementById('activeDate').value; // YYYY-MM-DD
    const timeVal = document.getElementById('activeTime').value; // HH:MM
    const link = document.getElementById('activeLink').value.trim();
    const variant = document.getElementById('activeVariant').value;

    if (!name || !dateVal || !timeVal || !link) {
        showAlert('Please fill in name, date, time and link', 'error');
        return;
    }

    // Compose a friendly display string for the public site
    let displayTime = `${dateVal} ${timeVal}`;
    try {
        const dt = new Date(`${dateVal}T${timeVal}`);
        if (!isNaN(dt.getTime())) {
            displayTime = dt.toLocaleString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit'
            });
        }
    } catch {}

    database.ref('activeTournament').set({
        name: name,
        time: displayTime, // keep existing schema for app.js
        link: link,
        variant: variant,
        active: true,
        // store raw values too for future edits (optional)
        date: dateVal,
        timeValue: timeVal
    }).then(() => {
        showAlert('Active tournament set successfully!');
        document.getElementById('activeName').value = '';
        document.getElementById('activeDate').value = '';
        document.getElementById('activeTime').value = '';
        document.getElementById('activeLink').value = '';
        document.getElementById('activeVariant').value = 'standard';
    }).catch(error => {
        showAlert('Error: ' + error.message, 'error');
    });
}

// Clear active tournament
function clearActiveTournament() {
    database.ref('activeTournament').set({
        active: false
    }).then(() => {
        showAlert('Active tournament cleared');
    }).catch(error => {
        showAlert('Error: ' + error.message, 'error');
    });
}



// Submit tournament results
function submitResults() {
    const results = {};
    let hasResults = false;
    
    // Collect all entered results
    for (let pos = 1; pos <= 10; pos++) {
        const playerName = document.getElementById(`pos${pos}`).value.trim();
        if (playerName) {
            results[playerName] = {
                position: pos,
                points: POINTS[pos]
            };
            hasResults = true;
        }
    }
    
    if (!hasResults) {
        showAlert('Please enter at least one player', 'error');
        return;
    }
    
    // Update leaderboard
    const updates = {};
    const promises = [];
    
    Object.entries(results).forEach(([playerName, data]) => {
        const playerRef = database.ref(`leaderboard/${playerName}`);
        
        promises.push(
            playerRef.once('value').then(snapshot => {
                const currentData = snapshot.val() || {
                    name: playerName,
                    points: 0,
                    wins: 0,
                    tournaments: 0
                };
                
                updates[`leaderboard/${playerName}`] = {
                    name: playerName,
                    points: (currentData.points || 0) + data.points,
                    wins: (currentData.wins || 0) + (data.position === 1 ? 1 : 0),
                    tournaments: (currentData.tournaments || 0) + 1
                };
            })
        );
    });
    
    Promise.all(promises).then(() => {
        return database.ref().update(updates);
    }).then(() => {
        showAlert('Results submitted and leaderboard updated!');
        
        // Increment current round
        database.ref('seasonInfo/currentRound').once('value').then(snapshot => {
            const currentRound = snapshot.val() || 0;
            database.ref('seasonInfo/currentRound').set(currentRound + 1);
        });
        
        // Clear form
        for (let i = 1; i <= 10; i++) {
            document.getElementById(`pos${i}`).value = '';
        }
    }).catch(error => {
        showAlert('Error: ' + error.message, 'error');
    });
}

// Add player
function addPlayer() {
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        showAlert('Please enter a player name', 'error');
        return;
    }
    
    const updates = {};
    updates[`leaderboard/${playerName}`] = { name: playerName, points: 0, wins: 0, tournaments: 0 };
    updates[`participants/${playerName}`] = true;
    database.ref().update(updates).then(() => {
        showAlert(`Player ${playerName} added!`);
        document.getElementById('playerName').value = '';
    }).catch(error => {
        showAlert('Error: ' + error.message, 'error');
    });
}

// Load and display players
function loadPlayers() {
    database.ref('leaderboard').on('value', (snapshot) => {
        const players = snapshot.val();
        const playersList = document.getElementById('playersList');
        
        if (!players || Object.keys(players).length === 0) {
            playersList.innerHTML = '<p class="no-data">No players registered yet</p>';
            return;
        }
        
        playersList.innerHTML = '';
        Object.entries(players).forEach(([key, player]) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'admin-panel';
            wrapper.style.marginBottom = '12px';
            wrapper.innerHTML = `
                <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; flex-wrap:wrap;">
                    <div style="min-width:220px;">
                        <strong>${player.name}</strong>
                        <div style="color: var(--text-muted); font-size: 0.9rem;">Edit stats below and Save</div>
                    </div>
                    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                        <div class="form-group" style="margin:0;">
                            <label>Points</label>
                            <input type="number" id="pts-${key}" value="${player.points || 0}" min="0" style="width:110px;">
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label>Wins</label>
                            <input type="number" id="wins-${key}" value="${player.wins || 0}" min="0" style="width:110px;">
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label>Tournaments</label>
                            <input type="number" id="tours-${key}" value="${player.tournaments || 0}" min="0" style="width:130px;">
                        </div>
                        <div class="admin-actions">
                            <button class="btn btn-success" onclick="updatePlayer('${key}', '${player.name.replace(/'/g, "\'")}')">Save</button>
                            <button class="btn btn-primary" onclick="deletePlayer('${key}')" style="background:#ef4444;">Delete</button>
                        </div>
                    </div>
                </div>
            `;
            playersList.appendChild(wrapper);
        });
    });
}

function updatePlayer(key, name) {
    const pts = parseInt(document.getElementById(`pts-${key}`).value) || 0;
    const wins = parseInt(document.getElementById(`wins-${key}`).value) || 0;
    const tours = parseInt(document.getElementById(`tours-${key}`).value) || 0;
    database.ref(`leaderboard/${key}`).set({
        name: name,
        points: pts,
        wins: wins,
        tournaments: tours
    }).then(() => {
        showAlert(`Updated ${name}`);
    }).catch(err => showAlert('Error: ' + err.message, 'error'));
}

// Delete player
function deletePlayer(playerKey) {
    if (confirm('Are you sure you want to delete this player?')) {
        const updates = {};
        updates[`leaderboard/${playerKey}`] = null;
        updates[`participants/${playerKey}`] = null;
        database.ref().update(updates).then(() => {
            showAlert('Player deleted');
        }).catch(error => {
            showAlert('Error: ' + error.message, 'error');
        });
    }
}

// Update season info
function updateSeasonInfo() {
    const totalRounds = parseInt(document.getElementById('totalRounds').value);
    const currentRound = parseInt(document.getElementById('currentRound').value);
    const status = document.getElementById('seasonStatus').value;
    
    if (isNaN(totalRounds) || isNaN(currentRound)) {
        showAlert('Please enter valid numbers', 'error');
        return;
    }
    
    database.ref('seasonInfo').set({
        totalRounds: totalRounds,
        currentRound: currentRound,
        status: status
    }).then(() => {
        showAlert('Season info updated!');
    }).catch(error => {
        showAlert('Error: ' + error.message, 'error');
    });
}

// Load season info
function loadSeasonInfo() {
    database.ref('seasonInfo').once('value').then(snapshot => {
        const info = snapshot.val();
        if (info) {
            document.getElementById('totalRounds').value = info.totalRounds || '';
            document.getElementById('currentRound').value = info.currentRound || '';
            document.getElementById('seasonStatus').value = info.status || 'Season Active';
        }
    });
}

// Reset leaderboard
function resetLeaderboard() {
    if (confirm('⚠️ WARNING: This will delete ALL player data and reset the leaderboard. Are you absolutely sure?')) {
        if (confirm('This action cannot be undone. Click OK to confirm.')) {
            database.ref('leaderboard').remove().then(() => {
                showAlert('Leaderboard has been reset');
            }).catch(error => {
                showAlert('Error: ' + error.message, 'error');
            });
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadPlayers();
    loadSeasonInfo();
});
