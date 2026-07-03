app.component('storeShelf',  {
    templateUrl:'app/components/storeShelf/storeShelf.html', 
    bindings : {
        products: '=',
        cartProductsStorage: '=',
        selectedCategory: '<',
        productName: '<',
        cart: '<',
        price : '<',
        image : '<'
    },
    controller:function($scope, $rootScope, $state, $http, $timeout) {
        $scope.cart = [];
        $scope.cartStorage = [];
        $http.get('/get-all-products').then(function(data){
            data = data.data;
            if(data.success){
                $scope.products = data.products;
            }
        });
        $scope.select = function($event){
            var categoryProducts = Array.prototype.slice.call(angular.element(document.getElementById('shelf')).children());
            $scope.productPos = categoryProducts.indexOf(angular.element($event.currentTarget)[0]);
            switch($state.current.url){
                case ('/management') : {
                    $scope.$parent.editProduct();
                    $timeout(function(){
                        var product = $scope.products[$scope.productPos];
                        $scope.$parent.productName = product.name;
                        $scope.$parent.price = product.price;
                        $scope.$parent.image = product.image;
                        var categoryIndex = $scope.$parent.categories.indexOf(product.category);
                        $scope.$parent.selectedCategory = $scope.$parent.categories[categoryIndex];
                        $rootScope.currentPos = $scope.productPos;
                        $("#product-name")[0].value = product.name;// over write changed product name
                        $("#price")[0].value = product.price;// over write changed product price
                        $("#image")[0].value = product.image;
                        $("#category option")[categoryIndex].selected = true;// over write changed product category
                    },300);
                    break;
                }   case ('/store') : {
                    if ($scope.cart.length === 0) {
                        $scope.cart.push($scope.products[$scope.productPos].id);
                        $scope.products[$scope.productPos].count = 1;
                        $scope.$parent.totalPrices.push($scope.products[$scope.productPos].price);
                        $scope.cartStorage.push({
                            id: $scope.products[$scope.productPos].id,
                            count: 1,
                            price: $scope.products[$scope.productPos].price
                        });
                        
                        $scope.$parent.cart.push($scope.products[$scope.productPos]);
                        var total = $scope.$parent.totalPrices.reduce(function(acum, curr){
                            return acum + curr;    
                        });
                        $scope.$parent.total = total.toFixed(2);
                        $http({ url : '/create-cart', method: 'post', data: {
                            products: $scope.cartStorage
                        }}).then(function(data){
                          data = data.data;
                          if(data.success){
                            $rootScope.cartData = {id:data.id, date:data.date};
                            localStorage.setItem($rootScope.userData.user,JSON.stringify({id:data.id, date:data.date, products:$scope.cartStorage}));
                          } else {
                            swal('some error occured.','Cart not created. Please try again leter');
                          }
                        },function(){
                            swal('some error occured.','Cart not created. Please try again leter');
                        });
                    }   else {
                        var pos = $scope.cart.indexOf($scope.products[$scope.productPos].id);
                        if( pos < 0){
                            $scope.cart.push($scope.products[$scope.productPos].id);
                            $scope.cartStorage.push({
                                id: $scope.products[$scope.productPos].id,
                                count: 1,
                                price: $scope.products[$scope.productPos].price
                            });
                            $scope.products[$scope.productPos].count = 1;
                            $scope.$parent.totalPrices.push($scope.products[$scope.productPos].price);
                            $scope.$parent.cart.push($scope.products[$scope.productPos]);
                            var total = $scope.$parent.totalPrices.reduce(function(acum, curr){
                                return acum + curr;    
                            });
                            $scope.$parent.total = total.toFixed(2);
                            $http({url:'/update-cart', method:'post', data:{
                                id: $rootScope.cartData.id, 
                                products: $scope.cartStorage
                            }}).then(function(data){
                                data = data.data;
                                if(data.success){
                                    localStorage.setItem($rootScope.userData.user,JSON.stringify({
                                        id: $rootScope.cartData.id, 
                                        date: $rootScope.cartData.date, 
                                        products: $scope.cartStorage
                                    }));    
                                }else{
                                    swal('some error occured.','Cart not saved. Please try again leter');
                                }
                            },  function(){
                                swal('some error occured.','Cart not saved. Please try again leter');
                            });
                        }   else {
                            $scope.$parent.cart[pos].count ++;
                            $scope.cartStorage[pos].count ++;
                            var totalPrice = $scope.$parent.cart[pos].count * $scope.$parent.cart[pos].price;
                            $scope.$parent.totalPrices[pos] = parseFloat(totalPrice.toFixed(2));
                            var total = $scope.$parent.totalPrices.reduce(function(acum, curr){
                                return acum + curr;    
                            });
                            $scope.$parent.total = total.toFixed(2);
                            $('#cart input')[pos].value = $scope.$parent.cart[pos].count;
                            $http({url:'/update-cart', method:'post', data:{
                                id: $rootScope.cartData.id, 
                                products: $scope.cartStorage
                            }}).then(function(data){
                                data = data.data;
                                if(data.success){
                                    localStorage.setItem($rootScope.userData.user,JSON.stringify({
                                        id: $rootScope.cartData.id, 
                                        date: $rootScope.cartData.date, 
                                        products: $scope.cartStorage
                                    }));    
                                }else{
                                    swal('some error occured.','Cart not saved. Please try again leter');
                                }
                            },  function(){
                                swal('some error occured.','Cart not saved. Please try again leter');
                            });
                            
                        }
                    }
                }
            }
        };
        var errMsg = function (){
            swal('Some error occurred','Please try again later')
        }
        
        $scope.milkAndEggs = function() {
            $http({
                url:'/get-products-by-category',
                method:'POST',  
                data:{category:'Milk & Eggs'}
            }).then(function(data) {
                data = data.data;
                if(data.success){
                    $scope.products = data.products;
                }
            }, errMsg);
        }; 
        $scope.vegetablesAndFruits = function() {
            $http({
                url:'/get-products-by-category',
                method:'POST', 
                data: {category: 'Vegetables & Fruits'}
            }).then(function(data) {
                data = data.data;
                if(data.success){
                    $scope.products = data.products;
                }
            }, errMsg);
        }; 
        $scope.meetAndFish = function() {
            $http({
                url:'/get-products-by-category',
                method:'POST',
                data: {category: 'Meet & Fish'}
            }).then(function(data) {
                data = data.data;
                if(data.success){
                    $scope.products = data.products;
                }
            }, errMsg);
        }; 
        $scope.wineAndDrinks = function() {
            $http({
                url:'/get-products-by-category',
                method:'POST',
                data: {category: 'Wine & Drinks'}
            }).then(function(data) {
                data = data.data;
                if(data.success){
                    $scope.products = data.products;
                }
            }, errMsg);
        }; 
    }
}); 