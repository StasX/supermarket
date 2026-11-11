app.component('shopInfo', {
    bindings:{
        orders:'<',
        products:'<'
    },
    templateUrl:'/app/components/shopInfo/shopInfo.html',
    controller: function($scope, $http, $timeout, $state){
        $http.get('/total-orders').then(function(data){
            var data = data.data;
            if(data.success){
                $scope.orders = data.ordersCount;
            }   
        },function(err){
            swal('Unexpected error!','Please try again!');
        });
        $http.get('/total-products').then(function(data){
            var data = data.data;
            if(data.success){
                $scope.products = data.productsCount;
            }
        },function(err){
            swal('Unexpected error!','Please try again!');
        });
        $timeout(function(){
            $state.go('welcome');
        },2300);
    }
});
