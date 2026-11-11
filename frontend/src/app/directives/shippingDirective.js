app.directive("shippingDirective",function(){
    return {
        require: "ngModel",
        link: function(scope,el,attr,mCtrl){
            function validateDate(value){
                if (/(^((0([1-9]))|(([12])([0-9]))|(30|31))\/((0([1-9]))|(1([0-2])))\/([0-9]{4})$)|(^([0-9]{4})\-((0([1-9]))|(1([0-2])))\-((0([1-9]))|(([12])([0-9]))|(30|31))$)/.test(value)) {
                    if (/\//.test(value)) { //if date format is: dd/mm/yyyy
                        var year = value.substr(6, 4);
                        var date = value.substr(3, 3) + value.substr(0, 3) + year + " 08:00:00 UTC";
                    } else {
                        var year = value.substr(0, 4);
                        var date = value + " 08:00:00 UTC";
                    }
                }
                var date = Date.parse(value); 
                mCtrl.$setValidity("shippingDate", ((!isNaN(date)) && ( date > Date.now())));
                return value;
            }
            mCtrl.$parsers.push(validateDate);
        }
    };
});
