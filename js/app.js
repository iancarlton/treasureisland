L.mapbox.accessToken = config.mapboxToken;

var map = L.mapbox.map('map', config.baseMap, {zoomControl: false})
    .setView(config.center, config.zoom);

var defaultStyle = config.defaultStyle;

var highlightStyle = config.highlightStyle;

var featureLayer = L.mapbox.featureLayer().addTo(map);
var disableHighlight = false;

var FIREBASE_URL = config.firebaseUrl + "/" + config.defaultScenario;

var app = angular.module("app", ["firebase", "ui.bootstrap", "formly", "formlyBootstrap", "ngNumeraljs"]);

app.run(function($rootScope) {

	// global configuration

    d3.json(config.shpsfile, function(error, shapes) {

    	// read a geojson file - I'm sure there's lots of places for
    	// shapes to come from but this is a common one

    	$rootScope.$apply(function () {
    		$rootScope.features = shapes.features;
    	});

		featureLayer.setGeoJSON(shapes);

		featureLayer.eachLayer(function (layer) {

			layer.setStyle(defaultStyle);

			layer.on("mouseover", function (e) {
				if(disableHighlight) return;
		        	layer.setStyle(highlightStyle);
			});

			layer.on("mouseout", function (e) {
		    		if(disableHighlight) return;
		        	layer.setStyle(defaultStyle);
			});
		});
    });
});


app.controller("mainCtrl", function($scope, $firebaseObject) {

	// root controller for the whole app

	$scope.showToolbar = true;
	$scope.showPlace = false;
});


app.controller("analyticsCtrl", function($scope, $rootScope) {

	// controller for the analytics window

	$rootScope.$watch("features", function (features) {
		$scope.analytics = config.runAnalytics(features);
	});
});


app.controller("placeCtrl", function($scope, $firebaseObject) {

	// controller for the place description window

	$scope.placeFields = config.placeForm();

	$scope.activatePlace = function (feature) {

		$scope.$parent.showToolbar = true;
		$scope.$parent.showPlace = true;
		$scope.feature = feature;
		$scope.place = {};

		var ref = new Firebase(FIREBASE_URL).child("places").child(feature.properties.parcel_id);

		if($scope.unbind) {
			$scope.unbind();
		}

		$firebaseObject(ref).$bindTo($scope, "place").then(function(unbind) {
			$scope.unbind = unbind;
		});
	};

	featureLayer.on('click', function(e) {

		if($scope.activeLayer) $scope.activeLayer.setStyle(defaultStyle);
		$scope.activeLayer = e.layer;
		disableHighlight = true;
		e.layer.setStyle(highlightStyle);

		$scope.$apply(function () {
			$scope.activatePlace(e.layer.feature);
		});
	});

	map.on('click', function (e) {

		if($scope.activeLayer) $scope.activeLayer.setStyle(defaultStyle);
		disableHighlight = false;
		$scope.activeLayer = undefined;

		$scope.$apply(function () {
			$scope.$parent.showPlace = false;
		});
	});
});