const mongoose = require('mongoose');
const router = require('express').Router();
const Product = require('../models/Product');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');

router.get('/', tokenValidator, (req, res, next) => {
    Product.find({}, (err, products) => {
        if(err){
            res.json({success:false});
            throw err;
        }
        products = products.map((product) => {
            return {
                id: product._id,
                name: product.name,
                price: product.price,
                image: product.image,
                category: product.category
            };
        });
        res.json({success:true, products});
    });
});

module.exports = router;