app.directive("creditcardDirective", function(){
    return {
        require : "ngModel",
        link : function(scope, el, attr, mCtrl){
            function creditCardValidation(value){
                var val = (value.match(/\s/g)) ? value.replace(/\s/g,"") : value;// if user split card number with spaces, replace them
                val = (val.match(/\-/g)) ? val.replace(/\-/g,"") : val;// if user split card number with dashes, replace them
                window.console.log(val)
                mCtrl.$setValidity("creditCard", (/^\d{16}$/.test(val)));
                return value;
            }
            mCtrl.$parsers.push(creditCardValidation);
        }
    };
});
