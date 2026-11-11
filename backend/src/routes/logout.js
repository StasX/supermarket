const mongoose = require('mongoose');
const router = require('express').Router();
const tokenValidator = require('../middlewares/tokenValidationMiddleware');

router.get('/', tokenValidator, (req, res, next) => {
    res.clearCookie("SESSIONID");
    res.json({'success':true});
});

module.exports = router;
