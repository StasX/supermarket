const mongoose = require('mongoose');
const router = require('express').Router();
const Product = require('../models/Product');
const jwt = require('jsonwebtoken');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');
const permitionValidator = require('../middlewares/permitionValidationMiddleware');

router.get('/', tokenValidator, permitionValidator, (req, res, next) => {
    Product.count({}, (err, products) => {
        if(err) {
            res.json({success:false});
            throw err;
        }
        res.json({success : true, productsCount : products});
    });
});

module.exports = router;