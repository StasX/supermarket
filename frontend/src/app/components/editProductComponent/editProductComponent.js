app.component('editProduct', {
    templateUrl: '/views/productComponent.html',
    controller: function($scope, $http, $rootScope, $timeout){
        //$timeout(function(){
       //$scope.form["product-name"].$modelValue = $rootScope.currentProduct.name;
       //$scope.form["product-name"].$setViewValue($rootScope.currentProduct.name);
        
        //},300);
        $scope.error = '';
        $scope.save = function(){
            if($scope.form.$valid){
                $http({
                    method: 'post',
                    url: '/edit-product',
                    data: {
                        id : $rootScope.currentProduct.id,
                        name : $scope.form['product-name'].$modelValue,
                        category : $scope.form.category.$modelValue,
                        price : $scope.form.price.$modelValue,
                        image : $scope.form.image.$modelValue
                    }
                }).then(function(data){
                    if(data.data.success){
                        $scope.$parent.$parent.products[$rootScope.currentProduct.pos] = {
                            name:$scope.form['product-name'].$modelValue,
                            price:$scope.form.price.$modelValue,
                            image:$scope.form.image.$modelValue
                        };
                        $timeout(function(){
                            $scope.$parent.$parent.removeForm();
                        },300);
                    }
                });
            }   else{
                $scope.error = 'views/saveProductError.html';
            }
        }
    }
});
