const mongoose = require("mongoose");
const router = require("express").Router();
const User = require('../models/User');

router.post('/', (req, res, next) => {
    req.checkBody('firstName','invalid first name ').matches(/^(([A-Z][a-z]+)(((\s)[A-Z]([a-z])+)+)*)$/),
    req.checkBody('lastName','invalid last name ').matches(/^(([A-Z][a-z]+)(((\s)[A-Z]([a-z])+)+)*)$/),
    req.checkBody('email','invalid email').isEmail(),
    req.checkBody('pass','password length is not enought').isLength({min:8}),
    req.checkBody('id','ID number must be 9 digits').isLength({min:9, max:9}).matches(/^(\d){9}$/),
    req.checkBody('city','Invalid city').matches(/^(([A-Z][a-z]+)(((\s)[A-Z]([a-z])+)+)*)$/),
    req.checkBody('street','Invalid street').matches(/^(([A-Z0-9][a-z0-9]+)(((\s)[A-Z0-9]([a-z0-9])+)+)*)$/);
    let errors = req.validationErrors();
    if(errors) {
        res.json({'created':false, 'reason':'one of passed values invalid'});
        throw errors;
    }   else {
        User.findOne({username: req.body.email}, (err, user) => {
            if (err){
                throw(err);
            }
            if (user){
                res.json({'created':false, 'reason':'user alredy exists'});
            }   else{
                let newUser = new User({
                    id : req.body.id,
                    name : {
                        first_name : req.body.firstName,
                        last_name : req.body.lastName,
                    },
                    username: req.body.email,
                    password:  req.body.pass,        
                    address : {
                        city :  req.body.city,
                        street :  req.body.street,    
                    },
                    role: 0
                });
                User.signup(newUser, (err, user) => {
                    if (err) {
                        res.json({'created':false, 'reason':'unexpected error'});
                        throw err;
                    }   else{
                        res.json({'created':true});
                    }
                });
            }
        });
    }
});
module.exports = router;