app.component("productPrice", {
    bindings: {
        className: "<"
    },
    templateUrl: '/app/components/productPrice/productPrice.html',
    controller: function($scope){
        $scope.className = "fa fa-info-circle";
        $scope.blur = function(){
            if($scope.$parent.form.price.$dirty){
                $scope.className = ($scope.$parent.form.price.$valid) ? "fa fa-check" : "fa fa-times";
            }
        }
    }
});
