app.component('welcomeMassage',{
    bindings : {

    },
    templateUrl : '/app/components/welcomeMessage/welcomeMessage.html',
    controller : function ($scope, $rootScope, $http ) {
        function userLastOrderDetection(){
            $http.get('/get-last-order').then(function(data){

            },  function(err){
                swal('Some error occurred please try again later');
            });
        }
        $rootScope.userData = $rootScope.userData || {};
        if( localStorage.getItem($rootScope.userData.user)){
            var cartData = JSON.parse(localStorage.getItem($rootScope.userData.user));
            console.log(cartData)
            $rootScope.order = {};
            $rootScope.order.cart = cartData.cart;
            //$http
            /*$rootScope.order.totals = cartData.cart.map(function(obj){
                return obj.price * obj.count;
            }); 
            var total = $rootScope.order.totals.reduce(function(acum, curr){
                return acum + curr;
            });
            total = total.toFixed(2)*/
            $rootScope.order.total = parseFloat(total); 
            var date =new Date(cartData.date);

            $scope.msg = 'You already have opened cart.</br>Cart opened at ' +
            date.getDate() + '\/' + date.getMonth() + '\/' + date.getFullYear() + '</br>Total price of all products in cart is:' + total +'$';
            $scope.btn = 'Continue shoping';
        }   else{
            $http.get('get-cart').then(function(data){
                console.log(data.cart);
                data = data.data;
                if (data.success && data.cart){
                    
                }   else{
                    $http.get('get-cart').then(function(data){
                        data = data.data;
                        
                    })
                }
            },  function(){
                swal('Some error occurred',"Can't load your cart, Please try again");
            });
            $scope.msg = '<div class="col-sm-6 col-xs-10 col-sm-offset-3 col-xs-offset-1">Welcome to your first buy.<div>';
            $scope.btn = 'Start shoping';
        }
    }
});
