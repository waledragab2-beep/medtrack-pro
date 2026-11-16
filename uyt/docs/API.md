# UYT API (v1)

Base path: `/api`. JSON in/out. Errors: `{ "error": { "code", "message", "details?" } }`.

Auth types:
- **Staff** – `Authorization: Bearer <accessToken>` (JWT, 1h) + rotating refresh token.
- **Device** – `X-Device-Token: <token>` issued when a phone links to an order (only valid for that order).

Roles: `owner` › `manager` › `cashier`. Every `/brands/:brandId/...` route checks membership (other tenants get 404).

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{fullName,email,password,brandName,branchName?,locale}` → creates user + brand + first branch + owner |
| POST | `/auth/login` | `{email,password}` → `{accessToken,refreshToken,user,memberships}` |
| POST | `/auth/refresh` | `{refreshToken}` – single use (rotation) |
| POST | `/auth/logout` | `{refreshToken}` |
| GET | `/me` | user + memberships |
| POST | `/me/password` | `{currentPassword,newPassword}` – revokes all sessions |

## Orders (all roles)
| Method | Path | Notes |
|---|---|---|
| GET | `/brands/:brandId/orders?branchId&scope=active` | board: preparing + ready |
| GET | `/brands/:brandId/orders?scope=history&q&status&before&limit` | paginated history |
| POST | `/brands/:brandId/orders` | `{branchId,orderNumber,note?,prepMinutes?}` – 409 if number active in branch |
| GET | `/brands/:brandId/orders/:orderId` | order + events timeline + notification log + rating |
| POST | `…/:orderId/ready` | idempotent; queues one push per linked device |
| POST | `…/:orderId/remind` | ready only, ≥30s apart, ≤ maxReminders |
| POST | `…/:orderId/pickup` | |
| POST | `…/:orderId/cancel` | cancels pending pushes |
| POST | `…/:orderId/unlink` | revokes linked phones, rotates QR secret + code |

## Brand admin (owner/manager)
| Method | Path |
|---|---|
| GET / PATCH | `/brands/:brandId` (identity, theme, social, googleReviewUrl, notificationSettings, locale, timezone, currency) |
| POST / PATCH | `/brands/:brandId/branches[/:branchId]` |
| GET / POST / PATCH / DELETE | `/brands/:brandId/staff[/:userId]` (managers may only manage cashiers; delete = owner) |
| CRUD | `/brands/:brandId/menu/categories`, `/brands/:brandId/menu/items`, `/brands/:brandId/offers` |
| POST | `/brands/:brandId/uploads` (multipart image ≤5MB: png/jpeg/webp/gif) |
| GET | `/brands/:brandId/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&branchId?` |

Analytics returns `current` and `previous` (same-length previous period) summaries: totalOrders, pickedUp, cancelled, avgOrdersPerDay, avgPrepSeconds, avgPickupSeconds, latePickups, avgRating, ratingsCount, googleReviewClicks, notifications {attempted, accepted, delivered, failed, sendRate, deliveryRate}, linkRate; plus `daily`, `hourly`, `recentRatings`, `allTimeOrders`.

## Public (customer)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/public/config` | – | VAPID public key |
| GET | `/public/branches/:slug` | – | brand page: identity, theme, branch, menu, active offers |
| POST | `/public/branches/:slug/claim` | – | `{orderNumber,claimCode?,platform,locale}` → `{orderId,deviceToken}` (12/min/IP) |
| POST | `/public/orders/:orderId/claim` | – | `{secret,platform,locale}` – per-order QR |
| GET | `/public/orders/:orderId` | device | status, ETA, queue position, brand content |
| POST | `/public/device/push` | device | `{provider:'fcm'|'apns'|'expo',token}` or `{provider:'webpush',subscription}` |
| POST | `/public/notifications/:id/ack` | device | delivery receipt |
| POST | `/public/orders/:orderId/rating` | device | `{stars:1..5,comment?}` |
| POST | `/public/orders/:orderId/review-click` | device | Google review click tracking |

## Realtime (Socket.IO, path `/socket.io`)
- Staff: `auth: { accessToken }` then `emit('subscribe:branch', {brandId, branchId}, ack)` → events `order:upsert`.
- Device: `auth: { deviceToken }` → auto-joined to its order → `order:status`, `order:reminder`, `order:unlinked`.
