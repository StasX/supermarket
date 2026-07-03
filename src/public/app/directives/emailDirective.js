app.directive('emailDirective',function(){
    return {
        require: 'ngModel',
        link: function (scope, el, attr, mCtrl){
            function eMailValidation(value){
                mCtrl.$setValidity('aEmail', /^([0-9a-z._-]+(\@)([0-9a-z-])+((\.)[a-z]{2}[a-z]*)+)$/.test(value));
                return value;
            }
            mCtrl.$parsers.push(eMailValidation);
        }
    };
});