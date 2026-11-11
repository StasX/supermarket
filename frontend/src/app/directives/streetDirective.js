app.directive('streetDirective',function(){
    return {
        require : "ngModel",
        link : function(scope, el, attr, mCtrl){
            function streetValidation(value){
                mCtrl.$setValidity("street", /^(([A-Z0-9][a-z0-9]+)(((\s)[A-Z0-9]([a-z0-9])+)+)*)$/.test(value));
                return value;
            }
            mCtrl.$parsers.push(streetValidation);
        }
    };
});
