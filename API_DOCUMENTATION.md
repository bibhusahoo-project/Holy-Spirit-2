# Movie Rental Backend API Documentation

> **Prerequisites**
>
> * Node ≥ 18
> * MongoDB connection string in `.env`
> * Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
> * **FFmpeg binary installed and on PATH** (used by video processor). On Debian/Ubuntu:
>   ```bash
>   sudo apt install ffmpeg
>   ```
>   Windows users can download from https://ffmpeg.org/ and set `FFMPEG_PATH` if necessary.
> * Run `npm install fluent-ffmpeg` after pulling changes.


Base URL:
- `http://localhost:5000`

Database:
- `movieappDB`

Content type:
- Use `Content-Type: application/json` for JSON endpoints.
- Use `multipart/form-data` for movie create/update endpoints.

Authentication:
- Protected endpoints require:
- `Authorization: Bearer <JWT_TOKEN>`

## Response Format

Success response:
```json
{
  "success": true,
  "message": "Some message",
  "data": {}
}
```

Error response:
```json
{
  "success": false,
  "message": "Error message"
}
```

---

## Health

### GET `/health`

Purpose:
- Service health check.

Response `200`:
```json
{
  "success": true,
  "message": "OK"
}
```

---

## Auth APIs

### POST `/api/auth/register`

Purpose:
- Register a normal user account and auto-login immediately.

Body:
```json
{
  "name": "John Doe",
  "email": "john@mail.com",
  "password": "User@123"
}
```

Response `200`:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "USER_ID",
      "name": "John Doe",
      "email": "john@mail.com",
      "role": "user"
    },
    "token": "JWT_TOKEN"
  }
}
```

Notes:
- Response structure matches `/api/auth/login` exactly.
- Token is returned immediately after successful registration.

### POST `/api/auth/login`

Purpose:
- Login a normal user account.
- Also accepts admin credentials from environment variables (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) and returns an admin JWT when matched.

Body:
```json
{
  "email": "john@mail.com",
  "password": "User@123"
}
```

Response `200`:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "USER_OR_ADMIN_ID",
      "name": "John Doe",
      "email": "john@mail.com",
      "role": "user"
    },
    "token": "JWT_TOKEN"
  }
}
```

### POST `/api/auth/admin/login`

Purpose:
- Login admin account using environment credentials (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

Body:
```json
{
  "email": "admin2@mail.com",
  "password": "admin123"
}
```

Response `200`:
```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "user": {
      "id": "admin",
      "name": "System Admin",
      "email": "admin2@mail.com",
      "role": "admin"
    },
    "token": "JWT_TOKEN"
  }
}
```

### POST `/api/auth/demo-login`

Purpose:
- Development-only demo authentication.
- Returns a JWT for either the configured demo admin or demo user without OTP verification.
- Controlled by `ENABLE_DEMO_LOGIN=true`.

Body:
```json
{
  "role": "user"
}
```

Response `200`:
```json
{
  "success": true,
  "message": "Demo user login successful",
  "user": {
    "id": "USER_ID",
    "name": "Demo User",
    "mobile": "9999999999",
    "role": "user"
  },
  "token": "JWT_TOKEN",
  "data": {
    "user": {
      "id": "USER_ID",
      "name": "Demo User",
      "mobile": "9999999999",
      "role": "user"
    },
    "token": "JWT_TOKEN"
  }
}
```

Alternative admin request:
```json
{
  "role": "admin"
}
```

Error `400`:
```json
{
  "success": false,
  "message": "role must be either admin or user"
}
```

Error `404`:
```json
{
  "success": false,
  "message": "Demo login is disabled"
}
```

### GET `/api/auth/me`

Purpose:
- Return authenticated account profile data for logged-in user/admin.

Headers:
- `Authorization: Bearer <JWT_TOKEN>`

Response `200`:
```json
{
  "success": true,
  "message": "Profile fetched successfully",
  "data": {
    "id": "USER_OR_ADMIN_ID",
    "name": "John Doe",
    "email": "john@mail.com",
    "role": "user"
  }
}
```

Error `401` examples:
```json
{
  "success": false,
  "message": "Authorization token is missing"
}
```

```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

```json
{
  "success": false,
  "message": "User not found or inactive"
}
```

Error `404` (token valid but account removed after auth check):
```json
{
  "success": false,
  "message": "User not found"
}
```

### POST `/api/auth/otp/send`

Purpose:
- Send OTP to mobile number for authentication.
- Creates or updates user record with OTP data.

Body:
```json
{
  "mobile": "9999999999",
  "name": "John Doe", // optional
  "email": "john@mail.com" // optional
}
```

Response `200`:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "mobile": "+919999999999",
    "otpSent": true
  }
}
```

### POST `/api/auth/otp/verify`

Purpose:
- Verify OTP code and return JWT token for authentication.

Body:
```json
{
  "mobile": "9999999999",
  "otp": "123456"
}
```

Response `200`:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "USER_ID",
      "name": "John Doe",
      "mobile": "+919999999999",
      "email": "john@mail.com",
      "role": "user"
    },
    "token": "JWT_TOKEN"
  }
}
```

### POST `/api/auth/demo/admin`

Purpose:
- Development-only demo authentication for admin.
- Returns admin JWT without password verification.
- Controlled by `ENABLE_DEMO_LOGIN=true`.

Body:
```json
{
  "role": "admin"
}
```

Response `200`:
```json
{
  "success": true,
  "message": "Demo admin login successful",
  "data": {
    "user": {
      "id": "admin",
      "name": "System Admin",
      "email": "admin@example.com",
      "role": "admin"
    },
    "token": "JWT_TOKEN"
  }
}
```

### POST `/api/auth/demo/user`

Purpose:
- Development-only demo authentication for user.
- Returns user JWT without OTP verification.
- Controlled by `ENABLE_DEMO_LOGIN=true`.

Body:
```json
{
  "role": "user"
}
```

Response `200`:
```json
{
  "success": true,
  "message": "Demo user login successful",
  "data": {
    "user": {
      "id": "USER_ID",
      "name": "Demo User",
      "mobile": "9999999999",
      "role": "user"
    },
    "token": "JWT_TOKEN"
  }
}
```

---

## Movie APIs (Public)

## Movie APIs (Public)

### GET `/api/movies?page=1&limit=10&category=<id|slug>`

Purpose:
- Paginated movie listing for home/library by category ("All" or custom categories).
- Posters always populated per category filter.

Query params:
- `page` default `1`
- `limit` default `10`, max `50`
- `category` optional ID/slug (filters movies in that category; omit for "All")

**For logged-in users**, each movie includes `purchaseStatus.purchased` (boolean).

Response `200`:
```json
{
  "success": true,
  "message": "Movies fetched successfully",
  "items": [
    {
      "id": "MOVIE_ID",
      "title": "Inception",
      "description": "Movie desc",
      "price": 199,
      "posterUrl": "https://res.cloudinary.com/.../posters/movie.jpg",
      "coverImageUrl": "https://res.cloudinary.com/.../covers/movie.jpg",
      "categories": [{"id": "CAT_ID", "name": "Action"}],
      "purchaseStatus": {
        "purchased": true,
        "expiryDate": "2024-12-01T00:00:00Z"
      },
      "chunkCount": 1
    }
  ],
  "pagination": {
    "totalMovies": 25,
    "totalPages": 3,
    "currentPage": 1,
    "limit": 10
  }
}
```

### GET `/api/movies/:movieId`

Purpose:
- Get single movie details (public metadata).

Response `200`:
```json
{
  "success": true,
  "message": "Movie details fetched",
  "data": {
    "id": "MOVIE_ID",
    "title": "Inception",
    "description": "Movie description",
    "actors": ["Actor 1", "Actor 2"],
    "rating": 8.8,
    "price": 199,
    "coverImageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v123/movie-rental/covers/file.jpg",
    "category": { "id": "CAT_ID", "name": "Action" },
    "tags": [{ "id": "TAG_ID", "name": "Thriller" }],
    "createdAt": "2026-02-16T10:00:00.000Z",
    "updatedAt": "2026-02-16T10:00:00.000Z"
  }
}
```

### POST `/api/movies/:movieId/rent`

Purpose:
- Create a Razorpay order for renting a movie (user must be authenticated).
- Prevents duplicate purchase if active rental already exists.

Headers:
- `Authorization: Bearer <USER_JWT>`

Response `201`:
```json
{
  "success": true,
  "message": "Razorpay order created",
  "data": {
    "orderId": "order_xxx",
    "amount": 19900,
    "currency": "INR",
    "keyId": "rzp_xxx",
    "movieId": "MOVIE_ID"
  }
}
```

Error `409` when already rented:
```json
{
  "success": false,
  "message": "You already rented this movie and your access is still active"
}
```

---

## Category & Tag APIs (Public)

### GET `/api/categories`

Purpose:
- Retrieve list of available categories for dropdowns.

Response `200`:
```json
{
  "success": true,
  "message": "Categories fetched",
  "data": [
    { "_id": "CAT_ID", "name": "Action" },
    { "_id": "CAT_ID2", "name": "Comedy" }
  ]
}
```

### POST `/api/categories`

Purpose:
- Admin only – create a new category.

Headers:
- `Authorization: Bearer <ADMIN_JWT>`

Body:
```json
{ "name": "Horror" }
```

Response `201`:
```json
{ "success": true, "message": "Category created", "data": { "_id": "NEW_ID", "name": "Horror" } }
```

### GET `/api/tags`

Purpose:
- Retrieve available tags.

Response `200`:
```json
{
  "success": true,
  "message": "Tags fetched",
  "data": [
    { "_id": "TAG_ID", "name": "Thriller" },
    { "_id": "TAG_ID2", "name": "Drama" }
  ]
}
```

### POST `/api/tags`

Purpose:
- Admin only – create a new tag.

(see `/api/categories` for headers/body syntax)

Response `201`:
```json
{ "success": true, "message": "Tag created", "data": { "_id": "NEW_ID", "name": "Thriller" } }
```

---

## Streaming (after purchase)

### GET `/api/user/watch/:movieId/stream`

Purpose:
- Protected endpoint that returns HLS playlist URL when user has active access.

Headers:
- `Authorization: Bearer <USER_JWT>`

Response `200`:
```json
{
  "success": true,
  "message": "Stream URL fetched",
  "data": { "hlsPlaylistUrl": "https://res.cloudinary.com/…/hls/MOVIE_ID/playlist.m3u8" }
}
```

Error `403` if the movie has not been purchased or access expired.

### GET `/api/user/watch/:movieId`

Purpose:
- Legacy compatibility endpoint for purchased movie access.
- Returns detailed watch payload for active rentals.

Headers:
- `Authorization: Bearer <USER_JWT>`

Response `200`:
```json
{
  "success": true,
  "message": "Watch access granted",
  "data": {
    "movie": { "id": "MOVIE_ID", "title": "Inception" },
    "accessExpiresAt": "2026-03-16T10:00:00.000Z",
    "watchLink": null,
    "hlsPlaylistUrl": "https://res.cloudinary.com/<cloud>/video/upload/v123/hls/playlist.m3u8"
  }
}
```


---

## Payment APIs (User Protected)

Required:
- User JWT token

### POST `/api/payment/create-order`

Purpose:
- Create a Razorpay order for a movie purchase (user must be authenticated).
- Prevents duplicate purchase if active rental already exists.

Request headers:
- `Authorization: Bearer <USER_JWT>`
- `Content-Type: application/json`

Body (JSON):
```json
{
  "movieId": "MOVIE_ID"
}
```

Notes:
- `movieId` is required.
- Amount is inferred from movie price on server.

Response `201`:
```json
{
  "success": true,
  "message": "Razorpay order created",
  "data": {
    "orderId": "order_xxx",
    "amount": 19900,
    "currency": "INR",
    "keyId": "rzp_xxx",
    "movieId": "MOVIE_ID" // included when movieId supplied
  }
}
```

Error `409` when already rented:
```json
{
  "success": false,
  "message": "You already rented this movie and your access is still active"
}
```

### POST `/api/payment/verify`

Purpose:
- Verify Razorpay signature after checkout.
- Mark associated purchase record as paid and grant rental access.
- Returns access expiry and watch link.

Headers:
- `Authorization: Bearer <USER_JWT>`
- `Content-Type: application/json`

Body:
```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```
Response `200`:
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "purchaseId": "PURCHASE_ID",
    "movieId": "MOVIE_ID",
    "accessExpiresAt": "2026-03-16T10:00:00.000Z",
    "watchLink": "/api/user/watch/MOVIE_ID"
  }
}
```

---

### GET `/api/payment/order/:orderId`

Purpose:
- Query the status of a previously created order for the authenticated user.

Headers:
- `Authorization: Bearer <USER_JWT>`

Response `200`:
```json
{
  "success": true,
  "message": "Order status retrieved",
  "data": {
    "orderId": "order_123",
    "paymentId": "pay_456",          // may be null while pending
    "status": "pending",            // pending | paid | failed
    "amount": 199,
    "currency": "INR",
    "paidAt": "2026-02-18T...",     // if paid
    "accessExpiresAt": "2026-03-18T..." // if paid
  }
}
```

### POST `/api/payment/webhook`

Purpose:
- Endpoint for Razorpay to notify about payment events.
- Does **not** require authentication; signature verified with
  `RAZORPAY_WEBHOOK_SECRET`.

Headers:
- `Content-Type: application/json`
- `X-Razorpay-Signature: <signature>`

Raw body: JSON object provided by Razorpay (see their docs).

Response `200` always:
```json
{ "success": true, "message": "Webhook processed", "data": null }
```

Error `400` for missing/invalid signature.

---

## User APIs (User Protected)

Required:
- User JWT token

### GET `/api/user/my-movies`

Purpose:
- Fetch all active purchased movies.
- Returns expiry date and watch link for each movie.

Response `200`:
```json
{
  "success": true,
  "message": "Purchased movies fetched successfully",
  "data": [
    {
      "movieId": "MOVIE_ID",
      "title": "Inception",
      "description": "Movie description",
      "actors": ["Actor 1", "Actor 2"],
      "rating": 8.8,
      "price": 199,
      "coverImageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v123/movie-rental/covers/file.jpg",
      "purchasedAt": "2026-02-16T10:00:00.000Z",
      "expiryDate": "2026-03-16T10:00:00.000Z",
      "status": "Active",
      "watchLink": "/api/user/watch/MOVIE_ID"
    }
  ]
}
```

### GET `/api/user/watch/:movieId`

Purpose:
- Validate active rental access for the movie.
- Returns movie details with watch access metadata.

Response `200`:
```json
{
  "success": true,
  "message": "Watch access granted",
  "data": {
    "movie": {
      "id": "MOVIE_ID",
      "title": "Inception",
      "description": "Movie description",
      "actors": ["Actor 1", "Actor 2"],
      "rating": 8.8,
      "price": 199,
      "coverImageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v123/movie-rental/covers/file.jpg",
      "category": { "id": "CAT_ID", "name": "Action" },
      "tags": [{ "id": "TAG_ID", "name": "Thriller" }],
      "createdAt": "2026-02-16T10:00:00.000Z",
      "updatedAt": "2026-02-16T10:00:00.000Z"
    },
    "accessExpiresAt": "2026-03-16T10:00:00.000Z",
    "watchLink": null,
    "hlsPlaylistUrl": "https://res.cloudinary.com/<cloud>/video/upload/v123/hls/playlist.m3u8"
  }
}
```

### GET `/api/user/watch/:movieId/stream`

Purpose:
- Returns HLS stream playlist URL after validating active purchase.
- Requires valid active purchase.

Response `200`:
```json
{
  "success": true,
  "message": "Stream URL fetched",
  "data": {
    "hlsPlaylistUrl": "https://res.cloudinary.com/<cloud>/video/upload/v123/hls/playlist.m3u8"
  }
}
```

### GET `/api/user/profile`

Purpose:
- Get authenticated user profile information.

Headers:
- `Authorization: Bearer <USER_JWT>`

Response `200`:
```json
{
  "success": true,
  "message": "Profile fetched successfully",
  "data": {
    "id": "USER_ID",
    "name": "John Doe",
    "email": "john@mail.com",
    "mobile": "+919999999999",
    "role": "user",
    "avatar": "https://res.cloudinary.com/.../avatar.jpg",
    "createdAt": "2026-02-16T10:00:00.000Z"
  }
}
```

### PUT `/api/user/profile`

Purpose:
- Update authenticated user profile details and optional avatar.

Headers:
- `Authorization: Bearer <USER_JWT>`

Request:
- `multipart/form-data` or `application/json`

Body fields (all optional):
- `username` (string)
- `email` (string)
- `phone` (string)
- `bio` (string)
- `avatar` (file: image)

Response `200`:
```json
{
  "success": true,
  "message": "Profile updated",
  "data": {
    "id": "USER_ID",
    "name": "John Doe",
    "username": "johnny",
    "email": "john@mail.com",
    "phone": "+91 9999999999",
    "bio": "Movie lover",
    "avatar": "https://res.cloudinary.com/<cloud>/image/upload/...",
    "role": "user"
  }
}
```

### GET `/api/user/transactions`

Purpose:
- Get paginated payment transactions for authenticated user.

Headers:
- `Authorization: Bearer <USER_JWT>`

Query params:
- `page` default `1`
- `limit` default `20`, max `50`

Response `200`:
```json
{
  "success": true,
  "message": "Transactions fetched",
  "data": [
    {
      "orderId": "order_xxx",
      "paymentId": "pay_xxx",
      "movieTitle": "Inception",
      "amount": 199,
      "status": "paid",
      "createdAt": "2026-02-20T10:00:00.000Z",
      "purchaseDate": "2026-02-20T10:02:00.000Z",
      "expiryDate": "2026-03-20T10:02:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## Postman Testing Guide

This section outlines how to exercise the payment APIs using Postman.

1. **Obtain user JWT** – call `/api/auth/login` with test user.
2. **Create order**
   - POST `/api/payment/create-order` with body `{ "movieId": "..." }`.
   - Copy `orderId` and `keyId` from response.
3. **Simulate payment**
   - In test mode use Razorpay checkout or create payment via dashboard.
   - Alternatively, use the `order` object to generate a fake signature:
     ```js
     const crypto = require('crypto');
     const sig = crypto
       .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
       .update(orderId + '|' + 'pay_fakeid')
       .digest('hex');
     ```
4. **Verify payment**
   - POST `/api/payment/verify` with captured `razorpay_order_id`,
     `razorpay_payment_id` and `razorpay_signature`.
   - Expect `success: true`.
5. **Access stream**
   - GET `/api/movies/:movieId/stream` with same JWT.
   - Should return `hlsPlaylistUrl`.
6. **Failure scenarios**
   - Send invalid signature -> expect 400 error.
   - Use different user token -> expect 404 "Order not found".
   - Omit JWT -> expect 401.

---

## Admin APIs (Admin Protected)

Required:
- Admin JWT token

### GET `/api/admin/dashboard/overview`

### GET `/api/admin/dashboard`

Purpose:
- Dashboard summary.
- Both endpoints return the same cached analytics snapshot from `dashboard_stats`.

Response `200`:
```json
{
  "success": true,
  "message": "Dashboard overview fetched",
  "data": {
    "totalMovies": 10,
    "totalUsers": 250,
    "totalPurchases": 540,
    "totalRevenue": 128000,
    "paidTransactions": 500
  }
}
```

### GET `/api/admin/movies`

Purpose:
- Get paginated movies (admin view).

Query params:
- `page` default `1`
- `limit` default `10`, max `50`

Response `200`:
```json
{
  "success": true,
  "message": "All movies fetched",
  "data": [{ "id": "MOVIE_ID", "title": "Inception" }],
  "meta": {
    "totalItems": 1,
    "totalPages": 1,
    "currentPage": 1,
    "limit": 10
  }
}
```

### GET `/api/admin/movies/:movieId`

Purpose:
- Get full movie details (admin view).

### POST `/api/movies/create`

Purpose:
- Create a new movie with metadata only (no file uploads).
- Admin only – for creating movie entries before uploading media.

Headers:
- `Authorization: Bearer <ADMIN_JWT>`
- `Content-Type: application/json`

Body:
```json
{
  "title": "Inception",
  "description": "A mind-bending thriller",
  "price": 199,
  "rating": 8.8,
  "actors": ["Leonardo DiCaprio", "Marion Cotillard"],
  "genres": ["Action", "Sci-Fi"],
  "language": "English",
  "validityDays": 30,
  "categories": ["category_id_1", "category_id_2"],
  "tags": ["tag_id_1", "tag_id_2"]
}
```

Response `201`:
```json
{
  "success": true,
  "message": "Movie created successfully",
  "data": {
    "id": "MOVIE_ID",
    "title": "Inception",
    "description": "A mind-bending thriller",
    "price": 199,
    "rating": 8.8,
    "actors": ["Leonardo DiCaprio", "Marion Cotillard"],
    "genres": ["Action", "Sci-Fi"],
    "language": "English",
    "validityDays": 30,
    "categories": [{"id": "CAT_ID", "name": "Action"}],
    "tags": [{"id": "TAG_ID", "name": "Thriller"}],
    "status": "Active",
    "createdAt": "2026-02-16T10:00:00.000Z",
    "updatedAt": "2026-02-16T10:00:00.000Z"
  }
}
```

### POST `/api/admin/movies/upload-video`

Purpose:
- Upload additional video parts for an existing movie (multi-part video support).
- Admin only – appends video parts to existing movie.

Headers:
- `Authorization: Bearer <ADMIN_JWT>`

Request:
- `multipart/form-data`

Fields:
- `movieId` (string, required) - ID of the existing movie
- `video` (file: video, required) - Video file to upload
- `partNumber` (number, required) - Part number for ordering (1, 2, 3, etc.)

Response `200`:
```json
{
  "success": true,
  "message": "Video part uploaded successfully",
  "data": {
    "movieId": "MOVIE_ID",
    "partNumber": 2,
    "url": "https://res.cloudinary.com/.../videos/part2.mp4",
    "duration": 1800,
    "publicId": "movie-rental/videos/part2"
  }
}
```

### POST `/api/admin/movies`

Purpose:
- Upload new movie with assets (admin only).
- Same payload can also be sent to `/api/movies/upload` which is an
  authenticated admin alias for convenience.

Request:
- `multipart/form-data`

Fields:
- `title` (string, required)
- `description` (string, required)
- `price` (number, required)
- `rating` (number, optional)
- `actors` (comma-separated string or array, optional)
- `cover` (file: image, required)
- `video` (file: video, required)

Response `201`:
```json
{
  "success": true,
  "message": "Movie uploaded successfully",
  "data": {
    "id": "MOVIE_ID",
    "title": "Inception",
    "description": "Movie description",
    "actors": ["Actor 1", "Actor 2"],
    "rating": 8.8,
    "price": 199,
    "coverImageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v123/movie-rental/covers/file.jpg",
    "coverImagePublicId": "movie-rental/covers/file",
    "videoUrl": "https://res.cloudinary.com/<cloud>/video/upload/v123/movie-rental/videos/file.mp4",
    "videoPublicId": "movie-rental/videos/file",
    "createdAt": "2026-02-16T10:00:00.000Z",
    "updatedAt": "2026-02-16T10:00:00.000Z"
  }
}
```

### POST `/api/movies/upload`

Purpose:
- Admin alias for `POST /api/admin/movies` (same payload/response).

### PUT `/api/admin/movies/:movieId`

Purpose:
- Update movie metadata and optionally replace cover/video files.
- If new media is uploaded, old Cloudinary assets are deleted after successful update.

Request:
- `multipart/form-data`

Fields (all optional):
- `title` (string)
- `description` (string)
- `price` (number)
- `rating` (number)
- `actors` (comma-separated string or array)
- `cover` (file: image)
- `video` (file: video)

Response `200`:
```json
{
  "success": true,
  "message": "Movie updated successfully",
  "data": {
    "id": "MOVIE_ID",
    "title": "Inception",
    "description": "Movie description",
    "actors": ["Actor 1", "Actor 2"],
    "rating": 8.9,
    "price": 249,
    "coverImageUrl": "https://res.cloudinary.com/<cloud>/image/upload/v123/movie-rental/covers/file.jpg",
    "coverImagePublicId": "movie-rental/covers/file",
    "videoUrl": "https://res.cloudinary.com/<cloud>/video/upload/v123/movie-rental/videos/file.mp4",
    "videoPublicId": "movie-rental/videos/file",
    "createdAt": "2026-02-16T10:00:00.000Z",
    "updatedAt": "2026-02-16T10:30:00.000Z"
  }
}
```

### DELETE `/api/admin/movies/:movieId`

Purpose:
- Delete movie and associated Cloudinary assets.

Response `200`:
```json
{
  "success": true,
  "message": "Movie deleted successfully",
  "data": null
}
```

### GET `/api/admin/users`

Purpose:
- List users with pagination.

Query params:
- `page` default `1`
- `limit` default `10`, max `50`

Response `200`:
```json
{
  "success": true,
  "message": "All users fetched",
  "data": [{ "_id": "USER_ID", "name": "John Doe", "email": "john@mail.com", "role": "user" }],
  "meta": {
    "totalItems": 1,
    "totalPages": 1,
    "currentPage": 1,
    "limit": 10
  }
}
```

### GET `/api/admin/purchases`

Purpose:
- List purchases with pagination.

Query params:
- `page` default `1`
- `limit` default `10`, max `50`

Response `200`:
```json
{
  "success": true,
  "message": "All purchases fetched",
  "data": [{ "id": "PURCHASE_ID", "paymentStatus": "paid" }],
  "meta": {
    "totalItems": 1,
    "totalPages": 1,
    "currentPage": 1,
    "limit": 10
  }
}
```

---

## Razorpay Frontend Integration Flow

1. User logs in using `/api/auth/login`.
2. Call `/api/payment/create-order` with `movieId`.
3. Open Razorpay checkout on frontend using:
- `key`: `data.keyId`
- `order_id`: `data.orderId`
- `amount`: `data.amount`
- `currency`: `data.currency`
4. On successful payment callback, send to backend `/api/payment/verify`:
- `razorpay_order_id`
- `razorpay_payment_id`
- `razorpay_signature`
5. If verify succeeds, user can access:
- `/api/user/my-movies`
- `/api/user/watch/:movieId`
- `/api/user/watch/:movieId/stream` (JSON stream URL endpoint)

---

## Common Status Codes

- `200` OK
- `201` Created
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `500` Internal Server Error


