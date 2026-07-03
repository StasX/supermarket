app.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/login');
    $stateProvider
    .state('login', {
        url : '/login',
        templateUrl : 'views/login.html',
        controller: function($scope, $state, titlerService) {
            titlerService.state($state.current.url);
        }
    })
    .state('signup', {
        url : '/sign-up',
        template: '<div ui-view></div>',
        deepStateRedirect: { default: { state: 'signup.step1'} }, 
        controller: function($scope, $state, titlerService) {
            titlerService.state($state.current.url);
            $state.go('signup.step1'); 
        }
    })
    .state('signup.step1', {
        url : '/sign-up/1',
        templateUrl : 'views/signup-step1.html',
        controller : function($scope, $state){
            $scope.alert = false;
            $scope.continue = function(){
                if($scope.form.$valid){
                    $scope.$parent.data = {
                        id : $scope.form.id.$modelValue,
                        email : $scope.form.email.$modelValue,
                        pass : $scope.form.pass.$modelValue
                    };
                    $state.go('signup.step2'); 
                }   else{
                    $scope.alert =true;
                }
            }
        }
    })
    .state('signup.step2', {
        url : '/sign-up/2',
        templateUrl : 'views/signup-step2.html',
        controller : 'createUserController'
    })
    .state('about', {
        url : '/about',
        templateUrl : 'views/about.html',
        controller: function($state, $timeout, $rootScope, $http, titlerService, permitionService) {
            permitionService.check($rootScope, $state, $http);
            titlerService.state($state.current.url);
            $timeout(function(){
                $state.go('info');
            },10000);
        }
    })
    .state('info', {
        url : '/info',
        templateUrl : 'views/info.html',
        controller: function($state, $rootScope, $http, titlerService, permitionService) {
            permitionService.check($rootScope, $state, $http);
            titlerService.state($state.current.url);
        }
    })
    .state('welcome', {
        url : '/welcome',
        templateUrl : 'views/welcome.html',
        controller :function($state, $rootScope, $http, titlerService, permitionService) {
            permitionService.check($rootScope, $state, $http);
            titlerService.state($state.current.url);
        }
    })
    .state('store', {
        url : '/store',
        templateUrl : 'views/store.html',
        bindings : {
            orders:'=',
            cart:'=',
            products: '=',
            cartStorage: '='
        },
        controller: function($scope, $state, $rootScope, $http, titlerService, permitionService) {
            permitionService.check($rootScope, $state, $http);
            titlerService.state($state.current.url);
            $rootScope.userData = $rootScope.userData || {};
            if($rootScope.order){
                $scope.total = $rootScope.order.total;
                $scope.cart = $rootScope.order.cart;
                $scope.totalPrices = $rootScope.order.totals; 
            } else if(localStorage.getItem($rootScope.userData.user)){
                
                var totals = JSON.parse(localStorage.getItem($rootScope.userData.user));
                $scope.cart = totals.cart;
                
                $scope.totalPrices = totals.cart.map(function(obj){
                    return obj.price * obj.count;
                });
                $scope.total = $scope.totalPrices.reduce(function(acum, curr){
                    return acum + curr;
                });
            }else{
                
                $scope.total = 0;
                $scope.cart = [];
                $scope.totalPrices=[];    
            }
            $scope.changeCount = function(){
                $scope.$$childHead.$$nextSibling.$$nextSibling.cartStorage[this.$index].count = this.count;
                $scope.cart[this.$index].count = this.count;
                var totalPrice = this.count * $scope.cart[this.$index].price;
                $scope.$$childHead.$$nextSibling.$$nextSibling.cartStorage[this.$index].price = this.totalPrice;
                var total = parseFloat(totalPrice.toFixed(2));
                $scope.total = $scope.totalPrices.reduce(function(acum, curr){
                    return acum + curr;
                });
                $scope.totalPrices[this.$index] = total.toFixed(2);
                
                $http({url:'/update-cart', method:'post', data:{
                    id: $rootScope.cartData.id, 
                    products: $scope.$$childHead.$$nextSibling.$$nextSibling.cartStorage
                }}).then(function(data){
                    data = data.data;
                    if(data.success){
                        localStorage.setItem($rootScope.userData.user,JSON.stringify({
                            id: $rootScope.cartData.id, 
                            date: $rootScope.cartData.date, 
                            products: $scope.$$childHead.$$nextSibling.$$nextSibling.cartStorage
                        }));    
                    }else{
                        swal('some error occured.','Cart not saved. Please try again leter');
                    }
                },  function(){
                    swal('some error occured.','Cart not saved. Please try again leter');
                });
            }
            $scope.continue = function(){
                $rootScope.order = {cart:$scope.cart, totals:$scope.totalPrices, total: $scope.total};
            }
            $scope.find = function(){
                $http({url:'/find-product',method:'post',data:{product:$scope.product}}).then(function(data){
                    data = data.data;
                    if(data.success){
                        $scope.$$childHead.$$nextSibling.$$nextSibling.products = data.products;
                    }
                });
            }
        }
    })
    .state("order", {
        url : '/order',
        template : '<div ui-view></div>',
        controller : function($state, $rootScope, $http, titlerService, permitionService){
            permitionService.check($rootScope, $state, $http);
            titlerService.state($state.current.url);
            $state.go('order.cartOverView');
        }
    })
    .state('order.cartOverView', {
        url : '/order/cart',
        template: '<top-container class="container-fluid"></top-container><users-cart class="container-fluid"></users-cart>'
    })
    .state('order.payment', {
        url : '/order/payment',
        templateUrl : 'views/payment.html',
    })
    .state('management', {
        url : '/management',
        bindings: {
            products : '@',
            error : '<',
            selectedCategory : '=',
            name : '=',
            price : '=',
            image : '='
        },
        templateUrl : 'views/management.html',
        controller: function($scope, $state, $rootScope, $http, titlerService, permitionService, $http, $timeout) {
            permitionService.check($rootScope, $state, $http, $http);
            titlerService.state($state.current.url);
            
            $scope.addProduct = function () {
                $scope.formContainer = 'views/addProduct.html';
            }
            $scope.removeForm = function () {
                $scope.formContainer = '';
            }
            $scope.editProduct = function () {
                $scope.formContainer = 'views/editProduct.html';
                $scope.categories = [
                    'Milk & Eggs',
                    'Vegetables & Fruits',
                    'Meet & Fish',
                    'Wine & Drinks'
                ];
                $scope.selectedCategory = $scope.categories[0];
                $scope.nameClassName = 'fa fa-check';
                $scope.priceClassName = 'fa fa-check';
                $scope.imageClassName = 'fa fa-check';
                
                $scope.categoryChange = function(){
                    $scope.selectedCategory = this.selectedCategory;
                }
                $scope.nameChange = function(){
                    $scope.name = this.productName;
                }
                $scope.priceChange = function(){
                    $scope.price = this.price;
                }
                $scope.imageChange = function(){
                    $scope.image = this.image;
                }
        
                $scope.checkName = function(){
                    if(this.form['product-name'].$dirty){
                        $scope.nameClassName = (this.form['product-name'].$valid) ? 'fa fa-check' : 'fa fa-times';
                    }
                }
                $scope.checkPrice = function(){
                    if(this.form.price.$dirty){
                        $scope.priceClassName = (this.form.price.$valid) ? 'fa fa-check' : 'fa fa-times';
                    }
                }
                $scope.checkImage = function(){
                    if(this.form.image.$dirty){
                        $scope.imageClassName = (this.form.image.$valid) ? 'fa fa-check' : 'fa fa-times';
                    }
                }
                $scope.error = '';
                $scope.save = function(){
                    if(this.form.$valid){
                        $http({
                            method: 'post',
                            url : '/edit-product',
                            data : {
                                id : $scope.$$childHead.$$nextSibling.$$nextSibling.products[$rootScope.currentPos].id,
                                name : $scope.name,
                                category : $scope.selectedCategory,
                                price : $scope.price,
                                image : $scope.image
                            }
                        }).then(function(data){
                            if(data.data.success){
                                $scope.$$childHead.$$nextSibling.$$nextSibling.products[$rootScope.currentPos] = {
                                    id : $scope.$$childHead.$$nextSibling.$$nextSibling.products[$rootScope.currentPos].id,
                                    name : $scope.name,
                                    category : $scope.selectedCategory,
                                    price : $scope.price,
                                    image : $scope.image
                                };
                                $scope.products = $scope.$$childHead.$$nextSibling.$$nextSibling.products;
                                $timeout(function(){
                                    $scope.removeForm();
                                },300);
                            }
                        });
                    }   else{
                        $scope.error = 'views/saveProductError.html';
                    }
                }
            }
            $scope.find = function(){
                $http({url:'/find-product',method:'post',data:{product:$scope.product}}).then(function(data){
                    data = data.data;
                    if(data.success){
                        $scope.$$childHead.$$nextSibling.$$nextSibling.products = data.products;
                    }
                });
            }   
        }
    });
});
