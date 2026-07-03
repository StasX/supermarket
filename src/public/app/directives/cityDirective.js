app.directive('cityDirective',function(){
    return {
        require : "ngModel",
        link : function (scope, el, attr, mCtrl){
            function cityValidation(value){
                mCtrl.$setValidity("city", /^(([A-Z][a-z]+)(((\s)[A-Z]([a-z])+)+)*)$/.test(value));
                return value;
            }
            mCtrl.$parsers.push(cityValidation);
        }
    };
});