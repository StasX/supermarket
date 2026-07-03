const mongoose = require('mongoose');
const router = require('express').Router();
const Cart = require('../models/Cart');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');
const permitionValidator = require('../middlewares/permitionValidationMiddleware');
const jwt = require('jsonwebtoken');

router.post('/', tokenValidator, permitionValidator, (req, res, next) => {
            Cart.findOne({user_id : req.user_data.id, status : 1}, (err, cart) => {
            if (cart) {
                res.json({success:false});
            }   else {
                const newCart = new Cart({
                    user_id :  req.user_data.id,
                    products : req.body.products,
                    created_at : Date.now()
                });
                newCart.save((err, cart) => {
                    if(err) {
                        res.json({success:false});
                        throw err;
                    }
                    res.json({success : true, id: cart._id, date: cart.created_at});
                });
            }
        });
});
module.exports = router;