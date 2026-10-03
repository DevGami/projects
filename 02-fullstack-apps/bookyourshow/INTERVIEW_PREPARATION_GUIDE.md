# BookYourShow: Master Technical Interview Preparation Guide

> **Project Stack:** Next.js, React, Node.js, TypeScript, Java Spring Boot, PostgreSQL, MongoDB, Redis, Apache Kafka, Docker, Prisma ORM, Tailwind CSS, Web Security  
> **Repository:** [DevGami/projects - bookyourshow](https://github.com/DevGami/projects/tree/main/02-fullstack-apps/bookyourshow)  
> **Document Purpose:** Complete repository of technical, system design, architectural, and behavioral interview questions derived from your resume. Each question provides a **detailed technical breakdown first** (to build deep conceptual understanding) followed by a **ready-to-speak interview answer** formatted in the first person.

---

## Table of Contents
1. [Category 1: System Design & Concurrency](#category-1-system-design--concurrency)
2. [Category 2: Database Strategy & Polyglot Persistence](#category-2-database-strategy--polyglot-persistence)
3. [Category 3: Caching, In-Memory Store & Rate-Limiting (Redis)](#category-3-caching-in-memory-store--rate-limiting-redis)
4. [Category 4: Event-Driven Messaging & Microservices (Kafka & Spring Boot)](#category-4-event-driven-messaging--microservices-kafka--spring-boot)
5. [Category 5: Frontend Architecture & Performance (Next.js & React)](#category-5-frontend-architecture--performance-nextjs--react)
6. [Category 6: Web Security & Authentication](#category-6-web-security--authentication)
7. [Category 7: DevOps, Containerization & Infrastructure (Docker)](#category-7-devops-containerization--infrastructure-docker)
8. [Category 8: Deep-Dive Technical Edge Cases & Behavioral Scenarios](#category-8-deep-dive-technical-edge-cases--behavioral-scenarios)

---

# Category 1: System Design & Concurrency

---

### Question 1: How do you solve the "Double-Booking Problem" when thousands of users attempt to reserve the exact same seat at the same second?

#### 1. Detailed Technical Explanation & Concepts
* **The Root Problem:** Two concurrent HTTP requests read `seat.status == 'AVAILABLE'` at time $T_0$. Both pass validation and attempt to write `seat.status = 'BOOKED'` at time $T_1$. Without synchronization, both transactions commit, resulting in two tickets issued for the same physical chair.
* **The Two-Tier Reservation Model:**
  1. *Tier 1: Fast In-Memory Distributed Lock (Redis):*
     * A user selecting a seat does not immediately purchase it. They need a 10-minute hold window during checkout.
     * Doing this solely in PostgreSQL with long-running transactions holding row locks (`SELECT ... FOR UPDATE`) exhausts connection pool limits (e.g., PgBouncer / Prisma max connections) and degrades database performance.
     * We use Redis with an atomic operation:
       ```
       SET seat_lock:{showtimeId}:{seatId} {userId} NX EX 600
       ```
     * `NX`: Only set if key does not exist.
     * `EX 600`: Self-expiring in 10 minutes (600 seconds).
     * If the call returns `OK`, the seat is temporarily locked. If `null`, someone else holds it.
  2. *Tier 2: Relational ACID Finalization (PostgreSQL):*
     * When payment succeeds, we commit to PostgreSQL within a Prisma `$transaction`.
     * The `BookingSeat` table enforces a compound unique constraint:
       ```prisma
       @@unique([showtimeId, seatId])
       ```
     * If a race condition bypasses Redis (e.g., Redis failover or cluster partition), PostgreSQL strictly rejects the duplicate insert with error code `P2002` (Unique Constraint Violation), ensuring 100% data integrity.
* **Failure Handling & TTL Expiration:** If the user abandons the checkout or payment fails, no cleanup worker is needed—Redis automatically evicts the lock key after 10 minutes, instantly returning the seat to the available pool.

```
[User A] ---> [API] ---> Redis SET NX EX 600 ---> [OK] (Hold 10 mins)
[User B] ---> [API] ---> Redis SET NX EX 600 ---> [FAIL] ("Seat on hold")
  |
(Payment Success)
  |
[API] ---> Postgres BEGIN TRANSACTION
             UPDATE Seat SET status = 'BOOKED' WHERE id = seatId;
             INSERT INTO Booking (...);
           COMMIT;
      ---> Redis DEL seat_lock:{showtimeId}:{seatId}
```

#### 2. What to Say in the Interview
> *"We solve the double-booking problem through a **Two-Tier Reservation Strategy** that pairs high-throughput Redis distributed locks with strict PostgreSQL ACID transactions.*
> 
> *When a user taps a seat, we acquire an atomic in-memory lock in Redis using `SET key value NX EX 600`. This temporarily reserves the seat for 10 minutes. If a second user taps that same seat, Redis returns null in under 2 milliseconds, and our UI displays that the seat is temporarily on hold.*
> 
> *By holding the lock in Redis rather than PostgreSQL, we avoid long-running database transactions and table-locking contention during high-traffic drops. Once payment is confirmed via Razorpay, our backend finalizes the booking inside a PostgreSQL Prisma `$transaction`. To guarantee zero double-bookings even in catastrophic edge cases, the database schema enforces a compound unique constraint on `showtimeId` and `seatId`. If the user drops off or payment fails, the Redis key expires on its own after 10 minutes, automatically freeing the seat without background cron overhead."*

---

### Question 2: Walk me through the end-to-end architecture of BookYourShow. What happens from the moment a user clicks "Book Ticket" to receiving a confirmation email?

#### 1. Detailed Technical Explanation & Concepts
* **Client Interaction (Next.js):** The user selects seats on the interactive SVG canvas. The Next.js frontend calls `POST /api/v1/bookings/lock-seats` with seat coordinates and showtime ID.
* **API Gateway & Core API (Node.js / Express / TypeScript):**
  * Authenticates user via JWT middleware.
  * Verifies seat availability via Redis atomic keys.
  * Creates an initial `PENDING` booking in PostgreSQL with an associated Razorpay Order ID.
* **Payment Gateway (Razorpay):** The frontend opens the Razorpay checkout modal. The user completes UPI/Card authorization.
* **Signature Verification & State Transition:**
  * Client sends payment response (`razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`) to `/api/v1/bookings/verify-payment`.
  * Node.js verifies the HMAC-SHA256 signature using the secret key.
  * In a PostgreSQL transaction, status changes from `PENDING` to `CONFIRMED`.
  * The Redis lock keys are deleted.
* **Event Dispatch (Apache Kafka):**
  * Node.js produces a JSON event to Kafka topic `booking-events`:
    `{ event: "BOOKING_CONFIRMED", bookingId: "...", userEmail: "...", seats: [...], movieTitle: "..." }`
  * Node.js does not wait for email delivery; it immediately responds with `200 OK` to the frontend, redirecting the user to `/booking/success`.
* **Microservice Consumption (Java Spring Boot):**
  * The `NotificationService` has a `@KafkaListener` subscribed to `booking-events`.
  * It pulls the message, renders a responsive HTML email with ticket details and QR code, and dispatches it via JavaMailSender / SMTP asynchronously.

#### 2. What to Say in the Interview
> *"The flow begins on the Next.js frontend where the user picks seats. The frontend hits our Node.js API, which secures an atomic 10-minute hold in Redis and creates a `PENDING` booking in PostgreSQL alongside a Razorpay Order.*
> 
> *The user completes payment via Razorpay. When Razorpay returns the cryptographic signature, our API verifies the HMAC-SHA256 signature against our webhook secret. Upon successful verification, we execute a Prisma transaction to transition the booking status to `CONFIRMED` and record the payment details.*
> 
> *Crucially, we do not make the user wait for email delivery. The API pushes a `BOOKING_CONFIRMED` message onto an Apache Kafka topic called `booking-events` and immediately sends an HTTP 200 to the client.*
> 
> *On the consumer side, our Java Spring Boot notification microservice consumes the event, formats the ticket email with booking metadata and QR codes, and dispatches it asynchronously. This ensures that even if SMTP servers experience latency or downtime, the core booking API remains blazing fast and unaffected."*

---

### Question 3: Where does BookYourShow stand on the CAP Theorem spectrum, and what trade-offs did you make?

#### 1. Detailed Technical Explanation & Concepts
* **CAP Theorem Basics:** In a distributed system with Network Partitions ($P$), you must choose between Consistency ($C$ - every read receives the most recent write or an error) and Availability ($A$ - every request receives a non-error response without guarantee of latest write).
* **Domain Decomposition Strategy:** A movie ticketing system cannot be simplified into one blanket CAP category. It has two distinct domains:
  1. *Booking & Payment Domain (PostgreSQL) -> **CP System (Consistency over Availability):***
     * You cannot compromise consistency when selling limited physical inventory. Under a network partition or replica lag, you must refuse a booking rather than risk double-selling seats.
     * We prioritize ACID transactions and serializable/repeatable read isolation.
  2. *Movie Catalog & Browsing Domain (MongoDB + Redis) -> **AP System (Availability over Consistency):***
     * If a new movie synopsis or trailer link is updated in the catalog, but a replica or edge cache is 60 seconds delayed, users can still browse and select movies.
     * High availability and fast read latencies (<20ms) are significantly more important than instantaneous consistency across global nodes.

#### 2. What to Say in the Interview
> *"We applied the CAP theorem differently across our subdomains based on business criticality:*
> 
> *For the **Booking & Financial Domain**, we prioritized **Consistency over Availability (CP)**. In movie ticketing, inventory is finite. If a partition occurs, it is far better to fail a checkout gracefully than to overbook a cinema hall and issue conflicting tickets. Here, PostgreSQL provides strong ACID consistency.*
> 
> *For the **Movie Catalog and Discovery Domain**, we chose **Availability and Partition Tolerance (AP)**. Movie synopses, posters, ratings, and cast lists are cached in Redis and backed by MongoDB. If an edge cache is slightly stale for 60 seconds after a TMDB update, the user experience is unharmed. Prioritizing availability ensures users can always browse movies smoothly without experiencing 500 errors during heavy traffic."*

---

### Question 4: How would your system handle a 10x traffic spike (e.g., ticket bookings opening for a blockbuster movie like *Avengers* or *Coldplay*)? What would break first?

#### 1. Detailed Technical Explanation & Concepts
* **What breaks first?**
  1. *Database Connection Pool Exhaustion:* Node.js opens connections to PostgreSQL. If 20,000 users hit `/showtimes` at once, PostgreSQL runs out of connection slots (default `max_connections = 100`).
  2. *Redis Bandwidth & Single-Thread Saturation:* While Redis handles 100k+ ops/sec, complex Lua scripts or returning massive JSON strings across hundreds of concurrent clients saturates network I/O.
  3. *Node.js Event Loop Blocking:* JSON parsing of huge seat arrays or synchronous crypto operations.
* **Mitigation Architecture:**
  * *PgBouncer / Prisma Accelerate:* Connection pooling placed between Node.js and PostgreSQL to reuse existing database connections via transaction-level pooling.
  * *Next.js Edge Caching & CDNs (Cloudflare / Vercel Edge):* Static movie details and showtime schedules cached at the edge with HTTP stale-while-revalidate headers.
  * *Virtual Waiting Room / Queue:* Before entering the seat-selection page, incoming users are assigned a position in a Redis-backed token bucket queue (`FIFO` via Redis Sorted Sets `ZADD` with timestamp score). Only $N$ users per minute enter the seat layout.
  * *Kafka Buffering:* Write spikes to notifications or analytical trackers are buffered in Kafka partitions, preventing downstream microservice crashes.

#### 2. What to Say in the Interview
> *"Under a 10x traffic surge, the first component at risk is the relational database connection pool, followed by API memory exhaustion.*
> 
> *To bulletproof BookYourShow against flash sales:*
> *First, we isolate the read path from the write path. 95% of traffic is browsing. We cache movie listings and showtime availability in Redis with a 90-second TTL and serve static assets via CDN edge caching, absorbing 90% of requests before they touch Node.js or PostgreSQL.*
> 
> *Second, for the critical write path (seat selection), we prevent database connection exhaustion using connection pooling (like PgBouncer). If traffic exceeds venue capacity, we can introduce a Virtual Waiting Room using Redis Sorted Sets, throttling active users into the seat map in controlled cohorts.*
> 
> *Finally, our notification pipeline is already decoupled through Kafka. Even if 50,000 bookings occur in 5 minutes, Kafka buffers the confirmation events safely on disk, allowing our Spring Boot service to consume and send emails at a sustainable pace without crashing."*

---

# Category 2: Database Strategy & Polyglot Persistence

---

### Question 5: Why did you implement Polyglot Persistence with both PostgreSQL AND MongoDB? Isn't maintaining two databases unnecessary operational overhead?

#### 1. Detailed Technical Explanation & Concepts
* **Different Data Models and Access Patterns:**
  * **Relational / Structured / Transactional (PostgreSQL):**
    * Entities: `User`, `Booking`, `Payment`, `Showtime`, `Theater`, `Screen`, `Seat`.
    * Why Postgres: Foreign keys prevent orphaned records (e.g., cannot book a seat that doesn't exist on that screen). Strict schema prevents type coercion errors in financial amounts. ACID transactions guarantee that updating seat status and inserting payment ledger records either succeed together or fail together.
  * **Document / Semi-Structured / Polymorphic (MongoDB):**
    * Entities: `Movie`, `Cast`, `Crew`, `Reviews`, `TMDB Metadata`.
    * Why MongoDB: Movie documents contain variable arrays of genres, spoken languages, backdrop images, YouTube trailer links, cast filmography, and localized descriptions fetched dynamically from the TMDB API. Storing this in relational Postgres requires 6-8 joined tables (`movies`, `movie_genres`, `genres`, `cast`, `movie_cast`, `media_assets`). A single MongoDB document fetch (`findOne({ _id: movieId })`) returns the entire hydrated movie profile in one indexed read without expensive multi-table SQL joins.
* **Operational Trade-off Justification:**
  * While polyglot persistence introduces two connection pools and deployment configurations, it cleanly isolates write contention. High-volume administrative or third-party TMDB catalog updates in MongoDB never lock or impact the transaction log (WAL) of PostgreSQL where live revenue bookings are processing.

```
                    ┌────────────────────────┐
                    │    Node.js Backend     │
                    └───────────┬────────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
   [Prisma ORM / PostgreSQL]          [Mongoose / MongoDB]
   ─────────────────────────          ────────────────────
   • Strict ACID compliance           • Polymorphic JSON documents
   • Complex relational integrity     • Fast single-read hydration
   • Seats, Bookings, Payments        • Movie catalog, Cast, TMDB sync
   • Zero tolerance for data loss     • High read throughput
```

#### 2. What to Say in the Interview
> *"We adopted **Polyglot Persistence** deliberately because our domain models have fundamentally conflicting requirements.*
> 
> *For bookings, payments, and seat layouts, we require strict relational integrity and ACID compliance. A seat belongs to a screen, a screen belongs to a theater, and a booking binds a user to specific seats for a specific showtime. PostgreSQL—managed through Prisma—gives us foreign key constraints, compound unique indexes, and atomic transactions that make double-booking physically impossible at the database layer.*
> 
> *On the other hand, our movie catalog is deeply hierarchical and semi-structured. Each movie has varying metadata: arrays of genres, cast members, crew, video trailers, and localized posters synced from the TMDB API. In PostgreSQL, querying a complete movie page would require joining 6 or 7 normalized tables. In MongoDB, the entire movie entity lives in a single rich document. A single indexed find query hydrates the entire frontend view in sub-5ms.*
> 
> *This separation also ensures that heavy background catalog updates or TMDB synchronizations in MongoDB have zero performance impact on the transactional engine handling ticket purchases in PostgreSQL."*

---

### Question 6: How do you handle distributed consistency between MongoDB and PostgreSQL? What if a movie exists in MongoDB but its showtime in PostgreSQL references a deleted movie?

#### 1. Detailed Technical Explanation & Concepts
* **The Problem:** In a single database, foreign keys (`REFERENCES movies(id) ON DELETE CASCADE`) enforce referential integrity. In a polyglot architecture, PostgreSQL cannot natively validate that a `movieId` string corresponds to a valid `_id` in MongoDB.
* **Our Solution:**
  1. *Immutable Foreign Identifiers:* The MongoDB `Movie._id` (or TMDB ID) is stored as a string column in the PostgreSQL `Showtime` table.
  2. *Soft Deletes:* We never execute hard deletes (`DELETE FROM movies`) on active catalog records. We set `isArchived: true` or `status: 'INACTIVE'` in MongoDB.
  3. *Application-Level Validation:* During showtime creation in the admin controller, the Node.js API queries MongoDB to verify the movie exists and is actively marked `NOW_SHOWING` before persisting the showtime in PostgreSQL.
  4. *Defensive Frontend Rendering:* If a movie is archived or unavailable, the PostgreSQL showtime query gracefully falls back or excludes orphan showtimes using our `catchUpShowtimes()` routine.

#### 2. What to Say in the Interview
> *"Because foreign keys cannot cross database boundaries, we enforce consistency through **application-level constraints and soft deletes**.*
> 
> *First, we treat movie IDs as immutable reference identifiers. When our automated showtime engine schedules screens in PostgreSQL, it validates that the `movieId` exists and has an active status in MongoDB.*
> 
> *Second, we enforce a strict **Soft Delete policy** in MongoDB. Movies are never hard deleted; their status is simply transitioned to `ARCHIVED`. This guarantees that historical booking records, revenue statistics, and user ticket histories in PostgreSQL never point to a missing entity.*
> 
> *Finally, our rolling showtime maintenance job automatically expires past showtimes, preventing stale references from ever reaching user-facing views."*

---

### Question 7: Explain how you use Prisma ORM transactions. What isolation level does Prisma use, and how did you prevent race conditions?

#### 1. Detailed Technical Explanation & Concepts
* **Prisma Interactive Transactions (`$transaction`):**
  * Normal Prisma calls are individual queries. If query A succeeds and query B fails, the system is left in an inconsistent state.
  * We wrap the booking finalization inside an interactive transaction:
    ```typescript
    await prisma.$transaction(async (tx) => {
      // 1. Fetch showtime with lock check
      const showtime = await tx.showtime.findUnique({
        where: { id: showtimeId }
      });
      
      // 2. Check if seats are already occupied
      const existingBookings = await tx.bookingSeat.findMany({
        where: {
          showtimeId,
          seatId: { in: selectedSeatIds },
          booking: { status: 'CONFIRMED' }
        }
      });
      
      if (existingBookings.length > 0) {
        throw new Error('SEAT_ALREADY_BOOKED');
      }

      // 3. Create the confirmed booking
      const booking = await tx.booking.create({ ... });

      // 4. Create the booking-seat junctions
      await tx.bookingSeat.createMany({ ... });

      return booking;
    });
    ```
* **PostgreSQL Default Isolation Level:** `Read Committed`.
  * Under Read Committed, each query sees data committed before the query began.
  * To prevent phantom reads or write skews during high-concurrency seat updates, we can elevate to `Serializable` or rely on our PostgreSQL unique constraint `@@unique([showtimeId, seatId])` on `BookingSeat`. If two concurrent transactions execute simultaneously, the database engine permits the first insert and triggers an instant unique constraint rollback on the second.

#### 2. What to Say in the Interview
> *"We utilize Prisma's interactive `$transaction` API to guarantee ACID properties during booking creation.*
> 
> *Inside the transaction callback, we inspect the `BookingSeat` table for conflicting confirmed reservations matching the target `showtimeId` and `seatIds`. If any seat is already confirmed, we abort immediately. If clear, we insert the booking record and seat mapping atomically.*
> 
> *While PostgreSQL defaults to Read Committed isolation, we defend against race conditions without relying solely on slow serializable locks. We enforced a compound unique constraint in Prisma: `@@unique([showtimeId, seatId])` on the seat booking junction table. If two concurrent requests slip past our Redis lock, the database engine enforces this constraint at the kernel level, rolling back the duplicate transaction automatically with a known Prisma error code."*

---

### Question 8: How did you design database indexes in PostgreSQL to optimize query performance?

#### 1. Detailed Technical Explanation & Concepts
* **Queries Executed Most Frequently:**
  1. Find all showtimes for a specific movie in a specific city for today:
     `SELECT * FROM showtimes WHERE movieId = $1 AND city = $2 AND startTime >= $3`
  2. Find all occupied seats for a given showtime:
     `SELECT seatId FROM booking_seats WHERE showtimeId = $1`
  3. Fetch all bookings for a user profile:
     `SELECT * FROM bookings WHERE userId = $1 ORDER BY createdAt DESC`
* **Indexing Strategy:**
  * **Composite B-Tree Index on Showtimes:**
    ```prisma
    @@index([movieId, city, startTime])
    ```
    *Index ordering matters:* Left-to-right prefix rule. The query filters on `movieId`, then equality on `city`, then range scan on `startTime`.
  * **Index on BookingSeat Foreign Keys:**
    ```prisma
    @@index([showtimeId])
    @@index([seatId])
    ```
  * **Index on Booking User Lookups:**
    ```prisma
    @@index([userId, createdAt(sort: Desc)])
    ```
* **Without these indexes:** PostgreSQL executes full table scans (`Seq Scan`), reading every disk block. With 50,000 historical bookings, queries slow down from 2ms to 350ms, exhausting CPU and connection pools.

#### 2. What to Say in the Interview
> *"We analyzed our read access patterns and built targeted **composite B-Tree indexes** using Prisma.*
> 
> *Our most critical read query searches for showtimes by movie, city, and date. We created a composite index on `[movieId, city, startTime]`. By adhering to the left-to-right index prefix rule—filtering first by movie ID, narrowing by city, and performing a range scan on show date—PostgreSQL executes an Index Scan instead of scanning thousands of table rows, cutting query execution time from 200ms down to sub-5ms.*
> 
> *We also indexed foreign keys on junction tables like `BookingSeat(showtimeId)` so that rendering occupied seats on the seat grid performs an immediate index lookup rather than an expensive sequential table scan."*

---

# Category 3: Caching, In-Memory Store & Rate-Limiting (Redis)

---

### Question 9: What caching strategy do you use for movie listings, and how do you handle cache invalidation?

#### 1. Detailed Technical Explanation & Concepts
* **The Pattern:** **Cache-Aside (Lazy Loading)**.
  1. The API receives `GET /api/v1/movies/now-showing?city=Ahmedabad`.
  2. Computes cache key: `movies:now-showing:Ahmedabad`.
  3. `redis.get(key)`:
     * **Cache Hit:** Return JSON immediately (<5ms response).
     * **Cache Miss:** Query MongoDB, format payload, store in Redis via `redis.setex(key, 120, data)` (120-second TTL), and return to client.
* **Cache Invalidation Approaches:**
  * *Time-to-Live (TTL):* Set to 90–180 seconds. In ticketing, movie schedules don't change every second, but theater owners do occasionally alter screen assignments. A 2-minute TTL provides an automatic safety net against stale data.
  * *Event-Driven Explicit Invalidation:* When an administrator adds a movie, updates showtimes, or our automated TMDB sync script finishes, the service executes a pattern-based deletion:
    ```typescript
    await redis.del(`movies:now-showing:*`);
    ```
* **Preventing Cache Stampede (Thundering Herd):** If a popular movie cache expires at the exact second 5,000 users reload the page, all 5,000 requests hit MongoDB simultaneously.
  * *Solution:* Probabilistic early expiration or mutex lock in Redis (`SET lock:movies:now-showing NX EX 5`) so only one worker queries the database on a miss while others wait or serve the slightly stale cache.

#### 2. What to Say in the Interview
> *"We implemented the **Cache-Aside pattern** using Redis to accelerate read performance for catalog and showtime endpoints.*
> 
> *When a user queries movie listings by city, we check Redis first under a normalized key such as `movies:now-showing:{city}`. On a cache hit, we respond in under 5 milliseconds without querying MongoDB. On a miss, we read from the database, write to Redis with a 2-minute TTL, and return the data.*
> 
> *For cache invalidation, we combine **TTL expiration with event-driven purging**. When our background sync updates the movie catalog or an admin publishes new showtimes, our service invalidates all matching cache keys immediately. This ensures that users always see accurate schedules while keeping database read loads over 85% lower during high-traffic browsing."*

---

### Question 10: How did you implement Rate Limiting using Redis? Why not use an in-memory Node.js library like `express-rate-limit` with default memory store?

#### 1. Detailed Technical Explanation & Concepts
* **The Vulnerability of In-Memory Rate Limiting:**
  * Node.js default memory stores keep request counters in local process RAM (e.g., JavaScript `Map`).
  * In production, applications run across multiple Docker containers or serverless instances behind a load balancer.
  * If User A makes 100 requests, the load balancer distributes them: 50 go to Container 1, 50 go to Container 2. Neither container hits the 100-request limit, effectively doubling or tripling the allowable threshold.
  * Container restarts wipe memory counters completely.
* **Redis-Backed Distributed Rate Limiting:**
  * Centralized Redis instance shared across all Node.js cluster processes.
  * **Sliding Window Counter Algorithm:**
    * Key: `rate_limit:{ip}:{endpoint}` or `rate_limit:{userId}`.
    * Atomic pipeline using Redis commands:
      ```
      MULTI
      INCR rate_limit:192.168.1.1:/api/v1/auth/login
      EXPIRE rate_limit:192.168.1.1:/api/v1/auth/login 60
      EXEC
      ```
    * If `count > limit`, immediately return HTTP `429 Too Many Requests` with a `Retry-After` header.

#### 2. What to Say in the Interview
> *"We implemented distributed rate limiting backed by Redis rather than relying on Node.js in-memory process state.*
> 
> *In-memory rate limiters fail in real-world deployments. As soon as you scale horizontally to two or more Docker containers behind a load balancer, each container maintains its own isolated counter. An attacker can distribute malicious brute-force attempts across containers and bypass the limit. Furthermore, rolling deployments or container restarts reset in-memory counters.*
> 
> *By storing rate-limit counters centrally in Redis using atomic operations (`INCR` with an expiry window), all backend nodes share a single source of truth. We apply strict limits on our authentication routes to stop credential stuffing and on our seat-reservation endpoints to block automated scalper bots."*

---

### Question 11: How does your Redis JWT Session & Blacklist mechanism work?

#### 1. Detailed Technical Explanation & Concepts
* **The Problem with Stateless JWTs:** A JWT is signed cryptographically. Once issued, it is valid until its expiration timestamp ($exp$). If a user logs out, or an account is compromised, the backend cannot revoke the JWT without changing the secret key (which would invalidate *all* active users).
* **The Redis Token Blacklist Pattern:**
  1. *On Logout:*
     * Client sends the JWT to `/api/v1/auth/logout`.
     * The server decodes the token, extracts the remaining time until expiry:
       $$\text{remainingTTL} = exp - \text{currentTime}$$
     * Stores the token in Redis with that exact TTL:
       ```
       SET blacklist:{token} "revoked" EX {remainingTTL}
       ```
  2. *On Authenticated Requests:*
     * Our authentication middleware verifies the cryptographic signature.
     * Before attaching `req.user`, it does a fast `EXISTS blacklist:{token}` in Redis.
     * If present, it rejects the request with HTTP `401 Unauthorized`.
  3. *Zero Waste Storage:* Because the Redis key TTL matches the token's remaining lifespan, Redis automatically evicts the blacklisted token once it has naturally expired, keeping memory consumption near zero.

#### 2. What to Say in the Interview
> *"Although JWTs are stateless by design, real-world security requires the ability to revoke sessions instantly upon logout or password reset.*
> 
> *We implemented a **Redis Token Blacklist**. When a user logs out, our API decodes the JWT's expiration claim and writes the token signature into Redis with a TTL equal to its remaining valid lifespan. Our authentication middleware performs a sub-millisecond check against Redis on protected routes.*
> 
> *If a stolen or logged-out token is presented, the server immediately denies access with a 401. Once the token reaches its original expiration time, Redis automatically purges it from memory. This gives us the best of both worlds: stateless verification for most requests, with instantaneous revocation when security demands it."*

---

# Category 4: Event-Driven Messaging & Microservices (Kafka & Spring Boot)

---

### Question 12: Why did you use Apache Kafka instead of RabbitMQ, Redis Pub/Sub, or simple HTTP Webhooks between Node.js and Spring Boot?

#### 1. Detailed Technical Explanation & Concepts
* **Comparison Matrix:**

| Feature | Apache Kafka | RabbitMQ | Redis Pub/Sub | Synchronous HTTP |
| :--- | :--- | :--- | :--- | :--- |
| **Delivery Model** | Distributed Commit Log | Message Broker (Queue) | Fire-and-Forget | Request / Response |
| **Persistence** | Durable on disk (Retention period) | Deleted upon acknowledgment | In-memory only (Lost on crash) | None (Network failure = loss) |
| **Replayability** | **Yes** (Rewind consumer offset) | No (Removed after ack) | No | No |
| **Throughput** | Millions msgs/sec (Batch sequential I/O) | ~20k-50k msgs/sec | High (Memory-bound) | Dependent on receiver latency |
| **Backpressure** | Built-in (Pull-based consumer) | Push-based with prefetch | None (Dropped messages) | Throttling / HTTP 429 |

* **Why Kafka Won for BookYourShow:**
  1. *Durable Audit Log:* Financial events (`BOOKING_CREATED`, `PAYMENT_SUCCESS`) must never be lost. Even if the notification service goes offline for 3 hours for maintenance, Kafka stores messages safely on disk. When the service boots up, it resumes processing from its last committed offset.
  2. *Decoupled Latency:* Node.js produces a message in 3ms without blocking the client.
  3. *Replayability:* If we deploy a new marketing microservice next month that needs to analyze past booking patterns, it can re-read the Kafka topic from offset 0 without modifying the existing backend.

#### 2. What to Say in the Interview
> *"We chose Apache Kafka because it acts as a **distributed, persistent commit log** rather than a transient message broker.*
> 
> *If we had used direct HTTP calls, any network blip or downtime in the notification service would either fail the booking or drop the customer's confirmation email. Redis Pub/Sub is fire-and-forget; if the subscriber is restarting, messages disappear permanently.*
> 
> *Kafka provides **durability and consumer backpressure**. Node.js publishes booking events in milliseconds. If our Java email service gets overwhelmed or third-party SMTP servers rate-limit us, Kafka stores the messages safely on disk. The Spring Boot consumer pulls messages at its own pace. Furthermore, because Kafka retains data according to our retention policy, we have a reliable audit trail and can replay events whenever needed."*

---

### Question 13: How does your Spring Boot Notification Service handle duplicate messages? What is your idempotency strategy?

#### 1. Detailed Technical Explanation & Concepts
* **The Reality of Kafka Delivery Guarantees:** Kafka provides **At-Least-Once delivery** semantics out-of-the-box. If a consumer processes an email but crashes before committing its offset back to Kafka, Kafka re-delivers the message upon partition rebalance.
* **The Risk:** A user receives 2 or 3 identical confirmation emails or SMS alerts.
* **Idempotent Consumer Implementation in Spring Boot:**
  1. Every event generated by Node.js contains a unique `eventId` (UUID) and the `bookingId`.
  2. The Spring Boot `@KafkaListener` consumer method wraps execution:
     ```java
     @KafkaListener(topics = "booking-events", groupId = "notification-group")
     public void handleBookingEvent(BookingEventDTO event, Acknowledgment ack) {
         // 1. Check if event has already been processed
         if (processedEventRepository.existsByEventId(event.getEventId())) {
             log.warn("Duplicate event received: {}", event.getEventId());
             ack.acknowledge(); // Commit offset and exit
             return;
         }

         // 2. Send email via JavaMailSender
         emailService.sendTicketConfirmation(event);

         // 3. Mark event as processed in database
         processedEventRepository.save(new ProcessedEvent(event.getEventId(), LocalDateTime.now()));

         // 4. Manually commit Kafka offset
         ack.acknowledge();
     }
     ```
  3. *Manual Ack Mode (`AckMode.MANUAL_IMMEDIATE`):* Offsets are committed only *after* the email action and database write succeed.

#### 2. What to Say in the Interview
> *"Because distributed message systems operate under **at-least-once delivery**, consumers must be designed to be strictly **idempotent**.*
> 
> *In our Spring Boot service, every Kafka message includes a unique `eventId` and `bookingId`. Before dispatching an email, the consumer checks a `processed_events` table. If the ID exists, it recognizes a re-delivery, acknowledges the offset to Kafka, and skips processing immediately.*
> 
> *If it's new, it sends the confirmation email, records the `eventId` in the database, and manually commits the Kafka offset. This guarantees that even during consumer crashes or partition rebalances, customers never receive duplicate confirmation emails."*

---

### Question 14: What is a Dead Letter Queue (DLQ), and how do you handle malformed or failed messages in Kafka?

#### 1. Detailed Technical Explanation & Concepts
* **The "Poison Pill" Problem:** A producer sends a corrupted payload (e.g., malformed JSON or a null email address). The consumer attempts to parse it, throws an uncaught exception, fails to commit the offset, and restarts. It reads the same message and crashes again, resulting in an infinite crash-loop that stalls the entire Kafka partition.
* **Our Solution:**
  * Configure Spring Kafka's `DefaultErrorHandler` with a `DeadLetterPublishingRecoverer`.
  * If a message fails after $N$ retry attempts (e.g., 3 retries with exponential backoff: 1s, 2s, 4s), it is automatically rerouted to a dedicated Dead Letter Topic:
    `booking-events.DLT`
  * The main partition advances, unblocking healthy messages.
  * Engineers can inspect the DLT, fix the bug, or trigger a manual replay.

#### 2. What to Say in the Interview
> *"To prevent 'poison pills' from stalling our message pipeline, we configured a **Dead Letter Queue (DLQ) pattern** in Spring Boot.*
> 
> *If an event fails due to a network glitch or temporary SMTP error, our Spring Kafka error handler retries the message three times with exponential backoff. If it still fails—for example, due to a malformed payload or corrupt email address—the message is routed to a Dead Letter Topic named `booking-events.DLT`.*
> 
> *The consumer commits the offset on the primary topic so normal traffic isn't blocked, while alerts notify us of messages in the DLT for debugging and manual reprocessing."*

---

# Category 5: Frontend Architecture & Performance (Next.js & React)

---

### Question 15: Which Next.js rendering strategies (SSR, SSG, ISR, CSR) did you choose for different pages in BookYourShow, and why?

#### 1. Detailed Technical Explanation & Concepts
* **Architectural Strategy Matrix:**

| Route | Strategy | Rationale |
| :--- | :--- | :--- |
| **Home (`/`)** | **ISR (revalidate: 300)** | Content updates periodically (every few minutes). Generates static HTML at build time and revalidates in the background every 5 minutes. Gives 100 Lighthouse performance and sub-50ms TTFB. |
| **Movie Details (`/movie/[id]`)** | **SSR with Dynamic Metadata** | Search engines (Google) and social share crawlers (OpenGraph) must see the movie title, description, and poster image in the raw HTML response for SEO. |
| **Seat Layout (`/showtimes/[id]/seats`)** | **CSR (Client-Side Rendering)** | Seat availability changes by the second. Static caching here is harmful. The page shell loads, then connects to the API via client-side fetch to load live seat matrices. |
| **User Profile / Bookings (`/profile`)** | **CSR with Middleware Auth** | Private, personalized data. Guarded by Next.js edge middleware inspecting the JWT cookie before rendering. |

#### 2. What to Say in the Interview
> *"We aligned our Next.js rendering strategies directly with user experience and SEO requirements:*
> 
> *For the **Landing Page and Movie Directory**, we use **Incremental Static Regeneration (ISR)** with a 5-minute revalidation window. This serves pre-rendered HTML from the edge CDN for near-instant page loads, while updating automatically as new movies release.*
> 
> *For **Movie Detail Pages**, we use **Server-Side Rendering (SSR)**. Movie pages require dynamic OpenGraph meta tags and JSON-LD structured data so that when links are shared on Twitter or WhatsApp, search bots see rich previews rather than blank client-side shells.*
> 
> *For the **Seat Selection Screen**, we use **Client-Side Rendering (CSR)**. Seat inventory changes millisecond-by-millisecond. Pre-rendering seats on the server would show stale information, so the client fetches fresh seat status directly and maintains dynamic WebSocket or polling connections."*

---

### Question 16: In the seat selection screen, a movie theater can have 300+ seats. How did you optimize React rendering performance so selecting a seat doesn't feel sluggish?

#### 1. Detailed Technical Explanation & Concepts
* **The Pitfall:** If seat layout state is maintained as an array in a parent component (`selectedSeats: ['A1', 'A2']`), every click causes the parent to re-render, forcing all 300 child `Seat` components to recalculate and re-render their virtual DOM nodes.
* **Optimizations Implemented:**
  1. *Component Memoization (`React.memo`):*
     ```tsx
     export const Seat = React.memo(({ id, row, col, status, onSelect }: SeatProps) => {
       // renders SVG chair
     }, (prev, next) => {
       return prev.status === next.status && prev.isSelected === next.isSelected;
     });
     ```
  2. *Stable Function References (`useCallback`):* Pass memoized callbacks so child props do not change identity on parent re-renders.
  3. *Normalized State with Zustand:* Instead of arrays requiring $O(N)$ lookups (`selectedSeats.includes(seatId)`), store selected IDs in a hash map / `Set` for $O(1)$ lookups.
  4. *Optimistic UI Updates:* The clicked seat immediately turns green on the user's screen before the Redis network lock request finishes, rolling back with a toast alert only if the backend returns an error.

#### 2. What to Say in the Interview
> *"Rendering hundreds of interactive SVG seats can easily introduce input lag if React triggers re-render cascades across the entire grid.*
> 
> *We tackled this with three specific optimizations:*
> *First, we wrapped our individual `Seat` components in `React.memo` with a custom comparison function that only re-renders the component if its specific status or selected state changes. Clicking seat 'D12' will not re-render the other 299 seats.*
> 
> *Second, we used a **Zustand store** to manage seat selection state outside the React component tree. We normalized selected seats into a Set, allowing $O(1)$ state lookups instead of running array iterations on every render.*
> 
> *Finally, we applied **Optimistic UI Updates**. When a user clicks a seat, the UI reflects the selection instantly, initiating the Redis lock in the background. If the lock fails, we revert the state and notify the user. This keeps the interface feeling native and instantaneous."*

---

### Question 17: How did you handle TMDB API integration, rate limits, and fallback scenarios when movie posters or data were missing?

#### 1. Detailed Technical Explanation & Concepts
* **The Vulnerability of Live 3rd-Party API Calls:** Calling TMDB directly from client browsers exposes private API keys and breaks if TMDB has an outage. Calling TMDB synchronously on every backend request exhausts TMDB's rate limit (40 requests per 10 seconds).
* **Our Resilient Architecture:**
  1. *Asynchronous Cron Ingestion:* We wrote a scheduled worker (`catchUpShowtimes` / TMDB sync) that runs every 6 hours. It fetches India's now-playing movies, transforms the payload, and upserts it into our MongoDB database. The client only queries *our* database.
  2. *Dynamic SVG Fallback Generation:* Indian regional movies often lack high-res posters or backdrop assets on TMDB. We built an automated SVG generator script (`generate_posters.py` / dynamic frontend canvas) that creates branded, stylized vector posters with the movie title, certificate rating, and genre tags so the grid layout never renders broken image placeholders.
  3. *Image Optimization:* In Next.js, images are served through `next/image`, which automatically converts TMDB posters into modern WebP format, resizes them according to viewport breakpoints, and prevents layout shift (CLS).

#### 2. What to Say in the Interview
> *"We decoupled our application completely from live TMDB availability.*
> 
> *Rather than making synchronous calls to TMDB during user requests, we built a **background synchronization service** that fetches and normalizes trending and now-playing Indian movies into our MongoDB collection on a scheduled cadence. User requests only ever query our indexed database and Redis cache.*
> 
> *To handle missing assets for regional titles, we developed a fallback generator that produces branded SVG vector posters matching the movie's genre palette. Combined with Next.js image optimization for automatic WebP conversion and lazy-loading, this ensures our catalog renders flawlessly even if TMDB experiences downtime or rate limits."*

---

# Category 6: Web Security & Authentication

---

### Question 18: Walk me through your Authentication and Authorization architecture. How do you handle Google OAuth alongside traditional JWT authentication?

#### 1. Detailed Technical Explanation & Concepts
* **Unified Dual-Token Architecture:**
  * **Access Token:** Signed with `JWT_ACCESS_SECRET`, 15-minute expiration. Carries `userId`, `email`, and `role` (`CUSTOMER`, `THEATER_ADMIN`, `SUPER_ADMIN`).
  * **Refresh Token:** Signed with `JWT_REFRESH_SECRET`, 7-day expiration. Stored in an `httpOnly, Secure, SameSite=Strict` cookie to prevent JavaScript access (eliminating XSS token theft).
* **Google OAuth 2.0 Flow:**
  1. Client initiates OAuth via Google SDK; user grants consent.
  2. Google returns an authorization code or ID Token to the client.
  3. Client POSTs the token to `/api/v1/auth/google`.
  4. Backend verifies the cryptographic signature with Google's public JWKS certificates using `google-auth-library`.
  5. The backend extracts `email`, `name`, `googleId`.
  6. **Account Linking:** If a user with that email already exists (registered via password), we link the `googleId` to their account; if not, we create a new `User` record with `authProvider = 'GOOGLE'`.
  7. The backend issues our standard Access & Refresh JWT pair.

```
[Client] ────> Google Login Modal ────> [Google Identity Provider]
   │                                               │
   │ <────────── Returns Google ID Token ─────────┘
   │
   ├───────────> POST /api/v1/auth/google (ID Token)
   │                       │
   │               [Node.js Backend]
   │                       │ ──> Verifies signature via Google JWKS
   │                       │ ──> Upserts User in Database
   │                       │ ──> Generates BookYourShow JWT Pair
   │ <─────────────────────┘
(Sets httpOnly Cookie)
```

#### 2. What to Say in the Interview
> *"We implemented a unified authentication system that supports both traditional credentials and Google OAuth 2.0 using a **Dual-Token pattern**.*
> 
> *For Google OAuth, the client exchanges credentials with Google and sends the ID token to our backend. Our Node.js API verifies the cryptographic signature against Google's public certificates, extracts the verified identity, and upserts the user in PostgreSQL.*
> 
> *From that point onward, the session is managed uniformly: the server issues a short-lived 15-minute Access Token for API authorization, and a 7-day Refresh Token stored inside an `httpOnly, Secure, SameSite=Strict` cookie. Storing the refresh token in an httpOnly cookie shields it from Cross-Site Scripting (XSS), while the short-lived access token limits the blast radius if intercepted."*

---

### Question 19: How do you defend your backend against SQL Injection, NoSQL Injection, XSS, and CSRF attacks?

#### 1. Detailed Technical Explanation & Concepts
* **SQL Injection (SQLi):**
  * *Vulnerability:* User inputs `' OR '1'='1` into raw SQL queries.
  * *Defense:* Prisma ORM uses **parameterized queries / prepared statements** by default. Input strings are treated strictly as data literals, never executable SQL commands.
* **NoSQL Injection:**
  * *Vulnerability:* Sending a JSON payload `{"username": {"$gt": ""}}` in a MongoDB query matches all records.
  * *Defense:* Strict schema validation using **Zod** schemas in our validation middleware before requests hit controllers. Malformed non-string inputs are rejected with `400 Bad Request`.
* **Cross-Site Scripting (XSS):**
  * *Defense:* Integrated **Helmet.js** to set strict HTTP security headers including Content-Security-Policy (CSP), preventing unauthorized script execution. Next.js natively escapes JSX variables.
* **Cross-Site Request Forgery (CSRF):**
  * *Defense:* Cookies use `SameSite=Strict` or `Lax`, preventing browsers from sending auth cookies along with cross-site third-party requests. State-changing operations require a custom `Authorization: Bearer` header which cross-origin forms cannot forge.
* **CORS:** Explicitly whitelisted frontend origin (`origin: process.env.CLIENT_URL`) with restricted HTTP methods (`GET, POST, PUT, DELETE`).

#### 2. What to Say in the Interview
> *"We adopt a defense-in-depth approach across our network and application layers:*
> 
> *To eliminate **SQL Injection**, Prisma ORM handles all database communication using parameterized queries. For **NoSQL Injection**, our Express middleware enforces strict request validation via Zod schemas, stripping unauthorized MongoDB operators like `$gt` or `$ne` before queries reach Mongoose.*
> 
> *Against **XSS and Clickjacking**, we employ Helmet.js to enforce Content Security Policy headers, frameguard, and disable `X-Powered-By`. React also escapes HTML entities by default.*
> 
> *For **CSRF**, our cookies are flagged with `SameSite=Strict`, and state-altering mutations require an explicit Bearer token header that third-party domains cannot forge. Finally, CORS is locked down strictly to our production Next.js domain."*

---

# Category 7: DevOps, Containerization & Infrastructure (Docker)

---

### Question 20: Explain how your Docker and Docker Compose configuration is structured. What are the benefits of Multi-Stage Builds?

#### 1. Detailed Technical Explanation & Concepts
* **Multi-Tier Orchestration (Docker Compose):**
  * Local development requires coordinating 6 distinct services: Node.js API, Spring Boot Notification Service, PostgreSQL, MongoDB, Redis, and Apache Kafka (with Zookeeper).
  * `docker-compose.yml` binds them into a private Docker network. Services resolve each other by container name (e.g., `postgres://postgres:5432/bookyourshow`, `redis://redis:6379`).
  * Named volumes persist database state across container rebuilds (`postgres_data`, `mongo_data`).
* **Multi-Stage Dockerfile Benefits:**
  * *Without Multi-Stage:* Node.js containers include `npm`, TypeScript compiler, development dependencies (`devDependencies`), and source code, resulting in bloated images (>1.2 GB) with large security attack surfaces.
  * *With Multi-Stage:*
    ```dockerfile
    # Stage 1: Build
    FROM node:20-alpine AS builder
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY . .
    RUN npm run build
    RUN npm prune --production

    # Stage 2: Production Runner
    FROM node:20-alpine AS runner
    WORKDIR /app
    USER node
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json ./package.json
    EXPOSE 5000
    CMD ["node", "dist/index.js"]
    ```
  * *Result:* The final production container contains only compiled JavaScript and production dependencies. Image size drops from 1.2 GB to under 140 MB, deploys faster, and runs under a non-root user (`USER node`) for Linux security compliance.

#### 2. What to Say in the Interview
> *"We use Docker and Docker Compose to enforce complete production parity across our development environment.*
> 
> *Our `docker-compose.yml` orchestrates our multi-tier stack—Node.js, Spring Boot, PostgreSQL, MongoDB, Redis, and Kafka—on an isolated internal bridge network, allowing services to communicate seamlessly via service name discovery without port collisions.*
> 
> *For our production Dockerfiles, we implemented **Multi-Stage Builds**. In the first stage, we install complete development toolchains, compile our TypeScript and Java binaries, and prune dev dependencies. In the second stage, we copy only the compiled artifacts into a lightweight Alpine Linux image running as a non-root user.*
> 
> *This reduced our final container image size by nearly 85%—from over 1.2 GB down to around 130 MB—which drastically accelerates deployment speeds and eliminates compiler toolchains from production containers to shrink our security footprint."*

---

# Category 8: Deep-Dive Technical Edge Cases & Behavioral Scenarios

---

### Question 21: What was the single most difficult engineering challenge or bug you faced while developing BookYourShow, and how did you diagnose and solve it?

#### 1. Detailed Technical Explanation & Concepts
* **The Real Challenge:** The **Rolling Weekly Showtime Generation & UTC Timezone Drift Bug**.
* **The Symptoms:**
  * When running locally in Indian Standard Time (IST, UTC+5:30), showtimes for the next 7 days generated correctly.
  * Once deployed to our cloud container runtime (Render / Docker running on UTC), showtime schedules started exhibiting strange behaviors:
    1. Past showtimes from yesterday were still returned as active today.
    2. At midnight IST, the upcoming day's showtimes disappeared completely because UTC was still on the previous calendar day.
    3. The Redis cache was serving stale showtimes that had already passed their physical screen time.
* **The Diagnosis:**
  * Database queries were using JavaScript `new Date()` which inherited host container UTC timestamps, while clients queried dates based on their local device time zone without offset normalization.
  * Showtimes were generated with naive local strings rather than ISO-8601 UTC timestamps with explicit database indexes.
* **The Architectural Fix (`catchUpShowtimes` Routine):**
  1. Built a self-healing routine that runs on boot and every 6 hours via node-cron.
  2. Enforced strict UTC storage in PostgreSQL: all timestamps are stored as `TIMESTAMPTZ`.
  3. Added an atomic query to prune/archive stale showtimes:
     ```sql
     UPDATE showtimes SET status = 'EXPIRED' WHERE startTime < NOW();
     ```
  4. Dynamically calculated missing dates in the rolling 7-day window and regenerated standard slots (Morning, Matinee, Evening, Night) for active movies.
  5. Implemented an automatic Redis cache flush (`redis.del('movies:now-showing:*')`) whenever showtimes are regenerated.

#### 2. What to Say in the Interview
> *"The most challenging bug I encountered involved **UTC timezone drift and rolling showtime consistency across server restarts**.*
> 
> *Initially, our showtime generation logic worked locally on Indian Standard Time. But once deployed to our cloud container environment, which operates on UTC, we discovered that midnight transitions caused showtime gaps. The system was comparing UTC server time against local theater schedules, causing past showtimes to remain active on the frontend while tomorrow's schedules failed to appear.*
> 
> *To fix this, I engineered a self-healing background routine called `catchUpShowtimes()`. First, I normalized all date handling across PostgreSQL, Prisma, and Express to strict UTC timestamps using `TIMESTAMPTZ`.*
> 
> *Second, the routine automatically executes on boot and every 6 hours: it archives past showtimes, scans the rolling 7-day calendar window for any missing date slots, generates balanced theater schedules across screens, and immediately purges stale Redis cache keys.*
> 
> *Diagnosing this taught me how subtle timezone conversions can break business logic in distributed microservices, and the importance of standardizing on UTC at the database layer while letting the client handle local presentation."*

---

### Question 22: If you were building Version 2.0 of BookYourShow from scratch, what architectural decisions would you change or improve?

#### 1. Detailed Technical Explanation & Concepts
* **Areas for Improvement:**
  1. *Replace Polling with WebSockets / Server-Sent Events (SSE) for Real-Time Seat Status:*
     * In V1, the seat layout fetches status on load. If another user locks a seat while you are looking at the screen, you only find out when you attempt to click it.
     * In V2, integrate WebSockets (Socket.io) or SSE so when User A locks seat 'B4', a broadcast event instantly turns 'B4' orange on everyone else's screen in real time.
  2. *Adopt Apache Kafka Schema Registry with Avro / Protobuf:*
     * In V1, Node.js and Spring Boot communicate via raw JSON strings in Kafka. If a field name is changed in Node.js, Spring Boot can throw deserialization errors.
     * In V2, enforce schema contracts via Protobuf or Avro to guarantee backward compatibility across language boundaries.
  3. *Migrate from Single-Instance Redis to Redis Sentinel or Cluster:*
     * For production scale, configure master-replica failover with Redis Sentinel to eliminate Redis as a single point of failure for distributed locks.

#### 2. What to Say in the Interview
> *"If I were architecting Version 2.0, there are two primary enhancements I would implement:*
> 
> *First, I would replace client-side polling with **WebSockets or Server-Sent Events (SSE)** on the seat selection grid. Currently, seat availability is fetched on load and validated on click. With WebSockets, whenever a user locks a seat, an event would broadcast to all clients viewing that specific screen, dynamically disabling the seat in real time and delivering an interactive, multiplayer-style booking experience.*
> 
> *Second, I would introduce **Protocol Buffers with a Schema Registry** for our Kafka pipeline between Node.js and Java Spring Boot. While JSON was rapid for development, Protobuf enforces strict compile-time contracts, reduces message payload sizes over the wire, and prevents subtle cross-language schema mismatches as the engineering team scales."*

---

### Question 23: How do you handle database migrations safely in production without causing downtime?

#### 1. Detailed Technical Explanation & Concepts
* **The Risk:** Running `prisma db push` in production can drop columns or lock tables, causing downtime.
* **Production Migration Best Practices:**
  * Use `prisma migrate deploy` in CI/CD pipelines, which only applies tested, version-controlled SQL migration scripts.
  * **Expand-and-Contract (Parallel Run) Pattern:**
    * Never rename a column directly (`ALTER TABLE users RENAME COLUMN phone TO mobile;`).
    * Step 1 (Expand): Add new column `mobile` as nullable.
    * Step 2 (Write to both): Update code to write to both `phone` and `mobile`.
    * Step 3 (Backfill): Run a script to copy old phone data to `mobile`.
    * Step 4 (Contract): Update code to read only from `mobile`, then drop `phone` column in a future migration.

#### 2. What to Say in the Interview
> *"In production environments, we never use destructive commands like `prisma db push`. Instead, we utilize version-controlled migrations via `prisma migrate deploy`.*
> 
> *For zero-downtime schema evolution, we follow the **Expand and Contract pattern**. For instance, if modifying a critical column, we first add the new column as nullable in migration 1. We deploy code that writes to both columns while backfilling existing records. Once verified, we switch our read queries to the new column, and finally remove the old column in a subsequent release. This ensures that old and new versions of our containerized services can run concurrently during rolling updates without database lockouts."*

---

# Summary Checklist: Key Talking Points by Skill

| Resume Skill | Primary Talking Points to Emphasize |
| :--- | :--- |
| **Next.js & React** | ISR for movie catalog (5-min revalidate), SSR for SEO-driven movie pages, CSR for live seat grids; `React.memo` and Zustand normalized state for lag-free 300+ seat rendering. |
| **Node.js & TypeScript** | Asynchronous non-blocking I/O, Express middleware pipeline, Zod schema validation, strictly typed DTOs and API contracts. |
| **PostgreSQL & Prisma** | Relational ACID transactions (`$transaction`), compound unique constraints `[showtimeId, seatId]` preventing double-booking, B-tree composite indexing. |
| **MongoDB** | Document-oriented catalog storage, flexible semi-structured schema for rich TMDB metadata and cast filmographies, fast single-query document reads. |
| **Redis** | In-memory distributed seat locks (`SET NX EX 600`), Cache-Aside pattern (90s TTL), sliding window rate-limiting, and JWT token blacklist on logout. |
| **Apache Kafka** | Distributed commit log, decoupled asynchronous notification events, durable disk persistence, consumer backpressure, and fault-tolerant retry buffering. |
| **Java Spring Boot** | Dedicated microservice with `@KafkaListener`, manual offset acknowledgment, idempotent consumer pattern, Dead Letter Queue (DLQ), enterprise email dispatching. |
| **Docker & Compose** | Multi-stage Dockerfiles reducing image size from 1.2 GB to 130 MB, isolated bridge networking for 6 microservices, local and production environment parity. |
| **Web Security** | Dual-token authentication (short-lived access + httpOnly refresh cookie), Google OAuth 2.0 verification via JWKS, Helmet security headers, CORS origin whitelisting. |
