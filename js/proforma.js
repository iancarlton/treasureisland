/*
Treasure Island Small Area Planner (TISAP)
Parcel-level pencil out analytics
Assumes full build out redevelopment scenario
Includes inclusionary housing and TIF calculations
*/

//Parcel inputs
var p = {
    rentSqftRes: 4, // $/SqFt/month
    rentSqftComm: 20, // $/SqFt/year NNN
    maxDua: 150,
    maxFar: 3,
    parcelSize: 10000,
    // Demo cost. We're solving for land surplus/shortfall to deliver 
    // the max allowed on a site that's contributed by the city for 
    // free... I'm assuming all land and property on Treasure Island 
    // is City-owned+obsolete and they want to rebuild to the full
    // extent described in zoning, using cross subsidies between
    // developments to do so
    landPrep: 0 
};

//Universal inputs
var u = {
    constructCost: 185, // $/SqFt hard cost
    softCost: 0.40, // % of hard cost
    capRate: 0.045,
    goInCapSpread: 0.20, // % over blended CAP
    inclusionary: 0.20, // % of Res sq ft
    affDepth: 0.6 // % of AMI
};


ROCpencil = function(p, u) {

    // Declare fixed variables... Do we want people to be
    // able to edit as parcel inputs or universal inputs?
    var VacancyRes = 0.1; // % of income
    var VacancyComm = 0.1; // % of income
    var ResOpEx = 0.25; // % of income
    var UnitSize = 850; // Average residential unit size - leasable area
    var FtPerAcre = 43560;
    var BldgEff = 0.8; // % of space that's leasable
    // HUD's Area Median Income for SF family of three found here:
    // http://sf-moh.org/modules/showdocument.aspx?documentid=8829
    var AMI = 91700;
    var AffIncomeRent = 0.3; // % of income toward rent
    // millage rate on appraised value; b/c all new buildings,
    // property value = appraised value
    var TaxRate = 0.0067;
    // Simple multiple for estimating the bonding capacity of a
    // fixed tax revenue stream
    var BondMult = 12;

    // #########################################
    // First, determine the value of real estate
    // #########################################

    // Res rent is monthly rate
    var IncomeRes = (p.rentSqftRes * 12 * (1 - u.inclusionary)) + 
        (u.inclusionary * u.affDepth * AMI * AffIncomeRent / UnitSize); 

    var IncomeComm = p.rentSqftComm; // Comm rent is annual rate NNN
    var ExpenseRes = (IncomeRes * ResOpEx) + (IncomeRes * VacancyRes);
    var ExpenseComm = IncomeComm * VacancyComm;
    var NOIRes = IncomeRes - ExpenseRes;
    var NOIComm = IncomeComm - ExpenseComm;

    // ######################################
    // Second, determine optimal bldg uses...
    // ######################################

    // 1) no supply & demand interaction between developments
    // 2) no parking
    var floorArea = p.parcelSize * p.maxFar;
    var maxFarUnits = floorArea / (UnitSize / BldgEff);
    var maxDuaUnits = p.parcelSize / FtPerAcre * p.maxDua;
    var floorRes = 0;
    var floorComm = 0;

    //Assumes you build max possible res if it's more profitable, 
    // all comm if it's more profitable, and equal parts res/comm
    // if equally profitable

    if (NOIRes > NOIComm) {

        floorRes = Math.min(maxFarUnits, maxDuaUnits) * UnitSize;
        floorComm = (floorArea - (floorRes / BldgEff)) * BldgEff;

    } else if (NOIRes == NOIComm) {

        floorRes = floorArea * BldgEff / 2;
        floorComm = floorArea * BldgEff / 2;

    } else {

        floorComm = floorArea * BldgEff;
    }

    // ######################################
    // Third, calculate financial performance
    // ######################################

    // Assumes you build to the full extent of the FAR on clean parcel
    // with no other funny biz
    var Cost = floorArea * u.constructCost * (1 + u.softCost) + p.landPrep; 

    // This does not consider a building envelope
    // Assumes all buildings have the same per sq ft
    // construction cost... no consideration of height
    var ROC = (NOIRes * floorRes + NOIComm * floorComm) / Cost;
    var ROCtarget = u.capRate * (1 + u.goInCapSpread);
    var ROCsurplus = ROC - ROCtarget;
    var ResidualLand = ROCsurplus * Cost / ROCtarget;

    // ###################################
    // Fourth, calculate the tax increment
    // ###################################

    var ValueIncome = (NOIRes * floorRes + NOIComm * floorComm) / u.capRate;
    var Value = Math.max(ValueIncome, Cost);
    var TaxRev = Value * TaxRate;
    var TIbond = TaxRev * BondMult;

    // ###################################
    // Fifth, produce feasibility indicator
    // ###################################
    
    var Feasibility = 2;
    
    if (!ROC) {

        Feasibility = 2;

    } else if (ROC < u.capRate) {

        Feasibility = -1; //Display parcel color = red; Perhaps set Feasibility equal to value for red

    } else if (ROC < u.capRate * (1 + u.goInCapSpread)) {

        Feasibility = 0; //Display parcel color = yellow; Perhaps set Feasibility equal to value for yellow

    } else {

        Feasibility = 1; //Display parcel color = green; Perhaps set Feasibility equal to value for green
    }
    
    // return key parcel feasibility calcs
    return {
        feasibility: Feasibility,
        resSqFt: floorRes / BldgEff,
        unitsTotal: Math.floor(floorRes / UnitSize),
        unitsAff: Math.ceil(floorRes / UnitSize * u.inclusionary),
        commSqFt: floorComm / BldgEff,
        roc: ROC,
        // Amount of "profit" generated or subsidy required to
        // build the max build out defined by zoning
        residualLand: ResidualLand, 
        // Bonding capacity of the parcel's tax increment
        // at full build out
        tifCapacity: TIbond

        /*
        Use these output variables to theme parcels by:
            1. amount of Res sq ft
            2. amount of Comm sq ft
            3. ROC,
            4. land residual (or subsidy),
            5. TIF bonding capacity contribution,
            6. affordable housing units (people will love to comment on where poor people are forced to live... though this map will be identical to the ResSqFt because it's based on inclusionary)
            
        Use these outputs to calculate scenario attributs like:
            1. sum total land proceeds of the scenario. If positive, there may be funds available from development for infrastructure. If negative, subsidies may be required to deliver the scale/scope of development specified.
            2. sum total TIF bonding capacity of the scenario... very interesting for a redevelpoment agency
            3. sum total affordable housing units in TISAP scenario
            4. sum total Res and Comm sq ft in TISAP scenario
        */
    };
};

// example use
// var results = ROCpencil(p, u);
// console.log(results);
