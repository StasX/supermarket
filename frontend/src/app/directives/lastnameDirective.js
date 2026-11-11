app.directive('lastnameDirective',function(){
    return {
        require : "ngModel",
        link : function (scope, el, attr, mCtrl){
            function lastNameValidation(value){
                mCtrl.$setValidity("lastname", /^(([A-Z][a-z]+)(((\s)[A-Z]([a-z])+)+)*)$/.test(value));
                return value;
            }
            mCtrl.$parsers.push(lastNameValidation);
        }
    };
});
