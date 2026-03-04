## Below features have the infrastructure in place but are hidden:
- Week Day selection bar to create a trip sheet for a past date
- Camera button in each card
- ~~BOL field in each card~~


# Why the app beats Google Sheets on a phone

1. **Google Sheets on mobile is genuinely painful**
Sheets was built for desktop. On a phone you're constantly pinching to zoom, tapping tiny cells, accidentally editing the wrong row, watching the keyboard push your content off screen, and fighting merged cells that don't scroll cleanly. Every interaction takes 3× longer than it should.

2. **"Log Now" eliminates the biggest daily friction**
The most frequent action drivers take is logging a time. In Sheets: tap cell, type "2:45 PM", hope the format is right. In the app: one tap on the green button, done, current time stamped. At 15+ stops a day, this alone is significant.

3. **Trailer number writes itself**
Enter it once at the MDC card. Every store in that segment gets it. In Sheets: copy-paste down a column, or type it 8 times and make a typo on stop 6.

5. <span style="color: #ffc400;">**Mistakes are caught before submission, not after**</span>
The validation step flags hard blocks (missing required fields) and soft warnings before the sheet ever leaves the driver's hands. In Sheets, bad data reaches the owner silently and has to be chased down by phone.

6. **Accidental edits are nearly impossible**
Cards are collapsed by default. You have to deliberately expand a stop to change anything. In Sheets, a stray thumb swipe edits a cell and you may not notice.

7. **The familiar structure is still there**
The order is the same: clock-in → MDC → stores → MDC → submit. Drivers aren't learning a new mental model, just a better interface for the same workflow. Segment markers and truck-change markers let them annotate the day exactly as they would on paper.

8. **Flags replace written notes in the margin**
SAME DAY SPECIAL, OFF DAY CALL, MISSING CALL — one tap instead of scribbling in a comment cell that the owner then has to interpret.

The core argument in one sentence: **the app does everything Sheets does, but it's built for thumbs, not mice**


# Data preservation — save events

| Trigger | What fires | Where data lands |
|---------|------------|-----------------|
| Any field changes | `saveState()` to localStorage | Driver's phone, instant |
| Every 10 seconds | `syncTrip()` via fetch | Backend SQLite |
| App backgrounded / screen locked | `syncTrip()` via fetch on `visibilitychange: hidden` | Backend SQLite |
| Browser closing / navigating away | `syncTripBeacon()` via sendBeacon on `pagehide` | Backend SQLite |
| Photo taken | Upload to `/api/trips/{id}/photos` | Backend filesystem, immediately |
| Driver hits Submit | `submitTrip()` + localStorage archive | Backend DB + Excel file |
| Backend down at submit | localStorage "pending" flag | Retried automatically when server returns |
| App reopened after crash | Restored from localStorage | Driver continues exactly where they left off |