# GIIS Chess Championship Website 🏆

A modern F1-style tournament leaderboard system for managing chess championships with real-time updates via Firebase and **Lichess API integration**. Supports both **Swiss** and **Arena** tournament formats with multiple chess variants!

## ✨ Features

- **Tournament Management**: Display active and upcoming Lichess tournament links
- **Live Leaderboard**: F1-inspired point system with real-time rankings
- **🔥 Lichess API Integration**: Automatically fetch tournament results from Swiss or Arena formats
- **Chess Variants Support**: Standard, Crazyhouse, Chess960, King of the Hill, and more
- **Pagination**: Smoothly browse leaderboards with 20+ participants
- **Championship Tracking**: Season progress and standings
- **Admin Panel**: Easy management interface with one-click auto-import from Lichess
- **Dark Mode**: Toggle between light and dark themes with SmartCare-inspired design
- **Responsive Design**: Professional gradient-based UI optimized for all devices
- **Real-time Updates**: Live tournament status updates every 30 seconds

## 🎨 Design Features

- Modern gradient-based UI with Inter font
- Dark/Light mode toggle with localStorage persistence
- Smooth animations and transitions
- Responsive for mobile and desktop
- Live status badges with pulsing animations
- Professional position badges (#1, #2, #3) for top players
- Hover effects and micro-interactions
- Pagination controls for large leaderboards (20+ players)

## 🎮 Lichess API Integration

### What You Can Do

1. **Auto-Import Results**: Paste a Lichess tournament URL (Swiss or Arena) to automatically import top 10 standings
2. **Live Status Updates**: Tournament status (LIVE NOW, UPCOMING, FINISHED) updates automatically every 30 seconds
3. **No Manual Entry**: Save time by letting the API fetch results directly from Lichess
4. **Supports Swiss Tournaments**: Works with both `/swiss/` and `/tournament/` formats

### How to Use

1. Host a tournament on [Lichess.org](https://lichess.org)
   - **Arena**: `https://lichess.org/tournament/abc123XY`
   - **Swiss**: `https://lichess.org/swiss/cqyFH8oh`
2. Copy the tournament URL
3. In admin panel, go to "Results" tab
4. Paste the URL in the "Auto-Import from Lichess" section
5. Click "Import Results from Lichess"
6. Top 10 players auto-fill in the form - then submit!

### API Endpoints Used

- Arena: `GET /api/tournament/{id}` - Tournament info
- Arena: `GET /api/tournament/{id}/results?nb=20` - Top 20 standings
- Swiss: `GET /api/swiss/{id}` - Swiss tournament info
- Swiss: `GET /api/swiss/{id}/results?nb=20` - Top 20 standings

**No API key required!** Lichess API is free and open.

## 🎯 Chess Variants Supported

Host tournaments in any Lichess variant:

- **Standard** - Classic chess
- **Crazyhouse** - Drop captured pieces back on the board
- **Chess960** - Fischer Random Chess with randomized starting positions
- **King of the Hill** - Bring your king to the center to win
- **Three-check** - Check opponent's king three times to win
- **Antichess** - Lose all your pieces or get stalemated to win
- **Atomic** - Captures create explosions
- **Horde** - Black defends with 36 pawns vs normal white army
- **Racing Kings** - Race your king to the back rank

Variants are displayed next to tournament names on the website!

## 📊 Point System (F1 Style)

- 1st Place: 25 points 🥇
- 2nd Place: 18 points 🥈
- 3rd Place: 15 points 🥉
- 4th-10th: 12, 10, 8, 6, 4, 2, 1 points

## 📄 Leaderboard Pagination

- Shows 10 players per page
- Automatic pagination for 11+ participants
- Arrow buttons (← Previous / Next →) to navigate pages
- Page indicator shows current page (e.g., "Page 1 of 3")
- Perfect for tournaments with 20+ participants!

## 🚀 Quick Start (No Firebase Setup)

Want to see the design first? Just open `demo.html` in your browser! It has sample data with working pagination and dark mode toggle.

## 📚 Documentation

- **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)** - Complete Firebase configuration guide
- **[ADMIN_GUIDE.md](ADMIN_GUIDE.md)** - How to use the admin panel (with Swiss support)
- **[QUICK_START.md](QUICK_START.md)** - Fast setup instructions

## Firebase Setup

See **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)** for detailed step-by-step instructions on:
1. Creating a Firebase project
2. Setting up Realtime Database
3. Getting your configuration
4. Updating app.js and admin.js
5. Configuring security rules
6. Deploying your site

## Deployment Options

### Option 1: Firebase Hosting (Recommended)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

Your site will be live at: `https://your-project-id.web.app`

### Option 2: GitHub Pages

1. Create a GitHub repository
2. Push all files
3. Go to Settings → Pages
4. Select branch and root folder
5. Save and deploy!

### Option 3: Netlify or Vercel

Simply drag and drop your project folder, or connect your GitHub repository!

## File Structure

```
Chess_Leaderboard/
├── index.html           # Main public page
├── admin.html           # Admin management panel
├── demo.html            # Demo with sample data
├── styles.css           # All styling (light/dark mode)
├── app.js              # Main site logic + Firebase + Lichess API
├── admin.js            # Admin panel logic + auto-import
├── README.md           # This file
├── FIREBASE_SETUP.md   # Firebase setup guide
├── ADMIN_GUIDE.md      # Admin panel user guide
└── QUICK_START.md      # Quick start guide
```

## Usage Guide

### For Players (Public Site)

1. Visit `index.html`
2. See active tournament with variant displayed
3. Click "Join Tournament" to go to Lichess
4. View live leaderboard standings (with pagination if 11+ players)
5. Check upcoming tournaments
6. Toggle dark mode using the moon/sun icon

### For Admins

1. Visit `admin.html`
2. **Tournaments Tab**:
   - Set active tournament with Lichess link (Swiss or Arena)
   - Select chess variant (Standard, Crazyhouse, Chess960, etc.)
   - Add upcoming tournaments
3. **Results Tab**:
   - **Auto-import from Lichess!** Paste Swiss or Arena tournament URL
   - Or manually enter tournament results (1st-10th place)
   - Points are awarded automatically
4. **Players Tab**:
   - Add new players
   - View all registered players with stats
5. **Season Tab**:
   - Update season info (rounds, status)
   - Reset leaderboard for new season

For detailed instructions, see **[ADMIN_GUIDE.md](ADMIN_GUIDE.md)**

## 🎨 Preview

Open `demo.html` in your browser to see the design with sample data and working pagination!

## Database Structure

```json
{
  "activeTournament": {
    "name": "GIIS Chess Round 1",
    "time": "Saturday, Nov 16, 3:00 PM",
    "link": "https://lichess.org/swiss/cqyFH8oh",
    "variant": "standard",
    "active": true
  },
  "upcomingTournaments": {
    "id1": {
      "name": "Round 2",
      "date": "Nov 23",
      "time": "3:00 PM",
      "variant": "crazyhouse"
    }
  },
  "leaderboard": {
    "PlayerName": {
      "name": "PlayerName",
      "points": 25,
      "wins": 1,
      "tournaments": 1
    }
  },
  "seasonInfo": {
    "totalRounds": 10,
    "currentRound": 1,
    "status": "Season Active"
  }
}
```

## Customization

- **Colors**: Edit CSS variables in `styles.css` (`:root` section)
- **Point System**: Modify `POINTS` object in `app.js` and `admin.js`
- **Branding**: Update title and text in HTML files
- **Variants**: Add more chess variants in the dropdown (admin.html)

## Security Recommendations

1. **Add Authentication**: Use Firebase Auth to protect admin panel
2. **Secure Database Rules**: Restrict write access to authenticated admins only
3. **Hide Admin Panel**: Don't link to `admin.html` from public pages
4. **Use Environment Variables**: For production, use Firebase environment config

See **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)** for security rule examples.

## Troubleshooting

### Lichess Import Issues

- **"Please enter a valid Lichess tournament URL"**
  - Check URL format: `https://lichess.org/swiss/XXXXXXXX` or `https://lichess.org/tournament/XXXXXXXX`
  - Make sure you copied the entire URL

- **"No results found or tournament is not finished yet"**
  - Tournament must be completely finished
  - Wait a few minutes after tournament ends
  - Use manual entry if auto-import fails

### Firebase Issues

- **"Permission denied"** - Check your database security rules
- **"Firebase not initialized"** - Verify config in app.js and admin.js
- **Data not showing** - Check Firebase Console → Realtime Database

### Pagination Not Working

- Pagination only appears with 11+ players
- Check browser console (F12) for JavaScript errors
- Clear browser cache and refresh

## Support

For issues or questions:
- Check browser console (F12) for errors
- Verify Firebase configuration is correct
- Review **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)** and **[ADMIN_GUIDE.md](ADMIN_GUIDE.md)**
- Check [Lichess API Docs](https://lichess.org/api)

## License

Free to use for GIIS Chess Club and educational purposes.

---

Built with ❤️ for GIIS Chess Club
#   g i i s c h e s s  
 