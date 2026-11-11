const mongoose = require('mongoose');
const router = require('express').Router();
const Order = require('../models/Order');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');
const permitionValidator = require('../middlewares/permitionValidationMiddleware');

router.get('/', tokenValidator, permitionValidator, (req, res, next) => {
    Order.find({user_id : req.req.user_data._id}, (err, orders) => {
        if (err){
            res.json({success : false});
            throw err;
        }
        if( orders.length > 0){
            const order = orders[orders.length - 1];
                res.json({success: true, order: {
                    
                }
                });
        }
    });
});
module.exports = router;
