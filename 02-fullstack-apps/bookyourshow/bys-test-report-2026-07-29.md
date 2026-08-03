# BookYourShow Test Report v2.0
_Generated: 30/07/2026, 02:17:08_

## Summary
| Metric | Count |
|--------|-------|
| ✅ Passed | 24 |
| ❌ Failed | 7 |
| ⏭️ Skipped | 6 |
| Total | 105 |
| Coverage | 35% |

## 🏠 Homepage & Navigation

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1.1 | Homepage loads | ✅ |  |
| 1.2 | City shows Ahmedabad | ✅ |  |
| 1.3 | Movie cards render | ✅ |  |
| 1.4 | Exactly 20 TMDB movies | ❌ |  |
| 1.5 | Hero auto-slide | ✅ |  |
| 1.6 | Movies nav link | ✅ |  |
| 1.7 | Footer visible | ✅ |  |

## 🔐 Authentication

| # | Test | Result | Notes |
|---|------|--------|-------|
| 2.1 | Signup page opens | ✅ |  |
| 2.2 | Signup validation | ✅ |  |
| 2.3 | Weak password rejected | ❌ | not working properly, like when i hit submit without meeting these critieras, "request validation failed" pop up appeard but there should be reason of it like not matching paasword critiera of no uppercase or special char or anything like that |
| 2.4 | Strong password accepted | ✅ |  |
| 2.5 | Signup success + email OTP | ⏭️ | is mailhog the best thing we can do for now?, like cant we send otp to the mail one is registering with |
| 2.6 | OTP verification works | ✅ |  |
| 2.7 | Duplicate email blocked | ✅ |  |
| 2.8 | Login page opens | ✅ |  |
| 2.9 | Wrong password blocked | ⏭️ |  |
| 2.10 | Admin login | ❌ |  |
| 2.11 | Session persists | ❌ |  |
| 2.12 | Logout works | ✅ |  |
| 2.13 | Protected route guard | ✅ |  |

## 🔑 Google OAuth (Secure)

| # | Test | Result | Notes |
|---|------|--------|-------|
| 3.1 | Google Sign-In button visible | ✅ |  |
| 3.2 | Google consent screen opens | ✅ |  |
| 3.3 | Tokens NOT in URL | ⏭️ |  |
| 3.4 | Logged in after Google OAuth | ✅ |  |
| 3.5 | Session persists | ❌ | after 5-6 refreshes, it signs out  |
| 3.6 | No token leakage in history | ⏭️ |  |

## 🎬 Movie Discovery

| # | Test | Result | Notes |
|---|------|--------|-------|
| 4.1 | Movies list page loads | ✅ |  |
| 4.2 | Genre filter works | ✅ |  |
| 4.3 | Language filter works | ❌ |  |
| 4.4 | Sort by rating | ✅ |  |
| 4.5 | Pagination works | ❌ |  |
| 4.6 | Movie detail page | ⏭️ | sometimes works sometimes not |
| 4.7 | Poster visible | ✅ |  |
| 4.8 | Backdrop image | ⏭️ | quality is not good, like not HD just some blurry low resolution background |
| 4.9 | Cast section | ✅ |  |
| 4.10 | Movie metadata | ✅ |  |
| 4.11 | Book Tickets CTA | ✅ |  |

## 🕐 Showtimes

| # | Test | Result | Notes |
|---|------|--------|-------|
| 5.1 | Showtimes page opens | ⬜ |  |
| 5.2 | Date tabs visible | ⬜ |  |
| 5.3 | Today's shows exist | ⬜ |  |
| 5.4 | Showtime card content | ⬜ |  |
| 5.5 | Multiple screens shown | ⬜ |  |
| 5.6 | No-shows fallback | ⬜ |  |

## 💺 Seat Selection

| # | Test | Result | Notes |
|---|------|--------|-------|
| 6.1 | Seat map opens | ⬜ |  |
| 6.2 | Seat map renders | ⬜ |  |
| 6.3 | Tier labels visible | ⬜ |  |
| 6.4 | Select a seat | ⬜ |  |
| 6.5 | Deselect a seat | ⬜ |  |
| 6.6 | Select 3 seats | ⬜ |  |
| 6.7 | Total calculation | ⬜ |  |
| 6.8 | Pay button appears | ⬜ |  |
| 6.9 | Auth required for booking | ⬜ |  |

## 💳 Payment (Razorpay)

| # | Test | Result | Notes |
|---|------|--------|-------|
| 7.1 | Razorpay modal opens | ⬜ |  |
| 7.2 | Merchant name correct | ⬜ |  |
| 7.3 | Amount matches | ⬜ |  |
| 7.4 | Test payment success | ⬜ |  |
| 7.5 | Booking confirmed status | ⬜ |  |
| 7.6 | Payment cancel | ⬜ |  |

## 📧 Email Notifications

| # | Test | Result | Notes |
|---|------|--------|-------|
| 8.1 | Welcome email on signup | ⬜ |  |
| 8.2 | OTP email delivered | ⬜ |  |
| 8.3 | Booking confirmation email | ⬜ |  |
| 8.4 | Password reset email | ⬜ |  |
| 8.5 | Kafka UI shows events | ⬜ |  |

## 🎟️ Booking History

| # | Test | Result | Notes |
|---|------|--------|-------|
| 9.1 | My Bookings page loads | ⬜ |  |
| 9.2 | Booking cards content | ⬜ |  |
| 9.3 | Status badge colours | ⬜ |  |
| 9.4 | Empty state | ⬜ |  |
| 9.5 | Booking detail page | ⬜ |  |
| 9.6 | Ticket details | ⬜ |  |
| 9.7 | Cancel button visible | ⬜ |  |
| 9.8 | Cancel confirms | ⬜ |  |

## 👤 User Profile

| # | Test | Result | Notes |
|---|------|--------|-------|
| 10.1 | Profile page loads | ⬜ |  |
| 10.2 | Role badge correct | ⬜ |  |
| 10.3 | Admin Panel link | ⬜ |  |
| 10.4 | Auth guard | ⬜ |  |

## 🔧 Admin Panel

| # | Test | Result | Notes |
|---|------|--------|-------|
| 11.1 | Admin dashboard loads | ⬜ |  |
| 11.2 | Non-admin blocked | ⬜ |  |
| 11.3 | Recent bookings table | ⬜ |  |
| 11.4 | Users list page | ⬜ |  |
| 11.5 | Movies admin page | ⬜ |  |
| 11.6 | TMDB sync button | ⬜ |  |
| 11.7 | Showtimes admin page | ⬜ |  |
| 11.8 | Theaters admin page | ⬜ |  |
| 11.9 | Bookings admin page | ⬜ |  |

## 🤖 AI Chatbot (RAG)

| # | Test | Result | Notes |
|---|------|--------|-------|
| 12.1 | Chat bubble visible | ⬜ |  |
| 12.2 | Chat panel opens | ⬜ |  |
| 12.3 | Welcome message | ⬜ |  |
| 12.4 | Suggestion click works | ⬜ |  |
| 12.5 | Markdown renders | ⬜ |  |
| 12.6 | Streaming visible | ⬜ |  |
| 12.7 | Custom question | ⬜ |  |

## 🛡️ Security & reCAPTCHA

| # | Test | Result | Notes |
|---|------|--------|-------|
| 13.1 | reCAPTCHA badge visible | ⬜ |  |
| 13.2 | Login works with reCAPTCHA | ⬜ |  |
| 13.3 | Signup works with reCAPTCHA | ⬜ |  |
| 13.4 | Auth rate limit hits | ⬜ |  |
| 13.5 | OTP brute-force lockout | ⬜ |  |
| 13.6 | Security headers present | ⬜ |  |
| 13.7 | Tokens not in Google OAuth URL | ⬜ |  |
| 13.8 | Booking rate limit | ⬜ |  |
| 13.9 | Admin-only routes blocked | ⬜ |  |

## ⚠️ Edge Cases & Error Handling

| # | Test | Result | Notes |
|---|------|--------|-------|
| 14.1 | Invalid movie slug | ⬜ |  |
| 14.2 | Invalid booking ID | ⬜ |  |
| 14.3 | Image fallbacks | ⬜ |  |
| 14.4 | Seat unavailable error | ⬜ |  |
| 14.5 | 404 page | ⬜ |  |

