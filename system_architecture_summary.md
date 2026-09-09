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

---

## 📢 Broadcast & Operator Notifications System

1. **Super Admin Broadcast Hub (`/admin` -> Notifications)**:
   - Super Administrators can compose and broadcast real-time operational messages, maintenance alerts, or price updates.
   - **Targeting Modes**:
     - `ALL`: Dispatches announcement globally to all operators across all companies.
     - `COMPANY`: Scopes the notification strictly to field operators under the selected company ID (`company_id`).
   - **Urgency Types**: `info` ℹ️, `warning` ⚠️, `urgent` 🚨, `maintenance` 🔧.
2. **API Contracts**:
   - `GET /api/mikrotik/admin/notifications`: Super Admin management and read statistics.
   - `POST /api/mikrotik/admin/notifications`: Broadcast new message.
   - `DELETE /api/mikrotik/admin/notifications?id={id}`: Revoke announcement.
   - `GET /api/mikrotik/notifications`: Mobile operator fetch scoped by `company_id` and `salesPersonId`.
   - `POST /api/mikrotik/notifications/read`: Mark notification as read per salesperson.

---

## ⏸️ Company Suspension & Dues Enforcement System

1. **Company Status Management (`/admin` -> Company Accounts)**:
   - Super Administrators can toggle any client company account between **`Active` (1)** and **`Paused (Dues)` (0)**.
   - Updates `companies.status` and `companies.suspended_reason` without altering or deleting any historical vouchers, routers, or transaction logs.
2. **Multi-Platform Enforcement**:
   - **Sales Operator Mobile App**:
     - `POST /api/mikrotik/auth/login` checks company status upon operator authentication. If paused, access is denied with HTTP 403 (`isSuspended: true`).
     - `POST /api/mikrotik/vouchers/redeem` checks company status upon voucher sale. If paused, recharges are blocked with HTTP 403 (`isSuspended: true`).
   - **Company Admin Portal**:
     - `POST /api/mikrotik/auth/admin-login` blocks company admin dashboard access with suspension notice while paused.
3. **Instant Reactivation**:
   - Toggling back to **Activate** restores all company services, sales POS, and admin access instantly in real-time.


