# Role-Based Access and Client Accounts

**Implementation notes — 13 October 2026**

## Purpose

This document records the role-based page access and client-account workflow implemented in the Order Management System. It describes the current application behavior, the main code areas involved, and the implementation steps in order.

## Role-based page access

Business roles and their page access are centralized in [`frontend/src/lib/roleAccess.ts`](./frontend/src/lib/roleAccess.ts).

| Role | Home page | Pages |
| --- | --- | --- |
| Business admin (`admin`) | Dashboard | Dashboard, Orders, Customers, Reports, Users, Notifications |
| Clerk | Dashboard | Dashboard, Orders, Customers, Notifications |
| Viewer | Customers | Customers |

Settings is presented separately in the sidebar and remains available to any signed-in business role.

The frontend uses the shared access map in two places:

- [`frontend/src/App.tsx`](./frontend/src/App.tsx) protects page routes. Unauthenticated users are redirected to login. Signed-in users who visit a disallowed page are redirected to their role’s home page.
- [`frontend/src/components/SideBar.tsx`](./frontend/src/components/SideBar.tsx) filters navigation items by the same page-access rules.

The viewer experience is the read-only Customers page. The former My Orders page and route were removed.

## Client accounts and associated orders

The client-account names displayed in Customers come from the `client_name` values on orders, matching the “Client Account” field displayed in [`frontend/src/pages/Orders.tsx`](./frontend/src/pages/Orders.tsx). They are not sourced from business user profiles.

The frontend page in [`frontend/src/pages/Customers.tsx`](./frontend/src/pages/Customers.tsx) works as follows:

1. Fetches the client-account names from `GET /api/orders/clients`.
2. Filters the names locally using the search input.
3. Waits for a user to select a name before requesting its orders.
4. Fetches the selected account’s orders from `GET /api/orders`, using the exact client-name filter and a page size of 20.
5. Displays each order’s reference, item name (`mineral_type`), quantity, price (`total_zar`), status, and creation date.
6. Offers Previous/Next controls when the selected account has multiple pages of orders.

The selected account’s order query is keyed by account name and page number, so changing either loads the corresponding result set.

## Backend implementation

The client-account endpoint is implemented alongside the order APIs:

- [`backend/src/routes/orders.routes.ts`](./backend/src/routes/orders.routes.ts) registers `GET /clients` before parameterized order routes. It verifies the business-user token.
- [`backend/src/controllers/orders.controller.ts`](./backend/src/controllers/orders.controller.ts) calls the service with the authenticated user’s business context and sends the API response.
- [`backend/src/services/orders.service.ts`](./backend/src/services/orders.service.ts) selects `client_name` from orders scoped to the authenticated `business_id`, reads in bounded batches of 1,000 rows, removes blank names, and deduplicates names case-insensitively.
- The existing order-list endpoint accepts `client_name_exact`. The service escapes SQL `LIKE` metacharacters before matching the client name, then uses the existing pagination behavior.

The client-account endpoint returns names only. Both it and the order-list endpoint remain tenant-scoped through the authenticated tenant database client; the browser does not supply a `business_id`.

## Implementation steps

1. **Defined the page-access rules.** Added a shared role-to-page map and home-page mapping for admin, clerk, and viewer.
2. **Applied rules to page routes.** Added role-aware protection to authenticated routes and made the fallback redirect to the signed-in user’s role home page.
3. **Applied rules to navigation.** Filtered sidebar entries with the same role map and retained the shared Settings control.
4. **Moved viewer access to Customers.** Set Customers as the viewer home page and allowed viewer access to that page.
5. **Removed the obsolete viewer page.** Removed the My Orders page, its route, and its navigation item.
6. **Aligned client accounts with Orders data.** Changed the Customers list to use distinct order `client_name` values rather than looking up viewer user profiles.
7. **Added a tenant-scoped account-name API.** Added `GET /api/orders/clients` to return names present in the signed-in business’s order records.
8. **Connected account selection to order lookup.** Added exact-name filtering to the order API request and loaded selected orders only, in pages.
9. **Displayed the requested order fields.** Used the Orders page’s item name, quantity, and total-price values in the associated-order table.
10. **Kept client names current after order changes.** Invalidated the customer-account query when Orders mutations succeed.
11. **Investigated a route-related 403.** The error response showed the older `/users/customers` request was being handled as `/users/:id`; the compiled backend output also lacked that earlier route. The backend was rebuilt, and the final account-name workflow was placed under `/api/orders/clients`.

## Loading, empty, and error behavior

- Customers shows loading feedback while client-account names are fetched.
- A failed account-name request shows an error message instead of an empty success state.
- An empty name list or unmatched search displays a no-results message.
- No orders are fetched before a client account is selected.
- The selected-account panel distinguishes loading orders, order-fetch errors, and accounts with no matching orders.
- Long order lists are paginated rather than loaded in one unbounded request.

## Validation status

- Backend TypeScript build (`npm --prefix backend run build`): passed after the order client-name endpoint was added.
- `git diff --check`: passed.
- Frontend build: blocked by the unresolved import `@/lib/platformHttp` in the existing `frontend/src/pages/platform/PlatformLoginPage.tsx`. The initial build also identified a stale pagination variable in Customers; that reference was corrected before the final check. The outstanding platform import is separate from the Customers implementation.
- A final frontend build and lint run were not completed successfully; no browser/API integration test is recorded here.

## Current endpoint summary

| Endpoint | Purpose | Access |
| --- | --- | --- |
| `GET /api/orders/clients` | Return distinct client-account names from the authenticated business’s orders | Any authenticated business role |
| `GET /api/orders?client_name_exact={name}&page={page}&limit=20` | Return a selected account’s paginated orders | Any authenticated business role, subject to tenant scope |

