/**
 * AngularJS filter for Numeral.js: number formatting as a filter
 * @version v1.2.0 - 2015-11-17
 * @link https://github.com/baumandm/angular-numeraljs
 * @author Dave Bauman <baumandm@gmail.com>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
"use strict";angular.module("ngNumeraljs",[]).provider("$numeraljsConfig",function(){var a={};this.setFormat=function(b,c){a[b]=c},this.setDefaultFormat=function(a){numeral.defaultFormat(a)},this.setLanguage=function(a,b){numeral.language(a,b)},this.setCurrentLanguage=function(a){numeral.language(a)},this.$get=function(){return{customFormat:function(b){return a[b]||b},setCurrentLanguage:this.setCurrentLanguage,setDefaultFormat:this.setDefaultFormat,setFormat:this.setFormat,setLanguage:this.setLanguage}}}).filter("numeraljs",["$numeraljsConfig",function(a){return function(b,c){return null==b?b:(c=a.customFormat(c),numeral(b).format(c))}}]);
