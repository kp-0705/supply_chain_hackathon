# AI Prompt: Supply Chain Demand Management System

You are an expert backend engineer building a supply chain demand management system for a semiconductor manufacturer (Micron). Generate production-ready code for the following requirements:

## System Overview
- **Tech Stack:** Node.js/Express (or FastAPI if Python), PostgreSQL, JWT authentication
- **Database:** Already designed (schema provided separately)
- **Architecture:** REST API with role-based access control (RBAC)
- **Core Feature:** Multi-level approval workflow (4 levels) with partial allocation handling

## Workflow Summary
1. **Admin:** Adds weekly supply (4 weeks per month, per product)
2. **Customer:** Submits demand (product, quantity, required date)
3. **Level 1 (DEMAND_VALIDATOR):** Validates customer & product
4. **Level 2 (SUPPLY_VALIDATOR):** Validates supply plan exists & locked
5. **Level 3 (MATCHING_PLANNER):** Allocates supply (full or partial), can adjust quantity
6. **Level 4 (EXECUTIVE_APPROVER):** Final approval, override authority

## Key Features to Implement

### 1. Authentication & Authorization
- JWT-based login with role-based routing
- Middleware to check user role before allowing API access
- Routes protected by role: ADMIN, CUSTOMER, LEVEL1, LEVEL2, LEVEL3, LEVEL4

### 2. Supply Management (Admin Only)
- Endpoint: `POST /api/admin/supply/add`
- Input: product_id, month, week (1-4), available_quantity
- Create 4 rows (one per week) for each product each month
- Validation: product must exist, month/week valid, quantity >= 0

### 3. Demand Submission (Customer Only)
- Endpoint: `POST /api/customer/demand/submit`
- Input: product_id, requested_quantity, required_date
- Validations: Apply Level 1 rules (see below)
- AI Integration: Call AI agent to generate suggested_quantity, reason, confidence
- Response: Created demand_raw row with level=0, status='PENDING'

### 4. Demand Approval Flow (4 Levels)
Each level has:
- Endpoint: `POST /api/level{N}/demand/{demand_id}/approve`
- Endpoint: `POST /api/level{N}/demand/{demand_id}/reject`
- Query: `GET /api/level{N}/demands` (show demands at current level only)
- Business Logic Rules (see separate section)
- Action Logging: Every decision logged to demand_action_log

### 5. Partial Allocation Handling
- When Level 3 allocates < requested_quantity:
  - Set status='PARTIALLY_ALLOCATED'
  - Keep level=3 (don't move to level 4)
  - Log action with reason
- Auto-completion logic:
  - When new week's supply is added, check for PARTIALLY_ALLOCATED demands
  - Automatically allocate remaining from new supply
  - Move to level 4 and notify Level 4 approver

### 6. Customer Dashboard
- Endpoint: `GET /api/customer/demand/{demand_id}/status`
- Response: Full timeline from demand_action_log + current level status
- Show allocated quantities per week, status at each level

### 7. AI Agent Integration
- When demand is submitted, call AI with:
  - Customer profile (tier, history, credit)
  - Product details (category, price, demand pattern)
  - Available supply (current + projected)
  - Suggest optimal quantity to approve
- Store: suggested_quantity, reason, confidence (0-100)

## Database Schema Reference
```
users, customers, products, supply, demand_raw, demand_action_log, 
demand_approved, supply_allocation
```

## Error Handling
- 400: Validation failed (missing fields, invalid data)
- 401: Unauthorized
- 403: Forbidden (wrong role)
- 404: Resource not found
- 409: Conflict (e.g., partial allocation that can't be resolved)

## Response Format
All endpoints return:
```json
{
  "success": true/false,
  "message": "...",
  "data": {...},
  "errors": [...]
}
```

## Priority
Generate code in this order:
1. Database models/connection
2. Authentication & middleware
3. Supply management endpoints
4. Demand submission with validation rules
5. Level 1-4 approval endpoints with business logic
6. Partial allocation auto-completion
7. Customer dashboard/timeline
8. AI integration (optional if time permits)

---

## Additional Notes
- Include proper error handling and logging
- Use transactions for multi-step operations (e.g., allocating supply + logging action)
- Add input validation for all endpoints
- Include database indexes for performance
