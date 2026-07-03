const mongoose = require('mongoose');
const router = require('express').Router();
const Product = require('../models/Product');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');
const permitionValidator = require('../middlewares/permitionValidationMiddleware');
const jwt = require('jsonwebtoken');

router.post('/', tokenValidator, permitionValidator, (req, res, next) => {
    req.checkBody('name','invalid product name ').isLength({min:1});
    req.checkBody('category','invalid category').isIn(['Milk & Eggs', 'Vegetables & Fruits', 'Meet & Fish', 'Wine & Drinks']);
    req.checkBody('price','invalid price').matches(/^(\d+)(\.)\d{2}$/);
    let errors = req.validationErrors();
    if(errors) {
        res.json({success:false});
    }   else {
        Product.findByIdAndUpdate(req.body.id,{$set:{
            name : req.body.name,
            category : req.body.category,
            price : req.body.price,
            image :req.body.image
        }}, (err, product) => {
            if(err) {
                console.log(err);
                res.json({success:false});
                throw err;
            }
            res.json({success : true});
        });
    }
});

module.exports = router;