config = {

	mapboxToken: 'pk.eyJ1IjoiZnNjb3R0Zm90aSIsImEiOiJLVHVqNHlNIn0.T0Ca4SWbbTc1p2jogYLQyA',

	defaultScenario: "baseline",

	firebaseUrl: "https://treasureisland.firebaseio.com",

	center: [37.823512, -122.370358],
	zoom: 16,
	shpsfile: "ti.geojson",
	baseMap: "fscottfoti.kaeo1aml",

	defaultStyle: {
	    color: "#2262CC",
	    weight: 2,
	    opacity: 0.6,
	    fillOpacity: 0.1,
	    fillColor: "#2262CC"
	},

	highlightStyle: {
	    color: '#2262CC', 
	    weight: 3,
	    opacity: 0.6,
	    fillOpacity: 0.65,
	    fillColor: '#2262CC'
	},

	placeForm: function () {

		var placeFields = [];

		["residentialUnits", "nonResidentialSqft"].forEach(function (key) {
    		placeFields.push({
				key: key,
				type: 'input',
				templateOptions: {
					type: 'text',
					label: key
				}
			});
    	});

    	return placeFields;
	},

	runAnalytics: function (features) {

		if(!features) return {};

		return {
			"total_residential_units": d3.sum(features, function (v) {
				return v.properties.total_residential_units;
			}),
			"total_non_residential_sqft": d3.sum(features, function (v) {
				return v.properties.total_non_residential_sqft;
			}),
			"total_acres": d3.sum(features, function (v) {
				return v.properties.parcel_acres;
			})
		};

	}
};