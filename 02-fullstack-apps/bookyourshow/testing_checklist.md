# 🎬 BookYourShow — Complete Feature Testing Checklist

> **How to use:** Test each item, then mark ✅ Pass or ❌ Fail.  
> Submit this file back and I will fix every ❌.

---

## Services Status (Check First)

| Service | URL | Expected |
|---------|-----|----------|
| API Health | http://localhost:5000/api/v1/health | `{"success":true,"data":{"status":"healthy"}}` |
| Frontend | http://localhost:3000 | Homepage loads, hero section visible |
| RAG Service | http://localhost:8001/health | `{"status":"ok"}` |

---

## Module 1 — Homepage & Navigation

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 1.1 | Homepage loads | Go to http://localhost:3000 | Hero section with movie cards visible, no blank screen | |
| 1.2 | City selector | Click city name in navbar | Dropdown shows 8 cities (Ahmedabad, Mumbai, Delhi…) | |
| 1.3 | Change city | Select "Mumbai" from dropdown | Page re-fetches movies for Mumbai; city updates in navbar | |
| 1.4 | City persists | Change to "Delhi", refresh page | Still shows Delhi after refresh | |
| 1.5 | Movie cards | Scroll homepage | Movie poster cards visible with title, rating, genre, format badges | |
| 1.6 | Hero slideshow | Wait 5 sec on homepage | Hero background changes to next movie automatically | |
| 1.7 | Movies link | Click "Movies" in navbar | Routes to /movies page | |
| 1.8 | Footer visible | Scroll to bottom of homepage | Footer renders without overlap | |

---

## Module 2 — Authentication

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 2.1 | Sign Up page | Click "Sign In" → click "Create account" link | Signup form shows (name, email, password) | |
| 2.2 | Sign Up validation | Submit empty form | Red validation errors appear under each field | |
| 2.3 | Sign Up — weak password | Enter password "123" | Error: password too short | |
| 2.4 | Sign Up — success | Fill valid details (new email) | Redirected to homepage; navbar shows user name | |
| 2.5 | Duplicate email | Sign up with same email again | Error: "User with this email already exists" | |
| 2.6 | Login page | Click "Sign In" | Login form shows (email, password) | |
| 2.7 | Login — wrong password | Enter correct email, wrong password | Error: "Invalid credentials" | |
| 2.8 | Login — success | Enter `admin@bookyourshow.com` / `admin123456` | Logged in; navbar shows "admin" name | |
| 2.9 | Session persists | Log in, refresh page | Still logged in (token from localStorage) | |
| 2.10 | Logout | Click name → Sign Out | Redirected; navbar shows "Sign In" button | |
| 2.11 | Protected route redirect | While logged out, go to /bookings | Redirected to /auth/login | |
| 2.12 | Token auto-refresh | Stay logged in for 15+ min | Still logged in (refresh token silently re-issues access token) | |

---

## Module 3 — Movie Discovery

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 3.1 | Movies list page | Go to /movies | Grid of movie cards with poster, title, rating, genre | |
| 3.2 | Genre filter | Select "Action" from genre dropdown | Movies list filters to action only | |
| 3.3 | Language filter | Select "Hindi" from language dropdown | Movies filter to Hindi films | |
| 3.4 | Sort by rating | Select "Sort: Rating (High → Low)" | Movies sorted with highest rating first | |
| 3.5 | Pagination | Click "Next Page" | Shows next set of movies | |
| 3.6 | Movie detail page | Click any movie poster/title | Opens /movies/[slug] with full movie info | |
| 3.7 | Movie detail — poster | On movie detail page | Poster image visible on left | |
| 3.8 | Movie detail — backdrop | On movie detail page | Full-width backdrop image behind header | |
| 3.9 | Movie detail — cast | Scroll down on detail page | Cast photos and names in horizontal scroll | |
| 3.10 | Movie detail — metadata | On detail page | Shows rating, duration, language, director, certificate | |
| 3.11 | Book Tickets button | Click "Book Tickets" on movie detail | Routes to /movies/[slug]/showtimes | |
| 3.12 | Watch Trailer button | Click "Watch Trailer" (if visible) | Opens YouTube link in new tab | |

---

## Module 4 — Showtimes

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 4.1 | Showtimes page | Click "Book Tickets" on any movie | Shows /movies/[slug]/showtimes | |
| 4.2 | Date tabs | Showtimes page | Shows 7 date tabs (today + 6 days) | |
| 4.3 | Today's shows | Select today's date tab | Shows showtimes for today (Toy Story 5, Backrooms, etc.) | |
| 4.4 | Showtime cards | See showtimes | Cards show time, screen, theater name, city, price tiers | |
| 4.5 | Different date | Click tomorrow's date tab | Shows showtimes for tomorrow | |
| 4.6 | Theater grouping | See showtimes list | Showtimes grouped by theater | |
| 4.7 | No shows fallback | Pick a date with no shows | "No shows found" message | |

---

## Module 5 — Seat Selection & Booking

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 5.1 | Seat map opens | Click a showtime | Routes to /book/[showtimeId] with interactive seat map | |
| 5.2 | Seat map renders | On booking page | Grid of seats color-coded: Green=available, Red=booked, Amber=held | |
| 5.3 | Tier labels | On seat map | Row labels show tier names (Silver, Gold, VIP) | |
| 5.4 | Select a seat | Click a green seat | Seat turns cyan/blue, added to "Booking Summary" | |
| 5.5 | Deselect seat | Click selected (cyan) seat | Seat goes back to green, removed from summary | |
| 5.6 | Select multiple | Click 3 different seats | All 3 shown in Booking Summary with individual prices | |
| 5.7 | Total calculation | Select 2 Gold seats (₹220 each) | Total shows ₹440 | |
| 5.8 | Summary sidebar | Select at least 1 seat | Right panel shows seats, prices, and "Pay ₹X" button | |
| 5.9 | Auth required | Try booking while logged out | Redirected to login | |
| 5.10 | Seat hold (Redis) | Select seat & start payment | Seat temporarily shows as "held" for others | |

---

## Module 6 — Payment (Razorpay)

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 6.1 | Payment modal opens | Click "Pay ₹X" with seats selected | Razorpay checkout modal/popup opens | |
| 6.2 | Razorpay branding | In Razorpay popup | Shows "BookYourShow" as merchant name | |
| 6.3 | Amount shown | In Razorpay popup | Correct amount matches seat total | |
| 6.4 | Test payment success | Use test card `4111 1111 1111 1111`, CVV `123`, any future expiry | Payment processes, redirected to /bookings/[id] | |
| 6.5 | Booking confirmed | After test payment | Booking detail page shows status "CONFIRMED" | |
| 6.6 | Seats finalized | After payment | Previously held seats show as booked | |
| 6.7 | Payment failure | Close Razorpay modal without paying | Booking stays PENDING; seats released after 5 min | |

---

## Module 7 — Booking History

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 7.1 | My Bookings page | Click username → "My Bookings" | Shows /bookings with list of your bookings | |
| 7.2 | Booking cards | On /bookings page | Each booking shows movie, date, time, theater, status badge | |
| 7.3 | Status badges | See booking list | PENDING=amber, CONFIRMED=green, CANCELLED=red | |
| 7.4 | Empty state | New account with no bookings | "No bookings yet" with link to browse movies | |
| 7.5 | Booking detail | Click a booking card | Opens /bookings/[id] with full ticket details | |
| 7.6 | Ticket layout | On booking detail | Shows movie, date, time, theater, screen, all seats, total | |
| 7.7 | Cancel button | On a PENDING/CONFIRMED booking | "Cancel Booking" button visible at bottom | |
| 7.8 | Cancel modal | Click "Cancel Booking" | Confirmation modal opens with booking ID and movie name | |
| 7.9 | Cancel confirm | Click "Yes, Cancel" in modal | Booking status changes to CANCELLED; button disappears | |

---

## Module 8 — User Profile

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 8.1 | Profile page | Click username → "Profile" | /profile shows avatar, name, email, role, phone | |
| 8.2 | Role badge | On profile page | Shows "Member" for regular users, "Administrator" for admins | |
| 8.3 | My Bookings link | On profile page | "My Bookings" quick action card visible | |
| 8.4 | Bookings link works | Click "My Bookings" on profile | Navigates to /bookings | |
| 8.5 | Admin link | Log in as admin, go to profile | "Admin Panel" quick action appears | |
| 8.6 | Auth guard | Go to /profile while logged out | Redirected to /auth/login | |

---

## Module 9 — Admin Panel

> **Login:** `admin@bookyourshow.com` / `admin123456`

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 9.1 | Admin dashboard | Go to /admin | Stats dashboard: Users, Movies, Bookings, Revenue | |
| 9.2 | Non-admin blocked | Log in as regular user, go to /admin | Error or redirect (not admin) | |
| 9.3 | Recent bookings table | On /admin dashboard | Last 5 bookings shown with movie, status, amount | |
| 9.4 | Users list | Click "Users" in admin sidebar | Table with all registered users, roles, created date | |
| 9.5 | User search | Type in search box on users page | Filters users by name or email | |
| 9.6 | Movies list (admin) | Click "Movies" in admin sidebar | Grid/table of all 120 movies with edit button | |
| 9.7 | Movie sync | Click "Sync from TMDB" button | Spinner → success message; movie count may increase | |
| 9.8 | Showtimes list (admin) | Click "Showtimes" in admin sidebar | Table of all showtimes with movie, screen, date, time, status | |
| 9.9 | Create showtime | Click "+ Add Showtime" | Form to pick movie, screen, date, time, price multiplier | |
| 9.10 | Theaters list (admin) | Click "Theaters" in admin sidebar | Lists existing theaters with city, screens count | |
| 9.11 | Bookings list (admin) | Click "Bookings" in admin sidebar | All system bookings with user, movie, status, amount | |

---

## Module 10 — AI Chatbot (RAG)

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 10.1 | Chat bubble | Homepage bottom-right | Purple floating button with sparkle icon visible | |
| 10.2 | Pulse animation | Look at chat button | Pulsing ring animation around button | |
| 10.3 | Open chat | Click the bubble | Chat panel slides open (380px wide) | |
| 10.4 | Welcome message | Open chat | "Hi! I'm your Movie AI..." greeting with suggestion chips | |
| 10.5 | Suggestion chips | Open chat | Shows 4 quick suggestion buttons | |
| 10.6 | Quick suggestion | Click "Top rated movies in your database?" | Response streams in with movie recommendations | |
| 10.7 | Markdown rendering | See AI response | **Bold text** renders as bold, • bullet lists render as bullets (not raw asterisks) | |
| 10.8 | Typing indicator | Send a message | "Thinking…" spinner while waiting for response | |
| 10.9 | Streaming response | Watch response appear | Text appears word-by-word (streaming, not all at once) | |
| 10.10 | Custom question | Type "Are there any Hindi movies?" | AI responds with relevant Hindi movies from database | |
| 10.11 | Context history | Send 2nd question "What about horror?" | AI remembers previous context, answers in context | |
| 10.12 | Close chat | Click X button | Panel closes; bubble reappears | |

---

## Module 11 — Health Checks & Edge Cases

| # | Feature | Steps | Expected Output | Result |
|---|---------|-------|-----------------|--------|
| 11.1 | Invalid movie slug | Go to /movies/fake-movie-0000 | "Movie not found" error state (not crash) | |
| 11.2 | Invalid booking ID | Go to /bookings/FAKE-ID | "Booking not found" (not crash) | |
| 11.3 | Wrong password (rate limit) | Try wrong password 5+ times fast | "Too many auth attempts" error from rate limiter | |
| 11.4 | Image fallbacks | If a movie has no poster | Placeholder SVG shown (not broken image icon) | |
| 11.5 | API offline | Stop API, try to browse | Toast or error state — no unhandled crash | |
| 11.6 | Seat unavailable | Try to book a seat already taken | "Seats already held/booked" error toast | |
| 11.7 | PENDING booking expire | Wait 5 min after creating PENDING booking | Seats released (Redis lock expires) | |

---

## Summary

| Module | Passed | Failed | Notes |
|--------|--------|--------|-------|
| M1 Homepage | / | / | |
| M2 Auth | / | / | |
| M3 Movies | / | / | |
| M4 Showtimes | / | / | |
| M5 Booking | / | / | |
| M6 Payment | / | / | |
| M7 History | / | / | |
| M8 Profile | / | / | |
| M9 Admin | / | / | |
| M10 AI Chat | / | / | |
| M11 Edge Cases | / | / | |

> Mark ✅ or ❌ in the Result column and paste back — I'll fix all failures.
