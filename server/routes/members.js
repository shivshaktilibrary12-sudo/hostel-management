const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/memberController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/next-id',           ctrl.nextId);
router.get('/archived',          ctrl.listArchived);
router.post('/archived/:id/restore', ctrl.restoreArchived);
router.delete('/archived/:id',   ctrl.deleteArchived);
router.get('/',                  ctrl.list);
router.get('/room/:roomNumber',  ctrl.getByRoom);
router.get('/:id',               ctrl.getOne);
router.post('/',                 ctrl.create);
router.put('/:id',               ctrl.update);
router.post('/:id/vacate',       ctrl.vacate);
router.delete('/:id',            ctrl.remove);

module.exports = router;
