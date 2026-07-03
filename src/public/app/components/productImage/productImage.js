app.component("productImage", {
    bindings: {
        className: "<"
    },
    templateUrl: '/app/components/productImage/productImage.html',
    controller: function($scope){
        $scope.className = "fa fa-info-circle";
        $scope.blur = function(){
            if($scope.$parent.form.image.$dirty){
                $scope.className = ($scope.$parent.form.image.$valid) ? "fa fa-check" : "fa fa-times";
            }
        }
    }
});