app.component('usersCart', {
    bindings: {
        total: '<',
        cart : '<',
        totalPrices : '<'
    },
    templateUrl: 'app/components/userCart/userCart.html', 
    controller: function($scope, $rootScope){
        $scope.total = $rootScope.order.total;
        $scope.cart = $rootScope.order.cart;
        $scope.totalPrices = $rootScope.order.total;
        
    }
});