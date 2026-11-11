app.component("shippingDate", {
    bindings: {
        className: "<"
    },
    templateUrl: '/app/components/shippingDate/shippingDate.html',
    controller: function($scope){
        $scope.className = "fa fa-info-circle";
        $scope.blur = function(){
            if($scope.$parent.form["shipping-date"].$dirty){
                $scope.className = ($scope.$parent.form["shipping-date"].$valid) ? "fa fa-check" : "fa fa-times";
            }
        }
    }
});
