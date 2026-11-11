app.component('addProduct', {
    templateUrl: 'views/productComponent.html',
    bindings: {
        products : '<'
    },
    controller: function($scope, $http, $timeout){
        console.log($scope);
        $scope.error = '';
        $scope.save = function(){
            if($scope.form.$valid){
                $http({
                    method: 'post',
                    url: '/add-product',
                    data: {
                        name : $scope.form['product-name'].$modelValue,
                        category : $scope.form.category.$modelValue,
                        price : $scope.form.price.$modelValue,
                        image : $scope.form.image.$modelValue
                    }
                }).then(function(data){
                    if(data.data.success){
                        $scope.$parent.$parent.$$childHead.$$nextSibling.$$nextSibling.products.push({
                            name:$scope.form['product-name'].$modelValue,
                            price:$scope.form.price.$modelValue,
                            image:$scope.form.image.$modelValue
                        });
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
