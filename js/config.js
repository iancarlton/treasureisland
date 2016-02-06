config = {

    mapboxToken: 'pk.eyJ1IjoiZnNjb3R0Zm90aSIsImEiOiJLVHVqNHlNIn0.T0Ca4SWbbTc1p2jogYLQyA',

    defaultScenario: "-K9JUejl-avKZl9oAIVH",

    firebaseUrl: "https://treasureisland.firebaseio.com",

    center: [37.823512, -122.368358],
    zoom: 16,
    shpsfile: "ti.geojson",
    baseMap: "fscottfoti.kaeo1aml",

    keyAttr: "parcel_id",

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

    themes: {
        "Max Dua": {
            attr: "maxDua",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: '#ffffcc',
            interpolate: ["#fff5eb", "#7f2704"]
        },
        "Max Far": {
            attr: "maxFar",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: "#ffb3ff",
            interpolate: ["#f7fbff", "#08306b"]
        },
        "Residential Units": {
            attr: "unitsTotal",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: '#ffffcc',
            interpolate: ["#fff7ec", "#7f0000"]
        },
        "Affordable Units": {
            attr: "unitsAff",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: '#ffffcc',
            interpolate: ["#fff7ec", "#7f0000"]
        },
        "Commercial Sqft": {
            attr: "commSqFt",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: "#ffb3ff",
            interpolate: ["#f7fbff", "#08306b"]
        },
        "Return on Cost": {
            attr: "roc",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: "#ffb3ff",
            interpolate: ["#ffffe5", "#004529"]
        },
        "Land Residual": {
            attr: "residualLand",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: "#ffb3ff",
            interpolate: ["#ffffe5", "#004529"]
        },
        "TIF Capacity": {
            attr: "tifCapacity",
            opacity: .9,
            outlineColor: "#000000",
            highlightColor: "#ffb3ff",
            interpolate: ["#ffffe5", "#004529"]
        }
    },

    editableAttributes: function () {
        return  [
            {key: "maxDua", label: "Max DUA"},
            {key: "maxFar", label: "Max FAR"},
            {key: "rentSqftRes", label: "Residential Rent ($/sqft/month)"},
            {key: "rentSqftComm", label: "Non-residential Rent ($/sqft/year)"},
            {key: "landPrep", label: "Land Prep Cost (Demo Cost)"}
        ]
    },

    placeForm: function () {

        var placeFields = [];

        this.editableAttributes().forEach(function (obj) {
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

    aggregateAnalytics: function (features, callback) {
        var v = {
            "raw_residential_capacity": d3.sum(features, function (v) {
                return v.properties.maxDua * v.properties.parcelAcres;
            }),
            "raw_non_residential_capacity": d3.sum(features, function (v) {
                return v.properties.maxFar * v.properties.parcelAcres * 43560;
            }),
            "total_residential_units": d3.sum(features, function (v) {
                return v.properties.unitsTotal;
            }),
            "total_affordable_units": d3.sum(features, function (v) {
                return v.properties.unitsAff;
            }),
            "total_non_residential_sqft": d3.sum(features, function (v) {
                return v.properties.commSqFt;
            }),
            "total_tif_capacity": d3.sum(features, function (v) {
                return v.properties.tifCapacity;
            }),
            "total_residual_land": d3.sum(features, function (v) {
                return v.properties.residualLand;
            }),
            "total_acres": d3.sum(features, function (v) {
                return v.properties.parcelAcres;
            })
        };

        // asynchronous
        callback(v);
    },

    // add analytics for a single feature
    runAnalytics(f) {

        // global assumptions, hard coded for now, but
        // will be entered by the user
        var globals = {
            constructCost: 185, // $/SqFt hard cost
            softCost: 0.40, // % of hard cost
            capRate: 0.045,
            goInCapSpread: 0.20, // % over blended CAP
            inclusionary: 0.20, // % of Res sq ft
            affDepth: 0.6 // % of AMI
        };

        var defaults = {
            rentSqftRes: 4, // $/SqFt/month
            rentSqftComm: 20, // $/SqFt/year NNN
            maxDua: 0,
            maxFar: 0,
            landPrep: 0
        };

        var p = f.properties;

        // set some default if they don't exist
        _.each(_.keys(defaults), function (prop) {
            if(!p[prop]) p[prop] = defaults[prop];
        });
        p.parcelSize = f.properties.parcel_size;

        // do the pro forma
        return ROCpencil(p, globals);
    },

    // this is a rather odd but important function which merged the "base"
    // data which comes out of the geojson with the override attribute
    // data which comes out of firebase
    getFullFeature: function (f, db) {
        // make a copy
        f = JSON.parse(JSON.stringify(f));

        // return geojson feature if firebase object does not yet exist
        var key = f.properties[config.keyAttr];
        if(!db || !db[key]) return f;

        // add firebase attributes to properties
        _.extend(f.properties, db[key]);
        // add analytic attribute under pf attribute
        _.extend(f.properties, config.runAnalytics(f));

        return f;
    },

    // this method moves data from the geojson into firebase - this only
    // really needs to be done once, although I guess you can do it
    // multiple times when debugging to reset to the initial state

    initializeData: function (features, url) {

        _.each(features, function (feature) {
            var ref = new Firebase(url).child("places").child(feature.properties.parcel_id);

            [
                //{key: "residentialUnits", prop: "total_residential_units"},
                //{key: "nonResidentialSqft", prop: "total_non_residential_sqft"},
                //{key: "parcelSize", prop: "parcel_size"},
                //{key: "parcelAcres", prop: "parcel_acres"}
                
            ].forEach(function (obj) {

                ref.child(obj.key).set(feature.properties[obj.prop]);

            });
        });
    }
};
