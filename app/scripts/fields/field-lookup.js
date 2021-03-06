angular.module('angular-lightning.lookup', [])

.factory('liLookupParser', ['$parse', function($parse) {
	var TYPEAHEAD_REGEXP = /^\s*([\s\S]+?)(?:\s+as\s+([\s\S]+?))?\s+for\s+(?:([\$\w][\$\w\d]*))\s+in\s+([\s\S]+?)$/;
    return {
      parse: function(input) {
        var match = input.match(TYPEAHEAD_REGEXP);
        if (!match) {
          throw new Error(
            'Expected typeahead specification in form of "_modelValue_ (as _label_)? for _item_ in _collection_"' +
              ' but got "' + input + '".');
        }

        return {
          itemName: match[3],
          source: $parse(match[4]),
          viewMapper: $parse(match[2] || match[1]),
          modelMapper: $parse(match[1])
        };
      }
    };
}])

.controller('liLookupController', ['$compile', '$parse', '$q', '$timeout', 'liLookupParser', function($compile, $parse, $q, $timeout, lookupParser) {
	'use strict';
	this.init = function(_scope, _element, _attrs, controllers) {
		var scope, element, attrs, modelCtrl;
		element = _element;
		scope = _scope.$new();
		attrs = _attrs;
		modelCtrl = controllers[1];

		scope.objectName = attrs.objectName;
		scope.matches = [];
		scope.selected = null;
		scope.isFocused = false;
		scope.dropdownFields = [];

		if (attrs.dropdownFields && JSON.parse(attrs.dropdownFields).length > 0) {
			scope.dropdownFields = JSON.parse(attrs.dropdownFields);
		}

		//Set object to model
		var parsedModel = $parse(attrs.ngModel);
	    var $setModelValue = function(scope, newValue) {
	      return parsedModel.assign(scope, newValue);
	    };

		// parse the expression the user has provided for what function/value to execute
		var parsedExpression = lookupParser.parse(attrs.liLookup);

		// create a listener for typing
		element.bind('keyup', function(event) {
			// when the deferred given to us by the expression resolves, we'll loop over all the results and put them into the matches scope var which 
			// has been handed down to the dropdown directive
			// we need to give the current model value to the functoin we're executing as a local
			var locals = {
				$viewValue: modelCtrl.$viewValue
			};

			$q.when(parsedExpression.source(scope, locals)).then(function(results) {
				scope.matches.length = 0;
				_.each(results, function(result) {
					locals[parsedExpression.itemName] = result;
					scope.matches.push({
						label: parsedExpression.viewMapper(scope, locals),
						model: result
					});
				});

				scope.currentVal = modelCtrl.$viewValue;
			});
		});


		//This is what sets the label on the input!
		modelCtrl.$formatters.push(function(modelValue) {
			var candidateViewValue, emptyViewValue;
	        var locals = {};

			locals[parsedExpression.itemName] = modelValue;
	        candidateViewValue = parsedExpression.viewMapper(scope, locals);
	        locals[parsedExpression.itemName] = undefined;
	        emptyViewValue = parsedExpression.viewMapper(scope, locals);

	        return candidateViewValue !== emptyViewValue ? candidateViewValue : modelValue;
		});

		//Make sure model is always an object
		modelCtrl.$parsers.push(function(value) {
			if (typeof value !== 'object') {
				return null;
			}
		});

		// create ui elements for the dropdown
		var dropdownElem = angular.element('<div li-lookup-dropdown></div>');
		dropdownElem.attr({
			matches: 'matches',
			'current-val': 'currentVal',
			'the-object': 'objectName',
			'dropdown-fields': 'dropdownFields',
			select: 'select(idx)'
		});

		// compile the ui element
		var dropdownDomElem = $compile(dropdownElem)(scope);

		element.bind('focus', function() {
			// insert it into the dom
			scope.currentVal = modelCtrl.$viewValue;
			scope.$digest();
			$(dropdownDomElem).show();
			$(element).parents('.slds-lookup').append(dropdownDomElem);
		});

		$(document).on('click', function (event) {
			if (!$.contains($(element).closest('.slds-lookup')[0], event.target) && !$(event.target).is($(element))) {
				$(dropdownDomElem).hide();
			}
		});

		scope.select = function(idx) {
			var locals = {};
			var model, item;

			locals[parsedExpression.itemName] = item = scope.matches[idx].model;
      		model = parsedExpression.modelMapper(scope, locals);
			$setModelValue(scope, model);

			scope.matches = [];
		};
	};

}])

.directive('liLookup', [function() {
	'use strict';
	return {
		controller: 'liLookupController',
		require: ['liLookup', 'ngModel'],
		link: function(scope, element, attrs, controllers) {
			var lookupController;

			if(controllers.length > 0) {
				lookupController = controllers[0];
			}

			if(lookupController) {
				lookupController.init(scope, element, attrs, controllers);
			}
		}	
	};
}])

.directive('liLookupDropdown', [function() {
	'use strict';
	return {
		templateUrl: 'views/fields/lookup/lookup-dropdown.html',
		scope: {
			matches: '=',
			currentVal: '=',
			theObject: '=',
			dropdownFields: '=',
			select: '&'
		},
		replace: true,
		link: function(scope, element, attrs) {
			scope.selectMatch = function(idx) {
				scope.select({idx: idx});
			};

			scope.getField = function(obj, field) {
				//Check if field is a relationship
				if (field.indexOf('.') > -1) {
					var objs = field.split('.');

					for (var i=0;i<objs.length;i++) {
						var k = objs[i];
						obj = obj[k];
					}

					return obj;
				}
				else {
					return obj[field];
				}
			};
		}
	};
}]);