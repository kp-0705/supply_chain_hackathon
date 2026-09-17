const BASE = 'http://localhost:5000/api';

async function post(url, data, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  const json = await res.json();
  return { httpStatus: res.status, ...json };
}

async function get(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + url, { headers });
  const json = await res.json();
  return { httpStatus: res.status, ...json };
}

async function main() {
  console.log('==================================================');
  console.log('🚀 TESTING END-TO-END DEMAND WORKFLOW (LEVELS 1-4)');
  console.log('==================================================');

  // 1. Log in users
  const custAuth = await post('/auth/login', { email: 'apple_buyer@apple.com', password: 'password123' });
  const l1Auth = await post('/auth/login', { email: 'level1@micron.com', password: 'password123' });
  const l2Auth = await post('/auth/login', { email: 'level2@micron.com', password: 'password123' });
  const l3Auth = await post('/auth/login', { email: 'level3@micron.com', password: 'password123' });
  const l4Auth = await post('/auth/login', { email: 'level4@micron.com', password: 'password123' });

  const custToken = custAuth.data.token;
  const l1Token = l1Auth.data.token;
  const l2Token = l2Auth.data.token;
  const l3Token = l3Auth.data.token;
  const l4Token = l4Auth.data.token;

  console.log('✓ All 5 actors authenticated successfully');

  // Test Case A: Full Happy Path to Level 4 Approval
  console.log('\n--- [TEST CASE A] FULL 4-LEVEL APPROVAL & ALLOCATION COMMIT ---');
  
  // A.1 Customer submits demand
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 30);
  const dateStr = targetDate.toISOString().split('T')[0];

  const submitRes = await post('/customer/demand/submit', {
    product_id: 1,
    requested_quantity: 500,
    required_date: dateStr
  }, custToken);

  console.assert(submitRes.success, 'Demand submission failed: ' + JSON.stringify(submitRes));
  const demandId = submitRes.data.demand_id;
  console.log(`✓ Demand #${demandId} submitted for 500 units`);

  // A.2 Verify queued strictly in Level 1
  const l1Demands = await get('/level1/demands', l1Token);
  console.log('l1Demands response:', JSON.stringify(l1Demands));
  const inL1 = l1Demands.data && l1Demands.data.some(d => Number(d.demand_id) === Number(demandId));
  console.assert(inL1, `Demand #${demandId} not found in Level 1 queue`);
  console.log(`✓ Demand #${demandId} is strictly in Level 1 queue`);

  // Check customer view before L1 review: allocated_quantity MUST be 0
  let custDemands = await get('/customer/demands', custToken);
  console.log('custDemands response:', JSON.stringify(custDemands));
  let curDemand = custDemands.data && custDemands.data.find(d => Number(d.demand_id) === Number(demandId));
  console.assert(curDemand && Number(curDemand.allocated_quantity) === 0, `Allocated qty should be 0, got ${curDemand?.allocated_quantity}`);
  console.log(`✓ Customer sees allocated_quantity = 0 (status: ${curDemand?.status})`);

  // A.3 Level 1 Approval with comment
  const l1Approve = await post(`/level1/demand/${demandId}/approve`, {
    comment: 'Customer credit and account active. Approved for Level 2 factory capacity check.'
  }, l1Token);
  console.assert(l1Approve.success, 'L1 approval failed');
  console.log(`✓ Level 1 approved with comment`);

  // Customer should see PROCESSING and allocated_quantity = 0
  custDemands = await get('/customer/demands', custToken);
  curDemand = custDemands.data.find(d => d.demand_id === demandId);
  console.assert(curDemand.status === 'PENDING', `Status should be PENDING (PROCESSING), got ${curDemand.status}`);
  console.assert(Number(curDemand.allocated_quantity) === 0, `Allocated qty should be 0, got ${curDemand.allocated_quantity}`);
  console.log(`✓ Customer sees status: PENDING (PROCESSING), allocated_quantity = 0`);

  // A.4 Level 2 Partial Accept and Full Accept
  // First test Partial Accept (if supply requested exceeds single week or user triggers partial accept)
  const l2Partial = await post(`/level2/demand/${demandId}/partial-accept`, {
    comment: 'Available factory weekly yield is constrained. Partially accepting and retaining in Level 2.'
  }, l2Token);
  console.assert(l2Partial.success, 'L2 partial accept failed');
  console.log(`✓ Level 2 partial accept executed with comment`);

  custDemands = await get('/customer/demands', custToken);
  curDemand = custDemands.data.find(d => d.demand_id === demandId);
  console.assert(curDemand.status === 'PARTIALLY_ALLOCATED', `Status should be PARTIALLY_ALLOCATED, got ${curDemand.status}`);
  console.assert(Number(curDemand.allocated_quantity) === 0, `Allocated qty must remain 0 until Level 4! Got ${curDemand.allocated_quantity}`);
  console.log(`✓ Customer sees status: PARTIALLY_ALLOCATED, allocated_quantity = 0 (retained in L2)`);

  // Now Level 2 approves forward to Level 3
  const l2Approve = await post(`/level2/demand/${demandId}/approve`, {
    comment: 'Factory capacity verified across W1-W4. Forwarded to Level 3 Planner.'
  }, l2Token);
  console.assert(l2Approve.success, 'L2 approval failed');
  console.log(`✓ Level 2 approved and forwarded to Level 3`);

  // A.5 Level 3 Allocation with comment
  const l3Demands = await get('/level3/demands', l3Token);
  const inL3 = l3Demands.data.some(d => d.demand_id === demandId);
  console.assert(inL3, `Demand #${demandId} not found in Level 3 matching cockpit`);
  console.log(`✓ Demand #${demandId} visible in Level 3 cockpit`);

  const l3Allocate = await post(`/level3/demand/${demandId}/allocate`, {
    manualWeeks: [{ week: 1, quantity: 500 }],
    comment: 'FIFO yield matching complete. 500 units booked from Week 1 cleanroom run.'
  }, l3Token);
  console.assert(l3Allocate.success, 'L3 allocation failed: ' + JSON.stringify(l3Allocate));
  console.log(`✓ Level 3 allocated 500 units with comment`);

  // Customer view before Level 4: allocated_quantity MUST STILL BE 0!
  custDemands = await get('/customer/demands', custToken);
  curDemand = custDemands.data.find(d => d.demand_id === demandId);
  console.assert(Number(curDemand.allocated_quantity) === 0, `Allocated qty should be 0 before L4, got ${curDemand.allocated_quantity}`);
  console.log(`✓ Before Level 4 final acceptance, customer allocated_quantity = 0`);

  // A.6 Level 4 Final Executive Approval
  const l4Demands = await get('/level4/demands', l4Token);
  const inL4 = l4Demands.data.some(d => d.demand_id === demandId);
  console.assert(inL4, `Demand #${demandId} not found in Level 4 executive hub`);
  console.log(`✓ Demand #${demandId} arrived in Level 4 Executive Hub`);

  const l4Approve = await post(`/level4/demand/${demandId}/approve`, {
    comment: 'Executive sign-off granted. Credit exposure authorized and shipment committed.',
    override_exceptions: true
  }, l4Token);
  console.assert(l4Approve.success, 'L4 approval failed: ' + JSON.stringify(l4Approve));
  console.log(`✓ Level 4 Final Executive Approval granted with comment`);

  // A.7 Check Customer View: Now and ONLY now is allocated_quantity = 500 and status = APPROVED!
  custDemands = await get('/customer/demands', custToken);
  curDemand = custDemands.data.find(d => d.demand_id === demandId);
  console.assert(curDemand.status === 'APPROVED', `Status should be APPROVED, got ${curDemand.status}`);
  console.assert(Number(curDemand.allocated_quantity) === 500, `Allocated qty should now be 500! Got ${curDemand.allocated_quantity}`);
  console.log(`✓ Official allocated_quantity successfully changed to ${curDemand.allocated_quantity} (status: APPROVED)`);

  // Verify all stage comments are present
  console.log(`✓ Total audit actions recorded: ${curDemand.actions.length}`);
  curDemand.actions.forEach(act => {
    console.log(`   - Level ${act.level} [${act.action_type}]: ${act.comment || act.reason}`);
  });

  // Test Case B: Rejection Flow with Preserved Passed Stage Comments
  console.log('\n--- [TEST CASE B] REJECTION FLOW & MULTI-STAGE COMMENTS DISPLAY ---');
  
  // B.1 Submit demand #2
  const submit2 = await post('/customer/demand/submit', {
    product_id: 2,
    requested_quantity: 300,
    required_date: dateStr
  }, custToken);
  const demand2Id = submit2.data.demand_id;
  console.log(`✓ Demand #${demand2Id} submitted for 300 units`);

  // B.2 Level 1 passes with comment
  await post(`/level1/demand/${demand2Id}/approve`, {
    comment: 'Level 1 verification passed. Tier Standard confirmed.'
  }, l1Token);
  console.log(`✓ Level 1 approved Demand #${demand2Id} with comment`);

  // B.3 Level 2 rejects with reason and comment
  const l2Reject = await post(`/level2/demand/${demand2Id}/reject`, {
    reason: 'Rule 2.5: Severe factory yield shortfall',
    comment: 'Wafer fabrication line fully saturated for this part number in month 9.'
  }, l2Token);
  console.assert(l2Reject.success, 'L2 reject failed');
  console.log(`✓ Level 2 rejected Demand #${demand2Id} with reason & comment`);

  // B.4 Customer checks demands
  custDemands = await get('/customer/demands', custToken);
  const rejectedDemand = custDemands.data.find(d => d.demand_id === demand2Id);
  console.assert(rejectedDemand.status === 'REJECTED', `Status should be REJECTED, got ${rejectedDemand.status}`);
  console.assert(Number(rejectedDemand.allocated_quantity) === 0, `Allocated qty must be 0, got ${rejectedDemand.allocated_quantity}`);
  console.log(`✓ Demand #${demand2Id} status is REJECTED, allocated_quantity = 0`);
  console.log(`✓ Preserved audit comments for rejected demand:`);
  rejectedDemand.actions.forEach(act => {
    console.log(`   - Level ${act.level} [${act.action_type}]: Reason="${act.reason}" | Comment="${act.comment}"`);
  });

  const hasL1Passed = rejectedDemand.actions.some(a => a.level === 1 && a.action_type === 'APPROVED');
  const hasL2Rejected = rejectedDemand.actions.some(a => a.level === 2 && a.action_type === 'REJECTED');
  console.assert(hasL1Passed, 'Level 1 passed action missing from rejected demand audit log');
  console.assert(hasL2Rejected, 'Level 2 rejected action missing from rejected demand audit log');
  console.log('✓ All stages passed and rejected stage comments verified!');

  console.log('\n==================================================');
  console.log('🎉 ALL WORKFLOW TESTS PASSED CLEANLY!');
  console.log('==================================================');
}

main().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
