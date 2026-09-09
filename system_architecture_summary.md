# LinkFi - Multi-Platform MikroTik Voucher & Sales Ecosystem
## Comprehensive System Architecture & Developer Guide

The **LinkFi** ecosystem is an end-to-end, multi-platform solution for managing MikroTik Hotspot networks, generating and printing vouchers, selling/recharging vouchers via a field mobile app, and generating sales/collection analytics.

---

```mermaid
graph TD
    subgraph 📱 Mobile App (Expo / React Native)
        MA[Field Operator App / POS]
    end

    subgraph 🗄️ Shared Central Database (Turso Cloud / LibSQL)
        TDB[(Turso Cloud Database: vouchers, routers, camps, payments, expenses, report_users)]
    end

    subgraph 🌐 Core Web & API Gateway (Next.js @ Vercel)
        CW[Web Admin Portal & Central API Gateway]
        CW_URL["https://microtik-nine.vercel.app"]
    end

    subgraph 📊 Sales & Accounting Portal (Next.js)
        SR[Admin Sales, Pricing & Expense Dashboard]
    end

    subgraph 🛰️ Physical Networks (Hotspot Infrastructure)
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
    SR -- "4. SQL Queries & Management (ID-Based Multi-Tenancy)" --> TDB
```

---

## 🏢 ID-Based Multi-Tenancy & Report Users Architecture

All tenant entities in the LinkFi ecosystem are bound together strictly using **Numerical Integer IDs** to prevent conflicts or broken associations:
1. **`companies`**: `id` (INTEGER PK), `name` (TEXT), `timezone` (e.g. `Asia/Dubai`, `Asia/Riyadh`).
2. **`report_users`**:
   - Stores login access for managers, auditors, and company accountants to view the **Sales Report Portal**.
   - Accessible and configurable **strictly by Super Administrators** via the Web Admin Portal (`/admin` -> `Report Viewers`).
   - Fields: `id`, `username`, `password`, `display_name`, `company_id` (FK to `companies.id`), `company_name`, `allowed_camp_ids` (JSON), `status` (1 = active, 0 = disabled).
3. **`sales_persons` (Salespeople & Mobile POS Operators)**:
   - Identifies POS salespeople bound to specific companies and authorized camps/routers.
   - Fields: `id`, `username`, `display_name`, `password`, `company_id` (FK to `companies.id`), `company_name`, `allowed_camps` (JSON Array), `allowed_router_ids` (JSON Array of router IDs).
   - Deprecated static `camp_name` field in favor of dynamic multi-camp permissions via `allowed_camps` and `allowed_router_ids`.
4. **Role & Branding Indicators**:
   - Web Admin Portal header & sidebar dynamically display account level:
     - `🛡️ Super Administrator`
     - `🏢 Company Admin: {CompanyName}`
   - Official branding updated across web surfaces to **LinkFi** featuring the official logo.

---

## 📡 Router Hardware Discovery, Deduplication & Lifecycle (`rout-plan-2`)

1. **Hardware Discovery via `/api/mikrotik/routers/test`**:
   - Queries `/system/routerboard`, `/system/resource`, `/system/identity`, and `/ip/cloud`.
   - Extracts hardware `serial-number`, `board-name`, `version`, and Cloud DNS (`*.sn.mynetname.net`).
2. **Deterministic Hardware Router IDs**:
   - `router-[serialNumber]` (e.g. `router-HE4089A12B`) or `router-[cloudPrefix]`.
   - Uniquely identifies physical hardware and prevents duplicate records under different names.
3. **Soft-Delete & Automatic Reactivation**:
   - Deleting a router marks `is_active = 0` and `deleted_at = CURRENT_TIMESTAMP`, keeping historical voucher transactions and sales reports 100% intact.
   - Re-adding the same physical router automatically reactivates the record (`is_active = 1`) and preserves historical links.
