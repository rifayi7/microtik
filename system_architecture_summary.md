# My WiFi — Multi-Platform MikroTik Voucher & Sales Ecosystem
## Comprehensive System Architecture & Developer Guide

The **My WiFi** ecosystem is an end-to-end, multi-platform solution for managing MikroTik Hotspot networks, generating and printing vouchers, selling/recharging vouchers via a field mobile app, and generating sales/collection analytics.

---

```mermaid
graph TD
    subgraph ?? Mobile App (Expo / React Native)
        MA[Field Operator App / POS]
    end

    subgraph ?? Shared Central Database (Turso Cloud / LibSQL)
        TDB[(Turso Cloud Database: vouchers, routers, camps, payments, expenses)]
    end

    subgraph ?? Core Web & API Gateway (Next.js @ Vercel)
        CW[Web Admin Portal & Central API Gateway]
        CW_URL["https://microtik-nine.vercel.app"]
    end

    subgraph ?? Sales & Accounting Portal (Next.js)
        SR[Admin Sales, Pricing & Expense Dashboard]
    end

    subgraph ?? Physical Networks (Hotspot Infrastructure)
        MT1[MikroTik RouterOS - Camp 1]
        MT2[MikroTik RouterOS - Camp 2]
    end

    %% Mobile Connections
    MA -- "1. Operator Auth & Recharge (/api/mikrotik/*)" --> CW_URL
    CW -- "2. Direct Sync" --> TDB

    %% Router Connections
    CW -- "3. RouterOS API (Port 8728/21985)" --> MT1
    CW -- "3. RouterOS API (Port 8728/21985)" --> MT2

    %% Sales Report Connections
    SR -- "4. SQL Queries & Management" --> TDB
```

---

## ?? The Three Connected Projects

### 1. ?? Web Admin Portal & Central API (`microtik`)
* **Path:** `C:\Users\User\Documents\microtik`
* **Live Deployment:** `https://microtik-nine.vercel.app`
* **Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Lucide Icons, `@libsql/client`, RouterOS API.
* **Role & Responsibilities:**
  * **Central API Gateway:** Serves all backend endpoints for the mobile app and router synchronization.
  * **Router Management:** Connects to multiple MikroTik RouterOS physical hardware units via API.
  * **Batch Voucher Generator:** Generates formatted alphanumeric voucher codes (including options like numbers `1234`, uppercase letters, custom lengths) and syncs them directly into MikroTik RouterOS and the central database.
  * **Operator Management:** Manages sales agents (`/api/mikrotik/auth/login`), access permissions, and session logs.
  * **Key Endpoints:**
    * `POST /api/mikrotik/auth/login`: Authenticates field agents.
    * `GET /api/mikrotik/routers`: Fetches verified camps and routers.
    * `POST /api/mikrotik/connect`: Tests/connects to a specific MikroTik router.
    * `POST /api/mikrotik/users/generate`: Generates voucher batches in DB & RouterOS.
    * `POST /api/mikrotik/vouchers/redeem`: Executes mobile customer recharges (marks `status='redeemed'`, binds customer `mobile`, records `sold_by` agent and `price_charged`, and activates the user in MikroTik RouterOS).
    * `GET /api/mikrotik/dashboard/sales-summary`: Provides live revenue and outstanding balances.

---

### 2. ?? Mobile Operator App (`microtik-mobileapp`)
* **Path:** `C:\Users\User\Downloads\microtik-mobileapp\microtik-mobileapp`
* **Tech Stack:** React Native (Expo SDK 56), TypeScript, Expo Router, `lucide-react-native`, `react-native-safe-area-context`, EAS Cloud Build.
* **Role & Responsibilities:**
  * **Field POS for Agents:** Used on Android smartphones by salespersons to sell hotspot internet vouchers to camp residents.
  * **Direct Backend Mode:** Configured by default to connect seamlessly to `https://microtik-nine.vercel.app`.
  * **Developer Bypass:** Hidden 5-tap gesture on the brand logo toggles manual Gateway URL input mode on/off on device.
  * **Hardware-Aware UI:** Built with `react-native-safe-area-context` to ensure top headers sit comfortably below notches, punch-holes, and status bars.
  * **Core Tabs:**
    * **Dashboard:** Shows personal daily sales, monthly revenue, outstanding balances, and recent collections.
    * **Sales (Recharge):** Allows selecting a Camp, selecting a Plan (e.g. 7, 15, 30 days), viewing live remaining voucher counts, entering customer phone numbers (10 digits), and instant one-tap redemption.
    * **History:** Searchable and date-filtered customer recharge logs (Today, Yesterday, Custom date range).
    * **Coupon:** Camp-wise inventory accordion showing available vs redeemed voucher stock.
    * **More:** Agent profile details, logout, and app info.

---

### 3. ?? Sales & Accounting Portal (`microtik-sales-report`)
* **Path:** `C:\Users\User\Documents\microtik-sales-report`
* **Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Recharts, Lucide Icons, `@libsql/client`.
* **Role & Responsibilities:**
  * **Executive Analytics & Reporting:** Comprehensive dashboard for managers and accountants.
  * **Camps Sales Carousel:** Interactive auto-sliding and swipeable carousel displaying performance metrics for each camp (name, total revenue in AED, voucher count).
  * **Dynamic Last-Month Stats:** Directly calculates previous month's total sales and verified collections from the database.
  * **Multi-Tenant Masters:**
    * **Companies & Camps:** Hierarchical setup of companies and their associated camps/routers.
    * **Validity Profiles & Camp Pricing:** Configurable custom pricing per camp and duration.
    * **Payments & Expenses:** Tracking collections, commissions, agent splits, and business expenses.
    * **Reports Suite:** Voucher Sales log, Monthly Sales breakdown, Validity distribution, Hotspot analytics, Payment by Camp, and Payment by User.

---

## ??? Database Architecture (Turso Cloud Database)

* **URL:** `libsql://microtik-fasilavayil.aws-ap-south-1.turso.io`
* **Primary Tables:**
  1. `vouchers`: Holds all generated and redeemed voucher codes (`code`, `validity`, `price_charged`, `status`, `used_at`, `used_by`, `sold_by`, `router_id`).
  2. `routers`: Registered MikroTik router configurations (`id`, `sessionName`, `host`, `port`, `username`, `password`, `camp`, `hotspotName`).
  3. `camps`: Camp entities (`id`, `name`, `company_name`, `hotspot_name`, `strength`).
  4. `companies`: Business corporate entities (`id`, `name`).
  5. `validity_profiles`: Available duration packages (`id`, `name` e.g. `30-Days`, `15-Days`).
  6. `camp_validity_pricing`: Custom pricing overrides per camp (`camp_name`, `validity_name`, `price`, `status`).
  7. `payments`: Record of payments received from agents (`id`, `paid_by_user`, `camp_name`, `paid_for_year_month`, `amount`, `verified_status`).
  8. `expenses`: Business expenses categorized by company, supplier, and date.
  9. `sales_pricing`: Global fallback pricing per validity days.

---

## ? Developer Cheat Sheet / Quick Commands

* **Web Portal (`microtik`):**
  * `npm run dev` — Run local development server on port 3000
  * `npm run build` — Verify production build
* **Sales Report (`microtik-sales-report`):**
  * `npm run dev` — Run local development server on port 3001
  * `npm run build` — Verify production build
* **Mobile App (`microtik-mobileapp`):**
  * `npx expo start` — Start Metro bundler
  * `npx tsc --noEmit` — Type-check mobile code
  * `npx eas-cli build --platform android --profile preview --non-interactive` — Cloud build Android APK
