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

		[
			{key: "residentialUnits", label: "Residential Units"},
			{key: "nonResidentialSqft", label: "Non-residential Sqft"}
			
		].forEach(function (obj) {

    		placeFields.push({
				key: obj.key,
				type: 'input',
				templateOptions: {
					type: 'text',
					label: obj.label
				}
			});
    	});

    	return placeFields;
	},

	runAnalytics: function (features, callback) {

		var v = {
			"total_residential_units": d3.sum(features, function (v) {
				return v.properties.residentialUnits;
			}),
			"total_non_residential_sqft": d3.sum(features, function (v) {
				return v.properties.nonResidentialSqft;
			}),
			"total_acres": d3.sum(features, function (v) {
				return v.properties.parcelAcres;
			})
		};

		// asynchronous
		callback(v);
	},

	// this is a rather odd but important function which merged the "base"
	// data which comes out of the geojson with the override attribute
	// data which comes out of firebase

	mergeGeojsonFirebase: function(features, db) {

		return _.map(features, function (f) {

			_.extend(f["properties"], db[f.properties.parcel_id]);
			return f;

		});
	},

	// this method moves data from the geojson into firebase - this only
	// really needs to be done once, although I guess you can do it
	// multiple times when debugging to reset to the initial state

	initializeData: function (features) {

		_.each(features, function (feature) {
			var ref = new Firebase(FIREBASE_URL).child("places").child(feature.properties.parcel_id);

			[
				{key: "residentialUnits", prop: "total_residential_units"},
				{key: "nonResidentialSqft", prop: "total_non_residential_sqft"},
				{key: "parcelAcres", prop: "parcel_acres"}
				
			].forEach(function (obj) {

	    		ref.child(obj.key).set(feature.properties[obj.prop]);

	    	});
		});
	}
};