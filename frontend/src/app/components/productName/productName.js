app.component('productName', {
    bindings: {
        className: '<',
    },
    templateUrl: '/app/components/productName/productName.html',
    controller: function($scope){
        $scope.className = 'fa fa-info-circle';
        $scope.blur = function(){
            if($scope.$parent.form['product-name'].$dirty){
                $scope.className = ($scope.$parent.form['product-name'].$valid) ? 'fa fa-check' : 'fa fa-times';
            }
        }
    }
});
