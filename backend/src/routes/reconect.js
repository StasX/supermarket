const mongoose = require('mongoose');
const router = require('express').Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const tokenValidator = require('../middlewares/tokenValidationMiddleware');
router.get('/', tokenValidator, (req, res, next) => {
            res.json({success:true,
                role : req.user_data.role,
                name : req.user_data.name, 
                user : req.user_data._id
            });
});
module.exports = router;
