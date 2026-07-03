const mongoose = require('mongoose');
const router = require('express').Router();
const Product = require('../models/Product');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');

router.post('/', tokenValidator, (req, res, next) => {
    req.checkBody('name','invalid product name ').isLength({min:1});
    let errors = req.validationErrors();
    if(errors) {
        res.json({success:false});
    }   else{
        Product.find({name : new RegExp(req.body.product,"i")}, (err, products) => {
            if(err){
                res.json({success:false});
                throw err;
            }
            res.json({success : true, products});
        });
    }
});

module.exports = router;