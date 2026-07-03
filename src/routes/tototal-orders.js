const mongoose = require('mongoose');
const router = require('express').Router();
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');
const permitionValidator = require('../middlewares/permitionValidationMiddleware');

router.get('/', tokenValidator, permitionValidator, (req, res, next) => {
    Order.count({}, (err, orders) => {
        if (err){
            res.json({success : false});
            throw err;
        }
        res.json({success : true, ordersCount : orders});
    });
});

module.exports = router;