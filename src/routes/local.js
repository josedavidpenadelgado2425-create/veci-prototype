const express = require('express');
const router = express.Router();
const multer = require('multer');
const authenticate = require('../middleware/authenticate');
const requireRank = require('../middleware/requireRank');
const localController = require('../controllers/localController');

// Multer config para evidencia de entrega
const upload = multer({ dest: 'uploads/' });

// ━━ MANDADOS ━━
router.get('/tasks', authenticate, localController.getTasks);
router.post('/tasks', authenticate, localController.createTask);
router.post('/tasks/:id/accept', authenticate, localController.acceptTask);
router.post('/tasks/:id/deliver', authenticate, upload.single('evidence'), localController.deliverTask);
router.post('/tasks/:id/confirm', authenticate, localController.confirmDelivery);

// ━━ SERVICIOS PROFESIONALES ━━
router.get('/services', authenticate, localController.getServices);
router.post('/services', authenticate, requireRank('confiable'), localController.createService);
router.post('/services/:id/request', authenticate, localController.requestService);

module.exports = router;
