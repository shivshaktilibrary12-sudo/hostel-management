const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/receiptController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/next-numbers',          ctrl.nextNumbers);
router.get('/room/:roomNumber/summary', ctrl.roomSummary);
router.get('/room/:roomNumber',      ctrl.byRoom);
router.get('/',                      ctrl.list);
router.post('/',                     ctrl.create);
router.delete('/:id',                ctrl.remove);

module.exports = router;
