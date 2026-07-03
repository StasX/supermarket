module.exports = (req, res, next) => {
    switch (req.originalUrl){
        case '/add-product' : {
            (req.user_data.role === 1) ? next() : res.json({success:false});
            break;
        }   case '/edit-product' : {
            (req.user_data.role === 1) ? next() : res.json({success:false});
            break;
        }   case '/get-last-order' : {
            (req.user_data.role === 0) ? next() : res.json({success:false});
            break;
        }   case '/get-opened-cart' : {
            (req.user_data.role === 0) ? next() : res.json({success:false});
            break;
        }   case '/total-orders' : {
            (req.user_data.role === 0) ? next() : res.json({success:false});
            break;
        }   case '/total-products' : {
            (req.user_data.role === 0) ? next() : res.json({success:false});
            break;
        }   case '/create-cart' : {
            (req.user_data.role === 0) ? next() : res.json({success:false});
            break;
        }   case '/update-cart' : {
            (req.user_data.role === 0) ? next() : res.json({success:false});
            break;
        }   case '/get-cart' : {
            (req.user_data.role === 0) ? next() : res.json({success:false});
            break;
        }   default : {
            res.json({success:false});
        }
    }
}