app.directive('firstnameDirective',function(){
    return {
        require : "ngModel",
        link : function (scope, el, attr, mCtrl){
            function firstNameValidation(value){
                mCtrl.$setValidity("firstname", /^(([A-Z][a-z]+)(((\s)[A-Z]([a-z])+)+)*)$/.test(value));
                return value;
            }
            mCtrl.$parsers.push(firstNameValidation);
        }
    };
});
