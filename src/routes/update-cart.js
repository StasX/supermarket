const mongoose = require('mongoose');
const router = require('express').Router();
const Cart = require('../models/Cart');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');
const permitionValidator = require('../middlewares/permitionValidationMiddleware');
const jwt = require('jsonwebtoken');

router.post('/', tokenValidator, permitionValidator, (req, res, next) => {
    req.checkBody('id','invalid cart id ').notEmpty();
    let errors = req.validationErrors();
        if(errors) {
            res.json({success:false});
        }   else {
            Cart.findByIdAndUpdate(req.body.id,{$set:{
                products : req.body.products
            }}, (err, cart) => {
                if(err) {
                    res.json({success:false});
                    throw err;
                }
                res.json({success : true});
            });
    }
});
module.exports = router;