# MikroTik Hotspot Voucher Management System
## System Architecture & Integration Summary

The ecosystem consists of three main components working together to handle voucher generation, mobile-based redemption by agents, and sales/revenue reporting.

---

```mermaid
graph TD
    subgraph Mobile App (Expo / React Native)
        MA[Operator Interface]
    end

    subgraph Core Backend (Next.js)
        CB[API Gateway / Router Handler]
        DB[(SQLite: vouchers.db)]
    end

    subgraph Sales Report Dashboard (Next.js)
        SR[Admin Dashboard & Analytics]
    end

    subgraph Infrastructure
        MT[MikroTik RouterOS API]
    end

    %% Mobile App Connections
    MA -- "1. GET /api/mikrotik/users" --> CB
    MA -- "2. POST /api/mikrotik/vouchers/redeem" --> CB

    %% Core Backend Connections
    CB -- "3. Read/Write Vouchers" --> DB
    CB -- "4. Create/Update Hotspot Users" --> MT

    %% Sales Report Connections
    SR -- "5. Direct Read/Write (sales_pricing)" --> DB
```

---

### 1. ⚙️ Core Backend (`microtik`)
*   **Path:** `C:\Users\User\Documents\microtik`
*   **Role:** Acts as the primary backend controller and database owner.
*   **Key Responsibilities:**
    *   Maintains the main SQLite database: [vouchers.db](file:///C:/Users/User/Documents/microtik/vouchers.db).
    *   Integrates with **MikroTik RouterOS** via the Node API protocol.
    *   Exposes endpoints used by the Mobile App:
        *   `POST /api/mikrotik/users`: Fetches list of current hotspot users on the router.
        *   `POST /api/mikrotik/vouchers/redeem`: Receives redemption requests from the mobile app. Updates the SQLite database (`is_used = 1`, logs phone number to `used_by`, logs agent name to `sold_by`), and creates/updates the matching hotspot user with comments on the MikroTik router.

### 2. 📱 Mobile Operator App (`microtik-mobileapp`)
*   **Path:** `C:\Users\User\Downloads\microtik-mobileapp\microtik-mobileapp`
*   **Role:** Used by operators/agents in the field to recharge client accounts.
*   **Key Responsibilities:**
    *   Fetches the list of active router users from the backend, parsing and matching them into available/used packages dynamically.
    *   Provides a clean dashboard for selecting plans (7, 15, 30 days) and entering the customer's mobile number.
    *   Executes recharges by sending the `salesperson`'s identity and customer details to `/api/mikrotik/vouchers/redeem`.
    *   Displays successful recharge receipts to operators.

### 3. 📊 Sales Reporting Dashboard (`microtik-sales-report`)
*   **Path:** `C:\Users\User\Documents\microtik-sales-report`
*   **Role:** Analytics portal for administrators to track performance.
*   **Key Responsibilities:**
    *   Connects directly to the shared [vouchers.db](file:///C:/Users/User/Documents/microtik/vouchers.db) database via environment variable settings in [.env.local](file:///C:/Users/User/Documents/microtik-sales-report/.env.local).
    *   Maintains a custom `sales_pricing` table to map voucher validity days (e.g. 7, 15, 30 days) to their sale price (in AED/currency).
    *   Provides dashboards showing total revenue, daily trends, logs, and an **Agent Leaderboard** ranking salespeople by sales count and generated revenue.
