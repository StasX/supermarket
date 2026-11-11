const mongoose = require('mongoose');
const router = require('express').Router();
const Product = require('../models/Product');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');

router.post('/', tokenValidator, (req, res, next) => {
    let errors = req.validationErrors();
    if (errors){
        res.json({success:false});
    }   else {
        Product.find({category : req.body.category}, (err, products) => {
            if(err){
                res.json({success:false});
                throw err;
            }
            res.json({success:true, products});
        });
    }
});
module.exports = router;
