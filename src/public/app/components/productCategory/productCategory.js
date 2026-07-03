app.component("productCategory", {
    templateUrl: '/app/components/productCategory/productCategory.html',
    controller: function($scope){
        $scope.categories = [
            'Milk & Eggs',
            'Vegetables & Fruits',
            'Meet & Fish',
            'Wine & Drinks'
        ];
    }
});