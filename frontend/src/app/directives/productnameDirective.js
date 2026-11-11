app.directive('productnameDirective',function(){
    return {
        require : "ngModel",
        link : function (scope, el, attr, mCtrl){
            function productNameValidation(value){
                mCtrl.$setValidity('productname', /^(([0-9a-zA-Z]+)(((\s)([0-9a-zA-Z])+)+)*)$/.test(value));
                return value;
            }
            mCtrl.$parsers.push(productNameValidation);
        }
    };
});
