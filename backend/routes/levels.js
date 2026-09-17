const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const Level1Controller = require('../controllers/level1Controller');
const Level2Controller = require('../controllers/level2Controller');
const Level3Controller = require('../controllers/level3Controller');
const Level4Controller = require('../controllers/level4Controller');

// Level 1 Router
const level1Router = express.Router();
level1Router.use(authenticate);
level1Router.use(authorize(['LEVEL1', 'ADMIN']));
level1Router.get('/demands', Level1Controller.getDemands);
level1Router.post('/demand/:demand_id/approve', Level1Controller.approve);
level1Router.post('/demand/:demand_id/reject', Level1Controller.reject);

// Level 2 Router
const level2Router = express.Router();
level2Router.use(authenticate);
level2Router.use(authorize(['LEVEL2', 'ADMIN']));
level2Router.get('/demands', Level2Controller.getDemands);
level2Router.post('/demand/:demand_id/approve', Level2Controller.approve);
level2Router.post('/demand/:demand_id/partial-accept', Level2Controller.partialAccept);
level2Router.post('/demand/:demand_id/reject', Level2Controller.reject);

// Level 3 Router
const level3Router = express.Router();
level3Router.use(authenticate);
level3Router.use(authorize(['LEVEL3', 'ADMIN']));
level3Router.get('/demands', Level3Controller.getDemands);
level3Router.post('/demand/:demand_id/allocate', Level3Controller.allocate);
level3Router.post('/demand/:demand_id/reject', Level3Controller.reject);
level3Router.get('/supply/availability', Level3Controller.getSupplyAvailability);

// Level 4 Router
const level4Router = express.Router();
level4Router.use(authenticate);
level4Router.use(authorize(['LEVEL4', 'ADMIN']));
level4Router.get('/demands', Level4Controller.getDemands);
level4Router.get('/demand/:demand_id/exceptions', Level4Controller.getExceptions);
level4Router.post('/demand/:demand_id/approve', Level4Controller.approve);
level4Router.post('/demand/:demand_id/reject', Level4Controller.reject);

module.exports = {
  level1Router,
  level2Router,
  level3Router,
  level4Router
};
