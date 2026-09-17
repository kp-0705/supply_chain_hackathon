const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/database');

// ============================================================================
// AI SERVICE - GEMINI-POWERED SUPPLY CHAIN INTELLIGENCE
// Provides two capabilities:
//   1. Level 2 Recommendation Agent (advisory only, human decides)
//   2. Customer Chatbot (restricted to authenticated customer's own demands)
// ============================================================================

/**
 * Initialise Gemini client lazily so missing API key doesn't crash the server.
 * Returns null if GEMINI_API_KEY is not set.
 */
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

// ---------------------------------------------------------------------------
// Helper: gather all context needed for a Level 2 demand
// ---------------------------------------------------------------------------
async function gatherLevel2Context(demandId) {
  // Demand core
  const demandRes = await db.query(
    `SELECT dr.*, c.customer_name, c.tier, c.priority, c.region, c.credit_limit,
            p.product_name, p.category, p.unit_price, p.standard_cost, p.status as product_status
     FROM demand_raw dr
     JOIN customers c ON dr.customer_id = c.customer_id
     JOIN products p ON dr.product_id = p.product_id
     WHERE dr.demand_id = $1`,
    [demandId]
  );
  if (demandRes.rows.length === 0) throw new Error(`Demand #${demandId} not found`);
  const demand = demandRes.rows[0];

  const reqDate = new Date(demand.required_date);
  const targetMonth = reqDate.getMonth() + 1;

  // Supply rows for this product + month
  const supplyRes = await db.query(
    `SELECT week, available_quantity, allocated_quantity,
            (available_quantity - allocated_quantity) AS remaining_quantity
     FROM supply
     WHERE product_id = $1 AND month = $2
     ORDER BY week ASC`,
    [demand.product_id, targetMonth]
  );
  const supplyRows = supplyRes.rows || [];

  const totalAvailable = supplyRows.reduce(
    (s, r) => s + Number(r.available_quantity), 0
  );
  const totalRemaining = supplyRows.reduce(
    (s, r) => s + Number(r.remaining_quantity), 0
  );

  // Previous action log entries for this demand (human decisions + comments)
  const logRes = await db.query(
    `SELECT level, action_type, approved_quantity, reason, comment, created_at
     FROM demand_action_log
     WHERE demand_id = $1
     ORDER BY created_at ASC`,
    [demandId]
  );
  const actionLog = logRes.rows || [];

  // Recent Level 2 decisions for the same product (last 5) — for pattern learning
  const historicalRes = await db.query(
    `SELECT dr.demand_id, dr.requested_quantity, dr.suggested_quantity,
            dr.confidence, dr.reason, c.tier, c.priority,
            dal.action_type, dal.approved_quantity, dal.reason as human_reason, dal.comment
     FROM demand_raw dr
     JOIN customers c ON dr.customer_id = c.customer_id
     LEFT JOIN demand_action_log dal ON dr.demand_id = dal.demand_id AND dal.level = 2
     WHERE dr.product_id = $1
       AND dr.demand_id != $2
       AND dal.action_type IS NOT NULL
     ORDER BY dr.created_at DESC
     LIMIT 5`,
    [demand.product_id, demandId]
  );
  const historicalDecisions = historicalRes.rows || [];

  // Exception rules that could apply
  const orderValue = Number(demand.requested_quantity) * Number(demand.unit_price);
  const margin = Number(demand.unit_price) > 0
    ? ((Number(demand.unit_price) - Number(demand.standard_cost)) / Number(demand.unit_price)) * 100
    : 0;

  const applicableRules = [];
  if (demand.tier === 'STRATEGIC' && demand.priority === 'HIGH') applicableRules.push('STRATEGIC_CUSTOMER: High-priority strategic customer, deserves supply preference');
  if (demand.tier === 'SPOT') applicableRules.push('SPOT_CUSTOMER: Spot customers require 100% full allocation or rejection');
  if (orderValue > 1000000) applicableRules.push(`HIGH_VALUE: Order value $${orderValue.toLocaleString()} exceeds $1M threshold`);
  if (margin < 8) applicableRules.push(`LOW_MARGIN: Profit margin ${margin.toFixed(1)}% is below 8% target`);
  if (demand.region === 'EU' && demand.category === 'RESTRICTED_EXPORT') applicableRules.push('EXPORT_RESTRICTION: EU region destination blocked for RESTRICTED_EXPORT products');

  return {
    demand,
    targetMonth,
    supplyRows,
    totalAvailable,
    totalRemaining,
    actionLog,
    historicalDecisions,
    applicableRules,
    orderValue,
    margin
  };
}

// ---------------------------------------------------------------------------
// 1. Level 2 AI Recommendation Agent
// ---------------------------------------------------------------------------
const AiService = {

  async generateLevel2Recommendation(demandId) {
    const genAI = getGenAI();
    if (!genAI) {
      return {
        suggested_quantity: null,
        allocation_pct: null,
        confidence: null,
        reason: 'AI recommendations are disabled. Set GEMINI_API_KEY in .env to enable.',
        generated_at: new Date().toISOString(),
        ai_available: false
      };
    }

    const ctx = await gatherLevel2Context(demandId);
    const { demand, supplyRows, totalRemaining, actionLog, historicalDecisions, applicableRules, orderValue, margin } = ctx;

    const requestedQty = Number(demand.requested_quantity);
    const allocationPct = totalRemaining >= requestedQty
      ? 100
      : totalRemaining > 0 ? Math.round((totalRemaining / requestedQty) * 100) : 0;

    // Build structured context for Gemini
    const contextBlock = JSON.stringify({
      demand: {
        id: demand.demand_id,
        requested_quantity: requestedQty,
        required_date: demand.required_date,
        product: demand.product_name,
        product_category: demand.category,
        product_status: demand.product_status,
        unit_price: Number(demand.unit_price),
        profit_margin_pct: margin.toFixed(2)
      },
      customer: {
        name: demand.customer_name,
        tier: demand.tier,
        priority: demand.priority,
        region: demand.region
      },
      supply: {
        target_month: ctx.targetMonth,
        total_available: ctx.totalAvailable,
        total_remaining: totalRemaining,
        weekly_breakdown: supplyRows.map(s => ({
          week: s.week,
          available: Number(s.available_quantity),
          already_allocated: Number(s.allocated_quantity),
          remaining: Number(s.remaining_quantity)
        })),
        can_fulfill_fully: totalRemaining >= requestedQty,
        estimated_allocation_pct: allocationPct
      },
      applicable_business_rules: applicableRules,
      action_history: actionLog,
      similar_past_decisions: historicalDecisions
    }, null, 2);

    const prompt = `You are an expert supply chain AI advisor embedded in a semiconductor supply allocation system.

Your role is to ASSIST (not replace) human Level 2 Supply Planners by providing a data-driven recommendation.

You have been given the following structured context about a customer demand:

<context>
${contextBlock}
</context>

Based on this context, generate a supply allocation recommendation. You MUST respond with ONLY valid JSON in the exact format below — no markdown, no prose, no explanation outside the JSON:

{
  "suggested_quantity": <number: exact integer quantity to allocate>,
  "allocation_pct": <number: percentage 0-100 of requested quantity to allocate>,
  "confidence": <number: your confidence 0-100>,
  "reason": "<concise 2-3 sentence explanation referencing specific data points from the context: supply availability, customer tier, business rules triggered, and any relevant historical patterns>"
}

Rules for your recommendation:
- suggested_quantity must not exceed the requested_quantity
- suggested_quantity must not exceed total_remaining supply
- For SPOT tier customers: only recommend 100% or 0% (no partials)
- For STRATEGIC + HIGH priority customers: maximize allocation, even if partial
- If export restrictions apply, recommend 0 with clear reason
- confidence should reflect how clear-cut the decision is (80-100 = obvious, 50-79 = moderate judgment needed, below 50 = complex case)
- Reason must reference actual numbers from the context`;

    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    let parsed;
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      // Strip markdown code fences if present
      const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch (err) {
      console.error('Gemini Level2 recommendation parse error:', err);
      // Fallback: return computed values without AI narrative
      return {
        suggested_quantity: Math.min(requestedQty, totalRemaining),
        allocation_pct: allocationPct,
        confidence: 60,
        reason: `Supply analysis: ${totalRemaining.toLocaleString()} units available out of ${requestedQty.toLocaleString()} requested (${allocationPct}%). Customer tier: ${demand.tier}, Priority: ${demand.priority}. AI narrative unavailable — using computed values.`,
        generated_at: new Date().toISOString(),
        ai_available: true,
        fallback: true
      };
    }

    return {
      suggested_quantity: Number(parsed.suggested_quantity),
      allocation_pct: Number(parsed.allocation_pct),
      confidence: Number(parsed.confidence),
      reason: parsed.reason,
      generated_at: new Date().toISOString(),
      ai_available: true,
      context_summary: {
        requested_qty: requestedQty,
        total_remaining_supply: totalRemaining,
        customer_tier: demand.tier,
        customer_priority: demand.priority,
        applicable_rules: applicableRules
      }
    };
  },

  // ---------------------------------------------------------------------------
  // 2. Customer Chatbot
  // ---------------------------------------------------------------------------
  async answerCustomerQuery(customerId, demandId, question) {
    const genAI = getGenAI();

    // Always gather DB context first
    const demandRes = await db.query(
      `SELECT dr.demand_id, dr.status, dr.level, dr.requested_quantity,
              dr.suggested_quantity, dr.reason, dr.required_date,
              dr.created_at, dr.updated_at,
              c.customer_name, c.tier,
              p.product_name, p.unit_price
       FROM demand_raw dr
       JOIN customers c ON dr.customer_id = c.customer_id
       JOIN products p ON dr.product_id = p.product_id
       WHERE dr.demand_id = $1 AND dr.customer_id = $2`,
      [demandId, customerId]
    );

    if (demandRes.rows.length === 0) {
      return {
        answer: 'I could not find that demand in your account. Please select one of your active demands from the dropdown.',
        sources: []
      };
    }

    const demand = demandRes.rows[0];

    // Allocations
    const allocRes = await db.query(
      `SELECT COALESCE(SUM(sa.allocated_quantity), 0) as total_allocated
       FROM supply_allocation sa WHERE sa.demand_id = $1`,
      [demandId]
    );
    const totalAllocated = Number(allocRes.rows?.[0]?.total_allocated || 0);

    // Action log — human decisions & comments (only customer-safe fields)
    const logRes = await db.query(
      `SELECT level, action_type, approved_quantity, reason, comment, created_at
       FROM demand_action_log
       WHERE demand_id = $1
       ORDER BY created_at ASC`,
      [demandId]
    );
    const actionLog = logRes.rows || [];

    // Next available supply for this product (future months)
    const reqDate = new Date(demand.required_date);
    const currentMonth = reqDate.getMonth() + 1;
    const nextSupplyRes = await db.query(
      `SELECT month, week,
              (available_quantity - allocated_quantity) AS remaining_quantity
       FROM supply
       WHERE product_id = (SELECT product_id FROM demand_raw WHERE demand_id = $1)
         AND (available_quantity - allocated_quantity) > 0
         AND month >= $2
       ORDER BY month ASC, week ASC
       LIMIT 4`,
      [demandId, currentMonth]
    );
    const nextAvailableSupply = nextSupplyRes.rows || [];

    // Build customer-safe context (no costs, margins, internal rule codes)
    const customerContext = JSON.stringify({
      demand: {
        id: demand.demand_id,
        product: demand.product_name,
        requested_quantity: Number(demand.requested_quantity),
        allocated_quantity: totalAllocated,
        fulfillment_percentage: Number(demand.requested_quantity) > 0
          ? Math.round((totalAllocated / Number(demand.requested_quantity)) * 100)
          : 0,
        status: demand.status,
        approval_stage: `Level ${demand.level} of 4`,
        required_date: demand.required_date,
        submitted_on: demand.created_at,
        last_updated: demand.updated_at,
        planner_notes: demand.reason || null
      },
      decision_history: actionLog.map(l => ({
        stage: `Level ${l.level}`,
        action: l.action_type,
        quantity_approved: l.approved_quantity,
        reason_given: l.reason,
        additional_comment: l.comment,
        date: l.created_at
      })),
      supply_availability: nextAvailableSupply.length > 0
        ? nextAvailableSupply.map(s => ({
            month: s.month,
            week: s.week,
            units_available: Number(s.remaining_quantity)
          }))
        : 'No upcoming supply currently scheduled for this product.'
    }, null, 2);

    if (!genAI) {
      // No API key — answer from DB data directly with a template
      return buildFallbackAnswer(demand, totalAllocated, actionLog, question);
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const systemPrompt = `You are a helpful, friendly customer support assistant for a semiconductor supply company.
You help customers understand the status of their procurement demands.

STRICT RULES:
1. ONLY answer using facts explicitly present in the <context> block below. Do NOT invent, guess, or extrapolate.
2. NEVER reveal: internal cost data, profit margins, other customers' information, internal rule codes, planner names, or business strategy.
3. If the context does not contain enough information to answer the question, say: "I don't have enough information about that in your demand record right now. Please contact your account manager for details."
4. Keep answers concise, clear, and empathetic. Use plain language suitable for a business customer.
5. When referencing quantities, always include the unit (units).
6. Do not use markdown headers. Use short paragraphs or bullet points only when listing items.

<context>
${customerContext}
</context>

Customer question: "${question}"

Answer:`;

    let answer;
    try {
      const result = await model.generateContent(systemPrompt);
      answer = result.response.text().trim();
    } catch (err) {
      console.error('Gemini chatbot error:', err);
      const fallback = buildFallbackAnswer(demand, totalAllocated, actionLog, question);
      return fallback;
    }

    return {
      answer,
      sources: ['Demand record', 'Decision history', 'Supply availability data']
    };
  }
};

// ---------------------------------------------------------------------------
// Fallback template-based answers (when Gemini is unavailable)
// ---------------------------------------------------------------------------
function buildFallbackAnswer(demand, totalAllocated, actionLog, question) {
  const requested = Number(demand.requested_quantity);
  const pct = requested > 0 ? Math.round((totalAllocated / requested) * 100) : 0;
  const q = question.toLowerCase();

  let answer = '';

  if (q.includes('reject') || q.includes('why not') || q.includes('denied')) {
    const rejectionEntry = actionLog.find(l => l.action_type === 'REJECTED');
    if (rejectionEntry) {
      answer = `Your demand #${demand.demand_id} was rejected at Level ${rejectionEntry.level}. Reason: ${rejectionEntry.reason || rejectionEntry.comment || 'No reason recorded'}`;
    } else {
      answer = `Demand #${demand.demand_id} has not been rejected. Current status: ${demand.status}.`;
    }
  } else if (q.includes('allocat') || q.includes('quantity') || q.includes('how much')) {
    answer = `For demand #${demand.demand_id}: You requested ${requested.toLocaleString()} units of ${demand.product_name}. ${totalAllocated.toLocaleString()} units (${pct}%) have been allocated so far.`;
  } else if (q.includes('status') || q.includes('stage') || q.includes('where')) {
    answer = `Demand #${demand.demand_id} is currently at Level ${demand.level} of 4 with status: ${demand.status}.`;
  } else if (q.includes('when') || q.includes('available') || q.includes('delivery')) {
    answer = `Your required delivery date for demand #${demand.demand_id} is ${demand.required_date ? demand.required_date.split('T')[0] : 'not specified'}.`;
  } else {
    answer = `Demand #${demand.demand_id} — Product: ${demand.product_name}, Requested: ${requested.toLocaleString()} units, Allocated: ${totalAllocated.toLocaleString()} units (${pct}%), Status: ${demand.status}, Stage: Level ${demand.level} of 4.`;
  }

  return { answer, sources: ['Demand record', 'Decision history'] };
}

module.exports = AiService;
