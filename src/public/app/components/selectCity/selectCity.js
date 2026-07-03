app.component("selectCity", {
    templateUrl: '/app/components/selectCity/selectCity.html',
    controller: function($scope){
        $scope.cities = [
            "Jerusalem",
            "Beersheba",
            "Arad",
            "Eilat",
            "Haifa",
            "Rishon LeZion",
            "Tel Aviv",
            "Modi'in",
            "Hadera",
            "Ma'ale Adumim"
        ];
    }
});