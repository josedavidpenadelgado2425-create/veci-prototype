const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ route: 'metrics routes' }));

module.exports = router;
