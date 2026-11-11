app.component('findProduct', {
    bindings: {

    },
    templateUrl: 'app/components/findProduct/findProduct.html',
    controller: function($scope, $rootScope, $state){
        var products = $scope.$parent.products; // get products
        
    }
});
