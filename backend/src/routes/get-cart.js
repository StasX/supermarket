const mongoose = require('mongoose');
const router = require('express').Router();
const Cart = require('../models/Cart');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');
const permitionValidator = require('../middlewares/permitionValidationMiddleware');

router.get('/', tokenValidator, permitionValidator, (req, res, next) => {    
    Cart.findOne({
        user_id : req.user_data.id,
        status : 1                
    }, (err, cart) => {
        if (err){
            res.json({success : false});
            throw err;
        }
        console.log(cart)
        if(cart){
            res.json({success:true, cart: {
                id : cart._id,
                products : cart.products,
                created : cart.created_at
            }});
        }   else{
            res.json({success:true});
        }
    });            
});
module.exports = router;
