const db = require('../config/database');

class ValidationService {
  // ==========================================================================
  // LEVEL 1 RULES (DEMAND_VALIDATOR)
  // ==========================================================================

  // Rule 1.1: Customer Exists & Active
  static validateRule1_1(customer) {
    if (!customer || !customer.is_active) {
      return {
        passed: false,
        rule: '1.1',
        field: 'customer_id',
        message: 'Customer does not exist or is inactive'
      };
    }
    return { passed: true, rule: '1.1' };
  }

  // Rule 1.2: Customer Has Sufficient Credit
  static validateRule1_2(customer, product, requestedQty) {
    const demandValue = Number(requestedQty) * Number(product.unit_price);
    const creditLimit = Number(customer.credit_limit);

    if (creditLimit < demandValue) {
      return {
        passed: false,
        rule: '1.2',
        field: 'credit_limit',
        message: `Customer credit limit exceeded. Limit: $${creditLimit.toLocaleString()}, Demand Value: $${demandValue.toLocaleString()}`
      };
    }
    return { passed: true, rule: '1.2' };
  }

  // Rule 1.3: Product Exists & Active
  static validateRule1_3(product) {
    if (!product || product.status !== 'ACTIVE' || !product.is_active) {
      return {
        passed: false,
        rule: '1.3',
        field: 'product_id',
        message: 'Product does not exist or is discontinued'
      };
    }
    return { passed: true, rule: '1.3' };
  }

  // Rule 1.4: Valid Quantity
  static validateRule1_4(requestedQty) {
    const qty = Number(requestedQty);
    if (isNaN(qty) || qty <= 0 || qty > 999999) {
      return {
        passed: false,
        rule: '1.4',
        field: 'requested_quantity',
        message: 'Requested quantity must be positive and reasonable (between 1 and 999,999 units)'
      };
    }
    return { passed: true, rule: '1.4' };
  }

  // Rule 1.5: Valid Required Date
  static validateRule1_5(requiredDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 90);

    const reqDate = new Date(requiredDateStr);
    reqDate.setHours(0, 0, 0, 0);

    if (isNaN(reqDate.getTime()) || reqDate < today || reqDate > maxDate) {
      return {
        passed: false,
        rule: '1.5',
        field: 'required_date',
        message: 'Required date must be between today and 90 days from today'
      };
    }
    return { passed: true, rule: '1.5' };
  }

  // Rule 1.6: Customer Tier Eligibility
  static validateRule1_6(customer, product) {
    if (product.category === 'PREMIUM') {
      if (!['STRATEGIC', 'STANDARD'].includes(customer.tier)) {
        return {
          passed: false,
          rule: '1.6',
          field: 'tier',
          message: `Customer tier '${customer.tier}' is not eligible for PREMIUM category products. Requires STRATEGIC or STANDARD tier.`
        };
      }
    }
    return { passed: true, rule: '1.6' };
  }

  // Rule 1.7: No Duplicate Demand
  static async validateRule1_7(customerId, productId, requiredDateStr, excludeDemandId = null, client = db) {
    const reqDate = new Date(requiredDateStr);
    const month = reqDate.getMonth() + 1;

    const result = await client.query(
      `SELECT demand_id FROM demand_raw 
       WHERE customer_id = $1 AND product_id = $2 AND status IN ('PENDING', 'APPROVED', 'PARTIALLY_ALLOCATED')
       AND EXTRACT(MONTH FROM required_date) = $3`,
      [customerId, productId, month]
    );

    const duplicates = result.rows.filter(r => !excludeDemandId || Number(r.demand_id) !== Number(excludeDemandId));
    if (duplicates.length > 0) {
      return {
        passed: false,
        rule: '1.7',
        field: 'duplicate',
        message: 'A pending or active demand for this product already exists for this period'
      };
    }
    return { passed: true, rule: '1.7' };
  }

  // Run all Level 1 validations
  static async validateLevel1(data, client = db) {
    const errors = [];
    const warnings = [];

    // Fetch customer
    const custRes = await client.query('SELECT * FROM customers WHERE customer_id = $1', [data.customer_id]);
    const customer = custRes.rows[0];
    const r1 = this.validateRule1_1(customer);
    if (!r1.passed) errors.push(r1);

    // Fetch product
    const prodRes = await client.query('SELECT * FROM products WHERE product_id = $1', [data.product_id]);
    const product = prodRes.rows[0];
    const r3 = this.validateRule1_3(product);
    if (!r3.passed) errors.push(r3);

    // Qty & Date checks
    const r4 = this.validateRule1_4(data.requested_quantity);
    if (!r4.passed) errors.push(r4);

    const r5 = this.validateRule1_5(data.required_date);
    if (!r5.passed) errors.push(r5);

    // Credit limit & tier checks (if customer and product exist)
    if (customer && product) {
      const r2 = this.validateRule1_2(customer, product, data.requested_quantity);
      if (!r2.passed) errors.push(r2);

      const r6 = this.validateRule1_6(customer, product);
      if (!r6.passed) errors.push(r6);
    }

    // Duplicate check
    const r7 = await this.validateRule1_7(data.customer_id, data.product_id, data.required_date, data.demand_id, client);
    if (!r7.passed) errors.push(r7);

    return {
      success: errors.length === 0,
      customer,
      product,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // LEVEL 2 RULES (SUPPLY_VALIDATOR)
  // ==========================================================================

  // Rule 2.1: Supply Plan Exists
  static validateRule2_1(supplyRows) {
    if (!supplyRows || supplyRows.length === 0) {
      return {
        passed: false,
        rule: '2.1',
        field: 'supply_plan',
        message: 'Supply plan for this product and target month has not been created by Admin'
      };
    }
    return { passed: true, rule: '2.1' };
  }

  // Rule 2.2: Supply Plan is Realistic (at least one week > 0)
  static validateRule2_2(supplyRows) {
    const hasAvailable = supplyRows.some(s => Number(s.available_quantity) > 0);
    if (!hasAvailable) {
      return {
        passed: false,
        rule: '2.2',
        field: 'available_quantity',
        message: 'No available supply exists for this product in any week of the target month'
      };
    }
    return { passed: true, rule: '2.2' };
  }

  // Rule 2.3: Minimum Threshold Check (Month total available >= 30% of requested)
  static validateRule2_3(supplyRows, requestedQty) {
    const totalAvailable = supplyRows.reduce((sum, s) => sum + (Number(s.available_quantity) - Number(s.allocated_quantity)), 0);
    const minThreshold = Number(requestedQty) * 0.3;
    const pct = Number(requestedQty) > 0 ? ((totalAvailable / requestedQty) * 100).toFixed(1) : 0;

    if (totalAvailable < minThreshold) {
      return {
        passed: false,
        rule: '2.3',
        field: 'minimum_threshold',
        isWarning: true,
        message: `Low supply availability: Only ${pct}% of requested quantity is currently available (minimum threshold is 30%)`
      };
    }
    return { passed: true, rule: '2.3', pct };
  }

  // Rule 2.4: Regional Export Constraint
  static validateRule2_4(customer, product) {
    if (customer && customer.region === 'EU' && product && product.category === 'RESTRICTED_EXPORT') {
      return {
        passed: false,
        rule: '2.4',
        field: 'region',
        message: 'Export restriction: Products categorized as RESTRICTED_EXPORT cannot be shipped to the EU region'
      };
    }
    return { passed: true, rule: '2.4' };
  }

  // Rule 2.5: No Supply Shortfall > 50%
  static validateRule2_5(supplyRows, requestedQty) {
    const totalRemaining = supplyRows.reduce((sum, s) => sum + (Number(s.available_quantity) - Number(s.allocated_quantity)), 0);
    const half = Number(requestedQty) * 0.5;

    if (totalRemaining < half) {
      return {
        passed: false,
        rule: '2.5',
        field: 'shortfall',
        isWarning: true,
        message: 'Supply shortfall exceeds 50%. This order requires executive attention at Level 4'
      };
    }
    return { passed: true, rule: '2.5' };
  }

  // Rule 2.6: Planned vs Actual Consistency
  static validateRule2_6(supplyRows) {
    for (const s of supplyRows) {
      if (Number(s.allocated_quantity) > Number(s.available_quantity)) {
        return {
          passed: false,
          rule: '2.6',
          field: 'data_integrity',
          message: `Data inconsistency detected: Week ${s.week} allocated quantity (${s.allocated_quantity}) exceeds available capacity (${s.available_quantity})`
        };
      }
    }
    return { passed: true, rule: '2.6' };
  }

  // Run all Level 2 validations
  static async validateLevel2(demandId, client = db) {
    const errors = [];
    const warnings = [];

    const dRes = await client.query('SELECT * FROM demand_raw WHERE demand_id = $1', [demandId]);
    if (dRes.rows.length === 0) {
      return { success: false, errors: [{ rule: '2.0', message: 'Demand not found' }] };
    }
    const demand = dRes.rows[0];

    const custRes = await client.query('SELECT * FROM customers WHERE customer_id = $1', [demand.customer_id]);
    const customer = custRes.rows[0];

    const prodRes = await client.query('SELECT * FROM products WHERE product_id = $1', [demand.product_id]);
    const product = prodRes.rows[0];

    const reqDate = new Date(demand.required_date);
    const month = reqDate.getMonth() + 1;

    const sRes = await client.query(
      'SELECT * FROM supply WHERE product_id = $1 AND month = $2 ORDER BY week ASC',
      [demand.product_id, month]
    );
    const supplyRows = sRes.rows;

    const r1 = this.validateRule2_1(supplyRows);
    if (!r1.passed) errors.push(r1);

    const r2 = this.validateRule2_2(supplyRows);
    if (!r2.passed) errors.push(r2);

    const r4 = this.validateRule2_4(customer, product);
    if (!r4.passed) errors.push(r4);

    const r6 = this.validateRule2_6(supplyRows);
    if (!r6.passed) errors.push(r6);

    const r3 = this.validateRule2_3(supplyRows, demand.requested_quantity);
    if (!r3.passed) warnings.push(r3);

    const r5 = this.validateRule2_5(supplyRows, demand.requested_quantity);
    if (!r5.passed) warnings.push(r5);

    return {
      success: errors.length === 0,
      demand,
      customer,
      product,
      supplyRows,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // LEVEL 3 RULES (MATCHING_PLANNER)
  // ==========================================================================

  // Rule 3.5: Margin Check (profit margin >= 8%)
  static validateRule3_5(product) {
    const unitPrice = Number(product.unit_price);
    const standardCost = Number(product.standard_cost);
    const margin = unitPrice > 0 ? ((unitPrice - standardCost) / unitPrice) * 100 : 0;

    if (margin < 8) {
      return {
        passed: false,
        rule: '3.5',
        code: 'LOW_MARGIN',
        marginPct: margin.toFixed(2),
        message: `Low profit margin: ${margin.toFixed(2)}% is below company target (8%). Flagged for executive review.`
      };
    }
    return { passed: true, rule: '3.5', marginPct: margin.toFixed(2) };
  }

  // Rule 3.6: Order Value Threshold (value > $1,000,000)
  static validateRule3_6(allocatedQty, unitPrice) {
    const orderValue = Number(allocatedQty) * Number(unitPrice);
    if (orderValue > 1000000) {
      return {
        passed: false,
        rule: '3.6',
        code: 'HIGH_VALUE',
        orderValue,
        message: `High value order ($${orderValue.toLocaleString()} > $1,000,000). Requires executive approval.`
      };
    }
    return { passed: true, rule: '3.6', orderValue };
  }

  // Rule 3.8: Strategic Customer High Priority Check
  static isStrategicHighPriority(customer) {
    return customer && customer.tier === 'STRATEGIC' && customer.priority === 'HIGH';
  }

  // ==========================================================================
  // LEVEL 4 RULES (EXECUTIVE_APPROVER)
  // ==========================================================================

  // Rule 4.1: Review Outstanding Exceptions
  static async validateRule4_1(demandId, comment, client = db) {
    const result = await client.query(
      'SELECT * FROM demand_exceptions WHERE demand_id = $1 AND resolved_at IS NULL',
      [demandId]
    );

    if (result.rows.length > 0 && (!comment || comment.trim().length < 5)) {
      return {
        passed: false,
        rule: '4.1',
        exceptions: result.rows,
        message: `Demand has ${result.rows.length} active exception(s). An executive comment (min 5 chars) is mandatory to override and approve.`
      };
    }
    return { passed: true, rule: '4.1', exceptions: result.rows };
  }

  // Rule 4.2: Recalculate Total Customer Credit Exposure
  static async validateRule4_2(customerId, newDemandValue, client = db) {
    const custRes = await client.query('SELECT credit_limit, customer_name FROM customers WHERE customer_id = $1', [customerId]);
    const customer = custRes.rows[0];
    const creditLimit = Number(customer?.credit_limit || 0);

    const appRes = await client.query(
      'SELECT COALESCE(SUM(total_value), 0) as total_approved FROM demand_approved WHERE customer_id = $1',
      [customerId]
    );
    const existingApproved = Number(appRes.rows[0].total_approved);
    const totalExposure = existingApproved + Number(newDemandValue);

    if (totalExposure > creditLimit) {
      return {
        passed: false,
        rule: '4.2',
        creditLimit,
        existingApproved,
        totalExposure,
        message: `Total customer exposure ($${totalExposure.toLocaleString()}) exceeds credit limit ($${creditLimit.toLocaleString()}).`
      };
    }
    return { passed: true, rule: '4.2', creditLimit, totalExposure };
  }

  // Rule 4.3: Revenue & Profit Impact
  static validateRule4_3(allocatedQty, product) {
    const revenue = Number(allocatedQty) * Number(product.unit_price);
    const profit = Number(allocatedQty) * (Number(product.unit_price) - Number(product.standard_cost));
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

    const warnings = [];
    if (marginPct < 5) {
      warnings.push(`Critical low margin: ${marginPct.toFixed(2)}% is under 5%`);
    }
    if (revenue < 10000) {
      warnings.push(`Low total order value: $${revenue.toLocaleString()} (< $10,000)`);
    }

    return {
      revenue,
      profit,
      marginPct: marginPct.toFixed(2),
      hasFinancialWarning: warnings.length > 0,
      financialWarnings: warnings
    };
  }

  // Rule 4.5: Strategic Customer Override Permission
  static validateRule4_5(customer, comment) {
    if (customer.tier === 'STRATEGIC') {
      return {
        canOverride: true,
        valid: Boolean(comment && comment.trim().length >= 5),
        message: 'Strategic customer rationale recorded for audit.'
      };
    }
    return { canOverride: false };
  }

  // Rule 4.6: Spot Customer Restrictions
  static validateRule4_6(customer, allocatedQty, requestedQty, marginPct) {
    if (customer.tier === 'SPOT') {
      if (Number(allocatedQty) < Number(requestedQty)) {
        return {
          passed: false,
          rule: '4.6',
          field: 'spot_partial',
          message: 'Spot tier customers are strictly restricted to 100% full allocation. Partial allocations are disallowed.'
        };
      }
      if (Number(marginPct) < 10) {
        return {
          passed: false,
          rule: '4.6',
          field: 'spot_margin',
          message: `Spot tier orders require at least 10% profit margin (current: ${marginPct}%).`
        };
      }
    }
    return { passed: true, rule: '4.6' };
  }

  // Rule 4.8: Concurrent Demand Balancing
  static async validateRule4_8(productId, month, newAllocation, client = db) {
    const supRes = await client.query(
      'SELECT COALESCE(SUM(available_quantity), 0) as total_supply FROM supply WHERE product_id = $1 AND month = $2',
      [productId, month]
    );
    const totalSupply = Number(supRes.rows[0].total_supply);

    const allocRes = await client.query(
      `SELECT COALESCE(SUM(sa.allocated_quantity), 0) as total_allocated
       FROM supply_allocation sa
       JOIN supply s ON sa.supply_id = s.supply_id
       WHERE s.product_id = $1 AND s.month = $2`,
      [productId, month]
    );
    const totalAllocated = Number(allocRes.rows[0].total_allocated);

    if (totalAllocated > totalSupply) {
      return {
        passed: false,
        rule: '4.8',
        message: `Collective demand allocation (${totalAllocated}) exceeds total monthly supply pool (${totalSupply}).`
      };
    }
    return { passed: true, rule: '4.8' };
  }
}

module.exports = ValidationService;
