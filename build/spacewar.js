/*
	Kailash Nadh (http://nadh.in)

	localStorageDB v 2.3.1
	A simple database layer for localStorage

	v 2.3.1 Mar 2015
	v 2.3 Feb 2014 Contribution: Christian Kellner (http://orange-coding.net)
	v 2.2 Jan 2014 Contribution: Andy Hawkins (http://a904guy.com) 
	v 2.1 Nov 2013
	v 2.0 June 2013
	v 1.9 Nov 2012

	License	:	MIT License
*/

!(function (_global, undefined) {
	function chromeStorageDB(db_name, engine, next) {
		if (next == null) {
			next = engine;
			engine = null;
		}
		var db_prefix = 'db_',
			db_id = db_prefix + db_name,
			db_new = false,	// this flag determines whether a new database was created during an object initialisation
			db = null,
			storage;

			try {
				if (chrome.storage != null) {
					storage = (engine == chrome.storage.sync ? chrome.storage.sync: chrome.storage.local);
				} else {
					storage = (engine == sessionStorage ? sessionStorage: localStorage);
				}
			} catch(e) { // ie8 hack
				storage = engine;
			}

		// if the database doesn't exist, create it
		if (chrome.storage == null) {
			db = storage[db_id];
			if (!( db && (db = JSON.parse(db)) && db.tables && db.data )) {
				if (!validateName(db_name)) {
					error("The name '" + db_name + "' contains invalid characters");
				} else {
					db = {tables: {}, data: {}};
					commit();
					db_new = true;
				}
			}
			if (next) return next(publicInterface(db));
		} else {
			storage.get(db_id, function(items) {
				db = items[db_id];
				if (!( db && (db = JSON.parse(db)) && db.tables && db.data )) {
					if (!validateName(db_name)) {
						error("The name '" + db_name + "' contains invalid characters");
					} else {
						db = {tables: {}, data: {}};
						commit(function() {
							db_new = true;
							return next(publicInterface(db));
						});
					}
				}
				return next(publicInterface(db));
			});
		}



		// ______________________ private methods

		// _________ database functions
		// drop the database
		function drop(next) {
			if (chrome.storage == null) {
				if(storage.hasOwnProperty(db_id)) {
					delete storage[db_id];
				}
				db = null;
				if (next) return next();
			} else {
				storage.remove(db_id, next);
				db = null;
			}
		}

		// number of tables in the database
		function tableCount() {
			var count = 0;
			for(var table in db.tables) {
				if( db.tables.hasOwnProperty(table) ) {
					count++;
				}
			}
			return count;
		}

		// _________ table functions

		// returns all fields in a table.
		function tableFields(table_name) {
			return db.tables[table_name].fields;
		}

		// check whether a table exists
		function tableExists(table_name) {
			return db.tables[table_name] ? true : false;
		}

		// check whether a table exists, and if not, throw an error
		function tableExistsWarn(table_name) {
			if(!tableExists(table_name)) {
				error("The table '" + table_name + "' does not exist");
			}
		}

		// check whether a table column exists
		function columnExists(table_name, field_name) {
			var exists = false;
			var table_fields = db.tables[table_name].fields;
			for(var field in table_fields){
				if(table_fields[field] == field_name)
				{
					exists = true;
					break;
				}
			}
			return exists;
		}

		// create a table
		function createTable(table_name, fields) {
			db.tables[table_name] = {fields: fields, auto_increment: 1};
			db.data[table_name] = {};
		}

		// drop a table
		function dropTable(table_name) {
			delete db.tables[table_name];
			delete db.data[table_name];
		}

		// empty a table
		function truncate(table_name) {
			db.tables[table_name].auto_increment = 1;
			db.data[table_name] = {};
		}

		//alter a table
		function alterTable(table_name, new_fields, default_values){
			db.tables[table_name].fields = db.tables[table_name].fields.concat(new_fields);

			// insert default values in existing table
			if(typeof default_values != "undefined") {
				// loop through all the records in the table
				for(var ID in db.data[table_name]) {
					if( !db.data[table_name].hasOwnProperty(ID) ) {
						continue;
					}
					for(var field in new_fields) {
						if(typeof default_values == "object") {
							db.data[table_name][ID][new_fields[field]] = default_values[new_fields[field]];
						} else {
							db.data[table_name][ID][new_fields[field]] = default_values;
						}
					}
				}
			}
		}

		// number of rows in a table
		function rowCount(table_name) {
			var count = 0;
			for(var ID in db.data[table_name]) {
				if( db.data[table_name].hasOwnProperty(ID) ) {
					count++;
				}
			}
			return count;
		}

		// insert a new row
		function insert(table_name, data) {
			data.ID = db.tables[table_name].auto_increment;
			db.data[table_name][ db.tables[table_name].auto_increment ] = data;
			db.tables[table_name].auto_increment++;
			return data.ID;
		}

		// select rows, given a list of IDs of rows in a table
		function select(table_name, ids, start, limit, sort, distinct) {
			var ID = null, results = [], row = null;

			for(var i=0; i<ids.length; i++) {
				ID = ids[i];
				row = db.data[table_name][ID];
				results.push( clone(row) );
			}

			// there are sorting params
			if(sort && sort instanceof Array) {
				for(var i=0; i<sort.length; i++) {
					results.sort(sort_results(sort[i][0], sort[i].length > 1 ? sort[i][1] : null));
				}
			}

			// distinct params
			if(distinct && distinct instanceof Array) {
				for(var j=0; j<distinct.length; j++) {
					var seen = {}, d = distinct[j];

					for(var i=0; i<results.length; i++) {
						if(results[i] === undefined) {
							continue;
						}

						if(results[i].hasOwnProperty(d) && seen.hasOwnProperty(results[i][d])) {
							delete(results[i]);
						} else {
							seen[results[i][d]] = 1;
						}
					}
				}

				// can't use .filter(ie8)
				var new_results = [];
				for(var i=0; i<results.length; i++) {
					if(results[i] !== undefined) {
						new_results.push(results[i]);
					}
				}

				results = new_results;
			}

			// limit and offset
			start = start && typeof start === "number" ? start : null;
			limit = limit && typeof limit === "number" ? limit : null;

			if(start && limit) {
				results = results.slice(start, start+limit);
			} else if(start) {
				results = results.slice(start);
			} else if(limit) {
				results = results.slice(start, limit);
			}

			return results;
		}

		// sort a result set
		function sort_results(field, order) {
			return function(x, y) {
				// case insensitive comparison for string values
				var v1 = typeof(x[field]) === "string" ? x[field].toLowerCase() : x[field],
					v2 = typeof(y[field]) === "string" ? y[field].toLowerCase() : y[field];

				if(order === "DESC") {
					return v1 == v2 ? 0 : (v1 < v2 ? 1 : -1);
				} else {
					return v1 == v2 ? 0 : (v1 > v2 ? 1 : -1);
				}
			};
		}

		// select rows in a table by field-value pairs, returns the IDs of matches
		function queryByValues(table_name, data) {
			var result_ids = [],
				exists = false,
				row = null;

			// loop through all the records in the table, looking for matches
			for(var ID in db.data[table_name]) {
				if( !db.data[table_name].hasOwnProperty(ID) ) {
					continue;
				}

				row = db.data[table_name][ID];
				exists = true;

				for(var field in data) {
					if( !data.hasOwnProperty(field) ) {
						continue;
					}

					if(typeof data[field] == 'string') {	// if the field is a string, do a case insensitive comparison
						if( row[field] === null || row[field].toString().toLowerCase() != data[field].toString().toLowerCase() ) {
							exists = false;
							break;
						}
					} else {
						if(row[field] != data[field]) {
							exists = false;
							break;
						}
					}
				}
				if(exists) {
					result_ids.push(ID);
				}
			}

			return result_ids;
		}

		// select rows in a table by a function, returns the IDs of matches
		function queryByFunction(table_name, query_function) {
			var result_ids = [],
				exists = false,
				row = null;

			// loop through all the records in the table, looking for matches
			for(var ID in db.data[table_name]) {
				if( !db.data[table_name].hasOwnProperty(ID) ) {
					continue;
				}

				row = db.data[table_name][ID];

				if( query_function( clone(row) ) == true ) {	// it's a match if the supplied conditional function is satisfied
					result_ids.push(ID);
				}
			}

			return result_ids;
		}

		// return all the IDs in a table
		function getIDs(table_name) {
			var result_ids = [];

			for(var ID in db.data[table_name]) {
				if( db.data[table_name].hasOwnProperty(ID) ) {
					result_ids.push(ID);
				}
			}
			return result_ids;
		}

		// delete rows, given a list of their IDs in a table
		function deleteRows(table_name, ids) {
			for(var i=0; i<ids.length; i++) {
				if( db.data[table_name].hasOwnProperty(ids[i]) ) {
					delete db.data[table_name][ ids[i] ];
				}
			}
			return ids.length;
		}

		// update rows
		function update(table_name, ids, update_function) {
			var ID = '', num = 0;

			for(var i=0; i<ids.length; i++) {
				ID = ids[i];

				var updated_data = update_function( clone(db.data[table_name][ID]) );

				if(updated_data) {
					delete updated_data['ID']; // no updates possible to ID

					var new_data = db.data[table_name][ID];
					// merge updated data with existing data
					for(var field in updated_data) {
						if( updated_data.hasOwnProperty(field) ) {
							new_data[field] = updated_data[field];
						}
					}

					db.data[table_name][ID] = validFields(table_name, new_data);
					num++;
				}
			}
			return num;
		}

		// commit the database to localStorage
		function commit(next) {
			if (chrome.storage == null) {
				try {
					storage.setItem(db_id, JSON.stringify(db));
					if (next) return next(true);
					return true;
				} catch(e) {
					if (next) return next(false);
					return false;
				}
			} else {
				var items = {};
				items[db_id] = JSON.stringify(db);
				storage.set(items, next);
			}
		}

		// serialize the database
		function serialize() {
			return JSON.stringify(db);
		}

		// throw an error
		function error(msg) {
			throw new Error(msg);
		}

		// clone an object
		function clone(obj) {
			var new_obj = {};
			for(var key in obj) {
				if( obj.hasOwnProperty(key) ) {
					new_obj[key] = obj[key];
				}
			}
			return new_obj;
		}

		// validate db, table, field names (alpha-numeric only)
		function validateName(name) {
			return name.toString().match(/[^a-z_0-9]/ig) ? false : true;
		}

		// given a data list, only retain valid fields in a table
		function validFields(table_name, data) {
			var field = '', new_data = {};

			for(var i=0; i<db.tables[table_name].fields.length; i++) {
				field = db.tables[table_name].fields[i];

				if (data[field] !== undefined) {
					new_data[field] = data[field];
				}
			}
			return new_data;
		}

		// given a data list, populate with valid field names of a table
		function validateData(table_name, data) {
			var field = '', new_data = {};
			for(var i=0; i<db.tables[table_name].fields.length; i++) {
				field = db.tables[table_name].fields[i];
				new_data[field] = (data[field] === null || data[field] === undefined) ? null : data[field];
			}
			return new_data;
		}

		function publicInterface(db) {
			// ______________________ public methods

			return {
				// commit the database to localStorage
				commit: function(next) {
					return commit(next);
				},

				// is this instance a newly created database?
				isNew: function() {
					return db_new;
				},

				// delete the database
				drop: function() {
					drop();
				},

				// serialize the database
				serialize: function() {
					return serialize();
				},

				// check whether a table exists
				tableExists: function(table_name) {
					return tableExists(table_name);
				},

				// list of keys in a table
				tableFields: function(table_name) {
					return tableFields(table_name);
				},

				// number of tables in the database
				tableCount: function() {
					return tableCount();
				},

				columnExists: function(table_name, field_name){
					return columnExists(table_name, field_name);
				},

				// create a table
				createTable: function(table_name, fields) {
					var result = false;
					if(!validateName(table_name)) {
						error("The database name '" + table_name + "' contains invalid characters.");
					} else if(this.tableExists(table_name)) {
						error("The table name '" + table_name + "' already exists.");
					} else {
						// make sure field names are valid
						var is_valid = true;
						for(var i=0; i<fields.length; i++) {
							if(!validateName(fields[i])) {
								is_valid = false;
								break;
							}
						}

						if(is_valid) {
							// cannot use indexOf due to <IE9 incompatibility
							// de-duplicate the field list
							var fields_literal = {};
							for(var i=0; i<fields.length; i++) {
								fields_literal[ fields[i] ] = true;
							}
							delete fields_literal['ID']; // ID is a reserved field name

							fields = ['ID'];
							for(var field in fields_literal) {
								if( fields_literal.hasOwnProperty(field) ) {
									fields.push(field);
								}
							}

							createTable(table_name, fields);
							result = true;
						} else {
							error("One or more field names in the table definition contains invalid characters");
						}
					}

					return result;
				},

				// Create a table using array of Objects @ [{k:v,k:v},{k:v,k:v},etc]
				createTableWithData: function(table_name, data, next) {
					if(typeof data !== 'object' || !data.length || data.length < 1) {
						error("Data supplied isn't in object form. Example: [{k:v,k:v},{k:v,k:v} ..]");
					}

					var fields = Object.keys(data[0]);

					// create the table
					if( this.createTable(table_name, fields) ) {
						this.commit(function() {

							// populate
							for (var i=0; i<data.length; i++) {
								if( !insert(table_name, data[i]) ) {
									error("Failed to insert record: [" + JSON.stringify(data[i]) + "]");
								}
							}
							this.commit(next);
						});
					}
					return true;
				},

				// drop a table
				dropTable: function(table_name) {
					tableExistsWarn(table_name);
					dropTable(table_name);
				},

				// empty a table
				truncate: function(table_name) {
					tableExistsWarn(table_name);
					truncate(table_name);
				},

				// alter a table
				alterTable: function(table_name, new_fields, default_values) {
					var result = false;
					if(!validateName(table_name)) {
						error("The database name '" + table_name + "' contains invalid characters");
					} else {
						if(typeof new_fields == "object") {
							// make sure field names are valid
							var is_valid = true;
							for(var i=0; i<new_fields.length; i++) {
								if(!validateName(new_fields[i])) {
									is_valid = false;
									break;
								}
							}

							if(is_valid) {
								// cannot use indexOf due to <IE9 incompatibility
								// de-duplicate the field list
								var fields_literal = {};
								for(var i=0; i<new_fields.length; i++) {
									fields_literal[ new_fields[i] ] = true;
								}
								delete fields_literal['ID']; // ID is a reserved field name

								new_fields = [];
								for(var field in fields_literal) {
									if( fields_literal.hasOwnProperty(field) ) {
										new_fields.push(field);
									}
								}

								alterTable(table_name, new_fields, default_values);
								result = true;
							} else {
								error("One or more field names in the table definition contains invalid characters");
							}
						} else if(typeof new_fields == "string") {
							if(validateName(new_fields)) {
								var new_fields_array = [];
								new_fields_array.push(new_fields);
								alterTable(table_name, new_fields_array, default_values);
								result = true;
							} else {
								error("One or more field names in the table definition contains invalid characters");
							}
						}
					}

					return result;
				},

				// number of rows in a table
				rowCount: function(table_name) {
					tableExistsWarn(table_name);
					return rowCount(table_name);
				},

				// insert a row
				insert: function(table_name, data) {
					tableExistsWarn(table_name);
					return insert(table_name, validateData(table_name, data) );
				},

				// insert or update based on a given condition
				insertOrUpdate: function(table_name, query, data) {
					tableExistsWarn(table_name);

					var result_ids = [];
					if(!query) {
						result_ids = getIDs(table_name);				// there is no query. applies to all records
					} else if(typeof query == 'object') {				// the query has key-value pairs provided
						result_ids = queryByValues(table_name, validFields(table_name, query));
					} else if(typeof query == 'function') {				// the query has a conditional map function provided
						result_ids = queryByFunction(table_name, query);
					}

					// no existing records matched, so insert a new row
					if(result_ids.length == 0) {
						return insert(table_name, validateData(table_name, data) );
					} else {
						var ids = [];
						for(var n=0; n<result_ids.length; n++) {
							update(table_name, result_ids, function(o) {
								ids.push(o.ID);
								return data;
							});
						}

						return ids;
					}
				},

				// update rows
				update: function(table_name, query, update_function) {
					tableExistsWarn(table_name);

					var result_ids = [];
					if(!query) {
						result_ids = getIDs(table_name);				// there is no query. applies to all records
					} else if(typeof query == 'object') {				// the query has key-value pairs provided
						result_ids = queryByValues(table_name, validFields(table_name, query));
					} else if(typeof query == 'function') {				// the query has a conditional map function provided
						result_ids = queryByFunction(table_name, query);
					}
					return update(table_name, result_ids, update_function);
				},

				// select rows
				query: function(table_name, query, limit, start, sort, distinct) {
					tableExistsWarn(table_name);

					var result_ids = [];
					if(!query) {
						result_ids = getIDs(table_name, limit, start); // no conditions given, return all records
					} else if(typeof query == 'object') {			// the query has key-value pairs provided
						result_ids = queryByValues(table_name, validFields(table_name, query), limit, start);
					} else if(typeof query == 'function') {		// the query has a conditional map function provided
						result_ids = queryByFunction(table_name, query, limit, start);
					}

					return select(table_name, result_ids, start, limit, sort, distinct);
				},

				// alias for query() that takes a dict of params instead of positional arrguments
				queryAll: function(table_name, params) {
					if(!params) {
						return this.query(table_name)
					} else {
						return this.query(table_name,
							params.hasOwnProperty('query') ? params.query : null,
							params.hasOwnProperty('limit') ? params.limit : null,
							params.hasOwnProperty('start') ? params.start : null,
							params.hasOwnProperty('sort') ? params.sort : null,
							params.hasOwnProperty('distinct') ? params.distinct : null
						);
					}
				},

				// delete rows
				deleteRows: function(table_name, query) {
					tableExistsWarn(table_name);

					var result_ids = [];
					if(!query) {
						result_ids = getIDs(table_name);
					} else if(typeof query == 'object') {
						result_ids = queryByValues(table_name, validFields(table_name, query));
					} else if(typeof query == 'function') {
						result_ids = queryByFunction(table_name, query);
					}
					return deleteRows(table_name, result_ids);
				}
			}
		}

	}

	// make amd compatible
	if(typeof define === 'function' && define.amd) {
		define(function() {
			return chromeStorageDB;
		});
	} else {
		_global['chromeStorageDB'] = chromeStorageDB;
	}

}(window));

/*
	Kailash Nadh (http://nadh.in)

	localStorageDB v 2.3.1
	A simple database layer for localStorage

	v 2.3.1 Mar 2015
	v 2.3 Feb 2014 Contribution: Christian Kellner (http://orange-coding.net)
	v 2.2 Jan 2014 Contribution: Andy Hawkins (http://a904guy.com) 
	v 2.1 Nov 2013
	v 2.0 June 2013
	v 1.9 Nov 2012

	License	:	MIT License
*/

!function(t,e){function n(t,n){function r(){E.hasOwnProperty(_)&&delete E[_],x=null}function a(){var t=0;for(var e in x.tables)x.tables.hasOwnProperty(e)&&t++;return t}function i(t){return x.tables[t].fields}function o(t){return x.tables[t]?!0:!1}function f(t){o(t)||D("The table '"+t+"' does not exist")}function u(t,e){var n=!1,r=x.tables[t].fields;for(var a in r)if(r[a]==e){n=!0;break}return n}function l(t,e){x.tables[t]={fields:e,auto_increment:1},x.data[t]={}}function s(t){delete x.tables[t],delete x.data[t]}function c(t){x.tables[t].auto_increment=1,x.data[t]={}}function d(t,e,n){if(x.tables[t].fields=x.tables[t].fields.concat(e),"undefined"!=typeof n)for(var r in x.data[t])if(x.data[t].hasOwnProperty(r))for(var a in e)x.data[t][r][e[a]]="object"==typeof n?n[e[a]]:n}function h(t){var e=0;for(var n in x.data[t])x.data[t].hasOwnProperty(n)&&e++;return e}function v(t,e){return e.ID=x.tables[t].auto_increment,x.data[t][x.tables[t].auto_increment]=e,x.tables[t].auto_increment++,e.ID}function p(t,n,r,a,i,o){for(var f=null,u=[],l=null,s=0;s<n.length;s++)f=n[s],l=x.data[t][f],u.push(k(l));if(i&&i instanceof Array)for(var s=0;s<i.length;s++)u.sort(y(i[s][0],i[s].length>1?i[s][1]:null));if(o&&o instanceof Array){for(var c=0;c<o.length;c++)for(var d={},h=o[c],s=0;s<u.length;s++)u[s]!==e&&(u[s].hasOwnProperty(h)&&d.hasOwnProperty(u[s][h])?delete u[s]:d[u[s][h]]=1);for(var v=[],s=0;s<u.length;s++)u[s]!==e&&v.push(u[s]);u=v}return r=r&&"number"==typeof r?r:null,a=a&&"number"==typeof a?a:null,r&&a?u=u.slice(r,r+a):r?u=u.slice(r):a&&(u=u.slice(r,a)),u}function y(t,e){return function(n,r){var a="string"==typeof n[t]?n[t].toLowerCase():n[t],i="string"==typeof r[t]?r[t].toLowerCase():r[t];return"DESC"===e?a==i?0:i>a?1:-1:a==i?0:a>i?1:-1}}function b(t,e){var n=[],r=!1,a=null;for(var i in x.data[t])if(x.data[t].hasOwnProperty(i)){a=x.data[t][i],r=!0;for(var o in e)if(e.hasOwnProperty(o))if("string"==typeof e[o]){if(a[o].toString().toLowerCase()!=e[o].toString().toLowerCase()){r=!1;break}}else if(a[o]!=e[o]){r=!1;break}r&&n.push(i)}return n}function g(t,e){var n=[],r=null;for(var a in x.data[t])x.data[t].hasOwnProperty(a)&&(r=x.data[t][a],1==e(k(r))&&n.push(a));return n}function m(t){var e=[];for(var n in x.data[t])x.data[t].hasOwnProperty(n)&&e.push(n);return e}function w(t,e){for(var n=0;n<e.length;n++)x.data[t].hasOwnProperty(e[n])&&delete x.data[t][e[n]];return e.length}function O(t,e,n){for(var r="",a=0,i=0;i<e.length;i++){r=e[i];var o=n(k(x.data[t][r]));if(o){delete o.ID;var f=x.data[t][r];for(var u in o)o.hasOwnProperty(u)&&(f[u]=o[u]);x.data[t][r]=j(t,f),a++}}return a}function P(){try{return E.setItem(_,JSON.stringify(x)),!0}catch(t){return!1}}function S(){return JSON.stringify(x)}function D(t){throw new Error(t)}function k(t){var e={};for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n]);return e}function T(t){return t.toString().match(/[^a-z_0-9]/gi)?!1:!0}function j(t,n){for(var r="",a={},i=0;i<x.tables[t].fields.length;i++)r=x.tables[t].fields[i],n[r]!==e&&(a[r]=n[r]);return a}function I(t,n){for(var r="",a={},i=0;i<x.tables[t].fields.length;i++)r=x.tables[t].fields[i],a[r]=null===n[r]||n[r]===e?null:n[r];return a}var C="db_",_=C+t,q=!1,x=null;try{var E=n==sessionStorage?sessionStorage:localStorage}catch(N){var E=n}return x=E[_],x&&(x=JSON.parse(x))&&x.tables&&x.data||(T(t)?(x={tables:{},data:{}},P(),q=!0):D("The name '"+t+"' contains invalid characters")),{commit:function(){return P()},isNew:function(){return q},drop:function(){r()},serialize:function(){return S()},tableExists:function(t){return o(t)},tableFields:function(t){return i(t)},tableCount:function(){return a()},columnExists:function(t,e){return u(t,e)},createTable:function(t,e){var n=!1;if(T(t))if(this.tableExists(t))D("The table name '"+t+"' already exists.");else{for(var r=!0,a=0;a<e.length;a++)if(!T(e[a])){r=!1;break}if(r){for(var i={},a=0;a<e.length;a++)i[e[a]]=!0;delete i.ID,e=["ID"];for(var o in i)i.hasOwnProperty(o)&&e.push(o);l(t,e),n=!0}else D("One or more field names in the table definition contains invalid characters")}else D("The database name '"+t+"' contains invalid characters.");return n},createTableWithData:function(t,e){("object"!=typeof e||!e.length||e.length<1)&&D("Data supplied isn't in object form. Example: [{k:v,k:v},{k:v,k:v} ..]");var n=Object.keys(e[0]);if(this.createTable(t,n)){this.commit();for(var r=0;r<e.length;r++)v(t,e[r])||D("Failed to insert record: ["+JSON.stringify(e[r])+"]");this.commit()}return!0},dropTable:function(t){f(t),s(t)},truncate:function(t){f(t),c(t)},alterTable:function(t,e,n){var r=!1;if(T(t)){if("object"==typeof e){for(var a=!0,i=0;i<e.length;i++)if(!T(e[i])){a=!1;break}if(a){for(var o={},i=0;i<e.length;i++)o[e[i]]=!0;delete o.ID,e=[];for(var f in o)o.hasOwnProperty(f)&&e.push(f);d(t,e,n),r=!0}else D("One or more field names in the table definition contains invalid characters")}else if("string"==typeof e)if(T(e)){var u=[];u.push(e),d(t,u,n),r=!0}else D("One or more field names in the table definition contains invalid characters")}else D("The database name '"+t+"' contains invalid characters");return r},rowCount:function(t){return f(t),h(t)},insert:function(t,e){return f(t),v(t,I(t,e))},insertOrUpdate:function(t,e,n){f(t);var r=[];if(e?"object"==typeof e?r=b(t,j(t,e)):"function"==typeof e&&(r=g(t,e)):r=m(t),0==r.length)return v(t,I(t,n));for(var a=[],i=0;i<r.length;i++)O(t,r,function(t){return a.push(t.ID),n});return a},update:function(t,e,n){f(t);var r=[];return e?"object"==typeof e?r=b(t,j(t,e)):"function"==typeof e&&(r=g(t,e)):r=m(t),O(t,r,n)},query:function(t,e,n,r,a,i){f(t);var o=[];return e?"object"==typeof e?o=b(t,j(t,e),n,r):"function"==typeof e&&(o=g(t,e,n,r)):o=m(t,n,r),p(t,o,r,n,a,i)},queryAll:function(t,e){return e?this.query(t,e.hasOwnProperty("query")?e.query:null,e.hasOwnProperty("limit")?e.limit:null,e.hasOwnProperty("start")?e.start:null,e.hasOwnProperty("sort")?e.sort:null,e.hasOwnProperty("distinct")?e.distinct:null):this.query(t)},deleteRows:function(t,e){f(t);var n=[];return e?"object"==typeof e?n=b(t,j(t,e)):"function"==typeof e&&(n=g(t,e)):n=m(t),w(t,n)}}}"function"==typeof define&&define.amd?define(function(){return n}):t.localStorageDB=n}(window);
/*!
 *  howler.js v1.1.26
 *  howlerjs.com
 *
 *  (c) 2013-2015, James Simpson of GoldFire Studios
 *  goldfirestudios.com
 *
 *  MIT License
 */
!function(){var e={},o=null,n=!0,t=!1;try{"undefined"!=typeof AudioContext?o=new AudioContext:"undefined"!=typeof webkitAudioContext?o=new webkitAudioContext:n=!1}catch(r){n=!1}if(!n)if("undefined"!=typeof Audio)try{new Audio}catch(r){t=!0}else t=!0;if(n){var a="undefined"==typeof o.createGain?o.createGainNode():o.createGain();a.gain.value=1,a.connect(o.destination)}var i=function(e){this._volume=1,this._muted=!1,this.usingWebAudio=n,this.ctx=o,this.noAudio=t,this._howls=[],this._codecs=e,this.iOSAutoEnable=!0};i.prototype={volume:function(e){var o=this;if(e=parseFloat(e),e>=0&&1>=e){o._volume=e,n&&(a.gain.value=e);for(var t in o._howls)if(o._howls.hasOwnProperty(t)&&o._howls[t]._webAudio===!1)for(var r=0;r<o._howls[t]._audioNode.length;r++)o._howls[t]._audioNode[r].volume=o._howls[t]._volume*o._volume;return o}return n?a.gain.value:o._volume},mute:function(){return this._setMuted(!0),this},unmute:function(){return this._setMuted(!1),this},_setMuted:function(e){var o=this;o._muted=e,n&&(a.gain.value=e?0:o._volume);for(var t in o._howls)if(o._howls.hasOwnProperty(t)&&o._howls[t]._webAudio===!1)for(var r=0;r<o._howls[t]._audioNode.length;r++)o._howls[t]._audioNode[r].muted=e},codecs:function(e){return this._codecs[e]},_enableiOSAudio:function(){var e=this;if(!o||!e._iOSEnabled&&/iPhone|iPad|iPod/i.test(navigator.userAgent)){e._iOSEnabled=!1;var n=function(){var t=o.createBuffer(1,1,22050),r=o.createBufferSource();r.buffer=t,r.connect(o.destination),"undefined"==typeof r.start?r.noteOn(0):r.start(0),setTimeout(function(){(r.playbackState===r.PLAYING_STATE||r.playbackState===r.FINISHED_STATE)&&(e._iOSEnabled=!0,e.iOSAutoEnable=!1,window.removeEventListener("touchstart",n,!1))},0)};return window.addEventListener("touchstart",n,!1),e}}};var u=null,d={};t||(u=new Audio,d={mp3:!!u.canPlayType("audio/mpeg;").replace(/^no$/,""),opus:!!u.canPlayType('audio/ogg; codecs="opus"').replace(/^no$/,""),ogg:!!u.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/,""),wav:!!u.canPlayType('audio/wav; codecs="1"').replace(/^no$/,""),aac:!!u.canPlayType("audio/aac;").replace(/^no$/,""),m4a:!!(u.canPlayType("audio/x-m4a;")||u.canPlayType("audio/m4a;")||u.canPlayType("audio/aac;")).replace(/^no$/,""),mp4:!!(u.canPlayType("audio/x-mp4;")||u.canPlayType("audio/mp4;")||u.canPlayType("audio/aac;")).replace(/^no$/,""),weba:!!u.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/,"")});var l=new i(d),f=function(e){var t=this;t._autoplay=e.autoplay||!1,t._buffer=e.buffer||!1,t._duration=e.duration||0,t._format=e.format||null,t._loop=e.loop||!1,t._loaded=!1,t._sprite=e.sprite||{},t._src=e.src||"",t._pos3d=e.pos3d||[0,0,-.5],t._volume=void 0!==e.volume?e.volume:1,t._urls=e.urls||[],t._rate=e.rate||1,t._model=e.model||null,t._onload=[e.onload||function(){}],t._onloaderror=[e.onloaderror||function(){}],t._onend=[e.onend||function(){}],t._onpause=[e.onpause||function(){}],t._onplay=[e.onplay||function(){}],t._onendTimer=[],t._webAudio=n&&!t._buffer,t._audioNode=[],t._webAudio&&t._setupAudioNode(),"undefined"!=typeof o&&o&&l.iOSAutoEnable&&l._enableiOSAudio(),l._howls.push(t),t.load()};if(f.prototype={load:function(){var e=this,o=null;if(t)return void e.on("loaderror");for(var n=0;n<e._urls.length;n++){var r,a;if(e._format)r=e._format;else{if(a=e._urls[n],r=/^data:audio\/([^;,]+);/i.exec(a),r||(r=/\.([^.]+)$/.exec(a.split("?",1)[0])),!r)return void e.on("loaderror");r=r[1].toLowerCase()}if(d[r]){o=e._urls[n];break}}if(!o)return void e.on("loaderror");if(e._src=o,e._webAudio)_(e,o);else{var u=new Audio;u.addEventListener("error",function(){u.error&&4===u.error.code&&(i.noAudio=!0),e.on("loaderror",{type:u.error?u.error.code:0})},!1),e._audioNode.push(u),u.src=o,u._pos=0,u.preload="auto",u.volume=l._muted?0:e._volume*l.volume();var f=function(){e._duration=Math.ceil(10*u.duration)/10,0===Object.getOwnPropertyNames(e._sprite).length&&(e._sprite={_default:[0,1e3*e._duration]}),e._loaded||(e._loaded=!0,e.on("load")),e._autoplay&&e.play(),u.removeEventListener("canplaythrough",f,!1)};u.addEventListener("canplaythrough",f,!1),u.load()}return e},urls:function(e){var o=this;return e?(o.stop(),o._urls="string"==typeof e?[e]:e,o._loaded=!1,o.load(),o):o._urls},play:function(e,n){var t=this;return"function"==typeof e&&(n=e),e&&"function"!=typeof e||(e="_default"),t._loaded?t._sprite[e]?(t._inactiveNode(function(r){r._sprite=e;var a=r._pos>0?r._pos:t._sprite[e][0]/1e3,i=0;t._webAudio?(i=t._sprite[e][1]/1e3-r._pos,r._pos>0&&(a=t._sprite[e][0]/1e3+a)):i=t._sprite[e][1]/1e3-(a-t._sprite[e][0]/1e3);var u,d=!(!t._loop&&!t._sprite[e][2]),f="string"==typeof n?n:Math.round(Date.now()*Math.random())+"";if(function(){var o={id:f,sprite:e,loop:d};u=setTimeout(function(){!t._webAudio&&d&&t.stop(o.id).play(e,o.id),t._webAudio&&!d&&(t._nodeById(o.id).paused=!0,t._nodeById(o.id)._pos=0,t._clearEndTimer(o.id)),t._webAudio||d||t.stop(o.id),t.on("end",f)},1e3*i),t._onendTimer.push({timer:u,id:o.id})}(),t._webAudio){var _=t._sprite[e][0]/1e3,s=t._sprite[e][1]/1e3;r.id=f,r.paused=!1,p(t,[d,_,s],f),t._playStart=o.currentTime,r.gain.value=t._volume,"undefined"==typeof r.bufferSource.start?d?r.bufferSource.noteGrainOn(0,a,86400):r.bufferSource.noteGrainOn(0,a,i):d?r.bufferSource.start(0,a,86400):r.bufferSource.start(0,a,i)}else{if(4!==r.readyState&&(r.readyState||!navigator.isCocoonJS))return t._clearEndTimer(f),function(){var o=t,a=e,i=n,u=r,d=function(){o.play(a,i),u.removeEventListener("canplaythrough",d,!1)};u.addEventListener("canplaythrough",d,!1)}(),t;r.readyState=4,r.id=f,r.currentTime=a,r.muted=l._muted||r.muted,r.volume=t._volume*l.volume(),setTimeout(function(){r.play()},0)}return t.on("play"),"function"==typeof n&&n(f),t}),t):("function"==typeof n&&n(),t):(t.on("load",function(){t.play(e,n)}),t)},pause:function(e){var o=this;if(!o._loaded)return o.on("play",function(){o.pause(e)}),o;o._clearEndTimer(e);var n=e?o._nodeById(e):o._activeNode();if(n)if(n._pos=o.pos(null,e),o._webAudio){if(!n.bufferSource||n.paused)return o;n.paused=!0,"undefined"==typeof n.bufferSource.stop?n.bufferSource.noteOff(0):n.bufferSource.stop(0)}else n.pause();return o.on("pause"),o},stop:function(e){var o=this;if(!o._loaded)return o.on("play",function(){o.stop(e)}),o;o._clearEndTimer(e);var n=e?o._nodeById(e):o._activeNode();if(n)if(n._pos=0,o._webAudio){if(!n.bufferSource||n.paused)return o;n.paused=!0,"undefined"==typeof n.bufferSource.stop?n.bufferSource.noteOff(0):n.bufferSource.stop(0)}else isNaN(n.duration)||(n.pause(),n.currentTime=0);return o},mute:function(e){var o=this;if(!o._loaded)return o.on("play",function(){o.mute(e)}),o;var n=e?o._nodeById(e):o._activeNode();return n&&(o._webAudio?n.gain.value=0:n.muted=!0),o},unmute:function(e){var o=this;if(!o._loaded)return o.on("play",function(){o.unmute(e)}),o;var n=e?o._nodeById(e):o._activeNode();return n&&(o._webAudio?n.gain.value=o._volume:n.muted=!1),o},volume:function(e,o){var n=this;if(e=parseFloat(e),e>=0&&1>=e){if(n._volume=e,!n._loaded)return n.on("play",function(){n.volume(e,o)}),n;var t=o?n._nodeById(o):n._activeNode();return t&&(n._webAudio?t.gain.value=e:t.volume=e*l.volume()),n}return n._volume},loop:function(e){var o=this;return"boolean"==typeof e?(o._loop=e,o):o._loop},sprite:function(e){var o=this;return"object"==typeof e?(o._sprite=e,o):o._sprite},pos:function(e,n){var t=this;if(!t._loaded)return t.on("load",function(){t.pos(e)}),"number"==typeof e?t:t._pos||0;e=parseFloat(e);var r=n?t._nodeById(n):t._activeNode();if(r)return e>=0?(t.pause(n),r._pos=e,t.play(r._sprite,n),t):t._webAudio?r._pos+(o.currentTime-t._playStart):r.currentTime;if(e>=0)return t;for(var a=0;a<t._audioNode.length;a++)if(t._audioNode[a].paused&&4===t._audioNode[a].readyState)return t._webAudio?t._audioNode[a]._pos:t._audioNode[a].currentTime},pos3d:function(e,o,n,t){var r=this;if(o="undefined"!=typeof o&&o?o:0,n="undefined"!=typeof n&&n?n:-.5,!r._loaded)return r.on("play",function(){r.pos3d(e,o,n,t)}),r;if(!(e>=0||0>e))return r._pos3d;if(r._webAudio){var a=t?r._nodeById(t):r._activeNode();a&&(r._pos3d=[e,o,n],a.panner.setPosition(e,o,n),a.panner.panningModel=r._model||"HRTF")}return r},fade:function(e,o,n,t,r){var a=this,i=Math.abs(e-o),u=e>o?"down":"up",d=i/.01,l=n/d;if(!a._loaded)return a.on("load",function(){a.fade(e,o,n,t,r)}),a;a.volume(e,r);for(var f=1;d>=f;f++)!function(){var e=a._volume+("up"===u?.01:-.01)*f,n=Math.round(1e3*e)/1e3,i=o;setTimeout(function(){a.volume(n,r),n===i&&t&&t()},l*f)}()},fadeIn:function(e,o,n){return this.volume(0).play().fade(0,e,o,n)},fadeOut:function(e,o,n,t){var r=this;return r.fade(r._volume,e,o,function(){n&&n(),r.pause(t),r.on("end")},t)},_nodeById:function(e){for(var o=this,n=o._audioNode[0],t=0;t<o._audioNode.length;t++)if(o._audioNode[t].id===e){n=o._audioNode[t];break}return n},_activeNode:function(){for(var e=this,o=null,n=0;n<e._audioNode.length;n++)if(!e._audioNode[n].paused){o=e._audioNode[n];break}return e._drainPool(),o},_inactiveNode:function(e){for(var o=this,n=null,t=0;t<o._audioNode.length;t++)if(o._audioNode[t].paused&&4===o._audioNode[t].readyState){e(o._audioNode[t]),n=!0;break}if(o._drainPool(),!n){var r;if(o._webAudio)r=o._setupAudioNode(),e(r);else{o.load(),r=o._audioNode[o._audioNode.length-1];var a=navigator.isCocoonJS?"canplaythrough":"loadedmetadata",i=function(){r.removeEventListener(a,i,!1),e(r)};r.addEventListener(a,i,!1)}}},_drainPool:function(){var e,o=this,n=0;for(e=0;e<o._audioNode.length;e++)o._audioNode[e].paused&&n++;for(e=o._audioNode.length-1;e>=0&&!(5>=n);e--)o._audioNode[e].paused&&(o._webAudio&&o._audioNode[e].disconnect(0),n--,o._audioNode.splice(e,1))},_clearEndTimer:function(e){for(var o=this,n=0,t=0;t<o._onendTimer.length;t++)if(o._onendTimer[t].id===e){n=t;break}var r=o._onendTimer[n];r&&(clearTimeout(r.timer),o._onendTimer.splice(n,1))},_setupAudioNode:function(){var e=this,n=e._audioNode,t=e._audioNode.length;return n[t]="undefined"==typeof o.createGain?o.createGainNode():o.createGain(),n[t].gain.value=e._volume,n[t].paused=!0,n[t]._pos=0,n[t].readyState=4,n[t].connect(a),n[t].panner=o.createPanner(),n[t].panner.panningModel=e._model||"equalpower",n[t].panner.setPosition(e._pos3d[0],e._pos3d[1],e._pos3d[2]),n[t].panner.connect(n[t]),n[t]},on:function(e,o){var n=this,t=n["_on"+e];if("function"==typeof o)t.push(o);else for(var r=0;r<t.length;r++)o?t[r].call(n,o):t[r].call(n);return n},off:function(e,o){var n=this,t=n["_on"+e],r=o?o.toString():null;if(r){for(var a=0;a<t.length;a++)if(r===t[a].toString()){t.splice(a,1);break}}else n["_on"+e]=[];return n},unload:function(){for(var o=this,n=o._audioNode,t=0;t<o._audioNode.length;t++)n[t].paused||(o.stop(n[t].id),o.on("end",n[t].id)),o._webAudio?n[t].disconnect(0):n[t].src="";for(t=0;t<o._onendTimer.length;t++)clearTimeout(o._onendTimer[t].timer);var r=l._howls.indexOf(o);null!==r&&r>=0&&l._howls.splice(r,1),delete e[o._src],o=null}},n)var _=function(o,n){if(n in e)return o._duration=e[n].duration,void c(o);if(/^data:[^;]+;base64,/.test(n)){for(var t=atob(n.split(",")[1]),r=new Uint8Array(t.length),a=0;a<t.length;++a)r[a]=t.charCodeAt(a);s(r.buffer,o,n)}else{var i=new XMLHttpRequest;i.open("GET",n,!0),i.responseType="arraybuffer",i.onload=function(){s(i.response,o,n)},i.onerror=function(){o._webAudio&&(o._buffer=!0,o._webAudio=!1,o._audioNode=[],delete o._gainNode,delete e[n],o.load())};try{i.send()}catch(u){i.onerror()}}},s=function(n,t,r){o.decodeAudioData(n,function(o){o&&(e[r]=o,c(t,o))},function(e){t.on("loaderror")})},c=function(e,o){e._duration=o?o.duration:e._duration,0===Object.getOwnPropertyNames(e._sprite).length&&(e._sprite={_default:[0,1e3*e._duration]}),e._loaded||(e._loaded=!0,e.on("load")),e._autoplay&&e.play()},p=function(n,t,r){var a=n._nodeById(r);a.bufferSource=o.createBufferSource(),a.bufferSource.buffer=e[n._src],a.bufferSource.connect(a.panner),a.bufferSource.loop=t[0],t[0]&&(a.bufferSource.loopStart=t[1],a.bufferSource.loopEnd=t[1]+t[2]),a.bufferSource.playbackRate.value=n._rate};"function"==typeof define&&define.amd&&define(function(){return{Howler:l,Howl:f}}),"undefined"!=typeof exports&&(exports.Howler=l,exports.Howl=f),"undefined"!=typeof window&&(window.Howler=l,window.Howl=f)}();
!function(t){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.PIXI=t()}}(function(){var t;return function e(t,r,i){function n(s,a){if(!r[s]){if(!t[s]){var h="function"==typeof require&&require;if(!a&&h)return h(s,!0);if(o)return o(s,!0);var l=new Error("Cannot find module '"+s+"'");throw l.code="MODULE_NOT_FOUND",l}var u=r[s]={exports:{}};t[s][0].call(u.exports,function(e){var r=t[s][1][e];return n(r?r:e)},u,u.exports,e,t,r,i)}return r[s].exports}for(var o="function"==typeof require&&require,s=0;s<i.length;s++)n(i[s]);return n}({1:[function(t,e,r){(function(r){t("./polyfill");var i=e.exports=t("./core");i.extras=t("./extras"),i.filters=t("./filters"),i.interaction=t("./interaction"),i.loaders=t("./loaders"),i.mesh=t("./mesh"),i.loader=new i.loaders.Loader,Object.assign(i,t("./deprecation")),r.PIXI=i}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{"./core":29,"./deprecation":78,"./extras":85,"./filters":102,"./interaction":117,"./loaders":120,"./mesh":126,"./polyfill":130}],2:[function(e,r,i){(function(e){!function(){function i(t){var e=!1;return function(){if(e)throw new Error("Callback was already called.");e=!0,t.apply(n,arguments)}}var n,o,s={};n=this,null!=n&&(o=n.async),s.noConflict=function(){return n.async=o,s};var a=Object.prototype.toString,h=Array.isArray||function(t){return"[object Array]"===a.call(t)},l=function(t,e){if(t.forEach)return t.forEach(e);for(var r=0;r<t.length;r+=1)e(t[r],r,t)},u=function(t,e){if(t.map)return t.map(e);var r=[];return l(t,function(t,i,n){r.push(e(t,i,n))}),r},c=function(t,e,r){return t.reduce?t.reduce(e,r):(l(t,function(t,i,n){r=e(r,t,i,n)}),r)},p=function(t){if(Object.keys)return Object.keys(t);var e=[];for(var r in t)t.hasOwnProperty(r)&&e.push(r);return e};"undefined"!=typeof e&&e.nextTick?(s.nextTick=e.nextTick,s.setImmediate="undefined"!=typeof setImmediate?function(t){setImmediate(t)}:s.nextTick):"function"==typeof setImmediate?(s.nextTick=function(t){setImmediate(t)},s.setImmediate=s.nextTick):(s.nextTick=function(t){setTimeout(t,0)},s.setImmediate=s.nextTick),s.each=function(t,e,r){function n(e){e?(r(e),r=function(){}):(o+=1,o>=t.length&&r())}if(r=r||function(){},!t.length)return r();var o=0;l(t,function(t){e(t,i(n))})},s.forEach=s.each,s.eachSeries=function(t,e,r){if(r=r||function(){},!t.length)return r();var i=0,n=function(){e(t[i],function(e){e?(r(e),r=function(){}):(i+=1,i>=t.length?r():n())})};n()},s.forEachSeries=s.eachSeries,s.eachLimit=function(t,e,r,i){var n=d(e);n.apply(null,[t,r,i])},s.forEachLimit=s.eachLimit;var d=function(t){return function(e,r,i){if(i=i||function(){},!e.length||0>=t)return i();var n=0,o=0,s=0;!function a(){if(n>=e.length)return i();for(;t>s&&o<e.length;)o+=1,s+=1,r(e[o-1],function(t){t?(i(t),i=function(){}):(n+=1,s-=1,n>=e.length?i():a())})}()}},f=function(t){return function(){var e=Array.prototype.slice.call(arguments);return t.apply(null,[s.each].concat(e))}},v=function(t,e){return function(){var r=Array.prototype.slice.call(arguments);return e.apply(null,[d(t)].concat(r))}},g=function(t){return function(){var e=Array.prototype.slice.call(arguments);return t.apply(null,[s.eachSeries].concat(e))}},m=function(t,e,r,i){if(e=u(e,function(t,e){return{index:e,value:t}}),i){var n=[];t(e,function(t,e){r(t.value,function(r,i){n[t.index]=i,e(r)})},function(t){i(t,n)})}else t(e,function(t,e){r(t.value,function(t){e(t)})})};s.map=f(m),s.mapSeries=g(m),s.mapLimit=function(t,e,r,i){return y(e)(t,r,i)};var y=function(t){return v(t,m)};s.reduce=function(t,e,r,i){s.eachSeries(t,function(t,i){r(e,t,function(t,r){e=r,i(t)})},function(t){i(t,e)})},s.inject=s.reduce,s.foldl=s.reduce,s.reduceRight=function(t,e,r,i){var n=u(t,function(t){return t}).reverse();s.reduce(n,e,r,i)},s.foldr=s.reduceRight;var x=function(t,e,r,i){var n=[];e=u(e,function(t,e){return{index:e,value:t}}),t(e,function(t,e){r(t.value,function(r){r&&n.push(t),e()})},function(t){i(u(n.sort(function(t,e){return t.index-e.index}),function(t){return t.value}))})};s.filter=f(x),s.filterSeries=g(x),s.select=s.filter,s.selectSeries=s.filterSeries;var b=function(t,e,r,i){var n=[];e=u(e,function(t,e){return{index:e,value:t}}),t(e,function(t,e){r(t.value,function(r){r||n.push(t),e()})},function(t){i(u(n.sort(function(t,e){return t.index-e.index}),function(t){return t.value}))})};s.reject=f(b),s.rejectSeries=g(b);var _=function(t,e,r,i){t(e,function(t,e){r(t,function(r){r?(i(t),i=function(){}):e()})},function(t){i()})};s.detect=f(_),s.detectSeries=g(_),s.some=function(t,e,r){s.each(t,function(t,i){e(t,function(t){t&&(r(!0),r=function(){}),i()})},function(t){r(!1)})},s.any=s.some,s.every=function(t,e,r){s.each(t,function(t,i){e(t,function(t){t||(r(!1),r=function(){}),i()})},function(t){r(!0)})},s.all=s.every,s.sortBy=function(t,e,r){s.map(t,function(t,r){e(t,function(e,i){e?r(e):r(null,{value:t,criteria:i})})},function(t,e){if(t)return r(t);var i=function(t,e){var r=t.criteria,i=e.criteria;return i>r?-1:r>i?1:0};r(null,u(e.sort(i),function(t){return t.value}))})},s.auto=function(t,e){e=e||function(){};var r=p(t),i=r.length;if(!i)return e();var n={},o=[],a=function(t){o.unshift(t)},u=function(t){for(var e=0;e<o.length;e+=1)if(o[e]===t)return void o.splice(e,1)},d=function(){i--,l(o.slice(0),function(t){t()})};a(function(){if(!i){var t=e;e=function(){},t(null,n)}}),l(r,function(r){var i=h(t[r])?t[r]:[t[r]],o=function(t){var i=Array.prototype.slice.call(arguments,1);if(i.length<=1&&(i=i[0]),t){var o={};l(p(n),function(t){o[t]=n[t]}),o[r]=i,e(t,o),e=function(){}}else n[r]=i,s.setImmediate(d)},f=i.slice(0,Math.abs(i.length-1))||[],v=function(){return c(f,function(t,e){return t&&n.hasOwnProperty(e)},!0)&&!n.hasOwnProperty(r)};if(v())i[i.length-1](o,n);else{var g=function(){v()&&(u(g),i[i.length-1](o,n))};a(g)}})},s.retry=function(t,e,r){var i=5,n=[];"function"==typeof t&&(r=e,e=t,t=i),t=parseInt(t,10)||i;var o=function(i,o){for(var a=function(t,e){return function(r){t(function(t,i){r(!t||e,{err:t,result:i})},o)}};t;)n.push(a(e,!(t-=1)));s.series(n,function(t,e){e=e[e.length-1],(i||r)(e.err,e.result)})};return r?o():o},s.waterfall=function(t,e){if(e=e||function(){},!h(t)){var r=new Error("First argument to waterfall must be an array of functions");return e(r)}if(!t.length)return e();var i=function(t){return function(r){if(r)e.apply(null,arguments),e=function(){};else{var n=Array.prototype.slice.call(arguments,1),o=t.next();n.push(o?i(o):e),s.setImmediate(function(){t.apply(null,n)})}}};i(s.iterator(t))()};var T=function(t,e,r){if(r=r||function(){},h(e))t.map(e,function(t,e){t&&t(function(t){var r=Array.prototype.slice.call(arguments,1);r.length<=1&&(r=r[0]),e.call(null,t,r)})},r);else{var i={};t.each(p(e),function(t,r){e[t](function(e){var n=Array.prototype.slice.call(arguments,1);n.length<=1&&(n=n[0]),i[t]=n,r(e)})},function(t){r(t,i)})}};s.parallel=function(t,e){T({map:s.map,each:s.each},t,e)},s.parallelLimit=function(t,e,r){T({map:y(e),each:d(e)},t,r)},s.series=function(t,e){if(e=e||function(){},h(t))s.mapSeries(t,function(t,e){t&&t(function(t){var r=Array.prototype.slice.call(arguments,1);r.length<=1&&(r=r[0]),e.call(null,t,r)})},e);else{var r={};s.eachSeries(p(t),function(e,i){t[e](function(t){var n=Array.prototype.slice.call(arguments,1);n.length<=1&&(n=n[0]),r[e]=n,i(t)})},function(t){e(t,r)})}},s.iterator=function(t){var e=function(r){var i=function(){return t.length&&t[r].apply(null,arguments),i.next()};return i.next=function(){return r<t.length-1?e(r+1):null},i};return e(0)},s.apply=function(t){var e=Array.prototype.slice.call(arguments,1);return function(){return t.apply(null,e.concat(Array.prototype.slice.call(arguments)))}};var E=function(t,e,r,i){var n=[];t(e,function(t,e){r(t,function(t,r){n=n.concat(r||[]),e(t)})},function(t){i(t,n)})};s.concat=f(E),s.concatSeries=g(E),s.whilst=function(t,e,r){t()?e(function(i){return i?r(i):void s.whilst(t,e,r)}):r()},s.doWhilst=function(t,e,r){t(function(i){if(i)return r(i);var n=Array.prototype.slice.call(arguments,1);e.apply(null,n)?s.doWhilst(t,e,r):r()})},s.until=function(t,e,r){t()?r():e(function(i){return i?r(i):void s.until(t,e,r)})},s.doUntil=function(t,e,r){t(function(i){if(i)return r(i);var n=Array.prototype.slice.call(arguments,1);e.apply(null,n)?r():s.doUntil(t,e,r)})},s.queue=function(t,e){function r(t,e,r,i){return t.started||(t.started=!0),h(e)||(e=[e]),0==e.length?s.setImmediate(function(){t.drain&&t.drain()}):void l(e,function(e){var n={data:e,callback:"function"==typeof i?i:null};r?t.tasks.unshift(n):t.tasks.push(n),t.saturated&&t.tasks.length===t.concurrency&&t.saturated(),s.setImmediate(t.process)})}void 0===e&&(e=1);var n=0,o={tasks:[],concurrency:e,saturated:null,empty:null,drain:null,started:!1,paused:!1,push:function(t,e){r(o,t,!1,e)},kill:function(){o.drain=null,o.tasks=[]},unshift:function(t,e){r(o,t,!0,e)},process:function(){if(!o.paused&&n<o.concurrency&&o.tasks.length){var e=o.tasks.shift();o.empty&&0===o.tasks.length&&o.empty(),n+=1;var r=function(){n-=1,e.callback&&e.callback.apply(e,arguments),o.drain&&o.tasks.length+n===0&&o.drain(),o.process()},s=i(r);t(e.data,s)}},length:function(){return o.tasks.length},running:function(){return n},idle:function(){return o.tasks.length+n===0},pause:function(){o.paused!==!0&&(o.paused=!0,o.process())},resume:function(){o.paused!==!1&&(o.paused=!1,o.process())}};return o},s.priorityQueue=function(t,e){function r(t,e){return t.priority-e.priority}function i(t,e,r){for(var i=-1,n=t.length-1;n>i;){var o=i+(n-i+1>>>1);r(e,t[o])>=0?i=o:n=o-1}return i}function n(t,e,n,o){return t.started||(t.started=!0),h(e)||(e=[e]),0==e.length?s.setImmediate(function(){t.drain&&t.drain()}):void l(e,function(e){var a={data:e,priority:n,callback:"function"==typeof o?o:null};t.tasks.splice(i(t.tasks,a,r)+1,0,a),t.saturated&&t.tasks.length===t.concurrency&&t.saturated(),s.setImmediate(t.process)})}var o=s.queue(t,e);return o.push=function(t,e,r){n(o,t,e,r)},delete o.unshift,o},s.cargo=function(t,e){var r=!1,i=[],n={tasks:i,payload:e,saturated:null,empty:null,drain:null,drained:!0,push:function(t,r){h(t)||(t=[t]),l(t,function(t){i.push({data:t,callback:"function"==typeof r?r:null}),n.drained=!1,n.saturated&&i.length===e&&n.saturated()}),s.setImmediate(n.process)},process:function o(){if(!r){if(0===i.length)return n.drain&&!n.drained&&n.drain(),void(n.drained=!0);var s="number"==typeof e?i.splice(0,e):i.splice(0,i.length),a=u(s,function(t){return t.data});n.empty&&n.empty(),r=!0,t(a,function(){r=!1;var t=arguments;l(s,function(e){e.callback&&e.callback.apply(null,t)}),o()})}},length:function(){return i.length},running:function(){return r}};return n};var S=function(t){return function(e){var r=Array.prototype.slice.call(arguments,1);e.apply(null,r.concat([function(e){var r=Array.prototype.slice.call(arguments,1);"undefined"!=typeof console&&(e?console.error&&console.error(e):console[t]&&l(r,function(e){console[t](e)}))}]))}};s.log=S("log"),s.dir=S("dir"),s.memoize=function(t,e){var r={},i={};e=e||function(t){return t};var n=function(){var n=Array.prototype.slice.call(arguments),o=n.pop(),a=e.apply(null,n);a in r?s.nextTick(function(){o.apply(null,r[a])}):a in i?i[a].push(o):(i[a]=[o],t.apply(null,n.concat([function(){r[a]=arguments;var t=i[a];delete i[a];for(var e=0,n=t.length;n>e;e++)t[e].apply(null,arguments)}])))};return n.memo=r,n.unmemoized=t,n},s.unmemoize=function(t){return function(){return(t.unmemoized||t).apply(null,arguments)}},s.times=function(t,e,r){for(var i=[],n=0;t>n;n++)i.push(n);return s.map(i,e,r)},s.timesSeries=function(t,e,r){for(var i=[],n=0;t>n;n++)i.push(n);return s.mapSeries(i,e,r)},s.seq=function(){var t=arguments;return function(){var e=this,r=Array.prototype.slice.call(arguments),i=r.pop();s.reduce(t,r,function(t,r,i){r.apply(e,t.concat([function(){var t=arguments[0],e=Array.prototype.slice.call(arguments,1);i(t,e)}]))},function(t,r){i.apply(e,[t].concat(r))})}},s.compose=function(){return s.seq.apply(null,Array.prototype.reverse.call(arguments))};var A=function(t,e){var r=function(){var r=this,i=Array.prototype.slice.call(arguments),n=i.pop();return t(e,function(t,e){t.apply(r,i.concat([e]))},n)};if(arguments.length>2){var i=Array.prototype.slice.call(arguments,2);return r.apply(this,i)}return r};s.applyEach=f(A),s.applyEachSeries=g(A),s.forever=function(t,e){function r(i){if(i){if(e)return e(i);throw i}t(r)}r()},"undefined"!=typeof r&&r.exports?r.exports=s:"undefined"!=typeof t&&t.amd?t([],function(){return s}):n.async=s}()}).call(this,e("_process"))},{_process:4}],3:[function(t,e,r){(function(t){function e(t,e){for(var r=0,i=t.length-1;i>=0;i--){var n=t[i];"."===n?t.splice(i,1):".."===n?(t.splice(i,1),r++):r&&(t.splice(i,1),r--)}if(e)for(;r--;r)t.unshift("..");return t}function i(t,e){if(t.filter)return t.filter(e);for(var r=[],i=0;i<t.length;i++)e(t[i],i,t)&&r.push(t[i]);return r}var n=/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/,o=function(t){return n.exec(t).slice(1)};r.resolve=function(){for(var r="",n=!1,o=arguments.length-1;o>=-1&&!n;o--){var s=o>=0?arguments[o]:t.cwd();if("string"!=typeof s)throw new TypeError("Arguments to path.resolve must be strings");s&&(r=s+"/"+r,n="/"===s.charAt(0))}return r=e(i(r.split("/"),function(t){return!!t}),!n).join("/"),(n?"/":"")+r||"."},r.normalize=function(t){var n=r.isAbsolute(t),o="/"===s(t,-1);return t=e(i(t.split("/"),function(t){return!!t}),!n).join("/"),t||n||(t="."),t&&o&&(t+="/"),(n?"/":"")+t},r.isAbsolute=function(t){return"/"===t.charAt(0)},r.join=function(){var t=Array.prototype.slice.call(arguments,0);return r.normalize(i(t,function(t,e){if("string"!=typeof t)throw new TypeError("Arguments to path.join must be strings");return t}).join("/"))},r.relative=function(t,e){function i(t){for(var e=0;e<t.length&&""===t[e];e++);for(var r=t.length-1;r>=0&&""===t[r];r--);return e>r?[]:t.slice(e,r-e+1)}t=r.resolve(t).substr(1),e=r.resolve(e).substr(1);for(var n=i(t.split("/")),o=i(e.split("/")),s=Math.min(n.length,o.length),a=s,h=0;s>h;h++)if(n[h]!==o[h]){a=h;break}for(var l=[],h=a;h<n.length;h++)l.push("..");return l=l.concat(o.slice(a)),l.join("/")},r.sep="/",r.delimiter=":",r.dirname=function(t){var e=o(t),r=e[0],i=e[1];return r||i?(i&&(i=i.substr(0,i.length-1)),r+i):"."},r.basename=function(t,e){var r=o(t)[2];return e&&r.substr(-1*e.length)===e&&(r=r.substr(0,r.length-e.length)),r},r.extname=function(t){return o(t)[3]};var s="b"==="ab".substr(-1)?function(t,e,r){return t.substr(e,r)}:function(t,e,r){return 0>e&&(e=t.length+e),t.substr(e,r)}}).call(this,t("_process"))},{_process:4}],4:[function(t,e,r){function i(){if(!a){a=!0;for(var t,e=s.length;e;){t=s,s=[];for(var r=-1;++r<e;)t[r]();e=s.length}a=!1}}function n(){}var o=e.exports={},s=[],a=!1;o.nextTick=function(t){s.push(t),a||setTimeout(i,0)},o.title="browser",o.browser=!0,o.env={},o.argv=[],o.version="",o.versions={},o.on=n,o.addListener=n,o.once=n,o.off=n,o.removeListener=n,o.removeAllListeners=n,o.emit=n,o.binding=function(t){throw new Error("process.binding is not supported")},o.cwd=function(){return"/"},o.chdir=function(t){throw new Error("process.chdir is not supported")},o.umask=function(){return 0}},{}],5:[function(e,r,i){(function(e){!function(n){function o(t){throw RangeError(B[t])}function s(t,e){for(var r=t.length;r--;)t[r]=e(t[r]);return t}function a(t,e){return s(t.split(O),e).join(".")}function h(t){for(var e,r,i=[],n=0,o=t.length;o>n;)e=t.charCodeAt(n++),e>=55296&&56319>=e&&o>n?(r=t.charCodeAt(n++),56320==(64512&r)?i.push(((1023&e)<<10)+(1023&r)+65536):(i.push(e),n--)):i.push(e);return i}function l(t){return s(t,function(t){var e="";return t>65535&&(t-=65536,e+=N(t>>>10&1023|55296),t=56320|1023&t),e+=N(t)}).join("")}function u(t){return 10>t-48?t-22:26>t-65?t-65:26>t-97?t-97:E}function c(t,e){return t+22+75*(26>t)-((0!=e)<<5)}function p(t,e,r){var i=0;for(t=r?I(t/C):t>>1,t+=I(t/e);t>L*A>>1;i+=E)t=I(t/L);return I(i+(L+1)*t/(t+w))}function d(t){var e,r,i,n,s,a,h,c,d,f,v=[],g=t.length,m=0,y=R,x=M;for(r=t.lastIndexOf(D),0>r&&(r=0),i=0;r>i;++i)t.charCodeAt(i)>=128&&o("not-basic"),v.push(t.charCodeAt(i));for(n=r>0?r+1:0;g>n;){for(s=m,a=1,h=E;n>=g&&o("invalid-input"),c=u(t.charCodeAt(n++)),(c>=E||c>I((T-m)/a))&&o("overflow"),m+=c*a,d=x>=h?S:h>=x+A?A:h-x,!(d>c);h+=E)f=E-d,a>I(T/f)&&o("overflow"),a*=f;e=v.length+1,x=p(m-s,e,0==s),I(m/e)>T-y&&o("overflow"),y+=I(m/e),m%=e,v.splice(m++,0,y)}return l(v)}function f(t){var e,r,i,n,s,a,l,u,d,f,v,g,m,y,x,b=[];for(t=h(t),g=t.length,e=R,r=0,s=M,a=0;g>a;++a)v=t[a],128>v&&b.push(N(v));for(i=n=b.length,n&&b.push(D);g>i;){for(l=T,a=0;g>a;++a)v=t[a],v>=e&&l>v&&(l=v);for(m=i+1,l-e>I((T-r)/m)&&o("overflow"),r+=(l-e)*m,e=l,a=0;g>a;++a)if(v=t[a],e>v&&++r>T&&o("overflow"),v==e){for(u=r,d=E;f=s>=d?S:d>=s+A?A:d-s,!(f>u);d+=E)x=u-f,y=E-f,b.push(N(c(f+x%y,0))),u=I(x/y);b.push(N(c(u,0))),s=p(r,m,i==n),r=0,++i}++r,++e}return b.join("")}function v(t){return a(t,function(t){return F.test(t)?d(t.slice(4).toLowerCase()):t})}function g(t){return a(t,function(t){return P.test(t)?"xn--"+f(t):t})}var m="object"==typeof i&&i,y="object"==typeof r&&r&&r.exports==m&&r,x="object"==typeof e&&e;(x.global===x||x.window===x)&&(n=x);var b,_,T=2147483647,E=36,S=1,A=26,w=38,C=700,M=72,R=128,D="-",F=/^xn--/,P=/[^ -~]/,O=/\x2E|\u3002|\uFF0E|\uFF61/g,B={overflow:"Overflow: input needs wider integers to process","not-basic":"Illegal input >= 0x80 (not a basic code point)","invalid-input":"Invalid input"},L=E-S,I=Math.floor,N=String.fromCharCode;if(b={version:"1.2.4",ucs2:{decode:h,encode:l},decode:d,encode:f,toASCII:g,toUnicode:v},"function"==typeof t&&"object"==typeof t.amd&&t.amd)t("punycode",function(){return b});else if(m&&!m.nodeType)if(y)y.exports=b;else for(_ in b)b.hasOwnProperty(_)&&(m[_]=b[_]);else n.punycode=b}(this)}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],6:[function(t,e,r){"use strict";function i(t,e){return Object.prototype.hasOwnProperty.call(t,e)}e.exports=function(t,e,r,o){e=e||"&",r=r||"=";var s={};if("string"!=typeof t||0===t.length)return s;var a=/\+/g;t=t.split(e);var h=1e3;o&&"number"==typeof o.maxKeys&&(h=o.maxKeys);var l=t.length;h>0&&l>h&&(l=h);for(var u=0;l>u;++u){var c,p,d,f,v=t[u].replace(a,"%20"),g=v.indexOf(r);g>=0?(c=v.substr(0,g),p=v.substr(g+1)):(c=v,p=""),d=decodeURIComponent(c),f=decodeURIComponent(p),i(s,d)?n(s[d])?s[d].push(f):s[d]=[s[d],f]:s[d]=f}return s};var n=Array.isArray||function(t){return"[object Array]"===Object.prototype.toString.call(t)}},{}],7:[function(t,e,r){"use strict";function i(t,e){if(t.map)return t.map(e);for(var r=[],i=0;i<t.length;i++)r.push(e(t[i],i));return r}var n=function(t){switch(typeof t){case"string":return t;case"boolean":return t?"true":"false";case"number":return isFinite(t)?t:"";default:return""}};e.exports=function(t,e,r,a){return e=e||"&",r=r||"=",null===t&&(t=void 0),"object"==typeof t?i(s(t),function(s){var a=encodeURIComponent(n(s))+r;return o(t[s])?i(t[s],function(t){return a+encodeURIComponent(n(t))}).join(e):a+encodeURIComponent(n(t[s]))}).join(e):a?encodeURIComponent(n(a))+r+encodeURIComponent(n(t)):""};var o=Array.isArray||function(t){return"[object Array]"===Object.prototype.toString.call(t)},s=Object.keys||function(t){var e=[];for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&e.push(r);return e}},{}],8:[function(t,e,r){"use strict";r.decode=r.parse=t("./decode"),r.encode=r.stringify=t("./encode")},{"./decode":6,"./encode":7}],9:[function(t,e,r){function i(){this.protocol=null,this.slashes=null,this.auth=null,this.host=null,this.port=null,this.hostname=null,this.hash=null,this.search=null,this.query=null,this.pathname=null,this.path=null,this.href=null}function n(t,e,r){if(t&&l(t)&&t instanceof i)return t;var n=new i;return n.parse(t,e,r),n}function o(t){return h(t)&&(t=n(t)),t instanceof i?t.format():i.prototype.format.call(t)}function s(t,e){return n(t,!1,!0).resolve(e)}function a(t,e){return t?n(t,!1,!0).resolveObject(e):e}function h(t){return"string"==typeof t}function l(t){return"object"==typeof t&&null!==t}function u(t){return null===t}function c(t){return null==t}var p=t("punycode");r.parse=n,r.resolve=s,r.resolveObject=a,r.format=o,r.Url=i;var d=/^([a-z0-9.+-]+:)/i,f=/:[0-9]*$/,v=["<",">",'"',"`"," ","\r","\n","	"],g=["{","}","|","\\","^","`"].concat(v),m=["'"].concat(g),y=["%","/","?",";","#"].concat(m),x=["/","?","#"],b=255,_=/^[a-z0-9A-Z_-]{0,63}$/,T=/^([a-z0-9A-Z_-]{0,63})(.*)$/,E={javascript:!0,"javascript:":!0},S={javascript:!0,"javascript:":!0},A={http:!0,https:!0,ftp:!0,gopher:!0,file:!0,"http:":!0,"https:":!0,"ftp:":!0,"gopher:":!0,"file:":!0},w=t("querystring");i.prototype.parse=function(t,e,r){if(!h(t))throw new TypeError("Parameter 'url' must be a string, not "+typeof t);var i=t;i=i.trim();var n=d.exec(i);if(n){n=n[0];var o=n.toLowerCase();this.protocol=o,i=i.substr(n.length)}if(r||n||i.match(/^\/\/[^@\/]+@[^@\/]+/)){var s="//"===i.substr(0,2);!s||n&&S[n]||(i=i.substr(2),this.slashes=!0)}if(!S[n]&&(s||n&&!A[n])){for(var a=-1,l=0;l<x.length;l++){var u=i.indexOf(x[l]);-1!==u&&(-1===a||a>u)&&(a=u)}var c,f;f=-1===a?i.lastIndexOf("@"):i.lastIndexOf("@",a),-1!==f&&(c=i.slice(0,f),i=i.slice(f+1),this.auth=decodeURIComponent(c)),a=-1;for(var l=0;l<y.length;l++){var u=i.indexOf(y[l]);-1!==u&&(-1===a||a>u)&&(a=u)}-1===a&&(a=i.length),this.host=i.slice(0,a),i=i.slice(a),this.parseHost(),this.hostname=this.hostname||"";var v="["===this.hostname[0]&&"]"===this.hostname[this.hostname.length-1];if(!v)for(var g=this.hostname.split(/\./),l=0,C=g.length;C>l;l++){var M=g[l];if(M&&!M.match(_)){for(var R="",D=0,F=M.length;F>D;D++)R+=M.charCodeAt(D)>127?"x":M[D];if(!R.match(_)){var P=g.slice(0,l),O=g.slice(l+1),B=M.match(T);B&&(P.push(B[1]),O.unshift(B[2])),O.length&&(i="/"+O.join(".")+i),this.hostname=P.join(".");break}}}if(this.hostname=this.hostname.length>b?"":this.hostname.toLowerCase(),!v){for(var L=this.hostname.split("."),I=[],l=0;l<L.length;++l){var N=L[l];I.push(N.match(/[^A-Za-z0-9_-]/)?"xn--"+p.encode(N):N)}this.hostname=I.join(".")}var U=this.port?":"+this.port:"",k=this.hostname||"";this.host=k+U,this.href+=this.host,v&&(this.hostname=this.hostname.substr(1,this.hostname.length-2),"/"!==i[0]&&(i="/"+i))}if(!E[o])for(var l=0,C=m.length;C>l;l++){var j=m[l],X=encodeURIComponent(j);X===j&&(X=escape(j)),i=i.split(j).join(X)}var G=i.indexOf("#");-1!==G&&(this.hash=i.substr(G),i=i.slice(0,G));var Y=i.indexOf("?");if(-1!==Y?(this.search=i.substr(Y),this.query=i.substr(Y+1),e&&(this.query=w.parse(this.query)),i=i.slice(0,Y)):e&&(this.search="",this.query={}),i&&(this.pathname=i),A[o]&&this.hostname&&!this.pathname&&(this.pathname="/"),this.pathname||this.search){var U=this.pathname||"",N=this.search||"";this.path=U+N}return this.href=this.format(),this},i.prototype.format=function(){var t=this.auth||"";t&&(t=encodeURIComponent(t),t=t.replace(/%3A/i,":"),t+="@");var e=this.protocol||"",r=this.pathname||"",i=this.hash||"",n=!1,o="";this.host?n=t+this.host:this.hostname&&(n=t+(-1===this.hostname.indexOf(":")?this.hostname:"["+this.hostname+"]"),this.port&&(n+=":"+this.port)),this.query&&l(this.query)&&Object.keys(this.query).length&&(o=w.stringify(this.query));var s=this.search||o&&"?"+o||"";return e&&":"!==e.substr(-1)&&(e+=":"),this.slashes||(!e||A[e])&&n!==!1?(n="//"+(n||""),r&&"/"!==r.charAt(0)&&(r="/"+r)):n||(n=""),i&&"#"!==i.charAt(0)&&(i="#"+i),s&&"?"!==s.charAt(0)&&(s="?"+s),r=r.replace(/[?#]/g,function(t){return encodeURIComponent(t)}),s=s.replace("#","%23"),e+n+r+s+i},i.prototype.resolve=function(t){return this.resolveObject(n(t,!1,!0)).format()},i.prototype.resolveObject=function(t){if(h(t)){var e=new i;e.parse(t,!1,!0),t=e}var r=new i;if(Object.keys(this).forEach(function(t){r[t]=this[t]},this),r.hash=t.hash,""===t.href)return r.href=r.format(),r;if(t.slashes&&!t.protocol)return Object.keys(t).forEach(function(e){"protocol"!==e&&(r[e]=t[e])}),A[r.protocol]&&r.hostname&&!r.pathname&&(r.path=r.pathname="/"),r.href=r.format(),r;if(t.protocol&&t.protocol!==r.protocol){if(!A[t.protocol])return Object.keys(t).forEach(function(e){r[e]=t[e]}),r.href=r.format(),r;if(r.protocol=t.protocol,t.host||S[t.protocol])r.pathname=t.pathname;else{for(var n=(t.pathname||"").split("/");n.length&&!(t.host=n.shift()););t.host||(t.host=""),t.hostname||(t.hostname=""),""!==n[0]&&n.unshift(""),n.length<2&&n.unshift(""),r.pathname=n.join("/")}if(r.search=t.search,r.query=t.query,r.host=t.host||"",r.auth=t.auth,r.hostname=t.hostname||t.host,r.port=t.port,r.pathname||r.search){var o=r.pathname||"",s=r.search||"";r.path=o+s}return r.slashes=r.slashes||t.slashes,r.href=r.format(),r}var a=r.pathname&&"/"===r.pathname.charAt(0),l=t.host||t.pathname&&"/"===t.pathname.charAt(0),p=l||a||r.host&&t.pathname,d=p,f=r.pathname&&r.pathname.split("/")||[],n=t.pathname&&t.pathname.split("/")||[],v=r.protocol&&!A[r.protocol];if(v&&(r.hostname="",r.port=null,r.host&&(""===f[0]?f[0]=r.host:f.unshift(r.host)),r.host="",t.protocol&&(t.hostname=null,t.port=null,t.host&&(""===n[0]?n[0]=t.host:n.unshift(t.host)),t.host=null),p=p&&(""===n[0]||""===f[0])),l)r.host=t.host||""===t.host?t.host:r.host,r.hostname=t.hostname||""===t.hostname?t.hostname:r.hostname,r.search=t.search,r.query=t.query,f=n;else if(n.length)f||(f=[]),f.pop(),f=f.concat(n),r.search=t.search,r.query=t.query;else if(!c(t.search)){if(v){r.hostname=r.host=f.shift();var g=r.host&&r.host.indexOf("@")>0?r.host.split("@"):!1;g&&(r.auth=g.shift(),r.host=r.hostname=g.shift())}return r.search=t.search,r.query=t.query,u(r.pathname)&&u(r.search)||(r.path=(r.pathname?r.pathname:"")+(r.search?r.search:"")),r.href=r.format(),r}if(!f.length)return r.pathname=null,r.path=r.search?"/"+r.search:null,r.href=r.format(),r;for(var m=f.slice(-1)[0],y=(r.host||t.host)&&("."===m||".."===m)||""===m,x=0,b=f.length;b>=0;b--)m=f[b],"."==m?f.splice(b,1):".."===m?(f.splice(b,1),x++):x&&(f.splice(b,1),x--);if(!p&&!d)for(;x--;x)f.unshift("..");!p||""===f[0]||f[0]&&"/"===f[0].charAt(0)||f.unshift(""),y&&"/"!==f.join("/").substr(-1)&&f.push("");var _=""===f[0]||f[0]&&"/"===f[0].charAt(0);if(v){r.hostname=r.host=_?"":f.length?f.shift():"";var g=r.host&&r.host.indexOf("@")>0?r.host.split("@"):!1;g&&(r.auth=g.shift(),r.host=r.hostname=g.shift())}return p=p||r.host&&f.length,p&&!_&&f.unshift(""),f.length?r.pathname=f.join("/"):(r.pathname=null,r.path=null),u(r.pathname)&&u(r.search)||(r.path=(r.pathname?r.pathname:"")+(r.search?r.search:"")),r.auth=t.auth||r.auth,r.slashes=r.slashes||t.slashes,r.href=r.format(),r},i.prototype.parseHost=function(){var t=this.host,e=f.exec(t);e&&(e=e[0],":"!==e&&(this.port=e.substr(1)),t=t.substr(0,t.length-e.length)),t&&(this.hostname=t)}},{punycode:5,querystring:8}],10:[function(t,e,r){"use strict";function i(t,e,r){r=r||2;var i=e&&e.length,a=i?e[0]*r:t.length,h=o(t,n(t,0,a,r,!0)),l=[];if(!h)return l;var c,p,d,f,v,g,m;if(i&&(h=u(t,e,h,r)),t.length>80*r){c=d=t[0],p=f=t[1];for(var y=r;a>y;y+=r)v=t[y],g=t[y+1],c>v&&(c=v),p>g&&(p=g),v>d&&(d=v),g>f&&(f=g);m=Math.max(d-c,f-p)}return s(t,h,l,r,c,p,m),l}function n(t,e,r,i,n){var o,s,a,h=0;for(o=e,s=r-i;r>o;o+=i)h+=(t[s]-t[o])*(t[o+1]+t[s+1]),s=o;if(n===h>0)for(o=e;r>o;o+=i)a=A(o,a);else for(o=r-i;o>=e;o-=i)a=A(o,a);return a}function o(t,e,r){r||(r=e);var i,n=e;do if(i=!1,x(t,n.i,n.next.i)||0===y(t,n.prev.i,n.i,n.next.i)){if(n.prev.next=n.next,n.next.prev=n.prev,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ),n=r=n.prev,n===n.next)return null;i=!0}else n=n.next;while(i||n!==r);return r}function s(t,e,r,i,n,u,c,p){if(e){p||void 0===n||d(t,e,n,u,c);for(var f,v,g=e;e.prev!==e.next;)if(f=e.prev,v=e.next,a(t,e,n,u,c))r.push(f.i/i),r.push(e.i/i),r.push(v.i/i),v.prev=f,f.next=v,e.prevZ&&(e.prevZ.nextZ=e.nextZ),e.nextZ&&(e.nextZ.prevZ=e.prevZ),e=v.next,g=v.next;else if(e=v,e===g){p?1===p?(e=h(t,e,r,i),s(t,e,r,i,n,u,c,2)):2===p&&l(t,e,r,i,n,u,c):s(t,o(t,e),r,i,n,u,c,1);break}}}function a(t,e,r,i,n){var o=e.prev.i,s=e.i,a=e.next.i,h=t[o],l=t[o+1],u=t[s],c=t[s+1],p=t[a],d=t[a+1],f=h*c-l*u,g=h*d-l*p,m=p*c-d*u,y=f-g-m;if(0>=y)return!1;var x,b,_,T,E,S,A,w=d-l,C=h-p,M=l-c,R=u-h;if(void 0!==r){var D=u>h?p>h?h:p:p>u?u:p,F=c>l?d>l?l:d:d>c?c:d,P=h>u?h>p?h:p:u>p?u:p,O=l>c?l>d?l:d:c>d?c:d,B=v(D,F,r,i,n),L=v(P,O,r,i,n);for(A=e.nextZ;A&&A.z<=L;)if(x=A.i,A=A.nextZ,x!==o&&x!==a&&(b=t[x],_=t[x+1],T=w*b+C*_-g,T>=0&&(E=M*b+R*_+f,E>=0&&(S=y-T-E,S>=0&&(T&&E||T&&S||E&&S)))))return!1;for(A=e.prevZ;A&&A.z>=B;)if(x=A.i,A=A.prevZ,x!==o&&x!==a&&(b=t[x],_=t[x+1],T=w*b+C*_-g,T>=0&&(E=M*b+R*_+f,E>=0&&(S=y-T-E,S>=0&&(T&&E||T&&S||E&&S)))))return!1}else for(A=e.next.next;A!==e.prev;)if(x=A.i,A=A.next,b=t[x],_=t[x+1],T=w*b+C*_-g,T>=0&&(E=M*b+R*_+f,E>=0&&(S=y-T-E,S>=0&&(T&&E||T&&S||E&&S))))return!1;return!0}function h(t,e,r,i){var n=e;do{var o=n.prev,s=n.next.next;if(o.i!==s.i&&b(t,o.i,n.i,n.next.i,s.i)&&T(t,o,s)&&T(t,s,o)){r.push(o.i/i),r.push(n.i/i),r.push(s.i/i),o.next=s,s.prev=o;var a=n.prevZ,h=n.nextZ&&n.nextZ.nextZ;a&&(a.nextZ=h),h&&(h.prevZ=a),n=e=s}n=n.next}while(n!==e);return n}function l(t,e,r,i,n,a,h){var l=e;do{for(var u=l.next.next;u!==l.prev;){if(l.i!==u.i&&m(t,l,u)){var c=S(l,u);return l=o(t,l,l.next),c=o(t,c,c.next),s(t,l,r,i,n,a,h),void s(t,c,r,i,n,a,h)}u=u.next}l=l.next}while(l!==e)}function u(t,e,r,i){var s,a,h,l,u,p=[];for(s=0,a=e.length;a>s;s++)h=e[s]*i,l=a-1>s?e[s+1]*i:t.length,u=o(t,n(t,h,l,i,!1)),u&&p.push(g(t,u));for(p.sort(function(e,r){return t[e.i]-t[r.i]}),s=0;s<p.length;s++)c(t,p[s],r),r=o(t,r,r.next);return r}function c(t,e,r){if(r=p(t,e,r)){var i=S(r,e);o(t,i,i.next)}}function p(t,e,r){var i,n,o,s=r,a=e.i,h=t[a],l=t[a+1],u=-(1/0);do{if(n=s.i,o=s.next.i,l<=t[n+1]&&l>=t[o+1]){var c=t[n]+(l-t[n+1])*(t[o]-t[n])/(t[o+1]-t[n+1]);h>=c&&c>u&&(u=c,i=t[n]<t[o]?s:s.next)}s=s.next}while(s!==r);if(!i)return null;var p,d,f,v,g,m,y=t[i.i],x=t[i.i+1],b=h*x-l*y,_=h*l-l*u,E=l-l,S=h-u,A=l-x,w=y-h,C=b-_-(u*x-l*y),M=0>=C?-1:1,R=i,D=1/0;for(s=i.next;s!==R;)p=t[s.i],d=t[s.i+1],f=h-p,f>=0&&p>=y&&(v=(E*p+S*d-_)*M,v>=0&&(g=(A*p+w*d+b)*M,g>=0&&C*M-v-g>=0&&(m=Math.abs(l-d)/f,D>m&&T(t,s,e)&&(i=s,D=m)))),s=s.next;return i}function d(t,e,r,i,n){var o=e;do null===o.z&&(o.z=v(t[o.i],t[o.i+1],r,i,n)),o.prevZ=o.prev,o.nextZ=o.next,o=o.next;while(o!==e);o.prevZ.nextZ=null,o.prevZ=null,f(o)}function f(t){var e,r,i,n,o,s,a,h,l=1;do{for(r=t,t=null,o=null,s=0;r;){for(s++,i=r,a=0,e=0;l>e&&(a++,i=i.nextZ,i);e++);for(h=l;a>0||h>0&&i;)0===a?(n=i,i=i.nextZ,h--):0!==h&&i?r.z<=i.z?(n=r,r=r.nextZ,a--):(n=i,i=i.nextZ,h--):(n=r,r=r.nextZ,a--),o?o.nextZ=n:t=n,n.prevZ=o,o=n;r=i}o.nextZ=null,l*=2}while(s>1);return t}function v(t,e,r,i,n){return t=1e3*(t-r)/n,t=16711935&(t|t<<8),t=252645135&(t|t<<4),t=858993459&(t|t<<2),t=1431655765&(t|t<<1),e=1e3*(e-i)/n,e=16711935&(e|e<<8),e=252645135&(e|e<<4),e=858993459&(e|e<<2),e=1431655765&(e|e<<1),t|e<<1}function g(t,e){var r=e,i=e;do t[r.i]<t[i.i]&&(i=r),r=r.next;while(r!==e);return i}function m(t,e,r){return!_(t,e,e.i,r.i)&&T(t,e,r)&&T(t,r,e)&&E(t,e,e.i,r.i)}function y(t,e,r,i){var n=(t[r+1]-t[e+1])*(t[i]-t[r])-(t[r]-t[e])*(t[i+1]-t[r+1]);return n>0?1:0>n?-1:0}function x(t,e,r){return t[e]===t[r]&&t[e+1]===t[r+1]}function b(t,e,r,i,n){return y(t,e,r,i)!==y(t,e,r,n)&&y(t,i,n,e)!==y(t,i,n,r)}function _(t,e,r,i){var n=e;do{var o=n.i,s=n.next.i;if(o!==r&&s!==r&&o!==i&&s!==i&&b(t,o,s,r,i))return!0;n=n.next}while(n!==e);return!1}function T(t,e,r){return-1===y(t,e.prev.i,e.i,e.next.i)?-1!==y(t,e.i,r.i,e.next.i)&&-1!==y(t,e.i,e.prev.i,r.i):-1===y(t,e.i,r.i,e.prev.i)||-1===y(t,e.i,e.next.i,r.i)}function E(t,e,r,i){var n=e,o=!1,s=(t[r]+t[i])/2,a=(t[r+1]+t[i+1])/2;do{var h=n.i,l=n.next.i;t[h+1]>a!=t[l+1]>a&&s<(t[l]-t[h])*(a-t[h+1])/(t[l+1]-t[h+1])+t[h]&&(o=!o),n=n.next}while(n!==e);return o}function S(t,e){var r=new w(t.i),i=new w(e.i),n=t.next,o=e.prev;return t.next=e,e.prev=t,r.next=n,n.prev=r,i.next=r,r.prev=i,o.next=i,i.prev=o,i}function A(t,e){var r=new w(t);return e?(r.next=e.next,r.prev=e,e.next.prev=r,e.next=r):(r.prev=r,r.next=r),r}function w(t){
this.i=t,this.prev=null,this.next=null,this.z=null,this.prevZ=null,this.nextZ=null}e.exports=i},{}],11:[function(t,e,r){"use strict";function i(t,e,r){this.fn=t,this.context=e,this.once=r||!1}function n(){}var o="function"!=typeof Object.create?"~":!1;n.prototype._events=void 0,n.prototype.listeners=function(t,e){var r=o?o+t:t,i=this._events&&this._events[r];if(e)return!!i;if(!i)return[];if(this._events[r].fn)return[this._events[r].fn];for(var n=0,s=this._events[r].length,a=new Array(s);s>n;n++)a[n]=this._events[r][n].fn;return a},n.prototype.emit=function(t,e,r,i,n,s){var a=o?o+t:t;if(!this._events||!this._events[a])return!1;var h,l,u=this._events[a],c=arguments.length;if("function"==typeof u.fn){switch(u.once&&this.removeListener(t,u.fn,void 0,!0),c){case 1:return u.fn.call(u.context),!0;case 2:return u.fn.call(u.context,e),!0;case 3:return u.fn.call(u.context,e,r),!0;case 4:return u.fn.call(u.context,e,r,i),!0;case 5:return u.fn.call(u.context,e,r,i,n),!0;case 6:return u.fn.call(u.context,e,r,i,n,s),!0}for(l=1,h=new Array(c-1);c>l;l++)h[l-1]=arguments[l];u.fn.apply(u.context,h)}else{var p,d=u.length;for(l=0;d>l;l++)switch(u[l].once&&this.removeListener(t,u[l].fn,void 0,!0),c){case 1:u[l].fn.call(u[l].context);break;case 2:u[l].fn.call(u[l].context,e);break;case 3:u[l].fn.call(u[l].context,e,r);break;default:if(!h)for(p=1,h=new Array(c-1);c>p;p++)h[p-1]=arguments[p];u[l].fn.apply(u[l].context,h)}}return!0},n.prototype.on=function(t,e,r){var n=new i(e,r||this),s=o?o+t:t;return this._events||(this._events=o?{}:Object.create(null)),this._events[s]?this._events[s].fn?this._events[s]=[this._events[s],n]:this._events[s].push(n):this._events[s]=n,this},n.prototype.once=function(t,e,r){var n=new i(e,r||this,!0),s=o?o+t:t;return this._events||(this._events=o?{}:Object.create(null)),this._events[s]?this._events[s].fn?this._events[s]=[this._events[s],n]:this._events[s].push(n):this._events[s]=n,this},n.prototype.removeListener=function(t,e,r,i){var n=o?o+t:t;if(!this._events||!this._events[n])return this;var s=this._events[n],a=[];if(e)if(s.fn)(s.fn!==e||i&&!s.once||r&&s.context!==r)&&a.push(s);else for(var h=0,l=s.length;l>h;h++)(s[h].fn!==e||i&&!s[h].once||r&&s[h].context!==r)&&a.push(s[h]);return a.length?this._events[n]=1===a.length?a[0]:a:delete this._events[n],this},n.prototype.removeAllListeners=function(t){return this._events?(t?delete this._events[o?o+t:t]:this._events=o?{}:Object.create(null),this):this},n.prototype.off=n.prototype.removeListener,n.prototype.addListener=n.prototype.on,n.prototype.setMaxListeners=function(){return this},n.prefixed=o,e.exports=n},{}],12:[function(t,e,r){"use strict";function i(t){if(null==t)throw new TypeError("Object.assign cannot be called with null or undefined");return Object(t)}e.exports=Object.assign||function(t,e){for(var r,n,o=i(t),s=1;s<arguments.length;s++){r=arguments[s],n=Object.keys(Object(r));for(var a=0;a<n.length;a++)o[n[a]]=r[n[a]]}return o}},{}],13:[function(e,r,i){(function(e){!function(){function i(t){var e=!1;return function(){if(e)throw new Error("Callback was already called.");e=!0,t.apply(n,arguments)}}var n,o,s={};n=this,null!=n&&(o=n.async),s.noConflict=function(){return n.async=o,s};var a=Object.prototype.toString,h=Array.isArray||function(t){return"[object Array]"===a.call(t)},l=function(t,e){if(t.forEach)return t.forEach(e);for(var r=0;r<t.length;r+=1)e(t[r],r,t)},u=function(t,e){if(t.map)return t.map(e);var r=[];return l(t,function(t,i,n){r.push(e(t,i,n))}),r},c=function(t,e,r){return t.reduce?t.reduce(e,r):(l(t,function(t,i,n){r=e(r,t,i,n)}),r)},p=function(t){if(Object.keys)return Object.keys(t);var e=[];for(var r in t)t.hasOwnProperty(r)&&e.push(r);return e};"undefined"!=typeof e&&e.nextTick?(s.nextTick=e.nextTick,s.setImmediate="undefined"!=typeof setImmediate?function(t){setImmediate(t)}:s.nextTick):"function"==typeof setImmediate?(s.nextTick=function(t){setImmediate(t)},s.setImmediate=s.nextTick):(s.nextTick=function(t){setTimeout(t,0)},s.setImmediate=s.nextTick),s.each=function(t,e,r){function n(e){e?(r(e),r=function(){}):(o+=1,o>=t.length&&r())}if(r=r||function(){},!t.length)return r();var o=0;l(t,function(t){e(t,i(n))})},s.forEach=s.each,s.eachSeries=function(t,e,r){if(r=r||function(){},!t.length)return r();var i=0,n=function(){e(t[i],function(e){e?(r(e),r=function(){}):(i+=1,i>=t.length?r():n())})};n()},s.forEachSeries=s.eachSeries,s.eachLimit=function(t,e,r,i){var n=d(e);n.apply(null,[t,r,i])},s.forEachLimit=s.eachLimit;var d=function(t){return function(e,r,i){if(i=i||function(){},!e.length||0>=t)return i();var n=0,o=0,s=0;!function a(){if(n>=e.length)return i();for(;t>s&&o<e.length;)o+=1,s+=1,r(e[o-1],function(t){t?(i(t),i=function(){}):(n+=1,s-=1,n>=e.length?i():a())})}()}},f=function(t){return function(){var e=Array.prototype.slice.call(arguments);return t.apply(null,[s.each].concat(e))}},v=function(t,e){return function(){var r=Array.prototype.slice.call(arguments);return e.apply(null,[d(t)].concat(r))}},g=function(t){return function(){var e=Array.prototype.slice.call(arguments);return t.apply(null,[s.eachSeries].concat(e))}},m=function(t,e,r,i){if(e=u(e,function(t,e){return{index:e,value:t}}),i){var n=[];t(e,function(t,e){r(t.value,function(r,i){n[t.index]=i,e(r)})},function(t){i(t,n)})}else t(e,function(t,e){r(t.value,function(t){e(t)})})};s.map=f(m),s.mapSeries=g(m),s.mapLimit=function(t,e,r,i){return y(e)(t,r,i)};var y=function(t){return v(t,m)};s.reduce=function(t,e,r,i){s.eachSeries(t,function(t,i){r(e,t,function(t,r){e=r,i(t)})},function(t){i(t,e)})},s.inject=s.reduce,s.foldl=s.reduce,s.reduceRight=function(t,e,r,i){var n=u(t,function(t){return t}).reverse();s.reduce(n,e,r,i)},s.foldr=s.reduceRight;var x=function(t,e,r,i){var n=[];e=u(e,function(t,e){return{index:e,value:t}}),t(e,function(t,e){r(t.value,function(r){r&&n.push(t),e()})},function(t){i(u(n.sort(function(t,e){return t.index-e.index}),function(t){return t.value}))})};s.filter=f(x),s.filterSeries=g(x),s.select=s.filter,s.selectSeries=s.filterSeries;var b=function(t,e,r,i){var n=[];e=u(e,function(t,e){return{index:e,value:t}}),t(e,function(t,e){r(t.value,function(r){r||n.push(t),e()})},function(t){i(u(n.sort(function(t,e){return t.index-e.index}),function(t){return t.value}))})};s.reject=f(b),s.rejectSeries=g(b);var _=function(t,e,r,i){t(e,function(t,e){r(t,function(r){r?(i(t),i=function(){}):e()})},function(t){i()})};s.detect=f(_),s.detectSeries=g(_),s.some=function(t,e,r){s.each(t,function(t,i){e(t,function(t){t&&(r(!0),r=function(){}),i()})},function(t){r(!1)})},s.any=s.some,s.every=function(t,e,r){s.each(t,function(t,i){e(t,function(t){t||(r(!1),r=function(){}),i()})},function(t){r(!0)})},s.all=s.every,s.sortBy=function(t,e,r){s.map(t,function(t,r){e(t,function(e,i){e?r(e):r(null,{value:t,criteria:i})})},function(t,e){if(t)return r(t);var i=function(t,e){var r=t.criteria,i=e.criteria;return i>r?-1:r>i?1:0};r(null,u(e.sort(i),function(t){return t.value}))})},s.auto=function(t,e){e=e||function(){};var r=p(t),i=r.length;if(!i)return e();var n={},o=[],a=function(t){o.unshift(t)},u=function(t){for(var e=0;e<o.length;e+=1)if(o[e]===t)return void o.splice(e,1)},d=function(){i--,l(o.slice(0),function(t){t()})};a(function(){if(!i){var t=e;e=function(){},t(null,n)}}),l(r,function(r){var i=h(t[r])?t[r]:[t[r]],o=function(t){var i=Array.prototype.slice.call(arguments,1);if(i.length<=1&&(i=i[0]),t){var o={};l(p(n),function(t){o[t]=n[t]}),o[r]=i,e(t,o),e=function(){}}else n[r]=i,s.setImmediate(d)},f=i.slice(0,Math.abs(i.length-1))||[],v=function(){return c(f,function(t,e){return t&&n.hasOwnProperty(e)},!0)&&!n.hasOwnProperty(r)};if(v())i[i.length-1](o,n);else{var g=function(){v()&&(u(g),i[i.length-1](o,n))};a(g)}})},s.retry=function(t,e,r){var i=5,n=[];"function"==typeof t&&(r=e,e=t,t=i),t=parseInt(t,10)||i;var o=function(i,o){for(var a=function(t,e){return function(r){t(function(t,i){r(!t||e,{err:t,result:i})},o)}};t;)n.push(a(e,!(t-=1)));s.series(n,function(t,e){e=e[e.length-1],(i||r)(e.err,e.result)})};return r?o():o},s.waterfall=function(t,e){if(e=e||function(){},!h(t)){var r=new Error("First argument to waterfall must be an array of functions");return e(r)}if(!t.length)return e();var i=function(t){return function(r){if(r)e.apply(null,arguments),e=function(){};else{var n=Array.prototype.slice.call(arguments,1),o=t.next();n.push(o?i(o):e),s.setImmediate(function(){t.apply(null,n)})}}};i(s.iterator(t))()};var T=function(t,e,r){if(r=r||function(){},h(e))t.map(e,function(t,e){t&&t(function(t){var r=Array.prototype.slice.call(arguments,1);r.length<=1&&(r=r[0]),e.call(null,t,r)})},r);else{var i={};t.each(p(e),function(t,r){e[t](function(e){var n=Array.prototype.slice.call(arguments,1);n.length<=1&&(n=n[0]),i[t]=n,r(e)})},function(t){r(t,i)})}};s.parallel=function(t,e){T({map:s.map,each:s.each},t,e)},s.parallelLimit=function(t,e,r){T({map:y(e),each:d(e)},t,r)},s.series=function(t,e){if(e=e||function(){},h(t))s.mapSeries(t,function(t,e){t&&t(function(t){var r=Array.prototype.slice.call(arguments,1);r.length<=1&&(r=r[0]),e.call(null,t,r)})},e);else{var r={};s.eachSeries(p(t),function(e,i){t[e](function(t){var n=Array.prototype.slice.call(arguments,1);n.length<=1&&(n=n[0]),r[e]=n,i(t)})},function(t){e(t,r)})}},s.iterator=function(t){var e=function(r){var i=function(){return t.length&&t[r].apply(null,arguments),i.next()};return i.next=function(){return r<t.length-1?e(r+1):null},i};return e(0)},s.apply=function(t){var e=Array.prototype.slice.call(arguments,1);return function(){return t.apply(null,e.concat(Array.prototype.slice.call(arguments)))}};var E=function(t,e,r,i){var n=[];t(e,function(t,e){r(t,function(t,r){n=n.concat(r||[]),e(t)})},function(t){i(t,n)})};s.concat=f(E),s.concatSeries=g(E),s.whilst=function(t,e,r){t()?e(function(i){return i?r(i):void s.whilst(t,e,r)}):r()},s.doWhilst=function(t,e,r){t(function(i){if(i)return r(i);var n=Array.prototype.slice.call(arguments,1);e.apply(null,n)?s.doWhilst(t,e,r):r()})},s.until=function(t,e,r){t()?r():e(function(i){return i?r(i):void s.until(t,e,r)})},s.doUntil=function(t,e,r){t(function(i){if(i)return r(i);var n=Array.prototype.slice.call(arguments,1);e.apply(null,n)?r():s.doUntil(t,e,r)})},s.queue=function(t,e){function r(t,e,r,i){return t.started||(t.started=!0),h(e)||(e=[e]),0==e.length?s.setImmediate(function(){t.drain&&t.drain()}):void l(e,function(e){var n={data:e,callback:"function"==typeof i?i:null};r?t.tasks.unshift(n):t.tasks.push(n),t.saturated&&t.tasks.length===t.concurrency&&t.saturated(),s.setImmediate(t.process)})}void 0===e&&(e=1);var n=0,o={tasks:[],concurrency:e,saturated:null,empty:null,drain:null,started:!1,paused:!1,push:function(t,e){r(o,t,!1,e)},kill:function(){o.drain=null,o.tasks=[]},unshift:function(t,e){r(o,t,!0,e)},process:function(){if(!o.paused&&n<o.concurrency&&o.tasks.length){var e=o.tasks.shift();o.empty&&0===o.tasks.length&&o.empty(),n+=1;var r=function(){n-=1,e.callback&&e.callback.apply(e,arguments),o.drain&&o.tasks.length+n===0&&o.drain(),o.process()},s=i(r);t(e.data,s)}},length:function(){return o.tasks.length},running:function(){return n},idle:function(){return o.tasks.length+n===0},pause:function(){o.paused!==!0&&(o.paused=!0,o.process())},resume:function(){o.paused!==!1&&(o.paused=!1,o.process())}};return o},s.priorityQueue=function(t,e){function r(t,e){return t.priority-e.priority}function i(t,e,r){for(var i=-1,n=t.length-1;n>i;){var o=i+(n-i+1>>>1);r(e,t[o])>=0?i=o:n=o-1}return i}function n(t,e,n,o){return t.started||(t.started=!0),h(e)||(e=[e]),0==e.length?s.setImmediate(function(){t.drain&&t.drain()}):void l(e,function(e){var a={data:e,priority:n,callback:"function"==typeof o?o:null};t.tasks.splice(i(t.tasks,a,r)+1,0,a),t.saturated&&t.tasks.length===t.concurrency&&t.saturated(),s.setImmediate(t.process)})}var o=s.queue(t,e);return o.push=function(t,e,r){n(o,t,e,r)},delete o.unshift,o},s.cargo=function(t,e){var r=!1,i=[],n={tasks:i,payload:e,saturated:null,empty:null,drain:null,drained:!0,push:function(t,r){h(t)||(t=[t]),l(t,function(t){i.push({data:t,callback:"function"==typeof r?r:null}),n.drained=!1,n.saturated&&i.length===e&&n.saturated()}),s.setImmediate(n.process)},process:function o(){if(!r){if(0===i.length)return n.drain&&!n.drained&&n.drain(),void(n.drained=!0);var s="number"==typeof e?i.splice(0,e):i.splice(0,i.length),a=u(s,function(t){return t.data});n.empty&&n.empty(),r=!0,t(a,function(){r=!1;var t=arguments;l(s,function(e){e.callback&&e.callback.apply(null,t)}),o()})}},length:function(){return i.length},running:function(){return r}};return n};var S=function(t){return function(e){var r=Array.prototype.slice.call(arguments,1);e.apply(null,r.concat([function(e){var r=Array.prototype.slice.call(arguments,1);"undefined"!=typeof console&&(e?console.error&&console.error(e):console[t]&&l(r,function(e){console[t](e)}))}]))}};s.log=S("log"),s.dir=S("dir"),s.memoize=function(t,e){var r={},i={};e=e||function(t){return t};var n=function(){var n=Array.prototype.slice.call(arguments),o=n.pop(),a=e.apply(null,n);a in r?s.nextTick(function(){o.apply(null,r[a])}):a in i?i[a].push(o):(i[a]=[o],t.apply(null,n.concat([function(){r[a]=arguments;var t=i[a];delete i[a];for(var e=0,n=t.length;n>e;e++)t[e].apply(null,arguments)}])))};return n.memo=r,n.unmemoized=t,n},s.unmemoize=function(t){return function(){return(t.unmemoized||t).apply(null,arguments)}},s.times=function(t,e,r){for(var i=[],n=0;t>n;n++)i.push(n);return s.map(i,e,r)},s.timesSeries=function(t,e,r){for(var i=[],n=0;t>n;n++)i.push(n);return s.mapSeries(i,e,r)},s.seq=function(){var t=arguments;return function(){var e=this,r=Array.prototype.slice.call(arguments),i=r.pop();s.reduce(t,r,function(t,r,i){r.apply(e,t.concat([function(){var t=arguments[0],e=Array.prototype.slice.call(arguments,1);i(t,e)}]))},function(t,r){i.apply(e,[t].concat(r))})}},s.compose=function(){return s.seq.apply(null,Array.prototype.reverse.call(arguments))};var A=function(t,e){var r=function(){var r=this,i=Array.prototype.slice.call(arguments),n=i.pop();return t(e,function(t,e){t.apply(r,i.concat([e]))},n)};if(arguments.length>2){var i=Array.prototype.slice.call(arguments,2);return r.apply(this,i)}return r};s.applyEach=f(A),s.applyEachSeries=g(A),s.forever=function(t,e){function r(i){if(i){if(e)return e(i);throw i}t(r)}r()},"undefined"!=typeof r&&r.exports?r.exports=s:"undefined"!=typeof t&&t.amd?t([],function(){return s}):n.async=s}()}).call(this,e("_process"))},{_process:4}],14:[function(t,e,r){arguments[4][11][0].apply(r,arguments)},{dup:11}],15:[function(t,e,r){function i(t,e){a.call(this),e=e||10,this.baseUrl=t||"",this.progress=0,this.loading=!1,this._progressChunk=0,this._beforeMiddleware=[],this._afterMiddleware=[],this._boundLoadResource=this._loadResource.bind(this),this._boundOnLoad=this._onLoad.bind(this),this._buffer=[],this._numToLoad=0,this._queue=n.queue(this._boundLoadResource,e),this.resources={}}var n=t("async"),o=t("url"),s=t("./Resource"),a=t("eventemitter3");i.prototype=Object.create(a.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.add=i.prototype.enqueue=function(t,e,r,i){if(Array.isArray(t)){for(var n=0;n<t.length;++n)this.add(t[n]);return this}if("object"==typeof t&&(i=e||t.callback||t.onComplete,r=t,e=t.url,t=t.name||t.key||t.url),"string"!=typeof e&&(i=r,r=e,e=t),"string"!=typeof e)throw new Error("No url passed to add resource to loader.");if("function"==typeof r&&(i=r,r=null),this.resources[t])throw new Error('Resource with name "'+t+'" already exists.');return e=this._handleBaseUrl(e),this.resources[t]=new s(t,e,r),"function"==typeof i&&this.resources[t].once("afterMiddleware",i),this._numToLoad++,this._queue.started?(this._queue.push(this.resources[t]),this._progressChunk=(100-this.progress)/(this._queue.length()+this._queue.running())):(this._buffer.push(this.resources[t]),this._progressChunk=100/this._buffer.length),this},i.prototype._handleBaseUrl=function(t){var e=o.parse(t);return e.protocol||0===e.pathname.indexOf("//")?t:this.baseUrl.length&&this.baseUrl.lastIndexOf("/")!==this.baseUrl.length-1&&t.lastIndexOf("/")!==t.length-1?this.baseUrl+"/"+t:this.baseUrl+t},i.prototype.before=i.prototype.pre=function(t){return this._beforeMiddleware.push(t),this},i.prototype.after=i.prototype.use=function(t){return this._afterMiddleware.push(t),this},i.prototype.reset=function(){this.progress=0,this.loading=!1,this._progressChunk=0,this._buffer.length=0,this._numToLoad=0,this._queue.kill(),this._queue.started=!1,this.resources={}},i.prototype.load=function(t){if("function"==typeof t&&this.once("complete",t),this._queue.started)return this;this.emit("start",this);for(var e=0;e<this._buffer.length;++e)this._queue.push(this._buffer[e]);return this._buffer.length=0,this},i.prototype._loadResource=function(t,e){var r=this;t._dequeue=e,this._runMiddleware(t,this._beforeMiddleware,function(){t.load(r._boundOnLoad)})},i.prototype._onComplete=function(){this.emit("complete",this,this.resources)},i.prototype._onLoad=function(t){this.progress+=this._progressChunk,this.emit("progress",this,t),t.error?this.emit("error",t.error,this,t):this.emit("load",this,t),this._runMiddleware(t,this._afterMiddleware,function(){t.emit("afterMiddleware",t),this._numToLoad--,0===this._numToLoad&&this._onComplete()}),t._dequeue()},i.prototype._runMiddleware=function(t,e,r){var i=this;n.eachSeries(e,function(e,r){e.call(i,t,r)},r.bind(this,t))},i.LOAD_TYPE=s.LOAD_TYPE,i.XHR_READY_STATE=s.XHR_READY_STATE,i.XHR_RESPONSE_TYPE=s.XHR_RESPONSE_TYPE},{"./Resource":16,async:13,eventemitter3:14,url:9}],16:[function(t,e,r){function i(t,e,r){if(s.call(this),r=r||{},"string"!=typeof t||"string"!=typeof e)throw new Error("Both name and url are required for constructing a resource.");this.name=t,this.url=e,this.isDataUrl=0===this.url.indexOf("data:"),this.data=null,this.crossOrigin=r.crossOrigin===!0?"anonymous":null,this.loadType=r.loadType||this._determineLoadType(),this.xhrType=r.xhrType,this.error=null,this.xhr=null,this.isJson=!1,this.isXml=!1,this.isImage=!1,this.isAudio=!1,this.isVideo=!1,this._dequeue=null,this._boundComplete=this.complete.bind(this),this._boundOnError=this._onError.bind(this),this._boundOnProgress=this._onProgress.bind(this),this._boundXhrOnError=this._xhrOnError.bind(this),this._boundXhrOnAbort=this._xhrOnAbort.bind(this),this._boundXhrOnLoad=this._xhrOnLoad.bind(this),this._boundXdrOnTimeout=this._xdrOnTimeout.bind(this)}function n(t){return t.toString().replace("object ","")}function o(t,e,r){e&&0===e.indexOf(".")&&(e=e.substring(1)),e&&(t[e]=r)}var s=t("eventemitter3"),a=t("url"),h=!(!window.XDomainRequest||"withCredentials"in new XMLHttpRequest),l=null;i.prototype=Object.create(s.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.complete=function(){this.data&&this.data.removeEventListener&&(this.data.removeEventListener("error",this._boundOnError),this.data.removeEventListener("load",this._boundComplete),this.data.removeEventListener("progress",this._boundOnProgress),this.data.removeEventListener("canplaythrough",this._boundComplete)),this.xhr&&(this.xhr.removeEventListener?(this.xhr.removeEventListener("error",this._boundXhrOnError),this.xhr.removeEventListener("abort",this._boundXhrOnAbort),this.xhr.removeEventListener("progress",this._boundOnProgress),this.xhr.removeEventListener("load",this._boundXhrOnLoad)):(this.xhr.onerror=null,this.xhr.ontimeout=null,this.xhr.onprogress=null,this.xhr.onload=null)),this.emit("complete",this)},i.prototype.load=function(t){switch(this.emit("start",this),t&&this.once("complete",t),"string"!=typeof this.crossOrigin&&(this.crossOrigin=this._determineCrossOrigin(this.url)),this.loadType){case i.LOAD_TYPE.IMAGE:this._loadImage();break;case i.LOAD_TYPE.AUDIO:this._loadElement("audio");break;case i.LOAD_TYPE.VIDEO:this._loadElement("video");break;case i.LOAD_TYPE.XHR:default:h&&this.crossOrigin?this._loadXdr():this._loadXhr()}},i.prototype._loadImage=function(){this.data=new Image,this.crossOrigin&&(this.data.crossOrigin=this.crossOrigin),this.data.src=this.url,this.isImage=!0,this.data.addEventListener("error",this._boundOnError,!1),this.data.addEventListener("load",this._boundComplete,!1),this.data.addEventListener("progress",this._boundOnProgress,!1)},i.prototype._loadElement=function(t){if(this.data=document.createElement(t),Array.isArray(this.url))for(var e=0;e<this.url.length;++e)this.data.appendChild(this._createSource(t,this.url[e]));else this.data.appendChild(this._createSource(t,this.url));this["is"+t[0].toUpperCase()+t.substring(1)]=!0,this.data.addEventListener("error",this._boundOnError,!1),this.data.addEventListener("load",this._boundComplete,!1),this.data.addEventListener("progress",this._boundOnProgress,!1),this.data.addEventListener("canplaythrough",this._boundComplete,!1),this.data.load()},i.prototype._loadXhr=function(){"string"!=typeof this.xhrType&&(this.xhrType=this._determineXhrType());var t=this.xhr=new XMLHttpRequest;t.open("GET",this.url,!0),t.responseType=this.xhrType===i.XHR_RESPONSE_TYPE.JSON||this.xhrType===i.XHR_RESPONSE_TYPE.DOCUMENT?i.XHR_RESPONSE_TYPE.TEXT:this.xhrType,t.addEventListener("error",this._boundXhrOnError,!1),t.addEventListener("abort",this._boundXhrOnAbort,!1),t.addEventListener("progress",this._boundOnProgress,!1),t.addEventListener("load",this._boundXhrOnLoad,!1),t.send()},i.prototype._loadXdr=function(){"string"!=typeof this.xhrType&&(this.xhrType=this._determineXhrType());var t=this.xhr=new XDomainRequest;t.timeout=5e3,t.onerror=this._boundXhrOnError,t.ontimeout=this._boundXdrOnTimeout,t.onprogress=this._boundOnProgress,t.onload=this._boundXhrOnLoad,t.open("GET",this.url,!0),setTimeout(function(){t.send()},0)},i.prototype._createSource=function(t,e,r){r||(r=t+"/"+e.substr(e.lastIndexOf(".")+1));var i=document.createElement("source");return i.src=e,i.type=r,i},i.prototype._onError=function(t){this.error=new Error("Failed to load element using "+t.target.nodeName),this.complete()},i.prototype._onProgress=function(t){t&&t.lengthComputable&&this.emit("progress",this,t.loaded/t.total)},i.prototype._xhrOnError=function(){this.error=new Error(n(this.xhr)+" Request failed. Status: "+this.xhr.status+', text: "'+this.xhr.statusText+'"'),this.complete()},i.prototype._xhrOnAbort=function(){this.error=new Error(n(this.xhr)+" Request was aborted by the user."),this.complete()},i.prototype._xdrOnTimeout=function(){this.error=new Error(n(this.xhr)+" Request timed out."),this.complete()},i.prototype._xhrOnLoad=function(){var t=this.xhr,e=void 0!==t.status?t.status:200;if(200===e||204===e||0===e&&t.responseText.length>0)if(this.xhrType===i.XHR_RESPONSE_TYPE.TEXT)this.data=t.responseText;else if(this.xhrType===i.XHR_RESPONSE_TYPE.JSON)try{this.data=JSON.parse(t.responseText),this.isJson=!0}catch(r){this.error=new Error("Error trying to parse loaded json:",r)}else if(this.xhrType===i.XHR_RESPONSE_TYPE.DOCUMENT)try{if(window.DOMParser){var n=new DOMParser;this.data=n.parseFromString(t.responseText,"text/xml")}else{var o=document.createElement("div");o.innerHTML=t.responseText,this.data=o}this.isXml=!0}catch(r){this.error=new Error("Error trying to parse loaded xml:",r)}else this.data=t.response||t.responseText;else this.error=new Error("["+t.status+"]"+t.statusText+":"+t.responseURL);this.complete()},i.prototype._determineCrossOrigin=function(t,e){if(0===t.indexOf("data:"))return"";e=e||window.location,l||(l=document.createElement("a")),l.href=t,t=a.parse(l.href);var r=!t.port&&""===e.port||t.port===e.port;return t.hostname===e.hostname&&r&&t.protocol===e.protocol?"":"anonymous"},i.prototype._determineXhrType=function(){return i._xhrTypeMap[this._getExtension()]||i.XHR_RESPONSE_TYPE.TEXT},i.prototype._determineLoadType=function(){return i._loadTypeMap[this._getExtension()]||i.LOAD_TYPE.XHR},i.prototype._getExtension=function(){var t,e=this.url;if(this.isDataUrl){var r=e.indexOf("/");t=e.substring(r+1,e.indexOf(";",r))}else{var i=e.indexOf("?");-1!==i&&(e=e.substring(0,i)),t=e.substring(e.lastIndexOf(".")+1)}return t},i.prototype._getMimeFromXhrType=function(t){switch(t){case i.XHR_RESPONSE_TYPE.BUFFER:return"application/octet-binary";case i.XHR_RESPONSE_TYPE.BLOB:return"application/blob";case i.XHR_RESPONSE_TYPE.DOCUMENT:return"application/xml";case i.XHR_RESPONSE_TYPE.JSON:return"application/json";case i.XHR_RESPONSE_TYPE.DEFAULT:case i.XHR_RESPONSE_TYPE.TEXT:default:return"text/plain"}},i.LOAD_TYPE={XHR:1,IMAGE:2,AUDIO:3,VIDEO:4},i.XHR_READY_STATE={UNSENT:0,OPENED:1,HEADERS_RECEIVED:2,LOADING:3,DONE:4},i.XHR_RESPONSE_TYPE={DEFAULT:"text",BUFFER:"arraybuffer",BLOB:"blob",DOCUMENT:"document",JSON:"json",TEXT:"text"},i._loadTypeMap={gif:i.LOAD_TYPE.IMAGE,png:i.LOAD_TYPE.IMAGE,bmp:i.LOAD_TYPE.IMAGE,jpg:i.LOAD_TYPE.IMAGE,jpeg:i.LOAD_TYPE.IMAGE,tif:i.LOAD_TYPE.IMAGE,tiff:i.LOAD_TYPE.IMAGE,webp:i.LOAD_TYPE.IMAGE,tga:i.LOAD_TYPE.IMAGE},i._xhrTypeMap={xhtml:i.XHR_RESPONSE_TYPE.DOCUMENT,html:i.XHR_RESPONSE_TYPE.DOCUMENT,htm:i.XHR_RESPONSE_TYPE.DOCUMENT,xml:i.XHR_RESPONSE_TYPE.DOCUMENT,tmx:i.XHR_RESPONSE_TYPE.DOCUMENT,tsx:i.XHR_RESPONSE_TYPE.DOCUMENT,svg:i.XHR_RESPONSE_TYPE.DOCUMENT,gif:i.XHR_RESPONSE_TYPE.BLOB,png:i.XHR_RESPONSE_TYPE.BLOB,bmp:i.XHR_RESPONSE_TYPE.BLOB,jpg:i.XHR_RESPONSE_TYPE.BLOB,jpeg:i.XHR_RESPONSE_TYPE.BLOB,tif:i.XHR_RESPONSE_TYPE.BLOB,tiff:i.XHR_RESPONSE_TYPE.BLOB,webp:i.XHR_RESPONSE_TYPE.BLOB,tga:i.XHR_RESPONSE_TYPE.BLOB,json:i.XHR_RESPONSE_TYPE.JSON,text:i.XHR_RESPONSE_TYPE.TEXT,txt:i.XHR_RESPONSE_TYPE.TEXT},i.setExtensionLoadType=function(t,e){o(i._loadTypeMap,t,e)},i.setExtensionXhrType=function(t,e){o(i._xhrTypeMap,t,e)}},{eventemitter3:14,url:9}],17:[function(t,e,r){e.exports={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encodeBinary:function(t){for(var e,r="",i=new Array(4),n=0,o=0,s=0;n<t.length;){for(e=new Array(3),o=0;o<e.length;o++)e[o]=n<t.length?255&t.charCodeAt(n++):0;switch(i[0]=e[0]>>2,i[1]=(3&e[0])<<4|e[1]>>4,i[2]=(15&e[1])<<2|e[2]>>6,i[3]=63&e[2],s=n-(t.length-1)){case 2:i[3]=64,i[2]=64;break;case 1:i[3]=64}for(o=0;o<i.length;o++)r+=this._keyStr.charAt(i[o])}return r}}},{}],18:[function(t,e,r){e.exports=t("./Loader"),e.exports.Resource=t("./Resource"),e.exports.middleware={caching:{memory:t("./middlewares/caching/memory")},parsing:{blob:t("./middlewares/parsing/blob")}}},{"./Loader":15,"./Resource":16,"./middlewares/caching/memory":19,"./middlewares/parsing/blob":20}],19:[function(t,e,r){var i={};e.exports=function(){return function(t,e){i[t.url]?(t.data=i[t.url],t.complete()):(t.once("complete",function(){i[this.url]=this.data}),e())}}},{}],20:[function(t,e,r){var i=t("../../Resource"),n=t("../../b64");window.URL=window.URL||window.webkitURL,e.exports=function(){return function(t,e){if(!t.data)return e();if(t.xhr&&t.xhrType===i.XHR_RESPONSE_TYPE.BLOB)if(window.Blob&&"string"!=typeof t.data){if(0===t.data.type.indexOf("image")){var r=URL.createObjectURL(t.data);t.blob=t.data,t.data=new Image,t.data.src=r,t.isImage=!0,t.data.onload=function(){URL.revokeObjectURL(r),t.data.onload=null,e()}}}else{var o=t.xhr.getResponseHeader("content-type");o&&0===o.indexOf("image")&&(t.data=new Image,t.data.src="data:"+o+";base64,"+n.encodeBinary(t.xhr.responseText),t.isImage=!0,t.data.onload=function(){t.data.onload=null,e()})}else e()}}},{"../../Resource":16,"../../b64":17}],21:[function(t,e,r){e.exports={name:"pixi.js",version:"3.0.7",description:"Pixi.js is a fast lightweight 2D library that works across all devices.",author:"Mat Groves",contributors:["Chad Engler <chad@pantherdev.com>","Richard Davey <rdavey@gmail.com>"],main:"./src/index.js",homepage:"http://goodboydigital.com/",bugs:"https://github.com/GoodBoyDigital/pixi.js/issues",license:"MIT",repository:{type:"git",url:"https://github.com/GoodBoyDigital/pixi.js.git"},scripts:{start:"gulp && gulp watch",test:"gulp && testem ci",build:"gulp",docs:"jsdoc -c ./gulp/util/jsdoc.conf.json -R README.md"},files:["bin/","src/"],dependencies:{async:"^0.9.0",brfs:"^1.4.0",earcut:"^2.0.1",eventemitter3:"^1.1.0","object-assign":"^2.0.0","resource-loader":"^1.6.1"},devDependencies:{browserify:"^10.2.3",chai:"^3.0.0",del:"^1.2.0",gulp:"^3.9.0","gulp-cached":"^1.1.0","gulp-concat":"^2.5.2","gulp-debug":"^2.0.1","gulp-jshint":"^1.11.0","gulp-mirror":"^0.4.0","gulp-plumber":"^1.0.1","gulp-rename":"^1.2.2","gulp-sourcemaps":"^1.5.2","gulp-uglify":"^1.2.0","gulp-util":"^3.0.5","jaguarjs-jsdoc":"git+https://github.com/davidshimjs/jaguarjs-jsdoc.git",jsdoc:"^3.3.0","jshint-summary":"^0.4.0",minimist:"^1.1.1",mocha:"^2.2.5","require-dir":"^0.3.0","run-sequence":"^1.1.0",testem:"^0.8.3","vinyl-buffer":"^1.0.0","vinyl-source-stream":"^1.1.0",watchify:"^3.2.1"},browserify:{transform:["brfs"]}}},{}],22:[function(t,e,r){var i={VERSION:t("../../package.json").version,PI_2:2*Math.PI,RAD_TO_DEG:180/Math.PI,DEG_TO_RAD:Math.PI/180,TARGET_FPMS:.06,RENDERER_TYPE:{UNKNOWN:0,WEBGL:1,CANVAS:2},BLEND_MODES:{NORMAL:0,ADD:1,MULTIPLY:2,SCREEN:3,OVERLAY:4,DARKEN:5,LIGHTEN:6,COLOR_DODGE:7,COLOR_BURN:8,HARD_LIGHT:9,SOFT_LIGHT:10,DIFFERENCE:11,EXCLUSION:12,HUE:13,SATURATION:14,COLOR:15,LUMINOSITY:16},DRAW_MODES:{POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},SCALE_MODES:{DEFAULT:0,LINEAR:0,NEAREST:1},RETINA_PREFIX:/@(.+)x/,RESOLUTION:1,FILTER_RESOLUTION:1,DEFAULT_RENDER_OPTIONS:{view:null,resolution:1,antialias:!1,forceFXAA:!1,autoResize:!1,transparent:!1,backgroundColor:0,clearBeforeRender:!0,preserveDrawingBuffer:!1},SHAPES:{POLY:0,RECT:1,CIRC:2,ELIP:3,RREC:4},SPRITE_BATCH_SIZE:2e3};e.exports=i},{"../../package.json":21}],23:[function(t,e,r){function i(){o.call(this),this.children=[]}var n=t("../math"),o=t("./DisplayObject"),s=t("../textures/RenderTexture"),a=new n.Matrix;i.prototype=Object.create(o.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{width:{get:function(){return this.scale.x*this.getLocalBounds().width},set:function(t){var e=this.getLocalBounds().width;this.scale.x=0!==e?t/e:1,this._width=t}},height:{get:function(){return this.scale.y*this.getLocalBounds().height},set:function(t){var e=this.getLocalBounds().height;this.scale.y=0!==e?t/e:1,this._height=t}}}),i.prototype.addChild=function(t){return this.addChildAt(t,this.children.length)},i.prototype.addChildAt=function(t,e){if(t===this)return t;if(e>=0&&e<=this.children.length)return t.parent&&t.parent.removeChild(t),t.parent=this,this.children.splice(e,0,t),t.emit("added",this),t;throw new Error(t+"addChildAt: The index "+e+" supplied is out of bounds "+this.children.length)},i.prototype.swapChildren=function(t,e){if(t!==e){var r=this.getChildIndex(t),i=this.getChildIndex(e);if(0>r||0>i)throw new Error("swapChildren: Both the supplied DisplayObjects must be children of the caller.");this.children[r]=e,this.children[i]=t}},i.prototype.getChildIndex=function(t){var e=this.children.indexOf(t);if(-1===e)throw new Error("The supplied DisplayObject must be a child of the caller");return e},i.prototype.setChildIndex=function(t,e){if(0>e||e>=this.children.length)throw new Error("The supplied index is out of bounds");var r=this.getChildIndex(t);this.children.splice(r,1),this.children.splice(e,0,t)},i.prototype.getChildAt=function(t){if(0>t||t>=this.children.length)throw new Error("getChildAt: Supplied index "+t+" does not exist in the child list, or the supplied DisplayObject is not a child of the caller");return this.children[t]},i.prototype.removeChild=function(t){var e=this.children.indexOf(t);if(-1!==e)return this.removeChildAt(e)},i.prototype.removeChildAt=function(t){var e=this.getChildAt(t);return e.parent=null,this.children.splice(t,1),e.emit("removed",this),e},i.prototype.removeChildren=function(t,e){var r=t||0,i="number"==typeof e?e:this.children.length,n=i-r;if(n>0&&i>=n){for(var o=this.children.splice(r,n),s=0;s<o.length;++s)o[s].parent=null;return o}if(0===n&&0===this.children.length)return[];throw new RangeError("removeChildren: numeric values are outside the acceptable range.")},i.prototype.generateTexture=function(t,e,r){var i=this.getLocalBounds(),n=new s(t,0|i.width,0|i.height,r,e);return a.tx=-i.x,a.ty=-i.y,n.render(this,a),n},i.prototype.updateTransform=function(){
if(this.visible){this.displayObjectUpdateTransform();for(var t=0,e=this.children.length;e>t;++t)this.children[t].updateTransform()}},i.prototype.containerUpdateTransform=i.prototype.updateTransform,i.prototype.getBounds=function(){if(!this._currentBounds){if(0===this.children.length)return n.Rectangle.EMPTY;for(var t,e,r,i=1/0,o=1/0,s=-(1/0),a=-(1/0),h=!1,l=0,u=this.children.length;u>l;++l){var c=this.children[l];c.visible&&(h=!0,t=this.children[l].getBounds(),i=i<t.x?i:t.x,o=o<t.y?o:t.y,e=t.width+t.x,r=t.height+t.y,s=s>e?s:e,a=a>r?a:r)}if(!h)return n.Rectangle.EMPTY;var p=this._bounds;p.x=i,p.y=o,p.width=s-i,p.height=a-o,this._currentBounds=p}return this._currentBounds},i.prototype.containerGetBounds=i.prototype.getBounds,i.prototype.getLocalBounds=function(){var t=this.worldTransform;this.worldTransform=n.Matrix.IDENTITY;for(var e=0,r=this.children.length;r>e;++e)this.children[e].updateTransform();return this.worldTransform=t,this._currentBounds=null,this.getBounds(n.Matrix.IDENTITY)},i.prototype.renderWebGL=function(t){if(this.visible&&!(this.worldAlpha<=0)&&this.renderable){var e,r;if(this._mask||this._filters){for(t.currentRenderer.flush(),this._filters&&t.filterManager.pushFilter(this,this._filters),this._mask&&t.maskManager.pushMask(this,this._mask),t.currentRenderer.start(),this._renderWebGL(t),e=0,r=this.children.length;r>e;e++)this.children[e].renderWebGL(t);t.currentRenderer.flush(),this._mask&&t.maskManager.popMask(this,this._mask),this._filters&&t.filterManager.popFilter(),t.currentRenderer.start()}else for(this._renderWebGL(t),e=0,r=this.children.length;r>e;++e)this.children[e].renderWebGL(t)}},i.prototype._renderWebGL=function(t){},i.prototype._renderCanvas=function(t){},i.prototype.renderCanvas=function(t){if(this.visible&&!(this.alpha<=0)&&this.renderable){this._mask&&t.maskManager.pushMask(this._mask,t),this._renderCanvas(t);for(var e=0,r=this.children.length;r>e;++e)this.children[e].renderCanvas(t);this._mask&&t.maskManager.popMask(t)}},i.prototype.destroy=function(t){if(o.prototype.destroy.call(this),t)for(var e=0,r=this.children.length;r>e;++e)this.children[e].destroy(t);this.removeChildren(),this.children=null}},{"../math":32,"../textures/RenderTexture":70,"./DisplayObject":24}],24:[function(t,e,r){function i(){s.call(this),this.position=new n.Point,this.scale=new n.Point(1,1),this.pivot=new n.Point(0,0),this.rotation=0,this.alpha=1,this.visible=!0,this.renderable=!0,this.parent=null,this.worldAlpha=1,this.worldTransform=new n.Matrix,this.filterArea=null,this._sr=0,this._cr=1,this._bounds=new n.Rectangle(0,0,1,1),this._currentBounds=null,this._mask=null,this._cacheAsBitmap=!1,this._cachedObject=null}var n=t("../math"),o=t("../textures/RenderTexture"),s=t("eventemitter3"),a=t("../const"),h=new n.Matrix;i.prototype=Object.create(s.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{x:{get:function(){return this.position.x},set:function(t){this.position.x=t}},y:{get:function(){return this.position.y},set:function(t){this.position.y=t}},worldVisible:{get:function(){var t=this;do{if(!t.visible)return!1;t=t.parent}while(t);return!0}},mask:{get:function(){return this._mask},set:function(t){this._mask&&(this._mask.renderable=!0),this._mask=t,this._mask&&(this._mask.renderable=!1)}},filters:{get:function(){return this._filters&&this._filters.slice()},set:function(t){this._filters=t&&t.slice()}}}),i.prototype.updateTransform=function(){var t,e,r,i,n,o,s=this.parent.worldTransform,h=this.worldTransform;this.rotation%a.PI_2?(this.rotation!==this.rotationCache&&(this.rotationCache=this.rotation,this._sr=Math.sin(this.rotation),this._cr=Math.cos(this.rotation)),t=this._cr*this.scale.x,e=this._sr*this.scale.x,r=-this._sr*this.scale.y,i=this._cr*this.scale.y,n=this.position.x,o=this.position.y,(this.pivot.x||this.pivot.y)&&(n-=this.pivot.x*t+this.pivot.y*r,o-=this.pivot.x*e+this.pivot.y*i),h.a=t*s.a+e*s.c,h.b=t*s.b+e*s.d,h.c=r*s.a+i*s.c,h.d=r*s.b+i*s.d,h.tx=n*s.a+o*s.c+s.tx,h.ty=n*s.b+o*s.d+s.ty):(t=this.scale.x,i=this.scale.y,n=this.position.x-this.pivot.x*t,o=this.position.y-this.pivot.y*i,h.a=t*s.a,h.b=t*s.b,h.c=i*s.c,h.d=i*s.d,h.tx=n*s.a+o*s.c+s.tx,h.ty=n*s.b+o*s.d+s.ty),this.worldAlpha=this.alpha*this.parent.worldAlpha,this._currentBounds=null},i.prototype.displayObjectUpdateTransform=i.prototype.updateTransform,i.prototype.getBounds=function(t){return n.Rectangle.EMPTY},i.prototype.getLocalBounds=function(){return this.getBounds(n.Matrix.IDENTITY)},i.prototype.toGlobal=function(t){return this.displayObjectUpdateTransform(),this.worldTransform.apply(t)},i.prototype.toLocal=function(t,e){return e&&(t=e.toGlobal(t)),this.displayObjectUpdateTransform(),this.worldTransform.applyInverse(t)},i.prototype.renderWebGL=function(t){},i.prototype.renderCanvas=function(t){},i.prototype.generateTexture=function(t,e,r){var i=this.getLocalBounds(),n=new o(t,0|i.width,0|i.height,e,r);return h.tx=-i.x,h.ty=-i.y,n.render(this,h),n},i.prototype.destroy=function(){this.position=null,this.scale=null,this.pivot=null,this.parent=null,this._bounds=null,this._currentBounds=null,this._mask=null,this.worldTransform=null,this.filterArea=null}},{"../const":22,"../math":32,"../textures/RenderTexture":70,eventemitter3:11}],25:[function(t,e,r){function i(){n.call(this),this.fillAlpha=1,this.lineWidth=0,this.lineColor=0,this.graphicsData=[],this.tint=16777215,this._prevTint=16777215,this.blendMode=u.BLEND_MODES.NORMAL,this.currentPath=null,this._webGL={},this.isMask=!1,this.boundsPadding=0,this._localBounds=new l.Rectangle(0,0,1,1),this.dirty=!0,this.glDirty=!1,this.boundsDirty=!0,this.cachedSpriteDirty=!1}var n=t("../display/Container"),o=t("../textures/Texture"),s=t("../renderers/canvas/utils/CanvasBuffer"),a=t("../renderers/canvas/utils/CanvasGraphics"),h=t("./GraphicsData"),l=t("../math"),u=t("../const"),c=new l.Point;i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{}),i.prototype.clone=function(){var t=new i;t.renderable=this.renderable,t.fillAlpha=this.fillAlpha,t.lineWidth=this.lineWidth,t.lineColor=this.lineColor,t.tint=this.tint,t.blendMode=this.blendMode,t.isMask=this.isMask,t.boundsPadding=this.boundsPadding,t.dirty=this.dirty,t.glDirty=this.glDirty,t.cachedSpriteDirty=this.cachedSpriteDirty;for(var e=0;e<this.graphicsData.length;++e)t.graphicsData.push(this.graphicsData[e].clone());return t.currentPath=t.graphicsData[t.graphicsData.length-1],t.updateLocalBounds(),t},i.prototype.lineStyle=function(t,e,r){return this.lineWidth=t||0,this.lineColor=e||0,this.lineAlpha=void 0===r?1:r,this.currentPath&&(this.currentPath.shape.points.length?this.drawShape(new l.Polygon(this.currentPath.shape.points.slice(-2))):(this.currentPath.lineWidth=this.lineWidth,this.currentPath.lineColor=this.lineColor,this.currentPath.lineAlpha=this.lineAlpha)),this},i.prototype.moveTo=function(t,e){return this.drawShape(new l.Polygon([t,e])),this},i.prototype.lineTo=function(t,e){return this.currentPath.shape.points.push(t,e),this.dirty=!0,this},i.prototype.quadraticCurveTo=function(t,e,r,i){this.currentPath?0===this.currentPath.shape.points.length&&(this.currentPath.shape.points=[0,0]):this.moveTo(0,0);var n,o,s=20,a=this.currentPath.shape.points;0===a.length&&this.moveTo(0,0);for(var h=a[a.length-2],l=a[a.length-1],u=0,c=1;s>=c;++c)u=c/s,n=h+(t-h)*u,o=l+(e-l)*u,a.push(n+(t+(r-t)*u-n)*u,o+(e+(i-e)*u-o)*u);return this.dirty=this.boundsDirty=!0,this},i.prototype.bezierCurveTo=function(t,e,r,i,n,o){this.currentPath?0===this.currentPath.shape.points.length&&(this.currentPath.shape.points=[0,0]):this.moveTo(0,0);for(var s,a,h,l,u,c=20,p=this.currentPath.shape.points,d=p[p.length-2],f=p[p.length-1],v=0,g=1;c>=g;++g)v=g/c,s=1-v,a=s*s,h=a*s,l=v*v,u=l*v,p.push(h*d+3*a*v*t+3*s*l*r+u*n,h*f+3*a*v*e+3*s*l*i+u*o);return this.dirty=this.boundsDirty=!0,this},i.prototype.arcTo=function(t,e,r,i,n){this.currentPath?0===this.currentPath.shape.points.length&&this.currentPath.shape.points.push(t,e):this.moveTo(t,e);var o=this.currentPath.shape.points,s=o[o.length-2],a=o[o.length-1],h=a-e,l=s-t,u=i-e,c=r-t,p=Math.abs(h*c-l*u);if(1e-8>p||0===n)(o[o.length-2]!==t||o[o.length-1]!==e)&&o.push(t,e);else{var d=h*h+l*l,f=u*u+c*c,v=h*u+l*c,g=n*Math.sqrt(d)/p,m=n*Math.sqrt(f)/p,y=g*v/d,x=m*v/f,b=g*c+m*l,_=g*u+m*h,T=l*(m+y),E=h*(m+y),S=c*(g+x),A=u*(g+x),w=Math.atan2(E-_,T-b),C=Math.atan2(A-_,S-b);this.arc(b+t,_+e,n,w,C,l*u>c*h)}return this.dirty=this.boundsDirty=!0,this},i.prototype.arc=function(t,e,r,i,n,o){if(o=o||!1,i===n)return this;!o&&i>=n?n+=2*Math.PI:o&&n>=i&&(i+=2*Math.PI);var s=o?-1*(i-n):n-i,a=40*Math.ceil(Math.abs(s)/(2*Math.PI));if(0===s)return this;var h=t+Math.cos(i)*r,l=e+Math.sin(i)*r;this.currentPath?o&&this.filling?this.currentPath.shape.points.push(t,e):this.currentPath.shape.points.push(h,l):o&&this.filling?this.moveTo(t,e):this.moveTo(h,l);for(var u=this.currentPath.shape.points,c=s/(2*a),p=2*c,d=Math.cos(c),f=Math.sin(c),v=a-1,g=v%1/v,m=0;v>=m;m++){var y=m+g*m,x=c+i+p*y,b=Math.cos(x),_=-Math.sin(x);u.push((d*b+f*_)*r+t,(d*-_+f*b)*r+e)}return this.dirty=this.boundsDirty=!0,this},i.prototype.beginFill=function(t,e){return this.filling=!0,this.fillColor=t||0,this.fillAlpha=void 0===e?1:e,this.currentPath&&this.currentPath.shape.points.length<=2&&(this.currentPath.fill=this.filling,this.currentPath.fillColor=this.fillColor,this.currentPath.fillAlpha=this.fillAlpha),this},i.prototype.endFill=function(){return this.filling=!1,this.fillColor=null,this.fillAlpha=1,this},i.prototype.drawRect=function(t,e,r,i){return this.drawShape(new l.Rectangle(t,e,r,i)),this},i.prototype.drawRoundedRect=function(t,e,r,i,n){return this.drawShape(new l.RoundedRectangle(t,e,r,i,n)),this},i.prototype.drawCircle=function(t,e,r){return this.drawShape(new l.Circle(t,e,r)),this},i.prototype.drawEllipse=function(t,e,r,i){return this.drawShape(new l.Ellipse(t,e,r,i)),this},i.prototype.drawPolygon=function(t){var e=t;if(!Array.isArray(e)){e=new Array(arguments.length);for(var r=0;r<e.length;++r)e[r]=arguments[r]}return this.drawShape(new l.Polygon(e)),this},i.prototype.clear=function(){return this.lineWidth=0,this.filling=!1,this.dirty=!0,this.clearDirty=!0,this.graphicsData=[],this},i.prototype.generateTexture=function(t,e,r){e=e||1;var i=this.getLocalBounds(),n=new s(i.width*e,i.height*e),h=o.fromCanvas(n.canvas,r);return h.baseTexture.resolution=e,n.context.scale(e,e),n.context.translate(-i.x,-i.y),a.renderGraphics(this,n.context),h},i.prototype._renderWebGL=function(t){this.glDirty&&(this.dirty=!0,this.glDirty=!1),t.setObjectRenderer(t.plugins.graphics),t.plugins.graphics.render(this)},i.prototype._renderCanvas=function(t){if(this.isMask!==!0){this._prevTint!==this.tint&&(this.dirty=!0,this._prevTint=this.tint);var e=t.context,r=this.worldTransform;this.blendMode!==t.currentBlendMode&&(t.currentBlendMode=this.blendMode,e.globalCompositeOperation=t.blendModes[t.currentBlendMode]);var i=t.resolution;e.setTransform(r.a*i,r.b*i,r.c*i,r.d*i,r.tx*i,r.ty*i),a.renderGraphics(this,e)}},i.prototype.getBounds=function(t){if(!this._currentBounds){if(!this.renderable)return l.Rectangle.EMPTY;this.boundsDirty&&(this.updateLocalBounds(),this.glDirty=!0,this.cachedSpriteDirty=!0,this.boundsDirty=!1);var e=this._localBounds,r=e.x,i=e.width+e.x,n=e.y,o=e.height+e.y,s=t||this.worldTransform,a=s.a,h=s.b,u=s.c,c=s.d,p=s.tx,d=s.ty,f=a*i+u*o+p,v=c*o+h*i+d,g=a*r+u*o+p,m=c*o+h*r+d,y=a*r+u*n+p,x=c*n+h*r+d,b=a*i+u*n+p,_=c*n+h*i+d,T=f,E=v,S=f,A=v;S=S>g?g:S,S=S>y?y:S,S=S>b?b:S,A=A>m?m:A,A=A>x?x:A,A=A>_?_:A,T=g>T?g:T,T=y>T?y:T,T=b>T?b:T,E=m>E?m:E,E=x>E?x:E,E=_>E?_:E,this._bounds.x=S,this._bounds.width=T-S,this._bounds.y=A,this._bounds.height=E-A,this._currentBounds=this._bounds}return this._currentBounds},i.prototype.containsPoint=function(t){this.worldTransform.applyInverse(t,c);for(var e=this.graphicsData,r=0;r<e.length;r++){var i=e[r];if(i.fill&&i.shape&&i.shape.contains(c.x,c.y))return!0}return!1},i.prototype.updateLocalBounds=function(){var t=1/0,e=-(1/0),r=1/0,i=-(1/0);if(this.graphicsData.length)for(var n,o,s,a,h,l,c=0;c<this.graphicsData.length;c++){var p=this.graphicsData[c],d=p.type,f=p.lineWidth;if(n=p.shape,d===u.SHAPES.RECT||d===u.SHAPES.RREC)s=n.x-f/2,a=n.y-f/2,h=n.width+f,l=n.height+f,t=t>s?s:t,e=s+h>e?s+h:e,r=r>a?a:r,i=a+l>i?a+l:i;else if(d===u.SHAPES.CIRC)s=n.x,a=n.y,h=n.radius+f/2,l=n.radius+f/2,t=t>s-h?s-h:t,e=s+h>e?s+h:e,r=r>a-l?a-l:r,i=a+l>i?a+l:i;else if(d===u.SHAPES.ELIP)s=n.x,a=n.y,h=n.width+f/2,l=n.height+f/2,t=t>s-h?s-h:t,e=s+h>e?s+h:e,r=r>a-l?a-l:r,i=a+l>i?a+l:i;else{o=n.points;for(var v=0;v<o.length;v+=2)s=o[v],a=o[v+1],t=t>s-f?s-f:t,e=s+f>e?s+f:e,r=r>a-f?a-f:r,i=a+f>i?a+f:i}}else t=0,e=0,r=0,i=0;var g=this.boundsPadding;this._localBounds.x=t-g,this._localBounds.width=e-t+2*g,this._localBounds.y=r-g,this._localBounds.height=i-r+2*g},i.prototype.drawShape=function(t){this.currentPath&&this.currentPath.shape.points.length<=2&&this.graphicsData.pop(),this.currentPath=null;var e=new h(this.lineWidth,this.lineColor,this.lineAlpha,this.fillColor,this.fillAlpha,this.filling,t);return this.graphicsData.push(e),e.type===u.SHAPES.POLY&&(e.shape.closed=e.shape.closed||this.filling,this.currentPath=e),this.dirty=this.boundsDirty=!0,e},i.prototype.destroy=function(){n.prototype.destroy.apply(this,arguments);for(var t=0;t<this.graphicsData.length;++t)this.graphicsData[t].destroy();for(var e in this._webgl)for(var r=0;r<this._webgl[e].data.length;++r)this._webgl[e].data[r].destroy();this.graphicsData=null,this.currentPath=null,this._webgl=null,this._localBounds=null}},{"../const":22,"../display/Container":23,"../math":32,"../renderers/canvas/utils/CanvasBuffer":44,"../renderers/canvas/utils/CanvasGraphics":45,"../textures/Texture":71,"./GraphicsData":26}],26:[function(t,e,r){function i(t,e,r,i,n,o,s){this.lineWidth=t,this.lineColor=e,this.lineAlpha=r,this._lineTint=e,this.fillColor=i,this.fillAlpha=n,this._fillTint=i,this.fill=o,this.shape=s,this.type=s.type}i.prototype.constructor=i,e.exports=i,i.prototype.clone=function(){return new i(this.lineWidth,this.lineColor,this.lineAlpha,this.fillColor,this.fillAlpha,this.fill,this.shape)},i.prototype.destroy=function(){this.shape=null}},{}],27:[function(t,e,r){function i(t){a.call(this,t),this.graphicsDataPool=[],this.primitiveShader=null,this.complexPrimitiveShader=null,this.maximumSimplePolySize=200}var n=t("../../utils"),o=t("../../math"),s=t("../../const"),a=t("../../renderers/webgl/utils/ObjectRenderer"),h=t("../../renderers/webgl/WebGLRenderer"),l=t("./WebGLGraphicsData"),u=t("earcut");i.prototype=Object.create(a.prototype),i.prototype.constructor=i,e.exports=i,h.registerPlugin("graphics",i),i.prototype.onContextChange=function(){},i.prototype.destroy=function(){a.prototype.destroy.call(this);for(var t=0;t<this.graphicsDataPool.length;++t)this.graphicsDataPool[t].destroy();this.graphicsDataPool=null},i.prototype.render=function(t){var e,r=this.renderer,i=r.gl,o=r.shaderManager.plugins.primitiveShader;t.dirty&&this.updateGraphics(t,i);var s=t._webGL[i.id];r.blendModeManager.setBlendMode(t.blendMode);for(var a=0;a<s.data.length;a++)1===s.data[a].mode?(e=s.data[a],r.stencilManager.pushStencil(t,e,r),i.uniform1f(r.shaderManager.complexPrimitiveShader.uniforms.alpha._location,t.worldAlpha*e.alpha),i.drawElements(i.TRIANGLE_FAN,4,i.UNSIGNED_SHORT,2*(e.indices.length-4)),r.stencilManager.popStencil(t,e,r)):(e=s.data[a],o=r.shaderManager.primitiveShader,r.shaderManager.setShader(o),i.uniformMatrix3fv(o.uniforms.translationMatrix._location,!1,t.worldTransform.toArray(!0)),i.uniformMatrix3fv(o.uniforms.projectionMatrix._location,!1,r.currentRenderTarget.projectionMatrix.toArray(!0)),i.uniform3fv(o.uniforms.tint._location,n.hex2rgb(t.tint)),i.uniform1f(o.uniforms.alpha._location,t.worldAlpha),i.bindBuffer(i.ARRAY_BUFFER,e.buffer),i.vertexAttribPointer(o.attributes.aVertexPosition,2,i.FLOAT,!1,24,0),i.vertexAttribPointer(o.attributes.aColor,4,i.FLOAT,!1,24,8),i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.indexBuffer),i.drawElements(i.TRIANGLE_STRIP,e.indices.length,i.UNSIGNED_SHORT,0))},i.prototype.updateGraphics=function(t){var e=this.renderer.gl,r=t._webGL[e.id];r||(r=t._webGL[e.id]={lastIndex:0,data:[],gl:e}),t.dirty=!1;var i;if(t.clearDirty){for(t.clearDirty=!1,i=0;i<r.data.length;i++){var n=r.data[i];n.reset(),this.graphicsDataPool.push(n)}r.data=[],r.lastIndex=0}var o;for(i=r.lastIndex;i<t.graphicsData.length;i++){var a=t.graphicsData[i];if(a.type===s.SHAPES.POLY){if(a.points=a.shape.points.slice(),a.shape.closed&&(a.points[0]!==a.points[a.points.length-2]||a.points[1]!==a.points[a.points.length-1])&&a.points.push(a.points[0],a.points[1]),a.fill&&a.points.length>=6)if(a.points.length<2*this.maximumSimplePolySize){o=this.switchMode(r,0);var h=this.buildPoly(a,o);h||(o=this.switchMode(r,1),this.buildComplexPoly(a,o))}else o=this.switchMode(r,1),this.buildComplexPoly(a,o);a.lineWidth>0&&(o=this.switchMode(r,0),this.buildLine(a,o))}else o=this.switchMode(r,0),a.type===s.SHAPES.RECT?this.buildRectangle(a,o):a.type===s.SHAPES.CIRC||a.type===s.SHAPES.ELIP?this.buildCircle(a,o):a.type===s.SHAPES.RREC&&this.buildRoundedRectangle(a,o);r.lastIndex++}for(i=0;i<r.data.length;i++)o=r.data[i],o.dirty&&o.upload()},i.prototype.switchMode=function(t,e){var r;return t.data.length?(r=t.data[t.data.length-1],(r.points.length>32e4||r.mode!==e||1===e)&&(r=this.graphicsDataPool.pop()||new l(t.gl),r.mode=e,t.data.push(r))):(r=this.graphicsDataPool.pop()||new l(t.gl),r.mode=e,t.data.push(r)),r.dirty=!0,r},i.prototype.buildRectangle=function(t,e){var r=t.shape,i=r.x,o=r.y,s=r.width,a=r.height;if(t.fill){var h=n.hex2rgb(t.fillColor),l=t.fillAlpha,u=h[0]*l,c=h[1]*l,p=h[2]*l,d=e.points,f=e.indices,v=d.length/6;d.push(i,o),d.push(u,c,p,l),d.push(i+s,o),d.push(u,c,p,l),d.push(i,o+a),d.push(u,c,p,l),d.push(i+s,o+a),d.push(u,c,p,l),f.push(v,v,v+1,v+2,v+3,v+3)}if(t.lineWidth){var g=t.points;t.points=[i,o,i+s,o,i+s,o+a,i,o+a,i,o],this.buildLine(t,e),t.points=g}},i.prototype.buildRoundedRectangle=function(t,e){var r=t.shape,i=r.x,o=r.y,s=r.width,a=r.height,h=r.radius,l=[];if(l.push(i,o+h),this.quadraticBezierCurve(i,o+a-h,i,o+a,i+h,o+a,l),this.quadraticBezierCurve(i+s-h,o+a,i+s,o+a,i+s,o+a-h,l),this.quadraticBezierCurve(i+s,o+h,i+s,o,i+s-h,o,l),this.quadraticBezierCurve(i+h,o,i,o,i,o+h+1e-10,l),t.fill){var c=n.hex2rgb(t.fillColor),p=t.fillAlpha,d=c[0]*p,f=c[1]*p,v=c[2]*p,g=e.points,m=e.indices,y=g.length/6,x=u(l,null,2),b=0;for(b=0;b<x.length;b+=3)m.push(x[b]+y),m.push(x[b]+y),m.push(x[b+1]+y),m.push(x[b+2]+y),m.push(x[b+2]+y);for(b=0;b<l.length;b++)g.push(l[b],l[++b],d,f,v,p)}if(t.lineWidth){var _=t.points;t.points=l,this.buildLine(t,e),t.points=_}},i.prototype.quadraticBezierCurve=function(t,e,r,i,n,o,s){function a(t,e,r){var i=e-t;return t+i*r}for(var h,l,u,c,p,d,f=20,v=s||[],g=0,m=0;f>=m;m++)g=m/f,h=a(t,r,g),l=a(e,i,g),u=a(r,n,g),c=a(i,o,g),p=a(h,u,g),d=a(l,c,g),v.push(p,d);return v},i.prototype.buildCircle=function(t,e){var r,i,o=t.shape,a=o.x,h=o.y;t.type===s.SHAPES.CIRC?(r=o.radius,i=o.radius):(r=o.width,i=o.height);var l=40,u=2*Math.PI/l,c=0;if(t.fill){var p=n.hex2rgb(t.fillColor),d=t.fillAlpha,f=p[0]*d,v=p[1]*d,g=p[2]*d,m=e.points,y=e.indices,x=m.length/6;for(y.push(x),c=0;l+1>c;c++)m.push(a,h,f,v,g,d),m.push(a+Math.sin(u*c)*r,h+Math.cos(u*c)*i,f,v,g,d),y.push(x++,x++);y.push(x-1)}if(t.lineWidth){var b=t.points;for(t.points=[],c=0;l+1>c;c++)t.points.push(a+Math.sin(u*c)*r,h+Math.cos(u*c)*i);this.buildLine(t,e),t.points=b}},i.prototype.buildLine=function(t,e){var r=0,i=t.points;if(0!==i.length){if(t.lineWidth%2)for(r=0;r<i.length;r++)i[r]+=.5;var s=new o.Point(i[0],i[1]),a=new o.Point(i[i.length-2],i[i.length-1]);if(s.x===a.x&&s.y===a.y){i=i.slice(),i.pop(),i.pop(),a=new o.Point(i[i.length-2],i[i.length-1]);var h=a.x+.5*(s.x-a.x),l=a.y+.5*(s.y-a.y);i.unshift(h,l),i.push(h,l)}var u,c,p,d,f,v,g,m,y,x,b,_,T,E,S,A,w,C,M,R,D,F,P,O=e.points,B=e.indices,L=i.length/2,I=i.length,N=O.length/6,U=t.lineWidth/2,k=n.hex2rgb(t.lineColor),j=t.lineAlpha,X=k[0]*j,G=k[1]*j,Y=k[2]*j;for(p=i[0],d=i[1],f=i[2],v=i[3],y=-(d-v),x=p-f,P=Math.sqrt(y*y+x*x),y/=P,x/=P,y*=U,x*=U,O.push(p-y,d-x,X,G,Y,j),O.push(p+y,d+x,X,G,Y,j),r=1;L-1>r;r++)p=i[2*(r-1)],d=i[2*(r-1)+1],f=i[2*r],v=i[2*r+1],g=i[2*(r+1)],m=i[2*(r+1)+1],y=-(d-v),x=p-f,P=Math.sqrt(y*y+x*x),y/=P,x/=P,y*=U,x*=U,b=-(v-m),_=f-g,P=Math.sqrt(b*b+_*_),b/=P,_/=P,b*=U,_*=U,S=-x+d-(-x+v),A=-y+f-(-y+p),w=(-y+p)*(-x+v)-(-y+f)*(-x+d),C=-_+m-(-_+v),M=-b+f-(-b+g),R=(-b+g)*(-_+v)-(-b+f)*(-_+m),D=S*M-C*A,Math.abs(D)<.1?(D+=10.1,O.push(f-y,v-x,X,G,Y,j),O.push(f+y,v+x,X,G,Y,j)):(u=(A*R-M*w)/D,c=(C*w-S*R)/D,F=(u-f)*(u-f)+(c-v)+(c-v),F>19600?(T=y-b,E=x-_,P=Math.sqrt(T*T+E*E),T/=P,E/=P,T*=U,E*=U,O.push(f-T,v-E),O.push(X,G,Y,j),O.push(f+T,v+E),O.push(X,G,Y,j),O.push(f-T,v-E),O.push(X,G,Y,j),I++):(O.push(u,c),O.push(X,G,Y,j),O.push(f-(u-f),v-(c-v)),O.push(X,G,Y,j)));for(p=i[2*(L-2)],d=i[2*(L-2)+1],f=i[2*(L-1)],v=i[2*(L-1)+1],y=-(d-v),x=p-f,P=Math.sqrt(y*y+x*x),y/=P,x/=P,y*=U,x*=U,O.push(f-y,v-x),O.push(X,G,Y,j),O.push(f+y,v+x),O.push(X,G,Y,j),B.push(N),r=0;I>r;r++)B.push(N++);B.push(N-1)}},i.prototype.buildComplexPoly=function(t,e){var r=t.points.slice();if(!(r.length<6)){var i=e.indices;e.points=r,e.alpha=t.fillAlpha,e.color=n.hex2rgb(t.fillColor);for(var o,s,a=1/0,h=-(1/0),l=1/0,u=-(1/0),c=0;c<r.length;c+=2)o=r[c],s=r[c+1],a=a>o?o:a,h=o>h?o:h,l=l>s?s:l,u=s>u?s:u;r.push(a,l,h,l,h,u,a,u);var p=r.length/2;for(c=0;p>c;c++)i.push(c)}},i.prototype.buildPoly=function(t,e){var r=t.points;if(!(r.length<6)){var i=e.points,o=e.indices,s=r.length/2,a=n.hex2rgb(t.fillColor),h=t.fillAlpha,l=a[0]*h,c=a[1]*h,p=a[2]*h,d=u(r,null,2);if(!d)return!1;var f=i.length/6,v=0;for(v=0;v<d.length;v+=3)o.push(d[v]+f),o.push(d[v]+f),o.push(d[v+1]+f),o.push(d[v+2]+f),o.push(d[v+2]+f);for(v=0;s>v;v++)i.push(r[2*v],r[2*v+1],l,c,p,h);return!0}}},{"../../const":22,"../../math":32,"../../renderers/webgl/WebGLRenderer":48,"../../renderers/webgl/utils/ObjectRenderer":62,"../../utils":76,"./WebGLGraphicsData":28,earcut:10}],28:[function(t,e,r){function i(t){this.gl=t,this.color=[0,0,0],this.points=[],this.indices=[],this.buffer=t.createBuffer(),this.indexBuffer=t.createBuffer(),this.mode=1,this.alpha=1,this.dirty=!0,this.glPoints=null,this.glIndices=null}i.prototype.constructor=i,e.exports=i,i.prototype.reset=function(){this.points.length=0,this.indices.length=0},i.prototype.upload=function(){var t=this.gl;this.glPoints=new Float32Array(this.points),t.bindBuffer(t.ARRAY_BUFFER,this.buffer),t.bufferData(t.ARRAY_BUFFER,this.glPoints,t.STATIC_DRAW),this.glIndices=new Uint16Array(this.indices),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.indexBuffer),t.bufferData(t.ELEMENT_ARRAY_BUFFER,this.glIndices,t.STATIC_DRAW),this.dirty=!1},i.prototype.destroy=function(){this.color=null,this.points=null,this.indices=null,this.gl.deleteBuffer(this.buffer),this.gl.deleteBuffer(this.indexBuffer),this.gl=null,this.buffer=null,this.indexBuffer=null,this.glPoints=null,this.glIndices=null}},{}],29:[function(t,e,r){var i=e.exports=Object.assign(t("./const"),t("./math"),{utils:t("./utils"),ticker:t("./ticker"),DisplayObject:t("./display/DisplayObject"),Container:t("./display/Container"),Sprite:t("./sprites/Sprite"),ParticleContainer:t("./particles/ParticleContainer"),SpriteRenderer:t("./sprites/webgl/SpriteRenderer"),ParticleRenderer:t("./particles/webgl/ParticleRenderer"),Text:t("./text/Text"),Graphics:t("./graphics/Graphics"),GraphicsData:t("./graphics/GraphicsData"),GraphicsRenderer:t("./graphics/webgl/GraphicsRenderer"),Texture:t("./textures/Texture"),BaseTexture:t("./textures/BaseTexture"),RenderTexture:t("./textures/RenderTexture"),VideoBaseTexture:t("./textures/VideoBaseTexture"),TextureUvs:t("./textures/TextureUvs"),CanvasRenderer:t("./renderers/canvas/CanvasRenderer"),CanvasGraphics:t("./renderers/canvas/utils/CanvasGraphics"),CanvasBuffer:t("./renderers/canvas/utils/CanvasBuffer"),WebGLRenderer:t("./renderers/webgl/WebGLRenderer"),ShaderManager:t("./renderers/webgl/managers/ShaderManager"),Shader:t("./renderers/webgl/shaders/Shader"),ObjectRenderer:t("./renderers/webgl/utils/ObjectRenderer"),RenderTarget:t("./renderers/webgl/utils/RenderTarget"),AbstractFilter:t("./renderers/webgl/filters/AbstractFilter"),FXAAFilter:t("./renderers/webgl/filters/FXAAFilter"),SpriteMaskFilter:t("./renderers/webgl/filters/SpriteMaskFilter"),autoDetectRenderer:function(t,e,r,n){return t=t||800,e=e||600,!n&&i.utils.isWebGLSupported()?new i.WebGLRenderer(t,e,r):new i.CanvasRenderer(t,e,r)}})},{"./const":22,"./display/Container":23,"./display/DisplayObject":24,"./graphics/Graphics":25,"./graphics/GraphicsData":26,"./graphics/webgl/GraphicsRenderer":27,"./math":32,"./particles/ParticleContainer":38,"./particles/webgl/ParticleRenderer":40,"./renderers/canvas/CanvasRenderer":43,"./renderers/canvas/utils/CanvasBuffer":44,"./renderers/canvas/utils/CanvasGraphics":45,"./renderers/webgl/WebGLRenderer":48,"./renderers/webgl/filters/AbstractFilter":49,"./renderers/webgl/filters/FXAAFilter":50,"./renderers/webgl/filters/SpriteMaskFilter":51,"./renderers/webgl/managers/ShaderManager":55,"./renderers/webgl/shaders/Shader":60,"./renderers/webgl/utils/ObjectRenderer":62,"./renderers/webgl/utils/RenderTarget":64,"./sprites/Sprite":66,"./sprites/webgl/SpriteRenderer":67,"./text/Text":68,"./textures/BaseTexture":69,"./textures/RenderTexture":70,"./textures/Texture":71,"./textures/TextureUvs":72,"./textures/VideoBaseTexture":73,"./ticker":75,"./utils":76}],30:[function(t,e,r){function i(){this.a=1,this.b=0,this.c=0,this.d=1,this.tx=0,this.ty=0}var n=t("./Point");i.prototype.constructor=i,e.exports=i,i.prototype.fromArray=function(t){this.a=t[0],this.b=t[1],this.c=t[3],this.d=t[4],this.tx=t[2],this.ty=t[5]},i.prototype.toArray=function(t,e){this.array||(this.array=new Float32Array(9));var r=e||this.array;return t?(r[0]=this.a,r[1]=this.b,r[2]=0,r[3]=this.c,r[4]=this.d,r[5]=0,r[6]=this.tx,r[7]=this.ty,r[8]=1):(r[0]=this.a,r[1]=this.c,r[2]=this.tx,r[3]=this.b,r[4]=this.d,r[5]=this.ty,r[6]=0,r[7]=0,r[8]=1),r},i.prototype.apply=function(t,e){e=e||new n;var r=t.x,i=t.y;return e.x=this.a*r+this.c*i+this.tx,e.y=this.b*r+this.d*i+this.ty,e},i.prototype.applyInverse=function(t,e){e=e||new n;var r=1/(this.a*this.d+this.c*-this.b),i=t.x,o=t.y;return e.x=this.d*r*i+-this.c*r*o+(this.ty*this.c-this.tx*this.d)*r,e.y=this.a*r*o+-this.b*r*i+(-this.ty*this.a+this.tx*this.b)*r,e},i.prototype.translate=function(t,e){return this.tx+=t,this.ty+=e,this},i.prototype.scale=function(t,e){return this.a*=t,this.d*=e,this.c*=t,this.b*=e,this.tx*=t,this.ty*=e,this},i.prototype.rotate=function(t){var e=Math.cos(t),r=Math.sin(t),i=this.a,n=this.c,o=this.tx;return this.a=i*e-this.b*r,this.b=i*r+this.b*e,this.c=n*e-this.d*r,this.d=n*r+this.d*e,this.tx=o*e-this.ty*r,this.ty=o*r+this.ty*e,this},i.prototype.append=function(t){var e=this.a,r=this.b,i=this.c,n=this.d;return this.a=t.a*e+t.b*i,this.b=t.a*r+t.b*n,this.c=t.c*e+t.d*i,this.d=t.c*r+t.d*n,this.tx=t.tx*e+t.ty*i+this.tx,this.ty=t.tx*r+t.ty*n+this.ty,this},i.prototype.prepend=function(t){var e=this.tx;if(1!==t.a||0!==t.b||0!==t.c||1!==t.d){var r=this.a,i=this.c;this.a=r*t.a+this.b*t.c,this.b=r*t.b+this.b*t.d,this.c=i*t.a+this.d*t.c,this.d=i*t.b+this.d*t.d}return this.tx=e*t.a+this.ty*t.c+t.tx,this.ty=e*t.b+this.ty*t.d+t.ty,this},i.prototype.invert=function(){var t=this.a,e=this.b,r=this.c,i=this.d,n=this.tx,o=t*i-e*r;return this.a=i/o,this.b=-e/o,this.c=-r/o,this.d=t/o,this.tx=(r*this.ty-i*n)/o,this.ty=-(t*this.ty-e*n)/o,this},i.prototype.identity=function(){return this.a=1,this.b=0,this.c=0,this.d=1,this.tx=0,this.ty=0,this},i.prototype.clone=function(){var t=new i;return t.a=this.a,t.b=this.b,t.c=this.c,t.d=this.d,t.tx=this.tx,t.ty=this.ty,t},i.prototype.copy=function(t){return t.a=this.a,t.b=this.b,t.c=this.c,t.d=this.d,t.tx=this.tx,t.ty=this.ty,t},i.IDENTITY=new i,i.TEMP_MATRIX=new i},{"./Point":31}],31:[function(t,e,r){function i(t,e){this.x=t||0,this.y=e||0}i.prototype.constructor=i,e.exports=i,i.prototype.clone=function(){return new i(this.x,this.y)},i.prototype.copy=function(t){this.set(t.x,t.y)},i.prototype.equals=function(t){return t.x===this.x&&t.y===this.y},i.prototype.set=function(t,e){this.x=t||0,this.y=e||(0!==e?this.x:0)}},{}],32:[function(t,e,r){e.exports={Point:t("./Point"),Matrix:t("./Matrix"),Circle:t("./shapes/Circle"),Ellipse:t("./shapes/Ellipse"),Polygon:t("./shapes/Polygon"),Rectangle:t("./shapes/Rectangle"),RoundedRectangle:t("./shapes/RoundedRectangle")}},{"./Matrix":30,"./Point":31,"./shapes/Circle":33,"./shapes/Ellipse":34,"./shapes/Polygon":35,"./shapes/Rectangle":36,"./shapes/RoundedRectangle":37}],33:[function(t,e,r){function i(t,e,r){this.x=t||0,this.y=e||0,this.radius=r||0,this.type=o.SHAPES.CIRC}var n=t("./Rectangle"),o=t("../../const");i.prototype.constructor=i,e.exports=i,i.prototype.clone=function(){return new i(this.x,this.y,this.radius)},i.prototype.contains=function(t,e){if(this.radius<=0)return!1;var r=this.x-t,i=this.y-e,n=this.radius*this.radius;return r*=r,i*=i,n>=r+i},i.prototype.getBounds=function(){return new n(this.x-this.radius,this.y-this.radius,2*this.radius,2*this.radius)}},{"../../const":22,"./Rectangle":36}],34:[function(t,e,r){function i(t,e,r,i){this.x=t||0,this.y=e||0,this.width=r||0,this.height=i||0,this.type=o.SHAPES.ELIP}var n=t("./Rectangle"),o=t("../../const");i.prototype.constructor=i,e.exports=i,i.prototype.clone=function(){return new i(this.x,this.y,this.width,this.height)},i.prototype.contains=function(t,e){if(this.width<=0||this.height<=0)return!1;var r=(t-this.x)/this.width,i=(e-this.y)/this.height;return r*=r,i*=i,1>=r+i},i.prototype.getBounds=function(){return new n(this.x-this.width,this.y-this.height,this.width,this.height)}},{"../../const":22,"./Rectangle":36}],35:[function(t,e,r){function i(t){var e=t;if(!Array.isArray(e)){e=new Array(arguments.length);for(var r=0;r<e.length;++r)e[r]=arguments[r]}if(e[0]instanceof n){for(var i=[],s=0,a=e.length;a>s;s++)i.push(e[s].x,e[s].y);e=i}this.closed=!0,this.points=e,this.type=o.SHAPES.POLY}var n=t("../Point"),o=t("../../const");i.prototype.constructor=i,e.exports=i,i.prototype.clone=function(){return new i(this.points.slice())},i.prototype.contains=function(t,e){for(var r=!1,i=this.points.length/2,n=0,o=i-1;i>n;o=n++){var s=this.points[2*n],a=this.points[2*n+1],h=this.points[2*o],l=this.points[2*o+1],u=a>e!=l>e&&(h-s)*(e-a)/(l-a)+s>t;u&&(r=!r)}return r}},{"../../const":22,"../Point":31}],36:[function(t,e,r){function i(t,e,r,i){this.x=t||0,this.y=e||0,this.width=r||0,this.height=i||0,this.type=n.SHAPES.RECT}var n=t("../../const");i.prototype.constructor=i,e.exports=i,i.EMPTY=new i(0,0,0,0),i.prototype.clone=function(){return new i(this.x,this.y,this.width,this.height)},i.prototype.contains=function(t,e){return this.width<=0||this.height<=0?!1:t>=this.x&&t<this.x+this.width&&e>=this.y&&e<this.y+this.height?!0:!1}},{"../../const":22}],37:[function(t,e,r){function i(t,e,r,i,o){this.x=t||0,this.y=e||0,this.width=r||0,this.height=i||0,this.radius=o||20,this.type=n.SHAPES.RREC}var n=t("../../const");i.prototype.constructor=i,e.exports=i,i.prototype.clone=function(){return new i(this.x,this.y,this.width,this.height,this.radius)},i.prototype.contains=function(t,e){return this.width<=0||this.height<=0?!1:t>=this.x&&t<=this.x+this.width&&e>=this.y&&e<=this.y+this.height?!0:!1}},{"../../const":22}],38:[function(t,e,r){function i(t,e){n.call(this),this._properties=[!1,!0,!1,!1,!1],this._size=t||15e3,this._buffers=null,this._updateStatic=!1,this.interactiveChildren=!1,this.blendMode=o.BLEND_MODES.NORMAL,this.roundPixels=!0,this.setProperties(e)}var n=t("../display/Container"),o=t("../const");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.setProperties=function(t){t&&(this._properties[0]="scale"in t?!!t.scale:this._properties[0],this._properties[1]="position"in t?!!t.position:this._properties[1],this._properties[2]="rotation"in t?!!t.rotation:this._properties[2],this._properties[3]="uvs"in t?!!t.uvs:this._properties[3],this._properties[4]="alpha"in t?!!t.alpha:this._properties[4])},i.prototype.updateTransform=function(){
this.displayObjectUpdateTransform()},i.prototype.renderWebGL=function(t){this.visible&&!(this.worldAlpha<=0)&&this.children.length&&this.renderable&&(t.setObjectRenderer(t.plugins.particle),t.plugins.particle.render(this))},i.prototype.addChildAt=function(t,e){if(t===this)return t;if(e>=0&&e<=this.children.length)return t.parent&&t.parent.removeChild(t),t.parent=this,this.children.splice(e,0,t),this._updateStatic=!0,t;throw new Error(t+"addChildAt: The index "+e+" supplied is out of bounds "+this.children.length)},i.prototype.removeChildAt=function(t){var e=this.getChildAt(t);return e.parent=null,this.children.splice(t,1),this._updateStatic=!0,e},i.prototype.renderCanvas=function(t){if(this.visible&&!(this.worldAlpha<=0)&&this.children.length&&this.renderable){var e=t.context,r=this.worldTransform,i=!0,n=0,o=0,s=0,a=0;e.globalAlpha=this.worldAlpha,this.displayObjectUpdateTransform();for(var h=0;h<this.children.length;++h){var l=this.children[h];if(l.visible){var u=l.texture.frame;if(e.globalAlpha=this.worldAlpha*l.alpha,l.rotation%(2*Math.PI)===0)i&&(e.setTransform(r.a,r.b,r.c,r.d,r.tx,r.ty),i=!1),n=l.anchor.x*-u.width*l.scale.x+l.position.x+.5,o=l.anchor.y*-u.height*l.scale.y+l.position.y+.5,s=u.width*l.scale.x,a=u.height*l.scale.y;else{i||(i=!0),l.displayObjectUpdateTransform();var c=l.worldTransform;t.roundPixels?e.setTransform(c.a,c.b,c.c,c.d,0|c.tx,0|c.ty):e.setTransform(c.a,c.b,c.c,c.d,c.tx,c.ty),n=l.anchor.x*-u.width+.5,o=l.anchor.y*-u.height+.5,s=u.width,a=u.height}e.drawImage(l.texture.baseTexture.source,u.x,u.y,u.width,u.height,n,o,s,a)}}}},i.prototype.destroy=function(){if(n.prototype.destroy.apply(this,arguments),this._buffers)for(var t=0;t<this._buffers.length;++t)this._buffers[t].destroy();this._properties=null,this._buffers=null}},{"../const":22,"../display/Container":23}],39:[function(t,e,r){function i(t,e,r){this.gl=t,this.vertSize=2,this.vertByteSize=4*this.vertSize,this.size=r,this.dynamicProperties=[],this.staticProperties=[];for(var i=0;i<e.length;i++){var n=e[i];n.dynamic?this.dynamicProperties.push(n):this.staticProperties.push(n)}this.staticStride=0,this.staticBuffer=null,this.staticData=null,this.dynamicStride=0,this.dynamicBuffer=null,this.dynamicData=null,this.initBuffers()}i.prototype.constructor=i,e.exports=i,i.prototype.initBuffers=function(){var t,e,r=this.gl,i=0;for(this.dynamicStride=0,t=0;t<this.dynamicProperties.length;t++)e=this.dynamicProperties[t],e.offset=i,i+=e.size,this.dynamicStride+=e.size;this.dynamicData=new Float32Array(this.size*this.dynamicStride*4),this.dynamicBuffer=r.createBuffer(),r.bindBuffer(r.ARRAY_BUFFER,this.dynamicBuffer),r.bufferData(r.ARRAY_BUFFER,this.dynamicData,r.DYNAMIC_DRAW);var n=0;for(this.staticStride=0,t=0;t<this.staticProperties.length;t++)e=this.staticProperties[t],e.offset=n,n+=e.size,this.staticStride+=e.size;this.staticData=new Float32Array(this.size*this.staticStride*4),this.staticBuffer=r.createBuffer(),r.bindBuffer(r.ARRAY_BUFFER,this.staticBuffer),r.bufferData(r.ARRAY_BUFFER,this.staticData,r.DYNAMIC_DRAW)},i.prototype.uploadDynamic=function(t,e,r){for(var i=this.gl,n=0;n<this.dynamicProperties.length;n++){var o=this.dynamicProperties[n];o.uploadFunction(t,e,r,this.dynamicData,this.dynamicStride,o.offset)}i.bindBuffer(i.ARRAY_BUFFER,this.dynamicBuffer),i.bufferSubData(i.ARRAY_BUFFER,0,this.dynamicData)},i.prototype.uploadStatic=function(t,e,r){for(var i=this.gl,n=0;n<this.staticProperties.length;n++){var o=this.staticProperties[n];o.uploadFunction(t,e,r,this.staticData,this.staticStride,o.offset)}i.bindBuffer(i.ARRAY_BUFFER,this.staticBuffer),i.bufferSubData(i.ARRAY_BUFFER,0,this.staticData)},i.prototype.bind=function(){var t,e,r=this.gl;for(r.bindBuffer(r.ARRAY_BUFFER,this.dynamicBuffer),t=0;t<this.dynamicProperties.length;t++)e=this.dynamicProperties[t],r.vertexAttribPointer(e.attribute,e.size,r.FLOAT,!1,4*this.dynamicStride,4*e.offset);for(r.bindBuffer(r.ARRAY_BUFFER,this.staticBuffer),t=0;t<this.staticProperties.length;t++)e=this.staticProperties[t],r.vertexAttribPointer(e.attribute,e.size,r.FLOAT,!1,4*this.staticStride,4*e.offset)},i.prototype.destroy=function(){this.dynamicProperties=null,this.dynamicData=null,this.gl.deleteBuffer(this.dynamicBuffer),this.staticProperties=null,this.staticData=null,this.gl.deleteBuffer(this.staticBuffer)}},{}],40:[function(t,e,r){function i(t){n.call(this,t),this.size=15e3;var e=6*this.size;this.indices=new Uint16Array(e);for(var r=0,i=0;e>r;r+=6,i+=4)this.indices[r+0]=i+0,this.indices[r+1]=i+1,this.indices[r+2]=i+2,this.indices[r+3]=i+0,this.indices[r+4]=i+2,this.indices[r+5]=i+3;this.shader=null,this.indexBuffer=null,this.properties=null,this.tempMatrix=new h.Matrix}var n=t("../../renderers/webgl/utils/ObjectRenderer"),o=t("../../renderers/webgl/WebGLRenderer"),s=t("./ParticleShader"),a=t("./ParticleBuffer"),h=t("../../math");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,o.registerPlugin("particle",i),i.prototype.onContextChange=function(){var t=this.renderer.gl;this.shader=new s(this.renderer.shaderManager),this.indexBuffer=t.createBuffer(),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.indexBuffer),t.bufferData(t.ELEMENT_ARRAY_BUFFER,this.indices,t.STATIC_DRAW),this.properties=[{attribute:this.shader.attributes.aVertexPosition,dynamic:!1,size:2,uploadFunction:this.uploadVertices,offset:0},{attribute:this.shader.attributes.aPositionCoord,dynamic:!0,size:2,uploadFunction:this.uploadPosition,offset:0},{attribute:this.shader.attributes.aRotation,dynamic:!1,size:1,uploadFunction:this.uploadRotation,offset:0},{attribute:this.shader.attributes.aTextureCoord,dynamic:!1,size:2,uploadFunction:this.uploadUvs,offset:0},{attribute:this.shader.attributes.aColor,dynamic:!1,size:1,uploadFunction:this.uploadAlpha,offset:0}]},i.prototype.start=function(){var t=this.renderer.gl;t.activeTexture(t.TEXTURE0),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.indexBuffer);var e=this.shader;this.renderer.shaderManager.setShader(e)},i.prototype.render=function(t){var e=t.children,r=e.length,i=t._size;if(0!==r){r>i&&(r=i),t._buffers||(t._buffers=this.generateBuffers(t)),this.renderer.blendModeManager.setBlendMode(t.blendMode);var n=this.renderer.gl,o=t.worldTransform.copy(this.tempMatrix);o.prepend(this.renderer.currentRenderTarget.projectionMatrix),n.uniformMatrix3fv(this.shader.uniforms.projectionMatrix._location,!1,o.toArray(!0)),n.uniform1f(this.shader.uniforms.uAlpha._location,t.worldAlpha);var s=t._updateStatic,a=e[0]._texture.baseTexture;if(a._glTextures[n.id])n.bindTexture(n.TEXTURE_2D,a._glTextures[n.id]);else{if(!this.renderer.updateTexture(a))return;this.properties[0].dynamic&&this.properties[3].dynamic||(s=!0)}for(var h=0,l=0;r>l;l+=this.size){var u=r-l;u>this.size&&(u=this.size);var c=t._buffers[h++];c.uploadDynamic(e,l,u),s&&c.uploadStatic(e,l,u),c.bind(this.shader),n.drawElements(n.TRIANGLES,6*u,n.UNSIGNED_SHORT,0),this.renderer.drawCount++}t._updateStatic=!1}},i.prototype.generateBuffers=function(t){var e,r=this.renderer.gl,i=[],n=t._size;for(e=0;e<t._properties.length;e++)this.properties[e].dynamic=t._properties[e];for(e=0;n>e;e+=this.size)i.push(new a(r,this.properties,this.size,this.shader));return i},i.prototype.uploadVertices=function(t,e,r,i,n,o){for(var s,a,h,l,u,c,p,d,f,v=0;r>v;v++)s=t[e+v],a=s._texture,l=s.scale.x,u=s.scale.y,a.trim?(h=a.trim,p=h.x-s.anchor.x*h.width,c=p+a.crop.width,f=h.y-s.anchor.y*h.height,d=f+a.crop.height):(c=a._frame.width*(1-s.anchor.x),p=a._frame.width*-s.anchor.x,d=a._frame.height*(1-s.anchor.y),f=a._frame.height*-s.anchor.y),i[o]=p*l,i[o+1]=f*u,i[o+n]=c*l,i[o+n+1]=f*u,i[o+2*n]=c*l,i[o+2*n+1]=d*u,i[o+3*n]=p*l,i[o+3*n+1]=d*u,o+=4*n},i.prototype.uploadPosition=function(t,e,r,i,n,o){for(var s=0;r>s;s++){var a=t[e+s].position;i[o]=a.x,i[o+1]=a.y,i[o+n]=a.x,i[o+n+1]=a.y,i[o+2*n]=a.x,i[o+2*n+1]=a.y,i[o+3*n]=a.x,i[o+3*n+1]=a.y,o+=4*n}},i.prototype.uploadRotation=function(t,e,r,i,n,o){for(var s=0;r>s;s++){var a=t[e+s].rotation;i[o]=a,i[o+n]=a,i[o+2*n]=a,i[o+3*n]=a,o+=4*n}},i.prototype.uploadUvs=function(t,e,r,i,n,o){for(var s=0;r>s;s++){var a=t[e+s]._texture._uvs;a?(i[o]=a.x0,i[o+1]=a.y0,i[o+n]=a.x1,i[o+n+1]=a.y1,i[o+2*n]=a.x2,i[o+2*n+1]=a.y2,i[o+3*n]=a.x3,i[o+3*n+1]=a.y3,o+=4*n):(i[o]=0,i[o+1]=0,i[o+n]=0,i[o+n+1]=0,i[o+2*n]=0,i[o+2*n+1]=0,i[o+3*n]=0,i[o+3*n+1]=0,o+=4*n)}},i.prototype.uploadAlpha=function(t,e,r,i,n,o){for(var s=0;r>s;s++){var a=t[e+s].alpha;i[o]=a,i[o+n]=a,i[o+2*n]=a,i[o+3*n]=a,o+=4*n}},i.prototype.destroy=function(){this.renderer.gl&&this.renderer.gl.deleteBuffer(this.indexBuffer),n.prototype.destroy.apply(this,arguments),this.shader.destroy(),this.indices=null,this.tempMatrix=null}},{"../../math":32,"../../renderers/webgl/WebGLRenderer":48,"../../renderers/webgl/utils/ObjectRenderer":62,"./ParticleBuffer":39,"./ParticleShader":41}],41:[function(t,e,r){function i(t){n.call(this,t,["attribute vec2 aVertexPosition;","attribute vec2 aTextureCoord;","attribute float aColor;","attribute vec2 aPositionCoord;","attribute vec2 aScale;","attribute float aRotation;","uniform mat3 projectionMatrix;","varying vec2 vTextureCoord;","varying float vColor;","void main(void){","   vec2 v = aVertexPosition;","   v.x = (aVertexPosition.x) * cos(aRotation) - (aVertexPosition.y) * sin(aRotation);","   v.y = (aVertexPosition.x) * sin(aRotation) + (aVertexPosition.y) * cos(aRotation);","   v = v + aPositionCoord;","   gl_Position = vec4((projectionMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);","   vTextureCoord = aTextureCoord;","   vColor = aColor;","}"].join("\n"),["precision lowp float;","varying vec2 vTextureCoord;","varying float vColor;","uniform sampler2D uSampler;","uniform float uAlpha;","void main(void){","  vec4 color = texture2D(uSampler, vTextureCoord) * vColor * uAlpha;","  if (color.a == 0.0) discard;","  gl_FragColor = color;","}"].join("\n"),{uAlpha:{type:"1f",value:1}},{aPositionCoord:0,aRotation:0})}var n=t("../../renderers/webgl/shaders/TextureShader");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i},{"../../renderers/webgl/shaders/TextureShader":61}],42:[function(t,e,r){function i(t,e,r,i){if(a.call(this),n.sayHello(t),i)for(var h in s.DEFAULT_RENDER_OPTIONS)"undefined"==typeof i[h]&&(i[h]=s.DEFAULT_RENDER_OPTIONS[h]);else i=s.DEFAULT_RENDER_OPTIONS;this.type=s.RENDERER_TYPE.UNKNOWN,this.width=e||800,this.height=r||600,this.view=i.view||document.createElement("canvas"),this.resolution=i.resolution,this.transparent=i.transparent,this.autoResize=i.autoResize||!1,this.blendModes=null,this.preserveDrawingBuffer=i.preserveDrawingBuffer,this.clearBeforeRender=i.clearBeforeRender,this._backgroundColor=0,this._backgroundColorRgb=[0,0,0],this._backgroundColorString="#000000",this.backgroundColor=i.backgroundColor||this._backgroundColor,this._tempDisplayObjectParent={worldTransform:new o.Matrix,worldAlpha:1,children:[]},this._lastObjectRendered=this._tempDisplayObjectParent}var n=t("../utils"),o=t("../math"),s=t("../const"),a=t("eventemitter3");i.prototype=Object.create(a.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{backgroundColor:{get:function(){return this._backgroundColor},set:function(t){this._backgroundColor=t,this._backgroundColorString=n.hex2string(t),n.hex2rgb(t,this._backgroundColorRgb)}}}),i.prototype.resize=function(t,e){this.width=t*this.resolution,this.height=e*this.resolution,this.view.width=this.width,this.view.height=this.height,this.autoResize&&(this.view.style.width=this.width/this.resolution+"px",this.view.style.height=this.height/this.resolution+"px")},i.prototype.destroy=function(t){t&&this.view.parent&&this.view.parent.removeChild(this.view),this.type=s.RENDERER_TYPE.UNKNOWN,this.width=0,this.height=0,this.view=null,this.resolution=0,this.transparent=!1,this.autoResize=!1,this.blendModes=null,this.preserveDrawingBuffer=!1,this.clearBeforeRender=!1,this._backgroundColor=0,this._backgroundColorRgb=null,this._backgroundColorString=null}},{"../const":22,"../math":32,"../utils":76,eventemitter3:11}],43:[function(t,e,r){function i(t,e,r){n.call(this,"Canvas",t,e,r),this.type=h.RENDERER_TYPE.CANVAS,this.context=this.view.getContext("2d",{alpha:this.transparent}),this.refresh=!0,this.maskManager=new o,this.roundPixels=!1,this.currentScaleMode=h.SCALE_MODES.DEFAULT,this.currentBlendMode=h.BLEND_MODES.NORMAL,this.smoothProperty="imageSmoothingEnabled",this.context.imageSmoothingEnabled||(this.context.webkitImageSmoothingEnabled?this.smoothProperty="webkitImageSmoothingEnabled":this.context.mozImageSmoothingEnabled?this.smoothProperty="mozImageSmoothingEnabled":this.context.oImageSmoothingEnabled?this.smoothProperty="oImageSmoothingEnabled":this.context.msImageSmoothingEnabled&&(this.smoothProperty="msImageSmoothingEnabled")),this.initPlugins(),this._mapBlendModes(),this._tempDisplayObjectParent={worldTransform:new a.Matrix,worldAlpha:1},this.resize(t,e)}var n=t("../SystemRenderer"),o=t("./utils/CanvasMaskManager"),s=t("../../utils"),a=t("../../math"),h=t("../../const");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,s.pluginTarget.mixin(i),i.prototype.render=function(t){var e=t.parent;this._lastObjectRendered=t,t.parent=this._tempDisplayObjectParent,t.updateTransform(),t.parent=e,this.context.setTransform(1,0,0,1,0,0),this.context.globalAlpha=1,this.currentBlendMode=h.BLEND_MODES.NORMAL,this.context.globalCompositeOperation=this.blendModes[h.BLEND_MODES.NORMAL],navigator.isCocoonJS&&this.view.screencanvas&&(this.context.fillStyle="black",this.context.clear()),this.clearBeforeRender&&(this.transparent?this.context.clearRect(0,0,this.width,this.height):(this.context.fillStyle=this._backgroundColorString,this.context.fillRect(0,0,this.width,this.height))),this.renderDisplayObject(t,this.context)},i.prototype.destroy=function(t){this.destroyPlugins(),n.prototype.destroy.call(this,t),this.context=null,this.refresh=!0,this.maskManager.destroy(),this.maskManager=null,this.roundPixels=!1,this.currentScaleMode=0,this.currentBlendMode=0,this.smoothProperty=null},i.prototype.renderDisplayObject=function(t,e){var r=this.context;this.context=e,t.renderCanvas(this),this.context=r},i.prototype.resize=function(t,e){n.prototype.resize.call(this,t,e),this.currentScaleMode=h.SCALE_MODES.DEFAULT,this.smoothProperty&&(this.context[this.smoothProperty]=this.currentScaleMode===h.SCALE_MODES.LINEAR)},i.prototype._mapBlendModes=function(){this.blendModes||(this.blendModes={},s.canUseNewCanvasBlendModes()?(this.blendModes[h.BLEND_MODES.NORMAL]="source-over",this.blendModes[h.BLEND_MODES.ADD]="lighter",this.blendModes[h.BLEND_MODES.MULTIPLY]="multiply",this.blendModes[h.BLEND_MODES.SCREEN]="screen",this.blendModes[h.BLEND_MODES.OVERLAY]="overlay",this.blendModes[h.BLEND_MODES.DARKEN]="darken",this.blendModes[h.BLEND_MODES.LIGHTEN]="lighten",this.blendModes[h.BLEND_MODES.COLOR_DODGE]="color-dodge",this.blendModes[h.BLEND_MODES.COLOR_BURN]="color-burn",this.blendModes[h.BLEND_MODES.HARD_LIGHT]="hard-light",this.blendModes[h.BLEND_MODES.SOFT_LIGHT]="soft-light",this.blendModes[h.BLEND_MODES.DIFFERENCE]="difference",this.blendModes[h.BLEND_MODES.EXCLUSION]="exclusion",this.blendModes[h.BLEND_MODES.HUE]="hue",this.blendModes[h.BLEND_MODES.SATURATION]="saturate",this.blendModes[h.BLEND_MODES.COLOR]="color",this.blendModes[h.BLEND_MODES.LUMINOSITY]="luminosity"):(this.blendModes[h.BLEND_MODES.NORMAL]="source-over",this.blendModes[h.BLEND_MODES.ADD]="lighter",this.blendModes[h.BLEND_MODES.MULTIPLY]="source-over",this.blendModes[h.BLEND_MODES.SCREEN]="source-over",this.blendModes[h.BLEND_MODES.OVERLAY]="source-over",this.blendModes[h.BLEND_MODES.DARKEN]="source-over",this.blendModes[h.BLEND_MODES.LIGHTEN]="source-over",this.blendModes[h.BLEND_MODES.COLOR_DODGE]="source-over",this.blendModes[h.BLEND_MODES.COLOR_BURN]="source-over",this.blendModes[h.BLEND_MODES.HARD_LIGHT]="source-over",this.blendModes[h.BLEND_MODES.SOFT_LIGHT]="source-over",this.blendModes[h.BLEND_MODES.DIFFERENCE]="source-over",this.blendModes[h.BLEND_MODES.EXCLUSION]="source-over",this.blendModes[h.BLEND_MODES.HUE]="source-over",this.blendModes[h.BLEND_MODES.SATURATION]="source-over",this.blendModes[h.BLEND_MODES.COLOR]="source-over",this.blendModes[h.BLEND_MODES.LUMINOSITY]="source-over"))}},{"../../const":22,"../../math":32,"../../utils":76,"../SystemRenderer":42,"./utils/CanvasMaskManager":46}],44:[function(t,e,r){function i(t,e){this.canvas=document.createElement("canvas"),this.context=this.canvas.getContext("2d"),this.canvas.width=t,this.canvas.height=e}i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{width:{get:function(){return this.canvas.width},set:function(t){this.canvas.width=t}},height:{get:function(){return this.canvas.height},set:function(t){this.canvas.height=t}}}),i.prototype.clear=function(){this.context.setTransform(1,0,0,1,0,0),this.context.clearRect(0,0,this.canvas.width,this.canvas.height)},i.prototype.resize=function(t,e){this.canvas.width=t,this.canvas.height=e},i.prototype.destroy=function(){this.context=null,this.canvas=null}},{}],45:[function(t,e,r){var i=t("../../../const"),n={};e.exports=n,n.renderGraphics=function(t,e){var r=t.worldAlpha;t.dirty&&(this.updateGraphicsTint(t),t.dirty=!1);for(var n=0;n<t.graphicsData.length;n++){var o=t.graphicsData[n],s=o.shape,a=o._fillTint,h=o._lineTint;if(e.lineWidth=o.lineWidth,o.type===i.SHAPES.POLY){e.beginPath();var l=s.points;e.moveTo(l[0],l[1]);for(var u=1;u<l.length/2;u++)e.lineTo(l[2*u],l[2*u+1]);s.closed&&e.lineTo(l[0],l[1]),l[0]===l[l.length-2]&&l[1]===l[l.length-1]&&e.closePath(),o.fill&&(e.globalAlpha=o.fillAlpha*r,e.fillStyle="#"+("00000"+(0|a).toString(16)).substr(-6),e.fill()),o.lineWidth&&(e.globalAlpha=o.lineAlpha*r,e.strokeStyle="#"+("00000"+(0|h).toString(16)).substr(-6),e.stroke())}else if(o.type===i.SHAPES.RECT)(o.fillColor||0===o.fillColor)&&(e.globalAlpha=o.fillAlpha*r,e.fillStyle="#"+("00000"+(0|a).toString(16)).substr(-6),e.fillRect(s.x,s.y,s.width,s.height)),o.lineWidth&&(e.globalAlpha=o.lineAlpha*r,e.strokeStyle="#"+("00000"+(0|h).toString(16)).substr(-6),e.strokeRect(s.x,s.y,s.width,s.height));else if(o.type===i.SHAPES.CIRC)e.beginPath(),e.arc(s.x,s.y,s.radius,0,2*Math.PI),e.closePath(),o.fill&&(e.globalAlpha=o.fillAlpha*r,e.fillStyle="#"+("00000"+(0|a).toString(16)).substr(-6),e.fill()),o.lineWidth&&(e.globalAlpha=o.lineAlpha*r,e.strokeStyle="#"+("00000"+(0|h).toString(16)).substr(-6),e.stroke());else if(o.type===i.SHAPES.ELIP){var c=2*s.width,p=2*s.height,d=s.x-c/2,f=s.y-p/2;e.beginPath();var v=.5522848,g=c/2*v,m=p/2*v,y=d+c,x=f+p,b=d+c/2,_=f+p/2;e.moveTo(d,_),e.bezierCurveTo(d,_-m,b-g,f,b,f),e.bezierCurveTo(b+g,f,y,_-m,y,_),e.bezierCurveTo(y,_+m,b+g,x,b,x),e.bezierCurveTo(b-g,x,d,_+m,d,_),e.closePath(),o.fill&&(e.globalAlpha=o.fillAlpha*r,e.fillStyle="#"+("00000"+(0|a).toString(16)).substr(-6),e.fill()),o.lineWidth&&(e.globalAlpha=o.lineAlpha*r,e.strokeStyle="#"+("00000"+(0|h).toString(16)).substr(-6),e.stroke())}else if(o.type===i.SHAPES.RREC){var T=s.x,E=s.y,S=s.width,A=s.height,w=s.radius,C=Math.min(S,A)/2|0;w=w>C?C:w,e.beginPath(),e.moveTo(T,E+w),e.lineTo(T,E+A-w),e.quadraticCurveTo(T,E+A,T+w,E+A),e.lineTo(T+S-w,E+A),e.quadraticCurveTo(T+S,E+A,T+S,E+A-w),e.lineTo(T+S,E+w),e.quadraticCurveTo(T+S,E,T+S-w,E),e.lineTo(T+w,E),e.quadraticCurveTo(T,E,T,E+w),e.closePath(),(o.fillColor||0===o.fillColor)&&(e.globalAlpha=o.fillAlpha*r,e.fillStyle="#"+("00000"+(0|a).toString(16)).substr(-6),e.fill()),o.lineWidth&&(e.globalAlpha=o.lineAlpha*r,e.strokeStyle="#"+("00000"+(0|h).toString(16)).substr(-6),e.stroke())}}},n.renderGraphicsMask=function(t,e){var r=t.graphicsData.length;if(0!==r){e.beginPath();for(var n=0;r>n;n++){var o=t.graphicsData[n],s=o.shape;if(o.type===i.SHAPES.POLY){var a=s.points;e.moveTo(a[0],a[1]);for(var h=1;h<a.length/2;h++)e.lineTo(a[2*h],a[2*h+1]);a[0]===a[a.length-2]&&a[1]===a[a.length-1]&&e.closePath()}else if(o.type===i.SHAPES.RECT)e.rect(s.x,s.y,s.width,s.height),e.closePath();else if(o.type===i.SHAPES.CIRC)e.arc(s.x,s.y,s.radius,0,2*Math.PI),e.closePath();else if(o.type===i.SHAPES.ELIP){var l=2*s.width,u=2*s.height,c=s.x-l/2,p=s.y-u/2,d=.5522848,f=l/2*d,v=u/2*d,g=c+l,m=p+u,y=c+l/2,x=p+u/2;e.moveTo(c,x),e.bezierCurveTo(c,x-v,y-f,p,y,p),e.bezierCurveTo(y+f,p,g,x-v,g,x),e.bezierCurveTo(g,x+v,y+f,m,y,m),e.bezierCurveTo(y-f,m,c,x+v,c,x),e.closePath()}else if(o.type===i.SHAPES.RREC){var b=s.x,_=s.y,T=s.width,E=s.height,S=s.radius,A=Math.min(T,E)/2|0;S=S>A?A:S,e.moveTo(b,_+S),e.lineTo(b,_+E-S),e.quadraticCurveTo(b,_+E,b+S,_+E),e.lineTo(b+T-S,_+E),e.quadraticCurveTo(b+T,_+E,b+T,_+E-S),e.lineTo(b+T,_+S),e.quadraticCurveTo(b+T,_,b+T-S,_),e.lineTo(b+S,_),e.quadraticCurveTo(b,_,b,_+S),e.closePath()}}}},n.updateGraphicsTint=function(t){if(16777215!==t.tint)for(var e=(t.tint>>16&255)/255,r=(t.tint>>8&255)/255,i=(255&t.tint)/255,n=0;n<t.graphicsData.length;n++){var o=t.graphicsData[n],s=0|o.fillColor,a=0|o.lineColor;o._fillTint=((s>>16&255)/255*e*255<<16)+((s>>8&255)/255*r*255<<8)+(255&s)/255*i*255,o._lineTint=((a>>16&255)/255*e*255<<16)+((a>>8&255)/255*r*255<<8)+(255&a)/255*i*255}}},{"../../../const":22}],46:[function(t,e,r){function i(){}var n=t("./CanvasGraphics");i.prototype.constructor=i,e.exports=i,i.prototype.pushMask=function(t,e){e.context.save();var r=t.alpha,i=t.worldTransform,o=e.resolution;e.context.setTransform(i.a*o,i.b*o,i.c*o,i.d*o,i.tx*o,i.ty*o),t.texture||(n.renderGraphicsMask(t,e.context),e.context.clip()),t.worldAlpha=r},i.prototype.popMask=function(t){t.context.restore()},i.prototype.destroy=function(){}},{"./CanvasGraphics":45}],47:[function(t,e,r){var i=t("../../../utils"),n={};e.exports=n,n.getTintedTexture=function(t,e){var r=t.texture;e=n.roundColor(e);var i="#"+("00000"+(0|e).toString(16)).substr(-6);if(r.tintCache=r.tintCache||{},r.tintCache[i])return r.tintCache[i];var o=n.canvas||document.createElement("canvas");if(n.tintMethod(r,e,o),n.convertTintToImage){var s=new Image;s.src=o.toDataURL(),r.tintCache[i]=s}else r.tintCache[i]=o,n.canvas=null;return o},n.tintWithMultiply=function(t,e,r){var i=r.getContext("2d"),n=t.crop;r.width=n.width,r.height=n.height,i.fillStyle="#"+("00000"+(0|e).toString(16)).substr(-6),i.fillRect(0,0,n.width,n.height),i.globalCompositeOperation="multiply",i.drawImage(t.baseTexture.source,n.x,n.y,n.width,n.height,0,0,n.width,n.height),i.globalCompositeOperation="destination-atop",i.drawImage(t.baseTexture.source,n.x,n.y,n.width,n.height,0,0,n.width,n.height)},n.tintWithOverlay=function(t,e,r){var i=r.getContext("2d"),n=t.crop;r.width=n.width,r.height=n.height,i.globalCompositeOperation="copy",i.fillStyle="#"+("00000"+(0|e).toString(16)).substr(-6),i.fillRect(0,0,n.width,n.height),i.globalCompositeOperation="destination-atop",i.drawImage(t.baseTexture.source,n.x,n.y,n.width,n.height,0,0,n.width,n.height)},n.tintWithPerPixel=function(t,e,r){var n=r.getContext("2d"),o=t.crop;r.width=o.width,r.height=o.height,n.globalCompositeOperation="copy",n.drawImage(t.baseTexture.source,o.x,o.y,o.width,o.height,0,0,o.width,o.height);for(var s=i.hex2rgb(e),a=s[0],h=s[1],l=s[2],u=n.getImageData(0,0,o.width,o.height),c=u.data,p=0;p<c.length;p+=4)c[p+0]*=a,c[p+1]*=h,c[p+2]*=l;n.putImageData(u,0,0)},n.roundColor=function(t){var e=n.cacheStepsPerColorChannel,r=i.hex2rgb(t);return r[0]=Math.min(255,r[0]/e*e),r[1]=Math.min(255,r[1]/e*e),r[2]=Math.min(255,r[2]/e*e),i.rgb2hex(r)},n.cacheStepsPerColorChannel=8,n.convertTintToImage=!1,n.canUseMultiply=i.canUseNewCanvasBlendModes(),n.tintMethod=n.canUseMultiply?n.tintWithMultiply:n.tintWithPerPixel},{"../../../utils":76}],48:[function(t,e,r){function i(t,e,r){r=r||{},n.call(this,"WebGL",t,e,r),this.type=f.RENDERER_TYPE.WEBGL,this.handleContextLost=this.handleContextLost.bind(this),this.handleContextRestored=this.handleContextRestored.bind(this),this.view.addEventListener("webglcontextlost",this.handleContextLost,!1),this.view.addEventListener("webglcontextrestored",this.handleContextRestored,!1),this._useFXAA=!!r.forceFXAA&&r.antialias,this._FXAAFilter=null,this._contextOptions={alpha:this.transparent,antialias:r.antialias,premultipliedAlpha:this.transparent&&"notMultiplied"!==this.transparent,stencil:!0,preserveDrawingBuffer:r.preserveDrawingBuffer},this.drawCount=0,this.shaderManager=new o(this),this.maskManager=new s(this),this.stencilManager=new a(this),this.filterManager=new h(this),this.blendModeManager=new l(this),this.currentRenderTarget=null,this.currentRenderer=new c(this),this.initPlugins(),this._createContext(),this._initContext(),this._mapGlModes(),this._renderTargetStack=[]}var n=t("../SystemRenderer"),o=t("./managers/ShaderManager"),s=t("./managers/MaskManager"),a=t("./managers/StencilManager"),h=t("./managers/FilterManager"),l=t("./managers/BlendModeManager"),u=t("./utils/RenderTarget"),c=t("./utils/ObjectRenderer"),p=t("./filters/FXAAFilter"),d=t("../../utils"),f=t("../../const");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,d.pluginTarget.mixin(i),i.glContextId=0,i.prototype._createContext=function(){var t=this.view.getContext("webgl",this._contextOptions)||this.view.getContext("experimental-webgl",this._contextOptions);if(this.gl=t,!t)throw new Error("This browser does not support webGL. Try using the canvas renderer");this.glContextId=i.glContextId++,t.id=this.glContextId,t.renderer=this},i.prototype._initContext=function(){var t=this.gl;t.disable(t.DEPTH_TEST),t.disable(t.CULL_FACE),t.enable(t.BLEND),this.renderTarget=new u(t,this.width,this.height,null,this.resolution,!0),this.setRenderTarget(this.renderTarget),this.emit("context",t),this.resize(this.width,this.height),this._useFXAA||(this._useFXAA=this._contextOptions.antialias&&!t.getContextAttributes().antialias),this._useFXAA&&(window.console.warn("FXAA antialiasing being used instead of native antialiasing"),this._FXAAFilter=[new p])},i.prototype.render=function(t){if(!this.gl.isContextLost()){this.drawCount=0,this._lastObjectRendered=t,this._useFXAA&&(this._FXAAFilter[0].uniforms.resolution.value.x=this.width,this._FXAAFilter[0].uniforms.resolution.value.y=this.height,t.filterArea=this.renderTarget.size,t.filters=this._FXAAFilter);var e=t.parent;t.parent=this._tempDisplayObjectParent,t.updateTransform(),t.parent=e;var r=this.gl;this.setRenderTarget(this.renderTarget),this.clearBeforeRender&&(this.transparent?r.clearColor(0,0,0,0):r.clearColor(this._backgroundColorRgb[0],this._backgroundColorRgb[1],this._backgroundColorRgb[2],1),r.clear(r.COLOR_BUFFER_BIT)),this.renderDisplayObject(t,this.renderTarget)}},i.prototype.renderDisplayObject=function(t,e,r){this.setRenderTarget(e),r&&e.clear(),this.filterManager.setFilterStack(e.filterStack),t.renderWebGL(this),this.currentRenderer.flush()},i.prototype.setObjectRenderer=function(t){this.currentRenderer!==t&&(this.currentRenderer.stop(),this.currentRenderer=t,this.currentRenderer.start())},i.prototype.setRenderTarget=function(t){this.currentRenderTarget!==t&&(this.currentRenderTarget=t,this.currentRenderTarget.activate(),this.stencilManager.setMaskStack(t.stencilMaskStack))},i.prototype.resize=function(t,e){n.prototype.resize.call(this,t,e),this.filterManager.resize(t,e),this.renderTarget.resize(t,e),this.currentRenderTarget===this.renderTarget&&(this.renderTarget.activate(),this.gl.viewport(0,0,this.width,this.height))},i.prototype.updateTexture=function(t){if(t=t.baseTexture||t,t.hasLoaded){var e=this.gl;return t._glTextures[e.id]||(t._glTextures[e.id]=e.createTexture(),t.on("update",this.updateTexture,this),t.on("dispose",this.destroyTexture,this)),e.bindTexture(e.TEXTURE_2D,t._glTextures[e.id]),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultipliedAlpha),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t.source),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,t.scaleMode===f.SCALE_MODES.LINEAR?e.LINEAR:e.NEAREST),t.mipmap&&t.isPowerOfTwo?(e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,t.scaleMode===f.SCALE_MODES.LINEAR?e.LINEAR_MIPMAP_LINEAR:e.NEAREST_MIPMAP_NEAREST),e.generateMipmap(e.TEXTURE_2D)):e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,t.scaleMode===f.SCALE_MODES.LINEAR?e.LINEAR:e.NEAREST),t.isPowerOfTwo?(e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT)):(e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)),t._glTextures[e.id]}},i.prototype.destroyTexture=function(t){t=t.baseTexture||t,t.hasLoaded&&t._glTextures[this.gl.id]&&this.gl.deleteTexture(t._glTextures[this.gl.id])},i.prototype.handleContextLost=function(t){t.preventDefault()},i.prototype.handleContextRestored=function(){this._initContext();for(var t in d.BaseTextureCache)d.BaseTextureCache[t]._glTextures.length=0},i.prototype.destroy=function(t){this.destroyPlugins(),this.view.removeEventListener("webglcontextlost",this.handleContextLost),this.view.removeEventListener("webglcontextrestored",this.handleContextRestored),n.prototype.destroy.call(this,t),this.uid=0,this.shaderManager.destroy(),this.maskManager.destroy(),this.stencilManager.destroy(),this.filterManager.destroy(),this.shaderManager=null,this.maskManager=null,this.filterManager=null,this.blendModeManager=null,this.handleContextLost=null,this.handleContextRestored=null,this._contextOptions=null,this.drawCount=0,this.gl=null},i.prototype._mapGlModes=function(){var t=this.gl;this.blendModes||(this.blendModes={},this.blendModes[f.BLEND_MODES.NORMAL]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.ADD]=[t.SRC_ALPHA,t.DST_ALPHA],this.blendModes[f.BLEND_MODES.MULTIPLY]=[t.DST_COLOR,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.SCREEN]=[t.SRC_ALPHA,t.ONE],this.blendModes[f.BLEND_MODES.OVERLAY]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.DARKEN]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.LIGHTEN]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.COLOR_DODGE]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.COLOR_BURN]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.HARD_LIGHT]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.SOFT_LIGHT]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.DIFFERENCE]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.EXCLUSION]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.HUE]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.SATURATION]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.COLOR]=[t.ONE,t.ONE_MINUS_SRC_ALPHA],this.blendModes[f.BLEND_MODES.LUMINOSITY]=[t.ONE,t.ONE_MINUS_SRC_ALPHA]),this.drawModes||(this.drawModes={},this.drawModes[f.DRAW_MODES.POINTS]=t.POINTS,this.drawModes[f.DRAW_MODES.LINES]=t.LINES,this.drawModes[f.DRAW_MODES.LINE_LOOP]=t.LINE_LOOP,this.drawModes[f.DRAW_MODES.LINE_STRIP]=t.LINE_STRIP,this.drawModes[f.DRAW_MODES.TRIANGLES]=t.TRIANGLES,this.drawModes[f.DRAW_MODES.TRIANGLE_STRIP]=t.TRIANGLE_STRIP,this.drawModes[f.DRAW_MODES.TRIANGLE_FAN]=t.TRIANGLE_FAN)}},{"../../const":22,"../../utils":76,"../SystemRenderer":42,"./filters/FXAAFilter":50,"./managers/BlendModeManager":52,"./managers/FilterManager":53,"./managers/MaskManager":54,"./managers/ShaderManager":55,"./managers/StencilManager":56,"./utils/ObjectRenderer":62,"./utils/RenderTarget":64}],49:[function(t,e,r){function i(t,e,r){this.shaders=[],this.padding=0,this.uniforms=r||{},this.vertexSrc=t||n.defaultVertexSrc,this.fragmentSrc=e||n.defaultFragmentSrc}var n=t("../shaders/TextureShader");i.prototype.constructor=i,e.exports=i,i.prototype.getShader=function(t){var e=t.gl,r=this.shaders[e.id];return r||(r=new n(t.shaderManager,this.vertexSrc,this.fragmentSrc,this.uniforms,this.attributes),this.shaders[e.id]=r),r},i.prototype.applyFilter=function(t,e,r,i){var n=this.getShader(t);t.filterManager.applyFilter(n,e,r,i)},i.prototype.syncUniform=function(t){for(var e=0,r=this.shaders.length;r>e;++e)this.shaders[e].syncUniform(t)}},{"../shaders/TextureShader":61}],50:[function(t,e,r){function i(){n.call(this,"\nprecision mediump float;\n\nattribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\nattribute vec4 aColor;\n\nuniform mat3 projectionMatrix;\nuniform vec2 resolution;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nvarying vec2 vResolution;\n\n//texcoords computed in vertex step\n//to avoid dependent texture reads\nvarying vec2 v_rgbNW;\nvarying vec2 v_rgbNE;\nvarying vec2 v_rgbSW;\nvarying vec2 v_rgbSE;\nvarying vec2 v_rgbM;\n\n\nvoid texcoords(vec2 fragCoord, vec2 resolution,\n            out vec2 v_rgbNW, out vec2 v_rgbNE,\n            out vec2 v_rgbSW, out vec2 v_rgbSE,\n            out vec2 v_rgbM) {\n    vec2 inverseVP = 1.0 / resolution.xy;\n    v_rgbNW = (fragCoord + vec2(-1.0, -1.0)) * inverseVP;\n    v_rgbNE = (fragCoord + vec2(1.0, -1.0)) * inverseVP;\n    v_rgbSW = (fragCoord + vec2(-1.0, 1.0)) * inverseVP;\n    v_rgbSE = (fragCoord + vec2(1.0, 1.0)) * inverseVP;\n    v_rgbM = vec2(fragCoord * inverseVP);\n}\n\nvoid main(void){\n   gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);\n   vTextureCoord = aTextureCoord;\n   vColor = vec4(aColor.rgb * aColor.a, aColor.a);\n   vResolution = resolution;\n\n   //compute the texture coords and send them to varyings\n   texcoords(aTextureCoord * resolution, resolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);\n}\n",'precision lowp float;\n\n\n/**\nBasic FXAA implementation based on the code on geeks3d.com with the\nmodification that the texture2DLod stuff was removed since it\'s\nunsupported by WebGL.\n\n--\n\nFrom:\nhttps://github.com/mitsuhiko/webgl-meincraft\n\nCopyright (c) 2011 by Armin Ronacher.\n\nSome rights reserved.\n\nRedistribution and use in source and binary forms, with or without\nmodification, are permitted provided that the following conditions are\nmet:\n\n    * Redistributions of source code must retain the above copyright\n      notice, this list of conditions and the following disclaimer.\n\n    * Redistributions in binary form must reproduce the above\n      copyright notice, this list of conditions and the following\n      disclaimer in the documentation and/or other materials provided\n      with the distribution.\n\n    * The names of the contributors may not be used to endorse or\n      promote products derived from this software without specific\n      prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS\n"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT\nLIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR\nA PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT\nOWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,\nSPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT\nLIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,\nDATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY\nTHEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT\n(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE\nOF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\n*/\n\n#ifndef FXAA_REDUCE_MIN\n    #define FXAA_REDUCE_MIN   (1.0/ 128.0)\n#endif\n#ifndef FXAA_REDUCE_MUL\n    #define FXAA_REDUCE_MUL   (1.0 / 8.0)\n#endif\n#ifndef FXAA_SPAN_MAX\n    #define FXAA_SPAN_MAX     8.0\n#endif\n\n//optimized version for mobile, where dependent\n//texture reads can be a bottleneck\nvec4 fxaa(sampler2D tex, vec2 fragCoord, vec2 resolution,\n            vec2 v_rgbNW, vec2 v_rgbNE,\n            vec2 v_rgbSW, vec2 v_rgbSE,\n            vec2 v_rgbM) {\n    vec4 color;\n    mediump vec2 inverseVP = vec2(1.0 / resolution.x, 1.0 / resolution.y);\n    vec3 rgbNW = texture2D(tex, v_rgbNW).xyz;\n    vec3 rgbNE = texture2D(tex, v_rgbNE).xyz;\n    vec3 rgbSW = texture2D(tex, v_rgbSW).xyz;\n    vec3 rgbSE = texture2D(tex, v_rgbSE).xyz;\n    vec4 texColor = texture2D(tex, v_rgbM);\n    vec3 rgbM  = texColor.xyz;\n    vec3 luma = vec3(0.299, 0.587, 0.114);\n    float lumaNW = dot(rgbNW, luma);\n    float lumaNE = dot(rgbNE, luma);\n    float lumaSW = dot(rgbSW, luma);\n    float lumaSE = dot(rgbSE, luma);\n    float lumaM  = dot(rgbM,  luma);\n    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));\n    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));\n\n    mediump vec2 dir;\n    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));\n    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));\n\n    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) *\n                          (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);\n\n    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);\n    dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX),\n              max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),\n              dir * rcpDirMin)) * inverseVP;\n\n    vec3 rgbA = 0.5 * (\n        texture2D(tex, fragCoord * inverseVP + dir * (1.0 / 3.0 - 0.5)).xyz +\n        texture2D(tex, fragCoord * inverseVP + dir * (2.0 / 3.0 - 0.5)).xyz);\n    vec3 rgbB = rgbA * 0.5 + 0.25 * (\n        texture2D(tex, fragCoord * inverseVP + dir * -0.5).xyz +\n        texture2D(tex, fragCoord * inverseVP + dir * 0.5).xyz);\n\n    float lumaB = dot(rgbB, luma);\n    if ((lumaB < lumaMin) || (lumaB > lumaMax))\n        color = vec4(rgbA, texColor.a);\n    else\n        color = vec4(rgbB, texColor.a);\n    return color;\n}\n\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\nvarying vec2 vResolution;\n\n//texcoords computed in vertex step\n//to avoid dependent texture reads\nvarying vec2 v_rgbNW;\nvarying vec2 v_rgbNE;\nvarying vec2 v_rgbSW;\nvarying vec2 v_rgbSE;\nvarying vec2 v_rgbM;\n\nuniform sampler2D uSampler;\n\n\nvoid main(void){\n\n    gl_FragColor = fxaa(uSampler, vTextureCoord * vResolution, vResolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);\n\n}\n',{
resolution:{type:"v2",value:{x:1,y:1}}})}var n=t("./AbstractFilter");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r){var i=t.filterManager,n=this.getShader(t);i.applyFilter(n,e,r)}},{"./AbstractFilter":49}],51:[function(t,e,r){function i(t){var e=new o.Matrix;n.call(this,"attribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\nattribute vec4 aColor;\n\nuniform mat3 projectionMatrix;\nuniform mat3 otherMatrix;\n\nvarying vec2 vMaskCoord;\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nvoid main(void)\n{\n    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);\n    vTextureCoord = aTextureCoord;\n    vMaskCoord = ( otherMatrix * vec3( aTextureCoord, 1.0)  ).xy;\n    vColor = vec4(aColor.rgb * aColor.a, aColor.a);\n}\n","precision lowp float;\n\nvarying vec2 vMaskCoord;\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nuniform sampler2D uSampler;\nuniform float alpha;\nuniform sampler2D mask;\n\nvoid main(void)\n{\n    // check clip! this will stop the mask bleeding out from the edges\n    vec2 text = abs( vMaskCoord - 0.5 );\n    text = step(0.5, text);\n    float clip = 1.0 - max(text.y, text.x);\n    vec4 original = texture2D(uSampler, vTextureCoord);\n    vec4 masky = texture2D(mask, vMaskCoord);\n    original *= (masky.r * masky.a * alpha * clip);\n    gl_FragColor = original;\n}\n",{mask:{type:"sampler2D",value:t._texture},alpha:{type:"f",value:1},otherMatrix:{type:"mat3",value:e.toArray(!0)}}),this.maskSprite=t,this.maskMatrix=e}var n=t("./AbstractFilter"),o=t("../../../math");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r){var i=t.filterManager;this.uniforms.mask.value=this.maskSprite._texture,i.calculateMappedMatrix(e.frame,this.maskSprite,this.maskMatrix),this.uniforms.otherMatrix.value=this.maskMatrix.toArray(!0),this.uniforms.alpha.value=this.maskSprite.worldAlpha;var n=this.getShader(t);i.applyFilter(n,e,r)},Object.defineProperties(i.prototype,{map:{get:function(){return this.uniforms.mask.value},set:function(t){this.uniforms.mask.value=t}},offset:{get:function(){return this.uniforms.offset.value},set:function(t){this.uniforms.offset.value=t}}})},{"../../../math":32,"./AbstractFilter":49}],52:[function(t,e,r){function i(t){n.call(this,t),this.currentBlendMode=99999}var n=t("./WebGLManager");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.setBlendMode=function(t){if(this.currentBlendMode===t)return!1;this.currentBlendMode=t;var e=this.renderer.blendModes[this.currentBlendMode];return this.renderer.gl.blendFunc(e[0],e[1]),!0}},{"./WebGLManager":57}],53:[function(t,e,r){function i(t){n.call(this,t),this.filterStack=[],this.filterStack.push({renderTarget:t.currentRenderTarget,filter:[],bounds:null}),this.texturePool=[],this.textureSize=new h.Rectangle(0,0,t.width,t.height),this.currentFrame=null}var n=t("./WebGLManager"),o=t("../utils/RenderTarget"),s=t("../../../const"),a=t("../utils/Quad"),h=t("../../../math");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.onContextChange=function(){this.texturePool.length=0;var t=this.renderer.gl;this.quad=new a(t)},i.prototype.setFilterStack=function(t){this.filterStack=t},i.prototype.pushFilter=function(t,e){var r=t.filterArea?t.filterArea.clone():t.getBounds();r.x=0|r.x,r.y=0|r.y,r.width=0|r.width,r.height=0|r.height;var i=0|e[0].padding;if(r.x-=i,r.y-=i,r.width+=2*i,r.height+=2*i,this.renderer.currentRenderTarget.transform){var n=this.renderer.currentRenderTarget.transform;r.x+=n.tx,r.y+=n.ty,this.capFilterArea(r),r.x-=n.tx,r.y-=n.ty}else this.capFilterArea(r);if(r.width>0&&r.height>0){this.currentFrame=r;var o=this.getRenderTarget();this.renderer.setRenderTarget(o),o.clear(),this.filterStack.push({renderTarget:o,filter:e})}else this.filterStack.push({renderTarget:null,filter:e})},i.prototype.popFilter=function(){var t=this.filterStack.pop(),e=this.filterStack[this.filterStack.length-1],r=t.renderTarget;if(t.renderTarget){var i=e.renderTarget,n=this.renderer.gl;this.currentFrame=r.frame,this.quad.map(this.textureSize,r.frame),n.bindBuffer(n.ARRAY_BUFFER,this.quad.vertexBuffer),n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,this.quad.indexBuffer);var o=t.filter;if(n.vertexAttribPointer(this.renderer.shaderManager.defaultShader.attributes.aVertexPosition,2,n.FLOAT,!1,0,0),n.vertexAttribPointer(this.renderer.shaderManager.defaultShader.attributes.aTextureCoord,2,n.FLOAT,!1,0,32),n.vertexAttribPointer(this.renderer.shaderManager.defaultShader.attributes.aColor,4,n.FLOAT,!1,0,64),this.renderer.blendModeManager.setBlendMode(s.BLEND_MODES.NORMAL),1===o.length)o[0].uniforms.dimensions&&(o[0].uniforms.dimensions.value[0]=this.renderer.width,o[0].uniforms.dimensions.value[1]=this.renderer.height,o[0].uniforms.dimensions.value[2]=this.quad.vertices[0],o[0].uniforms.dimensions.value[3]=this.quad.vertices[5]),o[0].applyFilter(this.renderer,r,i),this.returnRenderTarget(r);else{for(var a=r,h=this.getRenderTarget(!0),l=0;l<o.length-1;l++){var u=o[l];u.uniforms.dimensions&&(u.uniforms.dimensions.value[0]=this.renderer.width,u.uniforms.dimensions.value[1]=this.renderer.height,u.uniforms.dimensions.value[2]=this.quad.vertices[0],u.uniforms.dimensions.value[3]=this.quad.vertices[5]),u.applyFilter(this.renderer,a,h);var c=a;a=h,h=c}o[o.length-1].applyFilter(this.renderer,a,i),this.returnRenderTarget(a),this.returnRenderTarget(h)}return t.filter}},i.prototype.getRenderTarget=function(t){var e=this.texturePool.pop()||new o(this.renderer.gl,this.textureSize.width,this.textureSize.height,s.SCALE_MODES.LINEAR,this.renderer.resolution*s.FILTER_RESOLUTION);return e.frame=this.currentFrame,t&&e.clear(!0),e},i.prototype.returnRenderTarget=function(t){this.texturePool.push(t)},i.prototype.applyFilter=function(t,e,r,i){var n=this.renderer.gl;this.renderer.setRenderTarget(r),i&&r.clear(),this.renderer.shaderManager.setShader(t),t.uniforms.projectionMatrix.value=this.renderer.currentRenderTarget.projectionMatrix.toArray(!0),t.syncUniforms(),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,e.texture),n.drawElements(n.TRIANGLES,6,n.UNSIGNED_SHORT,0)},i.prototype.calculateMappedMatrix=function(t,e,r){var i=e.worldTransform.copy(h.Matrix.TEMP_MATRIX),n=e._texture.baseTexture,o=r.identity(),s=this.textureSize.height/this.textureSize.width;o.translate(t.x/this.textureSize.width,t.y/this.textureSize.height),o.scale(1,s);var a=this.textureSize.width/n.width,l=this.textureSize.height/n.height;return i.tx/=n.width*a,i.ty/=n.width*a,i.invert(),o.prepend(i),o.scale(1,1/s),o.scale(a,l),o.translate(e.anchor.x,e.anchor.y),o},i.prototype.capFilterArea=function(t){t.x<0&&(t.width+=t.x,t.x=0),t.y<0&&(t.height+=t.y,t.y=0),t.x+t.width>this.textureSize.width&&(t.width=this.textureSize.width-t.x),t.y+t.height>this.textureSize.height&&(t.height=this.textureSize.height-t.y)},i.prototype.resize=function(t,e){this.textureSize.width=t,this.textureSize.height=e;for(var r=0;r<this.texturePool.length;r++)this.texturePool[r].resize(t,e)},i.prototype.destroy=function(){this.filterStack=null,this.offsetY=0;for(var t=0;t<this.texturePool.length;t++)this.texturePool[t].destroy();this.texturePool=null}},{"../../../const":22,"../../../math":32,"../utils/Quad":63,"../utils/RenderTarget":64,"./WebGLManager":57}],54:[function(t,e,r){function i(t){n.call(this,t),this.stencilStack=[],this.reverse=!0,this.count=0,this.alphaMaskPool=[]}var n=t("./WebGLManager"),o=t("../filters/SpriteMaskFilter");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.pushMask=function(t,e){e.texture?this.pushSpriteMask(t,e):this.pushStencilMask(t,e)},i.prototype.popMask=function(t,e){e.texture?this.popSpriteMask(t,e):this.popStencilMask(t,e)},i.prototype.pushSpriteMask=function(t,e){var r=this.alphaMaskPool.pop();r||(r=[new o(e)]),r[0].maskSprite=e,this.renderer.filterManager.pushFilter(t,r)},i.prototype.popSpriteMask=function(){var t=this.renderer.filterManager.popFilter();this.alphaMaskPool.push(t)},i.prototype.pushStencilMask=function(t,e){this.renderer.stencilManager.pushMask(e)},i.prototype.popStencilMask=function(t,e){this.renderer.stencilManager.popMask(e)}},{"../filters/SpriteMaskFilter":51,"./WebGLManager":57}],55:[function(t,e,r){function i(t){n.call(this,t),this.maxAttibs=10,this.attribState=[],this.tempAttribState=[];for(var e=0;e<this.maxAttibs;e++)this.attribState[e]=!1;this.stack=[],this._currentId=-1,this.currentShader=null}var n=t("./WebGLManager"),o=t("../shaders/TextureShader"),s=t("../shaders/ComplexPrimitiveShader"),a=t("../shaders/PrimitiveShader"),h=t("../../../utils");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,h.pluginTarget.mixin(i),e.exports=i,i.prototype.onContextChange=function(){this.initPlugins();var t=this.renderer.gl;this.maxAttibs=t.getParameter(t.MAX_VERTEX_ATTRIBS),this.attribState=[];for(var e=0;e<this.maxAttibs;e++)this.attribState[e]=!1;this.defaultShader=new o(this),this.primitiveShader=new a(this),this.complexPrimitiveShader=new s(this)},i.prototype.setAttribs=function(t){var e;for(e=0;e<this.tempAttribState.length;e++)this.tempAttribState[e]=!1;for(var r in t)this.tempAttribState[t[r]]=!0;var i=this.renderer.gl;for(e=0;e<this.attribState.length;e++)this.attribState[e]!==this.tempAttribState[e]&&(this.attribState[e]=this.tempAttribState[e],this.attribState[e]?i.enableVertexAttribArray(e):i.disableVertexAttribArray(e))},i.prototype.setShader=function(t){return this._currentId===t.uid?!1:(this._currentId=t.uid,this.currentShader=t,this.renderer.gl.useProgram(t.program),this.setAttribs(t.attributes),!0)},i.prototype.destroy=function(){n.prototype.destroy.call(this),this.destroyPlugins(),this.attribState=null,this.tempAttribState=null}},{"../../../utils":76,"../shaders/ComplexPrimitiveShader":58,"../shaders/PrimitiveShader":59,"../shaders/TextureShader":61,"./WebGLManager":57}],56:[function(t,e,r){function i(t){n.call(this,t),this.stencilMaskStack=null}var n=t("./WebGLManager"),o=t("../../../utils");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.setMaskStack=function(t){this.stencilMaskStack=t;var e=this.renderer.gl;0===t.stencilStack.length?e.disable(e.STENCIL_TEST):e.enable(e.STENCIL_TEST)},i.prototype.pushStencil=function(t,e){this.renderer.currentRenderTarget.attachStencilBuffer();var r=this.renderer.gl,i=this.stencilMaskStack;this.bindGraphics(t,e,this.renderer),0===i.stencilStack.length&&(r.enable(r.STENCIL_TEST),r.clear(r.STENCIL_BUFFER_BIT),i.reverse=!0,i.count=0),i.stencilStack.push(e);var n=i.count;r.colorMask(!1,!1,!1,!1),r.stencilFunc(r.ALWAYS,0,255),r.stencilOp(r.KEEP,r.KEEP,r.INVERT),1===e.mode?(r.drawElements(r.TRIANGLE_FAN,e.indices.length-4,r.UNSIGNED_SHORT,0),i.reverse?(r.stencilFunc(r.EQUAL,255-n,255),r.stencilOp(r.KEEP,r.KEEP,r.DECR)):(r.stencilFunc(r.EQUAL,n,255),r.stencilOp(r.KEEP,r.KEEP,r.INCR)),r.drawElements(r.TRIANGLE_FAN,4,r.UNSIGNED_SHORT,2*(e.indices.length-4)),i.reverse?r.stencilFunc(r.EQUAL,255-(n+1),255):r.stencilFunc(r.EQUAL,n+1,255),i.reverse=!i.reverse):(i.reverse?(r.stencilFunc(r.EQUAL,n,255),r.stencilOp(r.KEEP,r.KEEP,r.INCR)):(r.stencilFunc(r.EQUAL,255-n,255),r.stencilOp(r.KEEP,r.KEEP,r.DECR)),r.drawElements(r.TRIANGLE_STRIP,e.indices.length,r.UNSIGNED_SHORT,0),i.reverse?r.stencilFunc(r.EQUAL,n+1,255):r.stencilFunc(r.EQUAL,255-(n+1),255)),r.colorMask(!0,!0,!0,!0),r.stencilOp(r.KEEP,r.KEEP,r.KEEP),i.count++},i.prototype.bindGraphics=function(t,e){this._currentGraphics=t;var r,i=this.renderer.gl;1===e.mode?(r=this.renderer.shaderManager.complexPrimitiveShader,this.renderer.shaderManager.setShader(r),i.uniformMatrix3fv(r.uniforms.translationMatrix._location,!1,t.worldTransform.toArray(!0)),i.uniformMatrix3fv(r.uniforms.projectionMatrix._location,!1,this.renderer.currentRenderTarget.projectionMatrix.toArray(!0)),i.uniform3fv(r.uniforms.tint._location,o.hex2rgb(t.tint)),i.uniform3fv(r.uniforms.color._location,e.color),i.uniform1f(r.uniforms.alpha._location,t.worldAlpha),i.bindBuffer(i.ARRAY_BUFFER,e.buffer),i.vertexAttribPointer(r.attributes.aVertexPosition,2,i.FLOAT,!1,8,0),i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.indexBuffer)):(r=this.renderer.shaderManager.primitiveShader,this.renderer.shaderManager.setShader(r),i.uniformMatrix3fv(r.uniforms.translationMatrix._location,!1,t.worldTransform.toArray(!0)),i.uniformMatrix3fv(r.uniforms.projectionMatrix._location,!1,this.renderer.currentRenderTarget.projectionMatrix.toArray(!0)),i.uniform3fv(r.uniforms.tint._location,o.hex2rgb(t.tint)),i.uniform1f(r.uniforms.alpha._location,t.worldAlpha),i.bindBuffer(i.ARRAY_BUFFER,e.buffer),i.vertexAttribPointer(r.attributes.aVertexPosition,2,i.FLOAT,!1,24,0),i.vertexAttribPointer(r.attributes.aColor,4,i.FLOAT,!1,24,8),i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.indexBuffer))},i.prototype.popStencil=function(t,e){var r=this.renderer.gl,i=this.stencilMaskStack;if(i.stencilStack.pop(),i.count--,0===i.stencilStack.length)r.disable(r.STENCIL_TEST);else{var n=i.count;this.bindGraphics(t,e,this.renderer),r.colorMask(!1,!1,!1,!1),1===e.mode?(i.reverse=!i.reverse,i.reverse?(r.stencilFunc(r.EQUAL,255-(n+1),255),r.stencilOp(r.KEEP,r.KEEP,r.INCR)):(r.stencilFunc(r.EQUAL,n+1,255),r.stencilOp(r.KEEP,r.KEEP,r.DECR)),r.drawElements(r.TRIANGLE_FAN,4,r.UNSIGNED_SHORT,2*(e.indices.length-4)),r.stencilFunc(r.ALWAYS,0,255),r.stencilOp(r.KEEP,r.KEEP,r.INVERT),r.drawElements(r.TRIANGLE_FAN,e.indices.length-4,r.UNSIGNED_SHORT,0),i.reverse?r.stencilFunc(r.EQUAL,n,255):r.stencilFunc(r.EQUAL,255-n,255)):(i.reverse?(r.stencilFunc(r.EQUAL,n+1,255),r.stencilOp(r.KEEP,r.KEEP,r.DECR)):(r.stencilFunc(r.EQUAL,255-(n+1),255),r.stencilOp(r.KEEP,r.KEEP,r.INCR)),r.drawElements(r.TRIANGLE_STRIP,e.indices.length,r.UNSIGNED_SHORT,0),i.reverse?r.stencilFunc(r.EQUAL,n,255):r.stencilFunc(r.EQUAL,255-n,255)),r.colorMask(!0,!0,!0,!0),r.stencilOp(r.KEEP,r.KEEP,r.KEEP)}},i.prototype.destroy=function(){n.prototype.destroy.call(this),this.stencilMaskStack.stencilStack=null},i.prototype.pushMask=function(t){this.renderer.setObjectRenderer(this.renderer.plugins.graphics),t.dirty&&this.renderer.plugins.graphics.updateGraphics(t,this.renderer.gl),t._webGL[this.renderer.gl.id].data.length&&this.pushStencil(t,t._webGL[this.renderer.gl.id].data[0],this.renderer)},i.prototype.popMask=function(t){this.renderer.setObjectRenderer(this.renderer.plugins.graphics),this.popStencil(t,t._webGL[this.renderer.gl.id].data[0],this.renderer)}},{"../../../utils":76,"./WebGLManager":57}],57:[function(t,e,r){function i(t){this.renderer=t,this.renderer.on("context",this.onContextChange,this)}i.prototype.constructor=i,e.exports=i,i.prototype.onContextChange=function(){},i.prototype.destroy=function(){this.renderer.off("context",this.onContextChange,this),this.renderer=null}},{}],58:[function(t,e,r){function i(t){n.call(this,t,["attribute vec2 aVertexPosition;","uniform mat3 translationMatrix;","uniform mat3 projectionMatrix;","uniform vec3 tint;","uniform float alpha;","uniform vec3 color;","varying vec4 vColor;","void main(void){","   gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);","   vColor = vec4(color * alpha * tint, alpha);","}"].join("\n"),["precision mediump float;","varying vec4 vColor;","void main(void){","   gl_FragColor = vColor;","}"].join("\n"),{tint:{type:"3f",value:[0,0,0]},alpha:{type:"1f",value:0},color:{type:"3f",value:[0,0,0]},translationMatrix:{type:"mat3",value:new Float32Array(9)},projectionMatrix:{type:"mat3",value:new Float32Array(9)}},{aVertexPosition:0})}var n=t("./Shader");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i},{"./Shader":60}],59:[function(t,e,r){function i(t){n.call(this,t,["attribute vec2 aVertexPosition;","attribute vec4 aColor;","uniform mat3 translationMatrix;","uniform mat3 projectionMatrix;","uniform float alpha;","uniform float flipY;","uniform vec3 tint;","varying vec4 vColor;","void main(void){","   gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);","   vColor = aColor * vec4(tint * alpha, alpha);","}"].join("\n"),["precision mediump float;","varying vec4 vColor;","void main(void){","   gl_FragColor = vColor;","}"].join("\n"),{tint:{type:"3f",value:[0,0,0]},alpha:{type:"1f",value:0},translationMatrix:{type:"mat3",value:new Float32Array(9)},projectionMatrix:{type:"mat3",value:new Float32Array(9)}},{aVertexPosition:0,aColor:0})}var n=t("./Shader");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i},{"./Shader":60}],60:[function(t,e,r){function i(t,e,r,i,o){if(!e||!r)throw new Error("Pixi.js Error. Shader requires vertexSrc and fragmentSrc");this.uid=n.uid(),this.gl=t.renderer.gl,this.shaderManager=t,this.program=null,this.uniforms=i||{},this.attributes=o||{},this.textureCount=1,this.vertexSrc=e,this.fragmentSrc=r,this.init()}var n=t("../../../utils");i.prototype.constructor=i,e.exports=i,i.prototype.init=function(){this.compile(),this.gl.useProgram(this.program),this.cacheUniformLocations(Object.keys(this.uniforms)),this.cacheAttributeLocations(Object.keys(this.attributes))},i.prototype.cacheUniformLocations=function(t){for(var e=0;e<t.length;++e)this.uniforms[t[e]]._location=this.gl.getUniformLocation(this.program,t[e])},i.prototype.cacheAttributeLocations=function(t){for(var e=0;e<t.length;++e)this.attributes[t[e]]=this.gl.getAttribLocation(this.program,t[e])},i.prototype.compile=function(){var t=this.gl,e=this._glCompile(t.VERTEX_SHADER,this.vertexSrc),r=this._glCompile(t.FRAGMENT_SHADER,this.fragmentSrc),i=t.createProgram();return t.attachShader(i,e),t.attachShader(i,r),t.linkProgram(i),t.getProgramParameter(i,t.LINK_STATUS)||(console.error("Pixi.js Error: Could not initialize shader."),console.error("gl.VALIDATE_STATUS",t.getProgramParameter(i,t.VALIDATE_STATUS)),console.error("gl.getError()",t.getError()),""!==t.getProgramInfoLog(i)&&console.warn("Pixi.js Warning: gl.getProgramInfoLog()",t.getProgramInfoLog(i)),t.deleteProgram(i),i=null),t.deleteShader(e),t.deleteShader(r),this.program=i},i.prototype.syncUniform=function(t){var e,r,i=t._location,o=t.value,s=this.gl;switch(t.type){case"b":case"bool":case"boolean":s.uniform1i(i,o?1:0);break;case"i":case"1i":s.uniform1i(i,o);break;case"f":case"1f":s.uniform1f(i,o);break;case"2f":s.uniform2f(i,o[0],o[1]);break;case"3f":s.uniform3f(i,o[0],o[1],o[2]);break;case"4f":s.uniform4f(i,o[0],o[1],o[2],o[3]);break;case"v2":s.uniform2f(i,o.x,o.y);break;case"v3":s.uniform3f(i,o.x,o.y,o.z);break;case"v4":s.uniform4f(i,o.x,o.y,o.z,o.w);break;case"1iv":s.uniform1iv(i,o);break;case"2iv":s.uniform2iv(i,o);break;case"3iv":s.uniform3iv(i,o);break;case"4iv":s.uniform4iv(i,o);break;case"1fv":s.uniform1fv(i,o);break;case"2fv":s.uniform2fv(i,o);break;case"3fv":s.uniform3fv(i,o);break;case"4fv":s.uniform4fv(i,o);break;case"m2":case"mat2":case"Matrix2fv":s.uniformMatrix2fv(i,t.transpose,o);break;case"m3":case"mat3":case"Matrix3fv":s.uniformMatrix3fv(i,t.transpose,o);break;case"m4":case"mat4":case"Matrix4fv":s.uniformMatrix4fv(i,t.transpose,o);break;case"c":"number"==typeof o&&(o=n.hex2rgb(o)),s.uniform3f(i,o[0],o[1],o[2]);break;case"iv1":s.uniform1iv(i,o);break;case"iv":s.uniform3iv(i,o);break;case"fv1":s.uniform1fv(i,o);break;case"fv":s.uniform3fv(i,o);break;case"v2v":for(t._array||(t._array=new Float32Array(2*o.length)),e=0,r=o.length;r>e;++e)t._array[2*e]=o[e].x,t._array[2*e+1]=o[e].y;s.uniform2fv(i,t._array);break;case"v3v":for(t._array||(t._array=new Float32Array(3*o.length)),e=0,r=o.length;r>e;++e)t._array[3*e]=o[e].x,t._array[3*e+1]=o[e].y,t._array[3*e+2]=o[e].z;s.uniform3fv(i,t._array);break;case"v4v":for(t._array||(t._array=new Float32Array(4*o.length)),e=0,r=o.length;r>e;++e)t._array[4*e]=o[e].x,t._array[4*e+1]=o[e].y,t._array[4*e+2]=o[e].z,t._array[4*e+3]=o[e].w;s.uniform4fv(i,t._array);break;case"t":case"sampler2D":if(!t.value||!t.value.baseTexture.hasLoaded)break;s.activeTexture(s["TEXTURE"+this.textureCount]);var a=t.value.baseTexture._glTextures[s.id];a||(this.initSampler2D(t),a=t.value.baseTexture._glTextures[s.id]),s.bindTexture(s.TEXTURE_2D,a),s.uniform1i(t._location,this.textureCount),this.textureCount++;break;default:console.warn("Pixi.js Shader Warning: Unknown uniform type: "+t.type)}},i.prototype.syncUniforms=function(){this.textureCount=1;for(var t in this.uniforms)this.syncUniform(this.uniforms[t])},i.prototype.initSampler2D=function(t){var e=this.gl,r=t.value.baseTexture;if(r.hasLoaded)if(t.textureData){var i=t.textureData;r._glTextures[e.id]=e.createTexture(),e.bindTexture(e.TEXTURE_2D,r._glTextures[e.id]),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,r.premultipliedAlpha),e.texImage2D(e.TEXTURE_2D,0,i.luminance?e.LUMINANCE:e.RGBA,e.RGBA,e.UNSIGNED_BYTE,r.source),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,i.magFilter?i.magFilter:e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,i.wrapS?i.wrapS:e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,i.wrapS?i.wrapS:e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,i.wrapT?i.wrapT:e.CLAMP_TO_EDGE)}else this.shaderManager.renderer.updateTexture(r)},i.prototype.destroy=function(){this.gl.deleteProgram(this.program),this.gl=null,this.uniforms=null,this.attributes=null,this.vertexSrc=null,this.fragmentSrc=null},i.prototype._glCompile=function(t,e){var r=this.gl.createShader(t);return this.gl.shaderSource(r,e),this.gl.compileShader(r),this.gl.getShaderParameter(r,this.gl.COMPILE_STATUS)?r:(console.log(this.gl.getShaderInfoLog(r)),null)}},{"../../../utils":76}],61:[function(t,e,r){function i(t,e,r,o,s){var a={uSampler:{type:"sampler2D",value:0},projectionMatrix:{type:"mat3",value:new Float32Array([1,0,0,0,1,0,0,0,1])}};if(o)for(var h in o)a[h]=o[h];var l={aVertexPosition:0,aTextureCoord:0,aColor:0};if(s)for(var u in s)l[u]=s[u];e=e||i.defaultVertexSrc,r=r||i.defaultFragmentSrc,n.call(this,t,e,r,a,l)}var n=t("./Shader");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.defaultVertexSrc=["precision lowp float;","attribute vec2 aVertexPosition;","attribute vec2 aTextureCoord;","attribute vec4 aColor;","uniform mat3 projectionMatrix;","varying vec2 vTextureCoord;","varying vec4 vColor;","void main(void){","   gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);","   vTextureCoord = aTextureCoord;","   vColor = vec4(aColor.rgb * aColor.a, aColor.a);","}"].join("\n"),i.defaultFragmentSrc=["precision lowp float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform sampler2D uSampler;","void main(void){","   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor ;","}"].join("\n")},{"./Shader":60}],62:[function(t,e,r){function i(t){n.call(this,t)}var n=t("../managers/WebGLManager");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.start=function(){},i.prototype.stop=function(){this.flush()},i.prototype.flush=function(){},i.prototype.render=function(t){}},{"../managers/WebGLManager":57}],63:[function(t,e,r){function i(t){this.gl=t,this.vertices=new Float32Array([0,0,200,0,200,200,0,200]),this.uvs=new Float32Array([0,0,1,0,1,1,0,1]),this.colors=new Float32Array([1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]),this.indices=new Uint16Array([0,1,2,0,3,2]),this.vertexBuffer=t.createBuffer(),this.indexBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,this.vertexBuffer),t.bufferData(t.ARRAY_BUFFER,128,t.DYNAMIC_DRAW),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.indexBuffer),t.bufferData(t.ELEMENT_ARRAY_BUFFER,this.indices,t.STATIC_DRAW),this.upload()}i.prototype.constructor=i,i.prototype.map=function(t,e){var r=0,i=0;this.uvs[0]=r,this.uvs[1]=i,this.uvs[2]=r+e.width/t.width,this.uvs[3]=i,this.uvs[4]=r+e.width/t.width,this.uvs[5]=i+e.height/t.height,this.uvs[6]=r,this.uvs[7]=i+e.height/t.height,r=e.x,i=e.y,this.vertices[0]=r,this.vertices[1]=i,this.vertices[2]=r+e.width,this.vertices[3]=i,this.vertices[4]=r+e.width,this.vertices[5]=i+e.height,this.vertices[6]=r,this.vertices[7]=i+e.height,this.upload()},i.prototype.upload=function(){var t=this.gl;t.bindBuffer(t.ARRAY_BUFFER,this.vertexBuffer),t.bufferSubData(t.ARRAY_BUFFER,0,this.vertices),t.bufferSubData(t.ARRAY_BUFFER,32,this.uvs),t.bufferSubData(t.ARRAY_BUFFER,64,this.colors)},e.exports=i},{}],64:[function(t,e,r){var i=t("../../../math"),n=t("../../../utils"),o=t("../../../const"),s=t("./StencilMaskStack"),a=function(t,e,r,a,h,l){if(this.gl=t,this.frameBuffer=null,this.texture=null,this.size=new i.Rectangle(0,0,1,1),this.resolution=h||o.RESOLUTION,this.projectionMatrix=new i.Matrix,this.transform=null,this.frame=null,this.stencilBuffer=null,this.stencilMaskStack=new s,this.filterStack=[{renderTarget:this,filter:[],bounds:this.size}],this.scaleMode=a||o.SCALE_MODES.DEFAULT,this.root=l,!this.root){this.frameBuffer=t.createFramebuffer(),this.texture=t.createTexture(),t.bindTexture(t.TEXTURE_2D,this.texture),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,a===o.SCALE_MODES.LINEAR?t.LINEAR:t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,a===o.SCALE_MODES.LINEAR?t.LINEAR:t.NEAREST);var u=n.isPowerOfTwo(e,r);u?(t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.REPEAT)):(t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE)),t.bindFramebuffer(t.FRAMEBUFFER,this.frameBuffer),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,this.texture,0)}this.resize(e,r)};a.prototype.constructor=a,e.exports=a,a.prototype.clear=function(t){var e=this.gl;t&&e.bindFramebuffer(e.FRAMEBUFFER,this.frameBuffer),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT)},a.prototype.attachStencilBuffer=function(){if(!this.stencilBuffer&&!this.root){var t=this.gl;this.stencilBuffer=t.createRenderbuffer(),t.bindRenderbuffer(t.RENDERBUFFER,this.stencilBuffer),t.framebufferRenderbuffer(t.FRAMEBUFFER,t.DEPTH_STENCIL_ATTACHMENT,t.RENDERBUFFER,this.stencilBuffer),t.renderbufferStorage(t.RENDERBUFFER,t.DEPTH_STENCIL,this.size.width*this.resolution,this.size.height*this.resolution)}},a.prototype.activate=function(){var t=this.gl;t.bindFramebuffer(t.FRAMEBUFFER,this.frameBuffer);var e=this.frame||this.size;this.calculateProjection(e),this.transform&&this.projectionMatrix.append(this.transform),t.viewport(0,0,e.width*this.resolution,e.height*this.resolution)},a.prototype.calculateProjection=function(t){var e=this.projectionMatrix;e.identity(),this.root?(e.a=1/t.width*2,e.d=-1/t.height*2,e.tx=-1-t.x*e.a,e.ty=1-t.y*e.d):(e.a=1/t.width*2,e.d=1/t.height*2,e.tx=-1-t.x*e.a,e.ty=-1-t.y*e.d)},a.prototype.resize=function(t,e){if(t=0|t,e=0|e,this.size.width!==t||this.size.height!==e){if(this.size.width=t,this.size.height=e,!this.root){var r=this.gl;r.bindTexture(r.TEXTURE_2D,this.texture),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,t*this.resolution,e*this.resolution,0,r.RGBA,r.UNSIGNED_BYTE,null),this.stencilBuffer&&(r.bindRenderbuffer(r.RENDERBUFFER,this.stencilBuffer),r.renderbufferStorage(r.RENDERBUFFER,r.DEPTH_STENCIL,t*this.resolution,e*this.resolution))}var i=this.frame||this.size;this.calculateProjection(i)}},a.prototype.destroy=function(){var t=this.gl;t.deleteFramebuffer(this.frameBuffer),t.deleteTexture(this.texture),this.frameBuffer=null,this.texture=null}},{"../../../const":22,"../../../math":32,"../../../utils":76,"./StencilMaskStack":65}],65:[function(t,e,r){function i(){this.stencilStack=[],this.reverse=!0,this.count=0}i.prototype.constructor=i,e.exports=i},{}],66:[function(t,e,r){function i(t){s.call(this),this.anchor=new n.Point,this._texture=null,this._width=0,this._height=0,this.tint=16777215,this.blendMode=l.BLEND_MODES.NORMAL,this.shader=null,this.cachedTint=16777215,this.texture=t||o.EMPTY}var n=t("../math"),o=t("../textures/Texture"),s=t("../display/Container"),a=t("../renderers/canvas/utils/CanvasTinter"),h=t("../utils"),l=t("../const"),u=new n.Point;i.prototype=Object.create(s.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{width:{get:function(){return this.scale.x*this.texture._frame.width},set:function(t){this.scale.x=t/this.texture._frame.width,this._width=t}},height:{get:function(){return this.scale.y*this.texture._frame.height},set:function(t){this.scale.y=t/this.texture._frame.height,this._height=t}},texture:{get:function(){return this._texture},set:function(t){this._texture!==t&&(this._texture=t,this.cachedTint=16777215,t&&(t.baseTexture.hasLoaded?this._onTextureUpdate():t.once("update",this._onTextureUpdate,this)))}}}),i.prototype._onTextureUpdate=function(){this._width&&(this.scale.x=this._width/this.texture.frame.width),this._height&&(this.scale.y=this._height/this.texture.frame.height)},i.prototype._renderWebGL=function(t){t.setObjectRenderer(t.plugins.sprite),t.plugins.sprite.render(this)},i.prototype.getBounds=function(t){if(!this._currentBounds){var e,r,i,n,o=this._texture._frame.width,s=this._texture._frame.height,a=o*(1-this.anchor.x),h=o*-this.anchor.x,l=s*(1-this.anchor.y),u=s*-this.anchor.y,c=t||this.worldTransform,p=c.a,d=c.b,f=c.c,v=c.d,g=c.tx,m=c.ty;if(0===d&&0===f)0>p&&(p*=-1),0>v&&(v*=-1),e=p*h+g,r=p*a+g,i=v*u+m,n=v*l+m;else{var y=p*h+f*u+g,x=v*u+d*h+m,b=p*a+f*u+g,_=v*u+d*a+m,T=p*a+f*l+g,E=v*l+d*a+m,S=p*h+f*l+g,A=v*l+d*h+m;e=y,e=e>b?b:e,e=e>T?T:e,e=e>S?S:e,i=x,i=i>_?_:i,i=i>E?E:i,i=i>A?A:i,r=y,r=b>r?b:r,r=T>r?T:r,r=S>r?S:r,n=x,n=_>n?_:n,n=E>n?E:n,n=A>n?A:n}if(this.children.length){var w=this.containerGetBounds();a=w.x,h=w.x+w.width,l=w.y,u=w.y+w.height,e=a>e?e:a,i=l>i?i:l,r=r>h?r:h,n=n>u?n:u}var C=this._bounds;C.x=e,C.width=r-e,C.y=i,C.height=n-i,this._currentBounds=C}return this._currentBounds},i.prototype.getLocalBounds=function(){return this._bounds.x=-this._texture._frame.width*this.anchor.x,this._bounds.y=-this._texture._frame.height*this.anchor.y,this._bounds.width=this._texture._frame.width,this._bounds.height=this._texture._frame.height,this._bounds},i.prototype.containsPoint=function(t){this.worldTransform.applyInverse(t,u);var e,r=this._texture._frame.width,i=this._texture._frame.height,n=-r*this.anchor.x;return u.x>n&&u.x<n+r&&(e=-i*this.anchor.y,u.y>e&&u.y<e+i)?!0:!1},i.prototype._renderCanvas=function(t){if(!(this.texture.crop.width<=0||this.texture.crop.height<=0)&&(this.blendMode!==t.currentBlendMode&&(t.currentBlendMode=this.blendMode,t.context.globalCompositeOperation=t.blendModes[t.currentBlendMode]),this.texture.valid)){var e,r,i,n,o=this._texture,s=this.worldTransform;if(t.context.globalAlpha=this.worldAlpha,t.smoothProperty&&t.currentScaleMode!==o.baseTexture.scaleMode&&(t.currentScaleMode=o.baseTexture.scaleMode,t.context[t.smoothProperty]=t.currentScaleMode===l.SCALE_MODES.LINEAR),o.rotate){var h=s.a,u=s.b;s.a=-s.c,s.b=-s.d,s.c=h,s.d=u,i=o.crop.height,n=o.crop.width,e=o.trim?o.trim.y-this.anchor.y*o.trim.height:this.anchor.y*-o._frame.height,r=o.trim?o.trim.x-this.anchor.x*o.trim.width:this.anchor.x*-o._frame.width}else i=o.crop.width,n=o.crop.height,e=o.trim?o.trim.x-this.anchor.x*o.trim.width:this.anchor.x*-o._frame.width,r=o.trim?o.trim.y-this.anchor.y*o.trim.height:this.anchor.y*-o._frame.height;t.roundPixels?(t.context.setTransform(s.a,s.b,s.c,s.d,s.tx*t.resolution|0,s.ty*t.resolution|0),e=0|e,r=0|r):t.context.setTransform(s.a,s.b,s.c,s.d,s.tx*t.resolution,s.ty*t.resolution);var c=o.baseTexture.resolution;16777215!==this.tint?(this.cachedTint!==this.tint&&(this.cachedTint=this.tint,this.tintedTexture=a.getTintedTexture(this,this.tint)),t.context.drawImage(this.tintedTexture,0,0,i*c,n*c,e*t.resolution,r*t.resolution,i*t.resolution,n*t.resolution)):t.context.drawImage(o.baseTexture.source,o.crop.x*c,o.crop.y*c,i*c,n*c,e*t.resolution,r*t.resolution,i*t.resolution,n*t.resolution)}},i.prototype.destroy=function(t,e){s.prototype.destroy.call(this),this.anchor=null,t&&this._texture.destroy(e),this._texture=null,this.shader=null},i.fromFrame=function(t){var e=h.TextureCache[t];if(!e)throw new Error('The frameId "'+t+'" does not exist in the texture cache');

return new i(e)},i.fromImage=function(t,e,r){return new i(o.fromImage(t,e,r))}},{"../const":22,"../display/Container":23,"../math":32,"../renderers/canvas/utils/CanvasTinter":47,"../textures/Texture":71,"../utils":76}],67:[function(t,e,r){function i(t){n.call(this,t),this.vertSize=5,this.vertByteSize=4*this.vertSize,this.size=s.SPRITE_BATCH_SIZE;var e=4*this.size*this.vertByteSize,r=6*this.size;this.vertices=new ArrayBuffer(e),this.positions=new Float32Array(this.vertices),this.colors=new Uint32Array(this.vertices),this.indices=new Uint16Array(r);for(var i=0,o=0;r>i;i+=6,o+=4)this.indices[i+0]=o+0,this.indices[i+1]=o+1,this.indices[i+2]=o+2,this.indices[i+3]=o+0,this.indices[i+4]=o+2,this.indices[i+5]=o+3;this.currentBatchSize=0,this.sprites=[],this.shader=null}var n=t("../../renderers/webgl/utils/ObjectRenderer"),o=t("../../renderers/webgl/WebGLRenderer"),s=t("../../const");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,o.registerPlugin("sprite",i),i.prototype.onContextChange=function(){var t=this.renderer.gl;this.shader=this.renderer.shaderManager.defaultShader,this.vertexBuffer=t.createBuffer(),this.indexBuffer=t.createBuffer(),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.indexBuffer),t.bufferData(t.ELEMENT_ARRAY_BUFFER,this.indices,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,this.vertexBuffer),t.bufferData(t.ARRAY_BUFFER,this.vertices,t.DYNAMIC_DRAW),this.currentBlendMode=99999},i.prototype.render=function(t){var e=t._texture;this.currentBatchSize>=this.size&&this.flush();var r=e._uvs;if(r){var i,n,o,s,a=t.anchor.x,h=t.anchor.y;if(e.trim){var l=e.trim;n=l.x-a*l.width,i=n+e.crop.width,s=l.y-h*l.height,o=s+e.crop.height}else i=e._frame.width*(1-a),n=e._frame.width*-a,o=e._frame.height*(1-h),s=e._frame.height*-h;var u=this.currentBatchSize*this.vertByteSize,c=t.worldTransform,p=c.a,d=c.b,f=c.c,v=c.d,g=c.tx,m=c.ty,y=this.colors,x=this.positions;this.renderer.roundPixels?(x[u]=p*n+f*s+g|0,x[u+1]=v*s+d*n+m|0,x[u+5]=p*i+f*s+g|0,x[u+6]=v*s+d*i+m|0,x[u+10]=p*i+f*o+g|0,x[u+11]=v*o+d*i+m|0,x[u+15]=p*n+f*o+g|0,x[u+16]=v*o+d*n+m|0):(x[u]=p*n+f*s+g,x[u+1]=v*s+d*n+m,x[u+5]=p*i+f*s+g,x[u+6]=v*s+d*i+m,x[u+10]=p*i+f*o+g,x[u+11]=v*o+d*i+m,x[u+15]=p*n+f*o+g,x[u+16]=v*o+d*n+m),x[u+2]=r.x0,x[u+3]=r.y0,x[u+7]=r.x1,x[u+8]=r.y1,x[u+12]=r.x2,x[u+13]=r.y2,x[u+17]=r.x3,x[u+18]=r.y3;var b=t.tint;y[u+4]=y[u+9]=y[u+14]=y[u+19]=(b>>16)+(65280&b)+((255&b)<<16)+(255*t.worldAlpha<<24),this.sprites[this.currentBatchSize++]=t}},i.prototype.flush=function(){if(0!==this.currentBatchSize){var t,e=this.renderer.gl;if(this.currentBatchSize>.5*this.size)e.bufferSubData(e.ARRAY_BUFFER,0,this.vertices);else{var r=this.positions.subarray(0,this.currentBatchSize*this.vertByteSize);e.bufferSubData(e.ARRAY_BUFFER,0,r)}for(var i,n,o,s,a=0,h=0,l=null,u=this.renderer.blendModeManager.currentBlendMode,c=null,p=!1,d=!1,f=0,v=this.currentBatchSize;v>f;f++)s=this.sprites[f],i=s._texture.baseTexture,n=s.blendMode,o=s.shader||this.shader,p=u!==n,d=c!==o,(l!==i||p||d)&&(this.renderBatch(l,a,h),h=f,a=0,l=i,p&&(u=n,this.renderer.blendModeManager.setBlendMode(u)),d&&(c=o,t=c.shaders?c.shaders[e.id]:c,t||(t=c.getShader(this.renderer)),this.renderer.shaderManager.setShader(t),t.uniforms.projectionMatrix.value=this.renderer.currentRenderTarget.projectionMatrix.toArray(!0),t.syncUniforms(),e.activeTexture(e.TEXTURE0))),a++;this.renderBatch(l,a,h),this.currentBatchSize=0}},i.prototype.renderBatch=function(t,e,r){if(0!==e){var i=this.renderer.gl;t._glTextures[i.id]?i.bindTexture(i.TEXTURE_2D,t._glTextures[i.id]):this.renderer.updateTexture(t),i.drawElements(i.TRIANGLES,6*e,i.UNSIGNED_SHORT,6*r*2),this.renderer.drawCount++}},i.prototype.start=function(){var t=this.renderer.gl;t.bindBuffer(t.ARRAY_BUFFER,this.vertexBuffer),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.indexBuffer);var e=this.vertByteSize;t.vertexAttribPointer(this.shader.attributes.aVertexPosition,2,t.FLOAT,!1,e,0),t.vertexAttribPointer(this.shader.attributes.aTextureCoord,2,t.FLOAT,!1,e,8),t.vertexAttribPointer(this.shader.attributes.aColor,4,t.UNSIGNED_BYTE,!0,e,16)},i.prototype.destroy=function(){this.renderer.gl.deleteBuffer(this.vertexBuffer),this.renderer.gl.deleteBuffer(this.indexBuffer),this.shader.destroy(),this.renderer=null,this.vertices=null,this.positions=null,this.colors=null,this.indices=null,this.vertexBuffer=null,this.indexBuffer=null,this.sprites=null,this.shader=null}},{"../../const":22,"../../renderers/webgl/WebGLRenderer":48,"../../renderers/webgl/utils/ObjectRenderer":62}],68:[function(t,e,r){function i(t,e,r){this.canvas=document.createElement("canvas"),this.context=this.canvas.getContext("2d"),this.resolution=r||h.RESOLUTION,this._text=null,this._style=null;var i=o.fromCanvas(this.canvas);i.trim=new s.Rectangle,n.call(this,i),this.text=t,this.style=e}var n=t("../sprites/Sprite"),o=t("../textures/Texture"),s=t("../math"),a=t("../utils"),h=t("../const");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.fontPropertiesCache={},i.fontPropertiesCanvas=document.createElement("canvas"),i.fontPropertiesContext=i.fontPropertiesCanvas.getContext("2d"),Object.defineProperties(i.prototype,{width:{get:function(){return this.dirty&&this.updateText(),this.scale.x*this._texture._frame.width},set:function(t){this.scale.x=t/this._texture._frame.width,this._width=t}},height:{get:function(){return this.dirty&&this.updateText(),this.scale.y*this._texture._frame.height},set:function(t){this.scale.y=t/this._texture._frame.height,this._height=t}},style:{get:function(){return this._style},set:function(t){t=t||{},"number"==typeof t.fill&&(t.fill=a.hex2string(t.fill)),"number"==typeof t.stroke&&(t.stroke=a.hex2string(t.stroke)),"number"==typeof t.dropShadowColor&&(t.dropShadowColor=a.hex2string(t.dropShadowColor)),t.font=t.font||"bold 20pt Arial",t.fill=t.fill||"black",t.align=t.align||"left",t.stroke=t.stroke||"black",t.strokeThickness=t.strokeThickness||0,t.wordWrap=t.wordWrap||!1,t.wordWrapWidth=t.wordWrapWidth||100,t.dropShadow=t.dropShadow||!1,t.dropShadowColor=t.dropShadowColor||"#000000",t.dropShadowAngle=t.dropShadowAngle||Math.PI/6,t.dropShadowDistance=t.dropShadowDistance||5,t.padding=t.padding||0,t.textBaseline=t.textBaseline||"alphabetic",t.lineJoin=t.lineJoin||"miter",t.miterLimit=t.miterLimit||10,this._style=t,this.dirty=!0}},text:{get:function(){return this._text},set:function(t){t=t.toString()||" ",this._text!==t&&(this._text=t,this.dirty=!0)}}}),i.prototype.updateText=function(){var t=this._style;this.context.font=t.font;for(var e=t.wordWrap?this.wordWrap(this._text):this._text,r=e.split(/(?:\r\n|\r|\n)/),i=new Array(r.length),n=0,o=this.determineFontProperties(t.font),s=0;s<r.length;s++){var a=this.context.measureText(r[s]).width;i[s]=a,n=Math.max(n,a)}var h=n+t.strokeThickness;t.dropShadow&&(h+=t.dropShadowDistance),this.canvas.width=(h+this.context.lineWidth)*this.resolution;var l=this.style.lineHeight||o.fontSize+t.strokeThickness,u=l*r.length;t.dropShadow&&(u+=t.dropShadowDistance),this.canvas.height=(u+2*this._style.padding)*this.resolution,this.context.scale(this.resolution,this.resolution),navigator.isCocoonJS&&this.context.clearRect(0,0,this.canvas.width,this.canvas.height),this.context.font=t.font,this.context.strokeStyle=t.stroke,this.context.lineWidth=t.strokeThickness,this.context.textBaseline=t.textBaseline,this.context.lineJoin=t.lineJoin,this.context.miterLimit=t.miterLimit;var c,p;if(t.dropShadow){this.context.fillStyle=t.dropShadowColor;var d=Math.cos(t.dropShadowAngle)*t.dropShadowDistance,f=Math.sin(t.dropShadowAngle)*t.dropShadowDistance;for(s=0;s<r.length;s++)c=t.strokeThickness/2,p=t.strokeThickness/2+s*l+o.ascent,"right"===t.align?c+=n-i[s]:"center"===t.align&&(c+=(n-i[s])/2),t.fill&&this.context.fillText(r[s],c+d,p+f+this._style.padding)}for(this.context.fillStyle=t.fill,s=0;s<r.length;s++)c=t.strokeThickness/2,p=t.strokeThickness/2+s*l+o.ascent,"right"===t.align?c+=n-i[s]:"center"===t.align&&(c+=(n-i[s])/2),t.stroke&&t.strokeThickness&&this.context.strokeText(r[s],c,p+this._style.padding),t.fill&&this.context.fillText(r[s],c,p+this._style.padding);this.updateTexture()},i.prototype.updateTexture=function(){var t=this._texture;t.baseTexture.hasLoaded=!0,t.baseTexture.resolution=this.resolution,t.baseTexture.width=this.canvas.width/this.resolution,t.baseTexture.height=this.canvas.height/this.resolution,t.crop.width=t._frame.width=this.canvas.width/this.resolution,t.crop.height=t._frame.height=this.canvas.height/this.resolution,t.trim.x=0,t.trim.y=-this._style.padding,t.trim.width=t._frame.width,t.trim.height=t._frame.height-2*this._style.padding,this._width=this.canvas.width/this.resolution,this._height=this.canvas.height/this.resolution,t.baseTexture.emit("update",t.baseTexture),this.dirty=!1},i.prototype.renderWebGL=function(t){this.dirty&&this.updateText(),n.prototype.renderWebGL.call(this,t)},i.prototype._renderCanvas=function(t){this.dirty&&this.updateText(),n.prototype._renderCanvas.call(this,t)},i.prototype.determineFontProperties=function(t){var e=i.fontPropertiesCache[t];if(!e){e={};var r=i.fontPropertiesCanvas,n=i.fontPropertiesContext;n.font=t;var o=Math.ceil(n.measureText("|MÉq").width),s=Math.ceil(n.measureText("M").width),a=2*s;s=1.4*s|0,r.width=o,r.height=a,n.fillStyle="#f00",n.fillRect(0,0,o,a),n.font=t,n.textBaseline="alphabetic",n.fillStyle="#000",n.fillText("|MÉq",0,s);var h,l,u=n.getImageData(0,0,o,a).data,c=u.length,p=4*o,d=0,f=!1;for(h=0;s>h;h++){for(l=0;p>l;l+=4)if(255!==u[d+l]){f=!0;break}if(f)break;d+=p}for(e.ascent=s-h,d=c-p,f=!1,h=a;h>s;h--){for(l=0;p>l;l+=4)if(255!==u[d+l]){f=!0;break}if(f)break;d-=p}e.descent=h-s,e.fontSize=e.ascent+e.descent,i.fontPropertiesCache[t]=e}return e},i.prototype.wordWrap=function(t){for(var e="",r=t.split("\n"),i=this._style.wordWrapWidth,n=0;n<r.length;n++){for(var o=i,s=r[n].split(" "),a=0;a<s.length;a++){var h=this.context.measureText(s[a]).width,l=h+this.context.measureText(" ").width;0===a||l>o?(a>0&&(e+="\n"),e+=s[a],o=i-h):(o-=l,e+=" "+s[a])}n<r.length-1&&(e+="\n")}return e},i.prototype.getBounds=function(t){return this.dirty&&this.updateText(),n.prototype.getBounds.call(this,t)},i.prototype.destroy=function(t){this.context=null,this.canvas=null,this._style=null,this._texture.destroy(void 0===t?!0:t)}},{"../const":22,"../math":32,"../sprites/Sprite":66,"../textures/Texture":71,"../utils":76}],69:[function(t,e,r){function i(t,e,r){s.call(this),this.uid=n.uid(),this.resolution=r||1,this.width=100,this.height=100,this.realWidth=100,this.realHeight=100,this.scaleMode=e||o.SCALE_MODES.DEFAULT,this.hasLoaded=!1,this.isLoading=!1,this.source=null,this.premultipliedAlpha=!0,this.imageUrl=null,this.isPowerOfTwo=!1,this.mipmap=!1,this._glTextures=[],t&&this.loadSource(t)}var n=t("../utils"),o=t("../const"),s=t("eventemitter3");i.prototype=Object.create(s.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.update=function(){this.realWidth=this.source.naturalWidth||this.source.width,this.realHeight=this.source.naturalHeight||this.source.height,this.width=this.realWidth/this.resolution,this.height=this.realHeight/this.resolution,this.isPowerOfTwo=n.isPowerOfTwo(this.realWidth,this.realHeight),this.emit("update",this)},i.prototype.loadSource=function(t){var e=this.isLoading;if(this.hasLoaded=!1,this.isLoading=!1,e&&this.source&&(this.source.onload=null,this.source.onerror=null),this.source=t,(this.source.complete||this.source.getContext)&&this.source.width&&this.source.height)this._sourceLoaded();else if(!t.getContext){this.isLoading=!0;var r=this;t.onload=function(){t.onload=null,t.onerror=null,r.isLoading&&(r.isLoading=!1,r._sourceLoaded(),r.emit("loaded",r))},t.onerror=function(){t.onload=null,t.onerror=null,r.isLoading&&(r.isLoading=!1,r.emit("error",r))},t.complete&&t.src&&(this.isLoading=!1,t.onload=null,t.onerror=null,t.width&&t.height?(this._sourceLoaded(),e&&this.emit("loaded",this)):e&&this.emit("error",this))}},i.prototype._sourceLoaded=function(){this.hasLoaded=!0,this.update()},i.prototype.destroy=function(){this.imageUrl?(delete n.BaseTextureCache[this.imageUrl],delete n.TextureCache[this.imageUrl],this.imageUrl=null,navigator.isCocoonJS||(this.source.src="")):this.source&&this.source._pixiId&&delete n.BaseTextureCache[this.source._pixiId],this.source=null,this.dispose()},i.prototype.dispose=function(){this.emit("dispose",this),this._glTextures.length=0},i.prototype.updateSourceImage=function(t){this.source.src=t,this.loadSource(this.source)},i.fromImage=function(t,e,r){var o=n.BaseTextureCache[t];if(void 0===e&&0!==t.indexOf("data:")&&(e=!0),!o){var s=new Image;e&&(s.crossOrigin=""),o=new i(s,r),o.imageUrl=t,s.src=t,n.BaseTextureCache[t]=o,o.resolution=n.getResolutionOfUrl(t)}return o},i.fromCanvas=function(t,e){t._pixiId||(t._pixiId="canvas_"+n.uid());var r=n.BaseTextureCache[t._pixiId];return r||(r=new i(t,e),n.BaseTextureCache[t._pixiId]=r),r}},{"../const":22,"../utils":76,eventemitter3:11}],70:[function(t,e,r){function i(t,e,r,i,c){if(!t)throw new Error("Unable to create RenderTexture, you must pass a renderer into the constructor.");e=e||100,r=r||100,c=c||u.RESOLUTION;var p=new n;if(p.width=e,p.height=r,p.resolution=c,p.scaleMode=i||u.SCALE_MODES.DEFAULT,p.hasLoaded=!0,o.call(this,p,new l.Rectangle(0,0,e,r)),this.width=e,this.height=r,this.resolution=c,this.render=null,this.renderer=t,this.renderer.type===u.RENDERER_TYPE.WEBGL){var d=this.renderer.gl;this.textureBuffer=new s(d,this.width,this.height,p.scaleMode,this.resolution),this.baseTexture._glTextures[d.id]=this.textureBuffer.texture,this.filterManager=new a(this.renderer),this.filterManager.onContextChange(),this.filterManager.resize(e,r),this.render=this.renderWebGL,this.renderer.currentRenderer.start(),this.renderer.currentRenderTarget.activate()}else this.render=this.renderCanvas,this.textureBuffer=new h(this.width*this.resolution,this.height*this.resolution),this.baseTexture.source=this.textureBuffer.canvas;this.valid=!0,this._updateUvs()}var n=t("./BaseTexture"),o=t("./Texture"),s=t("../renderers/webgl/utils/RenderTarget"),a=t("../renderers/webgl/managers/FilterManager"),h=t("../renderers/canvas/utils/CanvasBuffer"),l=t("../math"),u=t("../const"),c=new l.Matrix;i.prototype=Object.create(o.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.resize=function(t,e,r){(t!==this.width||e!==this.height)&&(this.valid=t>0&&e>0,this.width=this._frame.width=this.crop.width=t,this.height=this._frame.height=this.crop.height=e,r&&(this.baseTexture.width=this.width,this.baseTexture.height=this.height),this.valid&&(this.textureBuffer.resize(this.width,this.height),this.filterManager&&this.filterManager.resize(this.width,this.height)))},i.prototype.clear=function(){this.valid&&(this.renderer.type===u.RENDERER_TYPE.WEBGL&&this.renderer.gl.bindFramebuffer(this.renderer.gl.FRAMEBUFFER,this.textureBuffer.frameBuffer),this.textureBuffer.clear())},i.prototype.renderWebGL=function(t,e,r,i){if(this.valid){if(i=void 0!==i?i:!0,this.textureBuffer.transform=e,this.textureBuffer.activate(),t.worldAlpha=1,i){t.worldTransform.identity(),t.currentBounds=null;var n,o,s=t.children;for(n=0,o=s.length;o>n;++n)s[n].updateTransform()}var a=this.renderer.filterManager;this.renderer.filterManager=this.filterManager,this.renderer.renderDisplayObject(t,this.textureBuffer,r),this.renderer.filterManager=a}},i.prototype.renderCanvas=function(t,e,r,i){if(this.valid){i=!!i;var n=t.worldTransform,o=c;o.identity(),e&&o.append(e),t.worldTransform=o,t.worldAlpha=1;var s,a,h=t.children;for(s=0,a=h.length;a>s;++s)h[s].updateTransform();r&&this.textureBuffer.clear(),t.worldTransform=n;var l=this.textureBuffer.context,u=this.renderer.resolution;this.renderer.resolution=this.resolution,this.renderer.renderDisplayObject(t,l),this.renderer.resolution=u}},i.prototype.destroy=function(){o.prototype.destroy.call(this,!0),this.textureBuffer.destroy(),this.filterManager&&this.filterManager.destroy(),this.renderer=null},i.prototype.getImage=function(){var t=new Image;return t.src=this.getBase64(),t},i.prototype.getBase64=function(){return this.getCanvas().toDataURL()},i.prototype.getCanvas=function(){if(this.renderer.type===u.RENDERER_TYPE.WEBGL){var t=this.renderer.gl,e=this.textureBuffer.size.width,r=this.textureBuffer.size.height,i=new Uint8Array(4*e*r);t.bindFramebuffer(t.FRAMEBUFFER,this.textureBuffer.frameBuffer),t.readPixels(0,0,e,r,t.RGBA,t.UNSIGNED_BYTE,i),t.bindFramebuffer(t.FRAMEBUFFER,null);var n=new h(e,r),o=n.context.getImageData(0,0,e,r);return o.data.set(i),n.context.putImageData(o,0,0),n.canvas}return this.textureBuffer.canvas},i.prototype.getPixels=function(){var t,e;if(this.renderer.type===u.RENDERER_TYPE.WEBGL){var r=this.renderer.gl;t=this.textureBuffer.size.width,e=this.textureBuffer.size.height;var i=new Uint8Array(4*t*e);return r.bindFramebuffer(r.FRAMEBUFFER,this.textureBuffer.frameBuffer),r.readPixels(0,0,t,e,r.RGBA,r.UNSIGNED_BYTE,i),r.bindFramebuffer(r.FRAMEBUFFER,null),i}return t=this.textureBuffer.canvas.width,e=this.textureBuffer.canvas.height,this.textureBuffer.canvas.getContext("2d").getImageData(0,0,t,e).data},i.prototype.getPixel=function(t,e){if(this.renderer.type===u.RENDERER_TYPE.WEBGL){var r=this.renderer.gl,i=new Uint8Array(4);return r.bindFramebuffer(r.FRAMEBUFFER,this.textureBuffer.frameBuffer),r.readPixels(t,e,1,1,r.RGBA,r.UNSIGNED_BYTE,i),r.bindFramebuffer(r.FRAMEBUFFER,null),i}return this.textureBuffer.canvas.getContext("2d").getImageData(t,e,1,1).data}},{"../const":22,"../math":32,"../renderers/canvas/utils/CanvasBuffer":44,"../renderers/webgl/managers/FilterManager":53,"../renderers/webgl/utils/RenderTarget":64,"./BaseTexture":69,"./Texture":71}],71:[function(t,e,r){function i(t,e,r,n,o){a.call(this),this.noFrame=!1,e||(this.noFrame=!0,e=new h.Rectangle(0,0,1,1)),t instanceof i&&(t=t.baseTexture),this.baseTexture=t,this._frame=e,this.trim=n,this.valid=!1,this.requiresUpdate=!1,this._uvs=null,this.width=0,this.height=0,this.crop=r||e,this.rotate=!!o,t.hasLoaded?(this.noFrame&&(e=new h.Rectangle(0,0,t.width,t.height),t.on("update",this.onBaseTextureUpdated,this)),this.frame=e):t.once("loaded",this.onBaseTextureLoaded,this)}var n=t("./BaseTexture"),o=t("./VideoBaseTexture"),s=t("./TextureUvs"),a=t("eventemitter3"),h=t("../math"),l=t("../utils");i.prototype=Object.create(a.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{frame:{get:function(){return this._frame},set:function(t){if(this._frame=t,this.noFrame=!1,this.width=t.width,this.height=t.height,!this.trim&&!this.rotate&&(t.x+t.width>this.baseTexture.width||t.y+t.height>this.baseTexture.height))throw new Error("Texture Error: frame does not fit inside the base Texture dimensions "+this);this.valid=t&&t.width&&t.height&&this.baseTexture.hasLoaded,this.trim?(this.width=this.trim.width,this.height=this.trim.height,this._frame.width=this.trim.width,this._frame.height=this.trim.height):this.crop=t,this.valid&&this._updateUvs()}}}),i.prototype.update=function(){this.baseTexture.update()},i.prototype.onBaseTextureLoaded=function(t){this.frame=this.noFrame?new h.Rectangle(0,0,t.width,t.height):this._frame,this.emit("update",this)},i.prototype.onBaseTextureUpdated=function(t){this._frame.width=t.width,this._frame.height=t.height,this.emit("update",this)},i.prototype.destroy=function(t){this.baseTexture&&(t&&this.baseTexture.destroy(),this.baseTexture.off("update",this.onBaseTextureUpdated,this),this.baseTexture.off("loaded",this.onBaseTextureLoaded,this),this.baseTexture=null),this._frame=null,this._uvs=null,this.trim=null,this.crop=null,this.valid=!1},i.prototype.clone=function(){return new i(this.baseTexture,this.frame,this.crop,this.trim,this.rotate)},i.prototype._updateUvs=function(){this._uvs||(this._uvs=new s),this._uvs.set(this.crop,this.baseTexture,this.rotate)},i.fromImage=function(t,e,r){var o=l.TextureCache[t];return o||(o=new i(n.fromImage(t,e,r)),l.TextureCache[t]=o),o},i.fromFrame=function(t){var e=l.TextureCache[t];if(!e)throw new Error('The frameId "'+t+'" does not exist in the texture cache');return e},i.fromCanvas=function(t,e){return new i(n.fromCanvas(t,e))},i.fromVideo=function(t,e){return"string"==typeof t?i.fromVideoUrl(t,e):new i(o.fromVideo(t,e))},i.fromVideoUrl=function(t,e){return new i(o.fromUrl(t,e))},i.addTextureToCache=function(t,e){l.TextureCache[e]=t},i.removeTextureFromCache=function(t){var e=l.TextureCache[t];return delete l.TextureCache[t],delete l.BaseTextureCache[t],e},i.EMPTY=new i(new n)},{"../math":32,"../utils":76,"./BaseTexture":69,"./TextureUvs":72,"./VideoBaseTexture":73,eventemitter3:11}],72:[function(t,e,r){function i(){this.x0=0,this.y0=0,this.x1=1,this.y1=0,this.x2=1,this.y2=1,this.x3=0,this.y3=1}e.exports=i,i.prototype.set=function(t,e,r){var i=e.width,n=e.height;r?(this.x0=(t.x+t.height)/i,this.y0=t.y/n,this.x1=(t.x+t.height)/i,this.y1=(t.y+t.width)/n,this.x2=t.x/i,this.y2=(t.y+t.width)/n,this.x3=t.x/i,this.y3=t.y/n):(this.x0=t.x/i,this.y0=t.y/n,this.x1=(t.x+t.width)/i,this.y1=t.y/n,this.x2=(t.x+t.width)/i,this.y2=(t.y+t.height)/n,this.x3=t.x/i,this.y3=(t.y+t.height)/n)}},{}],73:[function(t,e,r){function i(t,e){if(!t)throw new Error("No video source element specified.");(t.readyState===t.HAVE_ENOUGH_DATA||t.readyState===t.HAVE_FUTURE_DATA)&&t.width&&t.height&&(t.complete=!0),o.call(this,t,e),this.autoUpdate=!1,this._onUpdate=this._onUpdate.bind(this),this._onCanPlay=this._onCanPlay.bind(this),t.complete||(t.addEventListener("canplay",this._onCanPlay),t.addEventListener("canplaythrough",this._onCanPlay),t.addEventListener("play",this._onPlayStart.bind(this)),t.addEventListener("pause",this._onPlayStop.bind(this))),this.__loaded=!1}function n(t,e){e||(e="video/"+t.substr(t.lastIndexOf(".")+1));var r=document.createElement("source");return r.src=t,r.type=e,r}var o=t("./BaseTexture"),s=t("../utils");i.prototype=Object.create(o.prototype),i.prototype.constructor=i,e.exports=i,i.prototype._onUpdate=function(){this.autoUpdate&&(window.requestAnimationFrame(this._onUpdate),this.update())},i.prototype._onPlayStart=function(){this.autoUpdate||(window.requestAnimationFrame(this._onUpdate),this.autoUpdate=!0)},i.prototype._onPlayStop=function(){this.autoUpdate=!1},i.prototype._onCanPlay=function(){this.hasLoaded=!0,this.source&&(this.source.removeEventListener("canplay",this._onCanPlay),this.source.removeEventListener("canplaythrough",this._onCanPlay),this.width=this.source.videoWidth,this.height=this.source.videoHeight,this.source.play(),this.__loaded||(this.__loaded=!0,this.emit("loaded",this)))},i.prototype.destroy=function(){this.source&&this.source._pixiId&&(delete s.BaseTextureCache[this.source._pixiId],delete this.source._pixiId),o.prototype.destroy.call(this)},i.fromVideo=function(t,e){t._pixiId||(t._pixiId="video_"+s.uid());var r=s.BaseTextureCache[t._pixiId];return r||(r=new i(t,e),s.BaseTextureCache[t._pixiId]=r),r},i.fromUrl=function(t,e){var r=document.createElement("video");if(Array.isArray(t))for(var o=0;o<t.length;++o)r.appendChild(n(t.src||t,t.mime));else r.appendChild(n(t.src||t,t.mime));return r.load(),r.play(),i.fromVideo(r,e)},i.fromUrls=i.fromUrl},{"../utils":76,"./BaseTexture":69}],74:[function(t,e,r){function i(){var t=this;this._tick=function(e){t._requestId=null,t.started&&(t.update(e),t.started&&null===t._requestId&&t._emitter.listeners(s,!0)&&(t._requestId=requestAnimationFrame(t._tick)))},this._emitter=new o,this._requestId=null,this._maxElapsedMS=100,this.autoStart=!1,this.deltaTime=1,this.elapsedMS=1/n.TARGET_FPMS,this.lastTime=0,this.speed=1,this.started=!1}var n=t("../const"),o=t("eventemitter3"),s="tick";Object.defineProperties(i.prototype,{FPS:{get:function(){return 1e3/this.elapsedMS}},minFPS:{get:function(){return 1e3/this._maxElapsedMS},set:function(t){var e=Math.min(Math.max(0,t)/1e3,n.TARGET_FPMS);this._maxElapsedMS=1/e}}}),i.prototype._requestIfNeeded=function(){null===this._requestId&&this._emitter.listeners(s,!0)&&(this.lastTime=performance.now(),this._requestId=requestAnimationFrame(this._tick))},i.prototype._cancelIfNeeded=function(){null!==this._requestId&&(cancelAnimationFrame(this._requestId),this._requestId=null)},i.prototype._startIfPossible=function(){this.started?this._requestIfNeeded():this.autoStart&&this.start()},i.prototype.add=function(t,e){return this._emitter.on(s,t,e),this._startIfPossible(),this},i.prototype.addOnce=function(t,e){return this._emitter.once(s,t,e),this._startIfPossible(),this},i.prototype.remove=function(t,e){return this._emitter.off(s,t,e),this._emitter.listeners(s,!0)||this._cancelIfNeeded(),this},i.prototype.start=function(){this.started||(this.started=!0,this._requestIfNeeded())},i.prototype.stop=function(){this.started&&(this.started=!1,this._cancelIfNeeded())},i.prototype.update=function(t){var e;t=t||performance.now(),e=this.elapsedMS=t-this.lastTime,e>this._maxElapsedMS&&(e=this._maxElapsedMS),this.deltaTime=e*n.TARGET_FPMS*this.speed,this._emitter.emit(s,this.deltaTime),this.lastTime=t},e.exports=i},{"../const":22,eventemitter3:11}],75:[function(t,e,r){var i=t("./Ticker"),n=new i;n.autoStart=!0,e.exports={shared:n,Ticker:i}},{"./Ticker":74}],76:[function(t,e,r){var i=t("../const"),n=e.exports={_uid:0,_saidHello:!1,pluginTarget:t("./pluginTarget"),async:t("async"),uid:function(){return++n._uid},hex2rgb:function(t,e){return e=e||[],e[0]=(t>>16&255)/255,e[1]=(t>>8&255)/255,e[2]=(255&t)/255,e},hex2string:function(t){return t=t.toString(16),t="000000".substr(0,6-t.length)+t,"#"+t},rgb2hex:function(t){return(255*t[0]<<16)+(255*t[1]<<8)+255*t[2]},canUseNewCanvasBlendModes:function(){if("undefined"==typeof document)return!1;var t="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAABAQMAAADD8p2OAAAAA1BMVEX/",e="AAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==",r=new Image;r.src=t+"AP804Oa6"+e;var i=new Image;i.src=t+"/wCKxvRF"+e;var n=document.createElement("canvas");n.width=6,n.height=1;var o=n.getContext("2d");o.globalCompositeOperation="multiply",o.drawImage(r,0,0),o.drawImage(i,2,0);var s=o.getImageData(2,0,1,1).data;return 255===s[0]&&0===s[1]&&0===s[2]},getNextPowerOfTwo:function(t){if(t>0&&0===(t&t-1))return t;for(var e=1;t>e;)e<<=1;return e},isPowerOfTwo:function(t,e){return t>0&&0===(t&t-1)&&e>0&&0===(e&e-1)},getResolutionOfUrl:function(t){var e=i.RETINA_PREFIX.exec(t);return e?parseFloat(e[1]):1},sayHello:function(t){if(!n._saidHello){if(navigator.userAgent.toLowerCase().indexOf("chrome")>-1){var e=["\n %c %c %c Pixi.js "+i.VERSION+" - ✰ "+t+" ✰  %c  %c  http://www.pixijs.com/  %c %c ♥%c♥%c♥ \n\n","background: #ff66a5; padding:5px 0;","background: #ff66a5; padding:5px 0;","color: #ff66a5; background: #030307; padding:5px 0;","background: #ff66a5; padding:5px 0;","background: #ffc3dc; padding:5px 0;","background: #ff66a5; padding:5px 0;","color: #ff2424; background: #fff; padding:5px 0;","color: #ff2424; background: #fff; padding:5px 0;","color: #ff2424; background: #fff; padding:5px 0;"];window.console.log.apply(console,e)}else window.console&&window.console.log("Pixi.js "+i.VERSION+" - "+t+" - http://www.pixijs.com/");n._saidHello=!0}},isWebGLSupported:function(){var t={stencil:!0};try{if(!window.WebGLRenderingContext)return!1;var e=document.createElement("canvas"),r=e.getContext("webgl",t)||e.getContext("experimental-webgl",t);return!(!r||!r.getContextAttributes().stencil)}catch(i){return!1}},TextureCache:{},BaseTextureCache:{}}},{"../const":22,"./pluginTarget":77,async:2}],77:[function(t,e,r){function i(t){t.__plugins={},t.registerPlugin=function(e,r){t.__plugins[e]=r},t.prototype.initPlugins=function(){this.plugins=this.plugins||{};for(var e in t.__plugins)this.plugins[e]=new t.__plugins[e](this)},t.prototype.destroyPlugins=function(){for(var t in this.plugins)this.plugins[t].destroy(),this.plugins[t]=null;this.plugins=null}}e.exports={mixin:function(t){i(t)}}},{}],78:[function(t,e,r){var i=t("./core"),n=t("./mesh"),o=t("./extras"),s=t("./filters");i.SpriteBatch=function(){throw new ReferenceError("SpriteBatch does not exist any more, please use the new ParticleContainer instead.")},i.AssetLoader=function(){throw new ReferenceError("The loader system was overhauled in pixi v3, please see the new PIXI.loaders.Loader class.")},Object.defineProperties(i,{Stage:{get:function(){return console.warn("You do not need to use a PIXI Stage any more, you can simply render any container."),i.Container}},DisplayObjectContainer:{get:function(){return console.warn("DisplayObjectContainer has been shortened to Container, please use Container from now on."),i.Container}},Strip:{get:function(){return console.warn("The Strip class has been renamed to Mesh and moved to mesh.Mesh, please use mesh.Mesh from now on."),n.Mesh}},Rope:{get:function(){return console.warn("The Rope class has been moved to mesh.Rope, please use mesh.Rope from now on."),n.Rope}},MovieClip:{get:function(){return console.warn("The MovieClip class has been moved to extras.MovieClip, please use extras.MovieClip from now on."),o.MovieClip}},TilingSprite:{get:function(){return console.warn("The TilingSprite class has been moved to extras.TilingSprite, please use extras.TilingSprite from now on."),o.TilingSprite}},BitmapText:{get:function(){return console.warn("The BitmapText class has been moved to extras.BitmapText, please use extras.BitmapText from now on."),o.BitmapText}},blendModes:{get:function(){return console.warn("The blendModes has been moved to BLEND_MODES, please use BLEND_MODES from now on."),i.BLEND_MODES}},scaleModes:{get:function(){return console.warn("The scaleModes has been moved to SCALE_MODES, please use SCALE_MODES from now on."),i.SCALE_MODES}},BaseTextureCache:{get:function(){return console.warn("The BaseTextureCache class has been moved to utils.BaseTextureCache, please use utils.BaseTextureCache from now on."),i.utils.BaseTextureCache}},TextureCache:{get:function(){return console.warn("The TextureCache class has been moved to utils.TextureCache, please use utils.TextureCache from now on."),i.utils.TextureCache}},math:{get:function(){return console.warn("The math namespace is deprecated, please access members already accessible on PIXI."),i}}}),i.Sprite.prototype.setTexture=function(t){this.texture=t,console.warn("setTexture is now deprecated, please use the texture property, e.g : sprite.texture = texture;")},o.BitmapText.prototype.setText=function(t){this.text=t,console.warn("setText is now deprecated, please use the text property, e.g : myBitmapText.text = 'my text';")},i.Text.prototype.setText=function(t){this.text=t,console.warn("setText is now deprecated, please use the text property, e.g : myText.text = 'my text';")},i.Text.prototype.setStyle=function(t){this.style=t,console.warn("setStyle is now deprecated, please use the style property, e.g : myText.style = style;")},i.Texture.prototype.setFrame=function(t){this.frame=t,console.warn("setFrame is now deprecated, please use the frame property, e.g : myTexture.frame = frame;")},Object.defineProperties(s,{AbstractFilter:{get:function(){return console.warn("filters.AbstractFilter is an undocumented alias, please use AbstractFilter from now on."),i.AbstractFilter}},FXAAFilter:{get:function(){return console.warn("filters.FXAAFilter is an undocumented alias, please use FXAAFilter from now on."),i.FXAAFilter}},SpriteMaskFilter:{get:function(){return console.warn("filters.SpriteMaskFilter is an undocumented alias, please use SpriteMaskFilter from now on."),i.SpriteMaskFilter}}}),i.utils.uuid=function(){return console.warn("utils.uuid() is deprecated, please use utils.uid() from now on."),i.utils.uid()}},{"./core":29,"./extras":85,"./filters":102,"./mesh":126}],79:[function(t,e,r){function i(t,e){n.Container.call(this),e=e||{},this.textWidth=0,this.textHeight=0,this._glyphs=[],this._font={tint:void 0!==e.tint?e.tint:16777215,align:e.align||"left",name:null,size:0},this.font=e.font,this._text=t,this.maxWidth=0,this.dirty=!1,this.updateText()}var n=t("../core");i.prototype=Object.create(n.Container.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{tint:{get:function(){return this._font.tint},set:function(t){
this._font.tint="number"==typeof t&&t>=0?t:16777215,this.dirty=!0}},align:{get:function(){return this._font.align},set:function(t){this._font.align=t||"left",this.dirty=!0}},font:{get:function(){return this._font},set:function(t){t&&("string"==typeof t?(t=t.split(" "),this._font.name=1===t.length?t[0]:t.slice(1).join(" "),this._font.size=t.length>=2?parseInt(t[0],10):i.fonts[this._font.name].size):(this._font.name=t.name,this._font.size="number"==typeof t.size?t.size:parseInt(t.size,10)),this.dirty=!0)}},text:{get:function(){return this._text},set:function(t){t=t.toString()||" ",this._text!==t&&(this._text=t,this.dirty=!0)}}}),i.prototype.updateText=function(){for(var t=i.fonts[this._font.name],e=new n.Point,r=null,o=[],s=0,a=0,h=[],l=0,u=this._font.size/t.size,c=-1,p=0;p<this.text.length;p++){var d=this.text.charCodeAt(p);if(c=/(\s)/.test(this.text.charAt(p))?p:c,/(?:\r\n|\r|\n)/.test(this.text.charAt(p)))h.push(s),a=Math.max(a,s),l++,e.x=0,e.y+=t.lineHeight,r=null;else if(-1!==c&&this.maxWidth>0&&e.x*u>this.maxWidth)o.splice(c,p-c),p=c,c=-1,h.push(s),a=Math.max(a,s),l++,e.x=0,e.y+=t.lineHeight,r=null;else{var f=t.chars[d];f&&(r&&f.kerning[r]&&(e.x+=f.kerning[r]),o.push({texture:f.texture,line:l,charCode:d,position:new n.Point(e.x+f.xOffset,e.y+f.yOffset)}),s=e.x+(f.texture.width+f.xOffset),e.x+=f.xAdvance,r=d)}}h.push(s),a=Math.max(a,s);var v=[];for(p=0;l>=p;p++){var g=0;"right"===this._font.align?g=a-h[p]:"center"===this._font.align&&(g=(a-h[p])/2),v.push(g)}var m=o.length,y=this.tint;for(p=0;m>p;p++){var x=this._glyphs[p];x?x.texture=o[p].texture:(x=new n.Sprite(o[p].texture),this._glyphs.push(x)),x.position.x=(o[p].position.x+v[o[p].line])*u,x.position.y=o[p].position.y*u,x.scale.x=x.scale.y=u,x.tint=y,x.parent||this.addChild(x)}for(p=m;p<this._glyphs.length;++p)this.removeChild(this._glyphs[p]);this.textWidth=a*u,this.textHeight=(e.y+t.lineHeight)*u},i.prototype.updateTransform=function(){this.validate(),this.containerUpdateTransform()},i.prototype.getLocalBounds=function(){return this.validate(),n.Container.prototype.getLocalBounds.call(this)},i.prototype.validate=function(){this.dirty&&(this.updateText(),this.dirty=!1)},i.fonts={}},{"../core":29}],80:[function(t,e,r){function i(t){n.Sprite.call(this,t[0]),this._textures=t,this.animationSpeed=1,this.loop=!0,this.onComplete=null,this._currentTime=0,this.playing=!1}var n=t("../core");i.prototype=Object.create(n.Sprite.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{totalFrames:{get:function(){return this._textures.length}},textures:{get:function(){return this._textures},set:function(t){this._textures=t,this.texture=this._textures[Math.floor(this._currentTime)%this._textures.length]}},currentFrame:{get:function(){return Math.floor(this._currentTime)%this._textures.length}}}),i.prototype.stop=function(){this.playing&&(this.playing=!1,n.ticker.shared.remove(this.update,this))},i.prototype.play=function(){this.playing||(this.playing=!0,n.ticker.shared.add(this.update,this))},i.prototype.gotoAndStop=function(t){this.stop(),this._currentTime=t;var e=Math.floor(this._currentTime);this._texture=this._textures[e%this._textures.length]},i.prototype.gotoAndPlay=function(t){this._currentTime=t,this.play()},i.prototype.update=function(t){this._currentTime+=this.animationSpeed*t;var e=Math.floor(this._currentTime);0>e?this.loop?this._texture=this._textures[this._textures.length-1+e%this._textures.length]:(this.gotoAndStop(0),this.onComplete&&this.onComplete()):this.loop||e<this._textures.length?this._texture=this._textures[e%this._textures.length]:e>=this._textures.length&&(this.gotoAndStop(this.textures.length-1),this.onComplete&&this.onComplete())},i.prototype.destroy=function(){this.stop(),n.Sprite.prototype.destroy.call(this)},i.fromFrames=function(t){for(var e=[],r=0;r<t.length;++r)e.push(new n.Texture.fromFrame(t[r]));return new i(e)},i.fromImages=function(t){for(var e=[],r=0;r<t.length;++r)e.push(new n.Texture.fromImage(t[r]));return new i(e)}},{"../core":29}],81:[function(t,e,r){function i(t,e,r){n.Sprite.call(this,t),this.tileScale=new n.Point(1,1),this.tilePosition=new n.Point(0,0),this._width=e||100,this._height=r||100,this._uvs=new n.TextureUvs,this._canvasPattern=null,this.shader=new n.AbstractFilter(["precision lowp float;","attribute vec2 aVertexPosition;","attribute vec2 aTextureCoord;","attribute vec4 aColor;","uniform mat3 projectionMatrix;","uniform vec4 uFrame;","uniform vec4 uTransform;","varying vec2 vTextureCoord;","varying vec4 vColor;","void main(void){","   gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);","   vec2 coord = aTextureCoord;","   coord -= uTransform.xy;","   coord /= uTransform.zw;","   vTextureCoord = coord;","   vColor = vec4(aColor.rgb * aColor.a, aColor.a);","}"].join("\n"),["precision lowp float;","varying vec2 vTextureCoord;","varying vec4 vColor;","uniform sampler2D uSampler;","uniform vec4 uFrame;","uniform vec2 uPixelSize;","void main(void){","   vec2 coord = mod(vTextureCoord, uFrame.zw);","   coord = clamp(coord, uPixelSize, uFrame.zw - uPixelSize);","   coord += uFrame.xy;","   gl_FragColor =  texture2D(uSampler, coord) * vColor ;","}"].join("\n"),{uFrame:{type:"4fv",value:[0,0,1,1]},uTransform:{type:"4fv",value:[0,0,1,1]},uPixelSize:{type:"2fv",value:[1,1]}})}var n=t("../core"),o=new n.Point;i.prototype=Object.create(n.Sprite.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{width:{get:function(){return this._width},set:function(t){this._width=t}},height:{get:function(){return this._height},set:function(t){this._height=t}}}),i.prototype._onTextureUpdate=function(){},i.prototype._renderWebGL=function(t){var e=this._texture;if(e&&e._uvs){var r=e._uvs,i=e._frame.width,n=e._frame.height,o=e.baseTexture.width,s=e.baseTexture.height;e._uvs=this._uvs,e._frame.width=this.width,e._frame.height=this.height,this.shader.uniforms.uPixelSize.value[0]=1/o,this.shader.uniforms.uPixelSize.value[1]=1/s,this.shader.uniforms.uFrame.value[0]=r.x0,this.shader.uniforms.uFrame.value[1]=r.y0,this.shader.uniforms.uFrame.value[2]=r.x1-r.x0,this.shader.uniforms.uFrame.value[3]=r.y2-r.y0,this.shader.uniforms.uTransform.value[0]=this.tilePosition.x%(i*this.tileScale.x)/this._width,this.shader.uniforms.uTransform.value[1]=this.tilePosition.y%(n*this.tileScale.y)/this._height,this.shader.uniforms.uTransform.value[2]=o/this._width*this.tileScale.x,this.shader.uniforms.uTransform.value[3]=s/this._height*this.tileScale.y,t.setObjectRenderer(t.plugins.sprite),t.plugins.sprite.render(this),e._uvs=r,e._frame.width=i,e._frame.height=n}},i.prototype._renderCanvas=function(t){var e=this._texture;if(e.baseTexture.hasLoaded){var r=t.context,i=this.worldTransform,o=t.resolution,s=e.baseTexture,a=this.tilePosition.x%(e._frame.width*this.tileScale.x),h=this.tilePosition.y%(e._frame.height*this.tileScale.y);if(!this._canvasPattern){var l=new n.CanvasBuffer(e._frame.width,e._frame.height);l.context.drawImage(s.source,-e._frame.x,-e._frame.y),this._canvasPattern=l.context.createPattern(l.canvas,"repeat")}r.globalAlpha=this.worldAlpha,r.setTransform(i.a*o,i.b*o,i.c*o,i.d*o,i.tx*o,i.ty*o),r.scale(this.tileScale.x,this.tileScale.y),r.translate(a+this.anchor.x*-this._width,h+this.anchor.y*-this._height),this.blendMode!==t.currentBlendMode&&(t.currentBlendMode=this.blendMode,r.globalCompositeOperation=t.blendModes[t.currentBlendMode]),r.fillStyle=this._canvasPattern,r.fillRect(-a,-h,this._width/this.tileScale.x,this._height/this.tileScale.y)}},i.prototype.getBounds=function(){var t,e,r,i,n=this._width,o=this._height,s=n*(1-this.anchor.x),a=n*-this.anchor.x,h=o*(1-this.anchor.y),l=o*-this.anchor.y,u=this.worldTransform,c=u.a,p=u.b,d=u.c,f=u.d,v=u.tx,g=u.ty,m=c*a+d*l+v,y=f*l+p*a+g,x=c*s+d*l+v,b=f*l+p*s+g,_=c*s+d*h+v,T=f*h+p*s+g,E=c*a+d*h+v,S=f*h+p*a+g;t=m,t=t>x?x:t,t=t>_?_:t,t=t>E?E:t,r=y,r=r>b?b:r,r=r>T?T:r,r=r>S?S:r,e=m,e=x>e?x:e,e=_>e?_:e,e=E>e?E:e,i=y,i=b>i?b:i,i=T>i?T:i,i=S>i?S:i;var A=this._bounds;return A.x=t,A.width=e-t,A.y=r,A.height=i-r,this._currentBounds=A,A},i.prototype.containsPoint=function(t){this.worldTransform.applyInverse(t,o);var e,r=this._width,i=this._height,n=-r*this.anchor.x;return o.x>n&&o.x<n+r&&(e=-i*this.anchor.y,o.y>e&&o.y<e+i)?!0:!1},i.prototype.destroy=function(){n.Sprite.prototype.destroy.call(this),this.tileScale=null,this._tileScaleOffset=null,this.tilePosition=null,this._uvs=null},i.fromFrame=function(t,e,r){var o=n.utils.TextureCache[t];if(!o)throw new Error('The frameId "'+t+'" does not exist in the texture cache '+this);return new i(o,e,r)},i.fromImage=function(t,e,r,o,s){return new i(n.Texture.fromImage(t,o,s),e,r)}},{"../core":29}],82:[function(t,e,r){var i=t("../core"),n=i.DisplayObject,o=new i.Matrix;n.prototype._cacheAsBitmap=!1,n.prototype._originalRenderWebGL=null,n.prototype._originalRenderCanvas=null,n.prototype._originalUpdateTransform=null,n.prototype._originalHitTest=null,n.prototype._originalDestroy=null,n.prototype._cachedSprite=null,Object.defineProperties(n.prototype,{cacheAsBitmap:{get:function(){return this._cacheAsBitmap},set:function(t){this._cacheAsBitmap!==t&&(this._cacheAsBitmap=t,t?(this._originalRenderWebGL=this.renderWebGL,this._originalRenderCanvas=this.renderCanvas,this._originalUpdateTransform=this.updateTransform,this._originalGetBounds=this.getBounds,this._originalDestroy=this.destroy,this._originalContainsPoint=this.containsPoint,this.renderWebGL=this._renderCachedWebGL,this.renderCanvas=this._renderCachedCanvas,this.destroy=this._cacheAsBitmapDestroy):(this._cachedSprite&&this._destroyCachedDisplayObject(),this.renderWebGL=this._originalRenderWebGL,this.renderCanvas=this._originalRenderCanvas,this.getBounds=this._originalGetBounds,this.destroy=this._originalDestroy,this.updateTransform=this._originalUpdateTransform,this.containsPoint=this._originalContainsPoint))}}}),n.prototype._renderCachedWebGL=function(t){!this.visible||this.worldAlpha<=0||!this.renderable||(this._initCachedDisplayObject(t),this._cachedSprite.worldAlpha=this.worldAlpha,t.setObjectRenderer(t.plugins.sprite),t.plugins.sprite.render(this._cachedSprite))},n.prototype._initCachedDisplayObject=function(t){if(!this._cachedSprite){t.currentRenderer.flush();var e=this.getLocalBounds().clone();if(this._filters){var r=this._filters[0].padding;e.x-=r,e.y-=r,e.width+=2*r,e.height+=2*r}var n=t.currentRenderTarget,s=t.filterManager.filterStack,a=new i.RenderTexture(t,0|e.width,0|e.height),h=o;h.tx=-e.x,h.ty=-e.y,this.renderWebGL=this._originalRenderWebGL,a.render(this,h,!0,!0),t.setRenderTarget(n),t.filterManager.filterStack=s,this.renderWebGL=this._renderCachedWebGL,this.updateTransform=this.displayObjectUpdateTransform,this.getBounds=this._getCachedBounds,this._cachedSprite=new i.Sprite(a),this._cachedSprite.worldTransform=this.worldTransform,this._cachedSprite.anchor.x=-(e.x/e.width),this._cachedSprite.anchor.y=-(e.y/e.height),this.updateTransform(),this.containsPoint=this._cachedSprite.containsPoint.bind(this._cachedSprite)}},n.prototype._renderCachedCanvas=function(t){!this.visible||this.worldAlpha<=0||!this.renderable||(this._initCachedDisplayObjectCanvas(t),this._cachedSprite.worldAlpha=this.worldAlpha,this._cachedSprite.renderCanvas(t))},n.prototype._initCachedDisplayObjectCanvas=function(t){if(!this._cachedSprite){var e=this.getLocalBounds(),r=t.context,n=new i.RenderTexture(t,0|e.width,0|e.height),s=o;s.tx=-e.x,s.ty=-e.y,this.renderCanvas=this._originalRenderCanvas,n.render(this,s,!0),t.context=r,this.renderCanvas=this._renderCachedCanvas,this.updateTransform=this.displayObjectUpdateTransform,this.getBounds=this._getCachedBounds,this._cachedSprite=new i.Sprite(n),this._cachedSprite.worldTransform=this.worldTransform,this._cachedSprite.anchor.x=-(e.x/e.width),this._cachedSprite.anchor.y=-(e.y/e.height),this.updateTransform(),this.containsPoint=this._cachedSprite.containsPoint.bind(this._cachedSprite)}},n.prototype._getCachedBounds=function(){return this._cachedSprite._currentBounds=null,this._cachedSprite.getBounds()},n.prototype._destroyCachedDisplayObject=function(){this._cachedSprite._texture.destroy(),this._cachedSprite=null},n.prototype._cacheAsBitmapDestroy=function(){this.cacheAsBitmap=!1,this._originalDestroy()}},{"../core":29}],83:[function(t,e,r){var i=t("../core");i.DisplayObject.prototype.name=null,i.Container.prototype.getChildByName=function(t){for(var e=0;e<this.children.length;e++)if(this.children[e].name===t)return this.children[e];return null}},{"../core":29}],84:[function(t,e,r){var i=t("../core");i.DisplayObject.prototype.getGlobalPosition=function(t){return t=t||new i.Point,this.parent?(this.displayObjectUpdateTransform(),t.x=this.worldTransform.tx,t.y=this.worldTransform.ty):(t.x=this.position.x,t.y=this.position.y),t}},{"../core":29}],85:[function(t,e,r){t("./cacheAsBitmap"),t("./getChildByName"),t("./getGlobalPosition"),e.exports={MovieClip:t("./MovieClip"),TilingSprite:t("./TilingSprite"),BitmapText:t("./BitmapText")}},{"./BitmapText":79,"./MovieClip":80,"./TilingSprite":81,"./cacheAsBitmap":82,"./getChildByName":83,"./getGlobalPosition":84}],86:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nuniform vec4 dimensions;\nuniform float pixelSize;\nuniform sampler2D uSampler;\n\nfloat character(float n, vec2 p)\n{\n    p = floor(p*vec2(4.0, -4.0) + 2.5);\n    if (clamp(p.x, 0.0, 4.0) == p.x && clamp(p.y, 0.0, 4.0) == p.y)\n    {\n        if (int(mod(n/exp2(p.x + 5.0*p.y), 2.0)) == 1) return 1.0;\n    }\n    return 0.0;\n}\n\nvoid main()\n{\n    vec2 uv = gl_FragCoord.xy;\n\n    vec3 col = texture2D(uSampler, floor( uv / pixelSize ) * pixelSize / dimensions.xy).rgb;\n\n    float gray = (col.r + col.g + col.b) / 3.0;\n\n    float n =  65536.0;             // .\n    if (gray > 0.2) n = 65600.0;    // :\n    if (gray > 0.3) n = 332772.0;   // *\n    if (gray > 0.4) n = 15255086.0; // o\n    if (gray > 0.5) n = 23385164.0; // &\n    if (gray > 0.6) n = 15252014.0; // 8\n    if (gray > 0.7) n = 13199452.0; // @\n    if (gray > 0.8) n = 11512810.0; // #\n\n    vec2 p = mod( uv / ( pixelSize * 0.5 ), 2.0) - vec2(1.0);\n    col = col * character(n, p);\n\n    gl_FragColor = vec4(col, 1.0);\n}\n",{dimensions:{type:"4fv",value:new Float32Array([0,0,0,0])},pixelSize:{type:"1f",value:8}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{size:{get:function(){return this.uniforms.pixelSize.value},set:function(t){this.uniforms.pixelSize.value=t}}})},{"../../core":29}],87:[function(t,e,r){function i(){n.AbstractFilter.call(this),this.blurXFilter=new o,this.blurYFilter=new s,this.defaultFilter=new n.AbstractFilter}var n=t("../../core"),o=t("../blur/BlurXFilter"),s=t("../blur/BlurYFilter");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r){var i=t.filterManager.getRenderTarget(!0);this.defaultFilter.applyFilter(t,e,r),this.blurXFilter.applyFilter(t,e,i),t.blendModeManager.setBlendMode(n.BLEND_MODES.SCREEN),this.blurYFilter.applyFilter(t,i,r),t.blendModeManager.setBlendMode(n.BLEND_MODES.NORMAL),t.filterManager.returnRenderTarget(i)},Object.defineProperties(i.prototype,{blur:{get:function(){return this.blurXFilter.blur},set:function(t){this.blurXFilter.blur=this.blurYFilter.blur=t}},blurX:{get:function(){return this.blurXFilter.blur},set:function(t){this.blurXFilter.blur=t}},blurY:{get:function(){return this.blurYFilter.blur},set:function(t){this.blurYFilter.blur=t}}})},{"../../core":29,"../blur/BlurXFilter":90,"../blur/BlurYFilter":91}],88:[function(t,e,r){function i(t,e){n.AbstractFilter.call(this,"attribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\nattribute vec4 aColor;\n\nuniform float strength;\nuniform float dirX;\nuniform float dirY;\nuniform mat3 projectionMatrix;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\nvarying vec2 vBlurTexCoords[3];\n\nvoid main(void)\n{\n    gl_Position = vec4((projectionMatrix * vec3((aVertexPosition), 1.0)).xy, 0.0, 1.0);\n    vTextureCoord = aTextureCoord;\n\n    vBlurTexCoords[0] = aTextureCoord + vec2( (0.004 * strength) * dirX, (0.004 * strength) * dirY );\n    vBlurTexCoords[1] = aTextureCoord + vec2( (0.008 * strength) * dirX, (0.008 * strength) * dirY );\n    vBlurTexCoords[2] = aTextureCoord + vec2( (0.012 * strength) * dirX, (0.012 * strength) * dirY );\n\n    vColor = vec4(aColor.rgb * aColor.a, aColor.a);\n}\n","precision lowp float;\n\nvarying vec2 vTextureCoord;\nvarying vec2 vBlurTexCoords[3];\nvarying vec4 vColor;\n\nuniform sampler2D uSampler;\n\nvoid main(void)\n{\n    gl_FragColor = vec4(0.0);\n\n    gl_FragColor += texture2D(uSampler, vTextureCoord     ) * 0.3989422804014327;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 0]) * 0.2419707245191454;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 1]) * 0.05399096651318985;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 2]) * 0.004431848411938341;\n}\n",{strength:{type:"1f",value:1},dirX:{type:"1f",value:t||0},dirY:{type:"1f",value:e||0}}),this.defaultFilter=new n.AbstractFilter,this.passes=1,this.dirX=t||0,this.dirY=e||0,this.strength=4}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r,i){var n=this.getShader(t);if(this.uniforms.strength.value=this.strength/4/this.passes*(e.frame.width/e.size.width),1===this.passes)t.filterManager.applyFilter(n,e,r,i);else{var o=t.filterManager.getRenderTarget(!0);t.filterManager.applyFilter(n,e,o,i);for(var s=0;s<this.passes-2;s++)t.filterManager.applyFilter(n,o,o,i);t.filterManager.applyFilter(n,o,r,i),t.filterManager.returnRenderTarget(o)}},Object.defineProperties(i.prototype,{blur:{get:function(){return this.strength},set:function(t){this.padding=.5*t,this.strength=t}},dirX:{get:function(){return this.dirX},set:function(t){this.uniforms.dirX.value=t}},dirY:{get:function(){return this.dirY},set:function(t){this.uniforms.dirY.value=t}}})},{"../../core":29}],89:[function(t,e,r){function i(){n.AbstractFilter.call(this),this.blurXFilter=new o,this.blurYFilter=new s}var n=t("../../core"),o=t("./BlurXFilter"),s=t("./BlurYFilter");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r){var i=t.filterManager.getRenderTarget(!0);this.blurXFilter.applyFilter(t,e,i),this.blurYFilter.applyFilter(t,i,r),t.filterManager.returnRenderTarget(i)},Object.defineProperties(i.prototype,{blur:{get:function(){return this.blurXFilter.blur},set:function(t){this.padding=.5*Math.abs(t),this.blurXFilter.blur=this.blurYFilter.blur=t}},passes:{get:function(){return this.blurXFilter.passes},set:function(t){this.blurXFilter.passes=this.blurYFilter.passes=t}},blurX:{get:function(){return this.blurXFilter.blur},set:function(t){this.blurXFilter.blur=t}},blurY:{get:function(){return this.blurYFilter.blur},set:function(t){this.blurYFilter.blur=t}}})},{"../../core":29,"./BlurXFilter":90,"./BlurYFilter":91}],90:[function(t,e,r){function i(){n.AbstractFilter.call(this,"attribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\nattribute vec4 aColor;\n\nuniform float strength;\nuniform mat3 projectionMatrix;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\nvarying vec2 vBlurTexCoords[6];\n\nvoid main(void)\n{\n    gl_Position = vec4((projectionMatrix * vec3((aVertexPosition), 1.0)).xy, 0.0, 1.0);\n    vTextureCoord = aTextureCoord;\n\n    vBlurTexCoords[ 0] = aTextureCoord + vec2(-0.012 * strength, 0.0);\n    vBlurTexCoords[ 1] = aTextureCoord + vec2(-0.008 * strength, 0.0);\n    vBlurTexCoords[ 2] = aTextureCoord + vec2(-0.004 * strength, 0.0);\n    vBlurTexCoords[ 3] = aTextureCoord + vec2( 0.004 * strength, 0.0);\n    vBlurTexCoords[ 4] = aTextureCoord + vec2( 0.008 * strength, 0.0);\n    vBlurTexCoords[ 5] = aTextureCoord + vec2( 0.012 * strength, 0.0);\n\n    vColor = vec4(aColor.rgb * aColor.a, aColor.a);\n}\n","precision lowp float;\n\nvarying vec2 vTextureCoord;\nvarying vec2 vBlurTexCoords[6];\nvarying vec4 vColor;\n\nuniform sampler2D uSampler;\n\nvoid main(void)\n{\n    gl_FragColor = vec4(0.0);\n\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 0])*0.004431848411938341;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 1])*0.05399096651318985;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 2])*0.2419707245191454;\n    gl_FragColor += texture2D(uSampler, vTextureCoord     )*0.3989422804014327;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 3])*0.2419707245191454;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 4])*0.05399096651318985;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 5])*0.004431848411938341;\n}\n",{strength:{type:"1f",value:1}}),this.passes=1,this.strength=4}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r,i){var n=this.getShader(t);if(this.uniforms.strength.value=this.strength/4/this.passes*(e.frame.width/e.size.width),1===this.passes)t.filterManager.applyFilter(n,e,r,i);else{for(var o=t.filterManager.getRenderTarget(!0),s=e,a=o,h=0;h<this.passes-1;h++){t.filterManager.applyFilter(n,s,a,!0);var l=a;a=s,s=l}t.filterManager.applyFilter(n,s,r,i),t.filterManager.returnRenderTarget(o)}},Object.defineProperties(i.prototype,{blur:{get:function(){return this.strength},set:function(t){this.padding=.5*Math.abs(t),this.strength=t}}})},{"../../core":29}],91:[function(t,e,r){function i(){n.AbstractFilter.call(this,"attribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\nattribute vec4 aColor;\n\nuniform float strength;\nuniform mat3 projectionMatrix;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\nvarying vec2 vBlurTexCoords[6];\n\nvoid main(void)\n{\n    gl_Position = vec4((projectionMatrix * vec3((aVertexPosition), 1.0)).xy, 0.0, 1.0);\n    vTextureCoord = aTextureCoord;\n\n    vBlurTexCoords[ 0] = aTextureCoord + vec2(0.0, -0.012 * strength);\n    vBlurTexCoords[ 1] = aTextureCoord + vec2(0.0, -0.008 * strength);\n    vBlurTexCoords[ 2] = aTextureCoord + vec2(0.0, -0.004 * strength);\n    vBlurTexCoords[ 3] = aTextureCoord + vec2(0.0,  0.004 * strength);\n    vBlurTexCoords[ 4] = aTextureCoord + vec2(0.0,  0.008 * strength);\n    vBlurTexCoords[ 5] = aTextureCoord + vec2(0.0,  0.012 * strength);\n\n   vColor = vec4(aColor.rgb * aColor.a, aColor.a);\n}\n","precision lowp float;\n\nvarying vec2 vTextureCoord;\nvarying vec2 vBlurTexCoords[6];\nvarying vec4 vColor;\n\nuniform sampler2D uSampler;\n\nvoid main(void)\n{\n    gl_FragColor = vec4(0.0);\n\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 0])*0.004431848411938341;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 1])*0.05399096651318985;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 2])*0.2419707245191454;\n    gl_FragColor += texture2D(uSampler, vTextureCoord     )*0.3989422804014327;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 3])*0.2419707245191454;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 4])*0.05399096651318985;\n    gl_FragColor += texture2D(uSampler, vBlurTexCoords[ 5])*0.004431848411938341;\n}\n",{strength:{type:"1f",value:1}}),this.passes=1,this.strength=4}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r,i){var n=this.getShader(t);if(this.uniforms.strength.value=Math.abs(this.strength)/4/this.passes*(e.frame.height/e.size.height),1===this.passes)t.filterManager.applyFilter(n,e,r,i);else{for(var o=t.filterManager.getRenderTarget(!0),s=e,a=o,h=0;h<this.passes-1;h++){t.filterManager.applyFilter(n,s,a,!0);var l=a;a=s,s=l}t.filterManager.applyFilter(n,s,r,i),t.filterManager.returnRenderTarget(o)}},Object.defineProperties(i.prototype,{blur:{get:function(){return this.strength},set:function(t){this.padding=.5*Math.abs(t),this.strength=t}}})},{"../../core":29}],92:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\nuniform vec2 delta;\n\nfloat random(vec3 scale, float seed)\n{\n    return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);\n}\n\nvoid main(void)\n{\n    vec4 color = vec4(0.0);\n    float total = 0.0;\n\n    float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);\n\n    for (float t = -30.0; t <= 30.0; t++)\n    {\n        float percent = (t + offset - 0.5) / 30.0;\n        float weight = 1.0 - abs(percent);\n        vec4 sample = texture2D(uSampler, vTextureCoord + delta * percent);\n        sample.rgb *= sample.a;\n        color += sample * weight;\n        total += weight;\n    }\n\n    gl_FragColor = color / total;\n    gl_FragColor.rgb /= gl_FragColor.a + 0.00001;\n}\n",{delta:{type:"v2",value:{x:.1,y:0}}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i},{"../../core":29}],93:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\nuniform sampler2D uSampler;\nuniform float m[25];\n\nvoid main(void)\n{\n\n    vec4 c = texture2D(uSampler, vTextureCoord);\n\n    gl_FragColor.r = (m[0] * c.r);\n        gl_FragColor.r += (m[1] * c.g);\n        gl_FragColor.r += (m[2] * c.b);\n        gl_FragColor.r += (m[3] * c.a);\n        gl_FragColor.r += m[4];\n\n    gl_FragColor.g = (m[5] * c.r);\n        gl_FragColor.g += (m[6] * c.g);\n        gl_FragColor.g += (m[7] * c.b);\n        gl_FragColor.g += (m[8] * c.a);\n        gl_FragColor.g += m[9];\n\n     gl_FragColor.b = (m[10] * c.r);\n        gl_FragColor.b += (m[11] * c.g);\n        gl_FragColor.b += (m[12] * c.b);\n        gl_FragColor.b += (m[13] * c.a);\n        gl_FragColor.b += m[14];\n\n     gl_FragColor.a = (m[15] * c.r);\n        gl_FragColor.a += (m[16] * c.g);\n        gl_FragColor.a += (m[17] * c.b);\n        gl_FragColor.a += (m[18] * c.a);\n        gl_FragColor.a += m[19];\n\n}\n",{m:{type:"1fv",value:[1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0]}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype._loadMatrix=function(t,e){e=!!e;var r=t;e&&(this._multiply(r,this.uniforms.m.value,t),r=this._colorMatrix(r)),this.uniforms.m.value=r},i.prototype._multiply=function(t,e,r){return t[0]=e[0]*r[0]+e[1]*r[5]+e[2]*r[10]+e[3]*r[15],t[1]=e[0]*r[1]+e[1]*r[6]+e[2]*r[11]+e[3]*r[16],t[2]=e[0]*r[2]+e[1]*r[7]+e[2]*r[12]+e[3]*r[17],t[3]=e[0]*r[3]+e[1]*r[8]+e[2]*r[13]+e[3]*r[18],t[4]=e[0]*r[4]+e[1]*r[9]+e[2]*r[14]+e[3]*r[19],t[5]=e[5]*r[0]+e[6]*r[5]+e[7]*r[10]+e[8]*r[15],t[6]=e[5]*r[1]+e[6]*r[6]+e[7]*r[11]+e[8]*r[16],t[7]=e[5]*r[2]+e[6]*r[7]+e[7]*r[12]+e[8]*r[17],t[8]=e[5]*r[3]+e[6]*r[8]+e[7]*r[13]+e[8]*r[18],t[9]=e[5]*r[4]+e[6]*r[9]+e[7]*r[14]+e[8]*r[19],t[10]=e[10]*r[0]+e[11]*r[5]+e[12]*r[10]+e[13]*r[15],t[11]=e[10]*r[1]+e[11]*r[6]+e[12]*r[11]+e[13]*r[16],t[12]=e[10]*r[2]+e[11]*r[7]+e[12]*r[12]+e[13]*r[17],t[13]=e[10]*r[3]+e[11]*r[8]+e[12]*r[13]+e[13]*r[18],t[14]=e[10]*r[4]+e[11]*r[9]+e[12]*r[14]+e[13]*r[19],t[15]=e[15]*r[0]+e[16]*r[5]+e[17]*r[10]+e[18]*r[15],t[16]=e[15]*r[1]+e[16]*r[6]+e[17]*r[11]+e[18]*r[16],t[17]=e[15]*r[2]+e[16]*r[7]+e[17]*r[12]+e[18]*r[17],t[18]=e[15]*r[3]+e[16]*r[8]+e[17]*r[13]+e[18]*r[18],t[19]=e[15]*r[4]+e[16]*r[9]+e[17]*r[14]+e[18]*r[19],t},i.prototype._colorMatrix=function(t){var e=new Float32Array(t);return e[4]/=255,e[9]/=255,e[14]/=255,e[19]/=255,e},i.prototype.brightness=function(t,e){var r=[t,0,0,0,0,0,t,0,0,0,0,0,t,0,0,0,0,0,1,0];this._loadMatrix(r,e)},i.prototype.greyscale=function(t,e){var r=[t,t,t,0,0,t,t,t,0,0,t,t,t,0,0,0,0,0,1,0];this._loadMatrix(r,e)},i.prototype.grayscale=i.prototype.greyscale,i.prototype.blackAndWhite=function(t){var e=[.3,.6,.1,0,0,.3,.6,.1,0,0,.3,.6,.1,0,0,0,0,0,1,0];this._loadMatrix(e,t)},i.prototype.hue=function(t,e){t=(t||0)/180*Math.PI;var r=Math.cos(t),i=Math.sin(t),n=.213,o=.715,s=.072,a=[n+r*(1-n)+i*-n,o+r*-o+i*-o,s+r*-s+i*(1-s),0,0,n+r*-n+.143*i,o+r*(1-o)+.14*i,s+r*-s+i*-.283,0,0,n+r*-n+i*-(1-n),o+r*-o+i*o,s+r*(1-s)+i*s,0,0,0,0,0,1,0];this._loadMatrix(a,e)},i.prototype.contrast=function(t,e){var r=(t||0)+1,i=-128*(r-1),n=[r,0,0,0,i,0,r,0,0,i,0,0,r,0,i,0,0,0,1,0];this._loadMatrix(n,e)},i.prototype.saturate=function(t,e){var r=2*(t||0)/3+1,i=(r-1)*-.5,n=[r,i,i,0,0,i,r,i,0,0,i,i,r,0,0,0,0,0,1,0];this._loadMatrix(n,e)},i.prototype.desaturate=function(t){this.saturate(-1)},i.prototype.negative=function(t){var e=[0,1,1,0,0,1,0,1,0,0,1,1,0,0,0,0,0,0,1,0];this._loadMatrix(e,t)},i.prototype.sepia=function(t){var e=[.393,.7689999,.18899999,0,0,.349,.6859999,.16799999,0,0,.272,.5339999,.13099999,0,0,0,0,0,1,0];this._loadMatrix(e,t)},i.prototype.technicolor=function(t){var e=[1.9125277891456083,-.8545344976951645,-.09155508482755585,0,11.793603434377337,-.3087833385928097,1.7658908555458428,-.10601743074722245,0,-70.35205161461398,-.231103377548616,-.7501899197440212,1.847597816108189,0,30.950940869491138,0,0,0,1,0];this._loadMatrix(e,t)},i.prototype.polaroid=function(t){var e=[1.438,-.062,-.062,0,0,-.122,1.378,-.122,0,0,-.016,-.016,1.483,0,0,0,0,0,1,0];this._loadMatrix(e,t)},i.prototype.toBGR=function(t){var e=[0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0];this._loadMatrix(e,t)},i.prototype.kodachrome=function(t){var e=[1.1285582396593525,-.3967382283601348,-.03992559172921793,0,63.72958762196502,-.16404339962244616,1.0835251566291304,-.05498805115633132,0,24.732407896706203,-.16786010706155763,-.5603416277695248,1.6014850761964943,0,35.62982807460946,0,0,0,1,0];this._loadMatrix(e,t)},i.prototype.browni=function(t){var e=[.5997023498159715,.34553243048391263,-.2708298674538042,0,47.43192855600873,-.037703249837783157,.8609577587992641,.15059552388459913,0,-36.96841498319127,.24113635128153335,-.07441037908422492,.44972182064877153,0,-7.562075277591283,0,0,0,1,0];this._loadMatrix(e,t)},i.prototype.vintage=function(t){var e=[.6279345635605994,.3202183420819367,-.03965408211312453,0,9.651285835294123,.02578397704808868,.6441188644374771,.03259127616149294,0,7.462829176470591,.0466055556782719,-.0851232987247891,.5241648018700465,0,5.159190588235296,0,0,0,1,0];this._loadMatrix(e,t)},i.prototype.colorTone=function(t,e,r,i,n){t=t||.2,e=e||.15,r=r||16770432,i=i||3375104;var o=(r>>16&255)/255,s=(r>>8&255)/255,a=(255&r)/255,h=(i>>16&255)/255,l=(i>>8&255)/255,u=(255&i)/255,c=[.3,.59,.11,0,0,o,s,a,t,0,h,l,u,e,0,o-h,s-l,a-u,0,0];this._loadMatrix(c,n)},i.prototype.night=function(t,e){t=t||.1;var r=[-2*t,-t,0,0,0,-t,0,t,0,0,0,t,2*t,0,0,0,0,0,1,0];this._loadMatrix(r,e)},i.prototype.predator=function(t,e){var r=[11.224130630493164*t,-4.794486999511719*t,-2.8746118545532227*t,0*t,.40342438220977783*t,-3.6330697536468506*t,9.193157196044922*t,-2.951810836791992*t,0*t,-1.316135048866272*t,-3.2184197902679443*t,-4.2375030517578125*t,7.476448059082031*t,0*t,.8044459223747253*t,0,0,0,1,0];this._loadMatrix(r,e)},i.prototype.lsd=function(t){var e=[2,-.4,.5,0,0,-.5,2,-.4,0,0,-.4,-.5,3,0,0,0,0,0,1,0];this._loadMatrix(e,t)},i.prototype.reset=function(){var t=[1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0];this._loadMatrix(t,!1)},Object.defineProperties(i.prototype,{matrix:{get:function(){return this.uniforms.m.value},set:function(t){this.uniforms.m.value=t}}})},{"../../core":29}],94:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\nuniform float step;\n\nvoid main(void)\n{\n    vec4 color = texture2D(uSampler, vTextureCoord);\n\n    color = floor(color * step) / step;\n\n    gl_FragColor = color;\n}\n",{step:{type:"1f",value:5}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{step:{get:function(){return this.uniforms.step.value},set:function(t){this.uniforms.step.value=t;

}}})},{"../../core":29}],95:[function(t,e,r){function i(t,e,r){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying mediump vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\nuniform vec2 texelSize;\nuniform float matrix[9];\n\nvoid main(void)\n{\n   vec4 c11 = texture2D(uSampler, vTextureCoord - texelSize); // top left\n   vec4 c12 = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - texelSize.y)); // top center\n   vec4 c13 = texture2D(uSampler, vec2(vTextureCoord.x + texelSize.x, vTextureCoord.y - texelSize.y)); // top right\n\n   vec4 c21 = texture2D(uSampler, vec2(vTextureCoord.x - texelSize.x, vTextureCoord.y)); // mid left\n   vec4 c22 = texture2D(uSampler, vTextureCoord); // mid center\n   vec4 c23 = texture2D(uSampler, vec2(vTextureCoord.x + texelSize.x, vTextureCoord.y)); // mid right\n\n   vec4 c31 = texture2D(uSampler, vec2(vTextureCoord.x - texelSize.x, vTextureCoord.y + texelSize.y)); // bottom left\n   vec4 c32 = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + texelSize.y)); // bottom center\n   vec4 c33 = texture2D(uSampler, vTextureCoord + texelSize); // bottom right\n\n   gl_FragColor =\n       c11 * matrix[0] + c12 * matrix[1] + c13 * matrix[2] +\n       c21 * matrix[3] + c22 * matrix[4] + c23 * matrix[5] +\n       c31 * matrix[6] + c32 * matrix[7] + c33 * matrix[8];\n\n   gl_FragColor.a = c22.a;\n}\n",{matrix:{type:"1fv",value:new Float32Array(t)},texelSize:{type:"v2",value:{x:1/e,y:1/r}}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{matrix:{get:function(){return this.uniforms.matrix.value},set:function(t){this.uniforms.matrix.value=new Float32Array(t)}},width:{get:function(){return 1/this.uniforms.texelSize.value.x},set:function(t){this.uniforms.texelSize.value.x=1/t}},height:{get:function(){return 1/this.uniforms.texelSize.value.y},set:function(t){this.uniforms.texelSize.value.y=1/t}}})},{"../../core":29}],96:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\n\nvoid main(void)\n{\n    float lum = length(texture2D(uSampler, vTextureCoord.xy).rgb);\n\n    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);\n\n    if (lum < 1.00)\n    {\n        if (mod(gl_FragCoord.x + gl_FragCoord.y, 10.0) == 0.0)\n        {\n            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n        }\n    }\n\n    if (lum < 0.75)\n    {\n        if (mod(gl_FragCoord.x - gl_FragCoord.y, 10.0) == 0.0)\n        {\n            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n        }\n    }\n\n    if (lum < 0.50)\n    {\n        if (mod(gl_FragCoord.x + gl_FragCoord.y - 5.0, 10.0) == 0.0)\n        {\n            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n        }\n    }\n\n    if (lum < 0.3)\n    {\n        if (mod(gl_FragCoord.x - gl_FragCoord.y - 5.0, 10.0) == 0.0)\n        {\n            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n        }\n    }\n}\n")}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i},{"../../core":29}],97:[function(t,e,r){function i(t){var e=new n.Matrix;t.renderable=!1,n.AbstractFilter.call(this,"attribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\nattribute vec4 aColor;\n\nuniform mat3 projectionMatrix;\nuniform mat3 otherMatrix;\n\nvarying vec2 vMapCoord;\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nvoid main(void)\n{\n   gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);\n   vTextureCoord = aTextureCoord;\n   vMapCoord = ( otherMatrix * vec3( aTextureCoord, 1.0)  ).xy;\n   vColor = vec4(aColor.rgb * aColor.a, aColor.a);\n}\n","precision lowp float;\n\nvarying vec2 vMapCoord;\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nuniform vec2 scale;\n\nuniform sampler2D uSampler;\nuniform sampler2D mapSampler;\n\nvoid main(void)\n{\n   vec4 original =  texture2D(uSampler, vTextureCoord);\n   vec4 map =  texture2D(mapSampler, vMapCoord);\n\n   map -= 0.5;\n   map.xy *= scale;\n\n   gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x + map.x, vTextureCoord.y + map.y));\n}\n",{mapSampler:{type:"sampler2D",value:t.texture},otherMatrix:{type:"mat3",value:e.toArray(!0)},scale:{type:"v2",value:{x:1,y:1}}}),this.maskSprite=t,this.maskMatrix=e,this.scale=new n.Point(20,20)}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r){var i=t.filterManager;i.calculateMappedMatrix(e.frame,this.maskSprite,this.maskMatrix),this.uniforms.otherMatrix.value=this.maskMatrix.toArray(!0),this.uniforms.scale.value.x=this.scale.x*(1/e.frame.width),this.uniforms.scale.value.y=this.scale.y*(1/e.frame.height);var n=this.getShader(t);i.applyFilter(n,e,r)},Object.defineProperties(i.prototype,{map:{get:function(){return this.uniforms.mapSampler.value},set:function(t){this.uniforms.mapSampler.value=t}}})},{"../../core":29}],98:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nuniform vec4 dimensions;\nuniform sampler2D uSampler;\n\nuniform float angle;\nuniform float scale;\n\nfloat pattern()\n{\n   float s = sin(angle), c = cos(angle);\n   vec2 tex = vTextureCoord * dimensions.xy;\n   vec2 point = vec2(\n       c * tex.x - s * tex.y,\n       s * tex.x + c * tex.y\n   ) * scale;\n   return (sin(point.x) * sin(point.y)) * 4.0;\n}\n\nvoid main()\n{\n   vec4 color = texture2D(uSampler, vTextureCoord);\n   float average = (color.r + color.g + color.b) / 3.0;\n   gl_FragColor = vec4(vec3(average * 10.0 - 5.0 + pattern()), color.a);\n}\n",{scale:{type:"1f",value:1},angle:{type:"1f",value:5},dimensions:{type:"4fv",value:[0,0,0,0]}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{scale:{get:function(){return this.uniforms.scale.value},set:function(t){this.uniforms.scale.value=t}},angle:{get:function(){return this.uniforms.angle.value},set:function(t){this.uniforms.angle.value=t}}})},{"../../core":29}],99:[function(t,e,r){function i(){n.AbstractFilter.call(this,"attribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\nattribute vec4 aColor;\n\nuniform float strength;\nuniform vec2 offset;\n\nuniform mat3 projectionMatrix;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\nvarying vec2 vBlurTexCoords[6];\n\nvoid main(void)\n{\n    gl_Position = vec4((projectionMatrix * vec3((aVertexPosition+offset), 1.0)).xy, 0.0, 1.0);\n    vTextureCoord = aTextureCoord;\n\n    vBlurTexCoords[ 0] = aTextureCoord + vec2(0.0, -0.012 * strength);\n    vBlurTexCoords[ 1] = aTextureCoord + vec2(0.0, -0.008 * strength);\n    vBlurTexCoords[ 2] = aTextureCoord + vec2(0.0, -0.004 * strength);\n    vBlurTexCoords[ 3] = aTextureCoord + vec2(0.0,  0.004 * strength);\n    vBlurTexCoords[ 4] = aTextureCoord + vec2(0.0,  0.008 * strength);\n    vBlurTexCoords[ 5] = aTextureCoord + vec2(0.0,  0.012 * strength);\n\n   vColor = vec4(aColor.rgb * aColor.a, aColor.a);\n}\n","precision lowp float;\n\nvarying vec2 vTextureCoord;\nvarying vec2 vBlurTexCoords[6];\nvarying vec4 vColor;\n\nuniform vec3 color;\nuniform float alpha;\n\nuniform sampler2D uSampler;\n\nvoid main(void)\n{\n    vec4 sum = vec4(0.0);\n\n    sum += texture2D(uSampler, vBlurTexCoords[ 0])*0.004431848411938341;\n    sum += texture2D(uSampler, vBlurTexCoords[ 1])*0.05399096651318985;\n    sum += texture2D(uSampler, vBlurTexCoords[ 2])*0.2419707245191454;\n    sum += texture2D(uSampler, vTextureCoord     )*0.3989422804014327;\n    sum += texture2D(uSampler, vBlurTexCoords[ 3])*0.2419707245191454;\n    sum += texture2D(uSampler, vBlurTexCoords[ 4])*0.05399096651318985;\n    sum += texture2D(uSampler, vBlurTexCoords[ 5])*0.004431848411938341;\n\n    gl_FragColor = vec4( color.rgb * sum.a * alpha, sum.a * alpha );\n}\n",{blur:{type:"1f",value:1/512},color:{type:"c",value:[0,0,0]},alpha:{type:"1f",value:.7},offset:{type:"2f",value:[5,5]},strength:{type:"1f",value:1}}),this.passes=1,this.strength=4}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r,i){var n=this.getShader(t);if(this.uniforms.strength.value=this.strength/4/this.passes*(e.frame.height/e.size.height),1===this.passes)t.filterManager.applyFilter(n,e,r,i);else{for(var o=t.filterManager.getRenderTarget(!0),s=e,a=o,h=0;h<this.passes-1;h++){t.filterManager.applyFilter(n,s,a,i);var l=a;a=s,s=l}t.filterManager.applyFilter(n,s,r,i),t.filterManager.returnRenderTarget(o)}},Object.defineProperties(i.prototype,{blur:{get:function(){return this.strength},set:function(t){this.padding=.5*t,this.strength=t}}})},{"../../core":29}],100:[function(t,e,r){function i(){n.AbstractFilter.call(this),this.blurXFilter=new o,this.blurYTintFilter=new s,this.defaultFilter=new n.AbstractFilter,this.padding=30,this._dirtyPosition=!0,this._angle=45*Math.PI/180,this._distance=10,this.alpha=.75,this.hideObject=!1,this.blendMode=n.BLEND_MODES.MULTIPLY}var n=t("../../core"),o=t("../blur/BlurXFilter"),s=t("./BlurYTintFilter");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r){var i=t.filterManager.getRenderTarget(!0);this._dirtyPosition&&(this._dirtyPosition=!1,this.blurYTintFilter.uniforms.offset.value[0]=Math.sin(this._angle)*this._distance,this.blurYTintFilter.uniforms.offset.value[1]=Math.cos(this._angle)*this._distance),this.blurXFilter.applyFilter(t,e,i),t.blendModeManager.setBlendMode(this.blendMode),this.blurYTintFilter.applyFilter(t,i,r),t.blendModeManager.setBlendMode(n.BLEND_MODES.NORMAL),this.hideObject||this.defaultFilter.applyFilter(t,e,r),t.filterManager.returnRenderTarget(i)},Object.defineProperties(i.prototype,{blur:{get:function(){return this.blurXFilter.blur},set:function(t){this.blurXFilter.blur=this.blurYTintFilter.blur=t}},blurX:{get:function(){return this.blurXFilter.blur},set:function(t){this.blurXFilter.blur=t}},blurY:{get:function(){return this.blurYTintFilter.blur},set:function(t){this.blurYTintFilter.blur=t}},color:{get:function(){return n.utils.rgb2hex(this.blurYTintFilter.uniforms.color.value)},set:function(t){this.blurYTintFilter.uniforms.color.value=n.utils.hex2rgb(t)}},alpha:{get:function(){return this.blurYTintFilter.uniforms.alpha.value},set:function(t){this.blurYTintFilter.uniforms.alpha.value=t}},distance:{get:function(){return this._distance},set:function(t){this._dirtyPosition=!0,this._distance=t}},angle:{get:function(){return this._angle},set:function(t){this._dirtyPosition=!0,this._angle=t}}})},{"../../core":29,"../blur/BlurXFilter":90,"./BlurYTintFilter":99}],101:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nuniform sampler2D uSampler;\nuniform float gray;\n\nvoid main(void)\n{\n   gl_FragColor = texture2D(uSampler, vTextureCoord);\n   gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.2126*gl_FragColor.r + 0.7152*gl_FragColor.g + 0.0722*gl_FragColor.b), gray);\n}\n",{gray:{type:"1f",value:1}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{gray:{get:function(){return this.uniforms.gray.value},set:function(t){this.uniforms.gray.value=t}}})},{"../../core":29}],102:[function(t,e,r){e.exports={AsciiFilter:t("./ascii/AsciiFilter"),BloomFilter:t("./bloom/BloomFilter"),BlurFilter:t("./blur/BlurFilter"),BlurXFilter:t("./blur/BlurXFilter"),BlurYFilter:t("./blur/BlurYFilter"),BlurDirFilter:t("./blur/BlurDirFilter"),ColorMatrixFilter:t("./color/ColorMatrixFilter"),ColorStepFilter:t("./color/ColorStepFilter"),ConvolutionFilter:t("./convolution/ConvolutionFilter"),CrossHatchFilter:t("./crosshatch/CrossHatchFilter"),DisplacementFilter:t("./displacement/DisplacementFilter"),DotScreenFilter:t("./dot/DotScreenFilter"),GrayFilter:t("./gray/GrayFilter"),DropShadowFilter:t("./dropshadow/DropShadowFilter"),InvertFilter:t("./invert/InvertFilter"),NoiseFilter:t("./noise/NoiseFilter"),NormalMapFilter:t("./normal/NormalMapFilter"),PixelateFilter:t("./pixelate/PixelateFilter"),RGBSplitFilter:t("./rgb/RGBSplitFilter"),ShockwaveFilter:t("./shockwave/ShockwaveFilter"),SepiaFilter:t("./sepia/SepiaFilter"),SmartBlurFilter:t("./blur/SmartBlurFilter"),TiltShiftFilter:t("./tiltshift/TiltShiftFilter"),TiltShiftXFilter:t("./tiltshift/TiltShiftXFilter"),TiltShiftYFilter:t("./tiltshift/TiltShiftYFilter"),TwistFilter:t("./twist/TwistFilter")}},{"./ascii/AsciiFilter":86,"./bloom/BloomFilter":87,"./blur/BlurDirFilter":88,"./blur/BlurFilter":89,"./blur/BlurXFilter":90,"./blur/BlurYFilter":91,"./blur/SmartBlurFilter":92,"./color/ColorMatrixFilter":93,"./color/ColorStepFilter":94,"./convolution/ConvolutionFilter":95,"./crosshatch/CrossHatchFilter":96,"./displacement/DisplacementFilter":97,"./dot/DotScreenFilter":98,"./dropshadow/DropShadowFilter":100,"./gray/GrayFilter":101,"./invert/InvertFilter":103,"./noise/NoiseFilter":104,"./normal/NormalMapFilter":105,"./pixelate/PixelateFilter":106,"./rgb/RGBSplitFilter":107,"./sepia/SepiaFilter":108,"./shockwave/ShockwaveFilter":109,"./tiltshift/TiltShiftFilter":111,"./tiltshift/TiltShiftXFilter":112,"./tiltshift/TiltShiftYFilter":113,"./twist/TwistFilter":114}],103:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\n\nuniform float invert;\nuniform sampler2D uSampler;\n\nvoid main(void)\n{\n    gl_FragColor = texture2D(uSampler, vTextureCoord);\n\n    gl_FragColor.rgb = mix( (vec3(1)-gl_FragColor.rgb) * gl_FragColor.a, gl_FragColor.rgb, 1.0 - invert);\n}\n",{invert:{type:"1f",value:1}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{invert:{get:function(){return this.uniforms.invert.value},set:function(t){this.uniforms.invert.value=t}}})},{"../../core":29}],104:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nuniform float noise;\nuniform sampler2D uSampler;\n\nfloat rand(vec2 co)\n{\n    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);\n}\n\nvoid main()\n{\n    vec4 color = texture2D(uSampler, vTextureCoord);\n\n    float diff = (rand(vTextureCoord) - 0.5) * noise;\n\n    color.r += diff;\n    color.g += diff;\n    color.b += diff;\n\n    gl_FragColor = color;\n}\n",{noise:{type:"1f",value:.5}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{noise:{get:function(){return this.uniforms.noise.value},set:function(t){this.uniforms.noise.value=t}}})},{"../../core":29}],105:[function(t,e,r){function i(t){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\n\nuniform sampler2D displacementMap;\nuniform sampler2D uSampler;\n\nuniform vec4 dimensions;\n\nconst vec2 Resolution = vec2(1.0,1.0);      //resolution of screen\nuniform vec3 LightPos;    //light position, normalized\nconst vec4 LightColor = vec4(1.0, 1.0, 1.0, 1.0);      //light RGBA -- alpha is intensity\nconst vec4 AmbientColor = vec4(1.0, 1.0, 1.0, 0.5);    //ambient RGBA -- alpha is intensity\nconst vec3 Falloff = vec3(0.0, 1.0, 0.2);         //attenuation coefficients\n\nuniform vec3 LightDir; // = vec3(1.0, 0.0, 1.0);\n\nuniform vec2 mapDimensions; // = vec2(256.0, 256.0);\n\n\nvoid main(void)\n{\n    vec2 mapCords = vTextureCoord.xy;\n\n    vec4 color = texture2D(uSampler, vTextureCoord.st);\n    vec3 nColor = texture2D(displacementMap, vTextureCoord.st).rgb;\n\n\n    mapCords *= vec2(dimensions.x/512.0, dimensions.y/512.0);\n\n    mapCords.y *= -1.0;\n    mapCords.y += 1.0;\n\n    // RGBA of our diffuse color\n    vec4 DiffuseColor = texture2D(uSampler, vTextureCoord);\n\n    // RGB of our normal map\n    vec3 NormalMap = texture2D(displacementMap, mapCords).rgb;\n\n    // The delta position of light\n    // vec3 LightDir = vec3(LightPos.xy - (gl_FragCoord.xy / Resolution.xy), LightPos.z);\n    vec3 LightDir = vec3(LightPos.xy - (mapCords.xy), LightPos.z);\n\n    // Correct for aspect ratio\n    // LightDir.x *= Resolution.x / Resolution.y;\n\n    // Determine distance (used for attenuation) BEFORE we normalize our LightDir\n    float D = length(LightDir);\n\n    // normalize our vectors\n    vec3 N = normalize(NormalMap * 2.0 - 1.0);\n    vec3 L = normalize(LightDir);\n\n    // Pre-multiply light color with intensity\n    // Then perform 'N dot L' to determine our diffuse term\n    vec3 Diffuse = (LightColor.rgb * LightColor.a) * max(dot(N, L), 0.0);\n\n    // pre-multiply ambient color with intensity\n    vec3 Ambient = AmbientColor.rgb * AmbientColor.a;\n\n    // calculate attenuation\n    float Attenuation = 1.0 / ( Falloff.x + (Falloff.y*D) + (Falloff.z*D*D) );\n\n    // the calculation which brings it all together\n    vec3 Intensity = Ambient + Diffuse * Attenuation;\n    vec3 FinalColor = DiffuseColor.rgb * Intensity;\n    gl_FragColor = vColor * vec4(FinalColor, DiffuseColor.a);\n\n    // gl_FragColor = vec4(1.0, 0.0, 0.0, Attenuation); // vColor * vec4(FinalColor, DiffuseColor.a);\n\n/*\n    // normalise color\n    vec3 normal = normalize(nColor * 2.0 - 1.0);\n\n    vec3 deltaPos = vec3( (light.xy - gl_FragCoord.xy) / resolution.xy, light.z );\n\n    float lambert = clamp(dot(normal, lightDir), 0.0, 1.0);\n\n    float d = sqrt(dot(deltaPos, deltaPos));\n    float att = 1.0 / ( attenuation.x + (attenuation.y*d) + (attenuation.z*d*d) );\n\n    vec3 result = (ambientColor * ambientIntensity) + (lightColor.rgb * lambert) * att;\n    result *= color.rgb;\n\n    gl_FragColor = vec4(result, 1.0);\n*/\n}\n",{displacementMap:{type:"sampler2D",value:t},scale:{type:"2f",value:{x:15,y:15}},offset:{type:"2f",value:{x:0,y:0}},mapDimensions:{type:"2f",value:{x:1,y:1}},dimensions:{type:"4f",value:[0,0,0,0]},LightPos:{type:"3f",value:[0,1,0]}}),t.baseTexture._powerOf2=!0,t.baseTexture.hasLoaded?this.onTextureLoaded():t.baseTexture.once("loaded",this.onTextureLoaded,this)}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.onTextureLoaded=function(){this.uniforms.mapDimensions.value.x=this.uniforms.displacementMap.value.width,this.uniforms.mapDimensions.value.y=this.uniforms.displacementMap.value.height},Object.defineProperties(i.prototype,{map:{get:function(){return this.uniforms.displacementMap.value},set:function(t){this.uniforms.displacementMap.value=t}},scale:{get:function(){return this.uniforms.scale.value},set:function(t){this.uniforms.scale.value=t}},offset:{get:function(){return this.uniforms.offset.value},set:function(t){this.uniforms.offset.value=t}}})},{"../../core":29}],106:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\n\nuniform vec4 dimensions;\nuniform vec2 pixelSize;\nuniform sampler2D uSampler;\n\nvoid main(void)\n{\n    vec2 coord = vTextureCoord;\n\n    vec2 size = dimensions.xy / pixelSize;\n\n    vec2 color = floor( ( vTextureCoord * size ) ) / size + pixelSize/dimensions.xy * 0.5;\n\n    gl_FragColor = texture2D(uSampler, color);\n}\n",{dimensions:{type:"4fv",value:new Float32Array([0,0,0,0])},pixelSize:{type:"v2",value:{x:10,y:10}}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{size:{get:function(){return this.uniforms.pixelSize.value},set:function(t){this.uniforms.pixelSize.value=t}}})},{"../../core":29}],107:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\nuniform vec4 dimensions;\nuniform vec2 red;\nuniform vec2 green;\nuniform vec2 blue;\n\nvoid main(void)\n{\n   gl_FragColor.r = texture2D(uSampler, vTextureCoord + red/dimensions.xy).r;\n   gl_FragColor.g = texture2D(uSampler, vTextureCoord + green/dimensions.xy).g;\n   gl_FragColor.b = texture2D(uSampler, vTextureCoord + blue/dimensions.xy).b;\n   gl_FragColor.a = texture2D(uSampler, vTextureCoord).a;\n}\n",{red:{type:"v2",value:{x:20,y:20}},green:{type:"v2",value:{x:-20,y:20}},blue:{type:"v2",value:{x:20,y:-20}},dimensions:{type:"4fv",value:[0,0,0,0]}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{red:{get:function(){return this.uniforms.red.value},set:function(t){this.uniforms.red.value=t}},green:{get:function(){return this.uniforms.green.value},set:function(t){this.uniforms.green.value=t}},blue:{get:function(){return this.uniforms.blue.value},set:function(t){this.uniforms.blue.value=t}}})},{"../../core":29}],108:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\nuniform float sepia;\n\nconst mat3 sepiaMatrix = mat3(0.3588, 0.7044, 0.1368, 0.2990, 0.5870, 0.1140, 0.2392, 0.4696, 0.0912);\n\nvoid main(void)\n{\n   gl_FragColor = texture2D(uSampler, vTextureCoord);\n   gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * sepiaMatrix, sepia);\n}\n",{sepia:{type:"1f",value:1}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{sepia:{get:function(){return this.uniforms.sepia.value},set:function(t){this.uniforms.sepia.value=t}}})},{"../../core":29}],109:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision lowp float;\n\nvarying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\n\nuniform vec2 center;\nuniform vec3 params; // 10.0, 0.8, 0.1\nuniform float time;\n\nvoid main()\n{\n    vec2 uv = vTextureCoord;\n    vec2 texCoord = uv;\n\n    float dist = distance(uv, center);\n\n    if ( (dist <= (time + params.z)) && (dist >= (time - params.z)) )\n    {\n        float diff = (dist - time);\n        float powDiff = 1.0 - pow(abs(diff*params.x), params.y);\n\n        float diffTime = diff  * powDiff;\n        vec2 diffUV = normalize(uv - center);\n        texCoord = uv + (diffUV * diffTime);\n    }\n\n    gl_FragColor = texture2D(uSampler, texCoord);\n}\n",{center:{type:"v2",value:{x:.5,y:.5}},params:{type:"v3",value:{x:10,y:.8,z:.1}},time:{type:"1f",value:0}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{center:{get:function(){return this.uniforms.center.value},set:function(t){this.uniforms.center.value=t}},params:{get:function(){return this.uniforms.params.value},set:function(t){this.uniforms.params.value=t}},time:{get:function(){return this.uniforms.time.value},set:function(t){this.uniforms.time.value=t}}})},{"../../core":29}],110:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\nuniform float blur;\nuniform float gradientBlur;\nuniform vec2 start;\nuniform vec2 end;\nuniform vec2 delta;\nuniform vec2 texSize;\n\nfloat random(vec3 scale, float seed)\n{\n    return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);\n}\n\nvoid main(void)\n{\n    vec4 color = vec4(0.0);\n    float total = 0.0;\n\n    float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);\n    vec2 normal = normalize(vec2(start.y - end.y, end.x - start.x));\n    float radius = smoothstep(0.0, 1.0, abs(dot(vTextureCoord * texSize - start, normal)) / gradientBlur) * blur;\n\n    for (float t = -30.0; t <= 30.0; t++)\n    {\n        float percent = (t + offset - 0.5) / 30.0;\n        float weight = 1.0 - abs(percent);\n        vec4 sample = texture2D(uSampler, vTextureCoord + delta / texSize * percent * radius);\n        sample.rgb *= sample.a;\n        color += sample * weight;\n        total += weight;\n    }\n\n    gl_FragColor = color / total;\n    gl_FragColor.rgb /= gl_FragColor.a + 0.00001;\n}\n",{blur:{type:"1f",value:100},gradientBlur:{type:"1f",value:600},start:{type:"v2",value:{x:0,y:window.innerHeight/2}},end:{type:"v2",value:{x:600,y:window.innerHeight/2}},delta:{type:"v2",value:{x:30,y:30}},texSize:{type:"v2",value:{x:window.innerWidth,y:window.innerHeight}}}),this.updateDelta()}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.updateDelta=function(){this.uniforms.delta.value.x=0,this.uniforms.delta.value.y=0},Object.defineProperties(i.prototype,{blur:{get:function(){return this.uniforms.blur.value},set:function(t){this.uniforms.blur.value=t}},gradientBlur:{get:function(){return this.uniforms.gradientBlur.value},set:function(t){this.uniforms.gradientBlur.value=t}},start:{get:function(){return this.uniforms.start.value},set:function(t){this.uniforms.start.value=t,this.updateDelta()}},end:{get:function(){return this.uniforms.end.value},set:function(t){this.uniforms.end.value=t,this.updateDelta()}}})},{"../../core":29}],111:[function(t,e,r){function i(){n.AbstractFilter.call(this),this.tiltShiftXFilter=new o,this.tiltShiftYFilter=new s}var n=t("../../core"),o=t("./TiltShiftXFilter"),s=t("./TiltShiftYFilter");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.applyFilter=function(t,e,r){var i=t.filterManager.getRenderTarget(!0);this.tiltShiftXFilter.applyFilter(t,e,i),this.tiltShiftYFilter.applyFilter(t,i,r),t.filterManager.returnRenderTarget(i)},Object.defineProperties(i.prototype,{blur:{get:function(){return this.tiltShiftXFilter.blur},set:function(t){this.tiltShiftXFilter.blur=this.tiltShiftYFilter.blur=t}},gradientBlur:{get:function(){return this.tiltShiftXFilter.gradientBlur},set:function(t){this.tiltShiftXFilter.gradientBlur=this.tiltShiftYFilter.gradientBlur=t}},start:{get:function(){return this.tiltShiftXFilter.start},set:function(t){this.tiltShiftXFilter.start=this.tiltShiftYFilter.start=t}},end:{get:function(){return this.tiltShiftXFilter.end},set:function(t){this.tiltShiftXFilter.end=this.tiltShiftYFilter.end=t}}})},{"../../core":29,"./TiltShiftXFilter":112,"./TiltShiftYFilter":113}],112:[function(t,e,r){function i(){n.call(this)}var n=t("./TiltShiftAxisFilter");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.updateDelta=function(){var t=this.uniforms.end.value.x-this.uniforms.start.value.x,e=this.uniforms.end.value.y-this.uniforms.start.value.y,r=Math.sqrt(t*t+e*e);this.uniforms.delta.value.x=t/r,this.uniforms.delta.value.y=e/r}},{"./TiltShiftAxisFilter":110}],113:[function(t,e,r){function i(){n.call(this)}var n=t("./TiltShiftAxisFilter");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.updateDelta=function(){var t=this.uniforms.end.value.x-this.uniforms.start.value.x,e=this.uniforms.end.value.y-this.uniforms.start.value.y,r=Math.sqrt(t*t+e*e);this.uniforms.delta.value.x=-e/r,this.uniforms.delta.value.y=t/r}},{"./TiltShiftAxisFilter":110}],114:[function(t,e,r){function i(){n.AbstractFilter.call(this,null,"precision mediump float;\n\nvarying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\nuniform float radius;\nuniform float angle;\nuniform vec2 offset;\n\nvoid main(void)\n{\n   vec2 coord = vTextureCoord - offset;\n   float dist = length(coord);\n\n   if (dist < radius)\n   {\n       float ratio = (radius - dist) / radius;\n       float angleMod = ratio * ratio * angle;\n       float s = sin(angleMod);\n       float c = cos(angleMod);\n       coord = vec2(coord.x * c - coord.y * s, coord.x * s + coord.y * c);\n   }\n\n   gl_FragColor = texture2D(uSampler, coord+offset);\n}\n",{radius:{type:"1f",value:.5},angle:{type:"1f",value:5},offset:{type:"v2",value:{x:.5,y:.5}}})}var n=t("../../core");i.prototype=Object.create(n.AbstractFilter.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{offset:{get:function(){return this.uniforms.offset.value},set:function(t){this.uniforms.offset.value=t}},radius:{get:function(){return this.uniforms.radius.value},set:function(t){this.uniforms.radius.value=t}},angle:{get:function(){return this.uniforms.angle.value},set:function(t){this.uniforms.angle.value=t}}})},{"../../core":29}],115:[function(t,e,r){function i(){this.global=new n.Point,this.target=null,this.originalEvent=null}var n=t("../core");i.prototype.constructor=i,e.exports=i,i.prototype.getLocalPosition=function(t,e,r){var i=t.worldTransform,o=r?r:this.global,s=i.a,a=i.c,h=i.tx,l=i.b,u=i.d,c=i.ty,p=1/(s*u+a*-l);return e=e||new n.Point,e.x=u*p*o.x+-a*p*o.x+(c*a-h*u)*p,e.y=s*p*o.y+-l*p*o.y+(-c*s+h*l)*p,e}},{"../core":29}],116:[function(t,e,r){function i(t,e){e=e||{},this.renderer=t,this.autoPreventDefault=void 0!==e.autoPreventDefault?e.autoPreventDefault:!0,this.interactionFrequency=e.interactionFrequency||10,this.mouse=new o,this.eventData={stopped:!1,target:null,type:null,data:this.mouse,stopPropagation:function(){this.stopped=!0}},this.interactiveDataPool=[],this.interactionDOMElement=null,this.eventsAdded=!1,this.onMouseUp=this.onMouseUp.bind(this),this.processMouseUp=this.processMouseUp.bind(this),this.onMouseDown=this.onMouseDown.bind(this),this.processMouseDown=this.processMouseDown.bind(this),this.onMouseMove=this.onMouseMove.bind(this),this.processMouseMove=this.processMouseMove.bind(this),this.onMouseOut=this.onMouseOut.bind(this),this.processMouseOverOut=this.processMouseOverOut.bind(this),this.onTouchStart=this.onTouchStart.bind(this),this.processTouchStart=this.processTouchStart.bind(this),this.onTouchEnd=this.onTouchEnd.bind(this),this.processTouchEnd=this.processTouchEnd.bind(this),this.onTouchMove=this.onTouchMove.bind(this),this.processTouchMove=this.processTouchMove.bind(this),this.last=0,this.currentCursorStyle="inherit",this._tempPoint=new n.Point,this.resolution=1,this.setTargetElement(this.renderer.view,this.renderer.resolution)}var n=t("../core"),o=t("./InteractionData");Object.assign(n.DisplayObject.prototype,t("./interactiveTarget")),i.prototype.constructor=i,e.exports=i,i.prototype.setTargetElement=function(t,e){this.removeEvents(),this.interactionDOMElement=t,this.resolution=e||1,this.addEvents()},i.prototype.addEvents=function(){this.interactionDOMElement&&(n.ticker.shared.add(this.update,this),window.navigator.msPointerEnabled&&(this.interactionDOMElement.style["-ms-content-zooming"]="none",this.interactionDOMElement.style["-ms-touch-action"]="none"),window.document.addEventListener("mousemove",this.onMouseMove,!0),this.interactionDOMElement.addEventListener("mousedown",this.onMouseDown,!0),this.interactionDOMElement.addEventListener("mouseout",this.onMouseOut,!0),this.interactionDOMElement.addEventListener("touchstart",this.onTouchStart,!0),this.interactionDOMElement.addEventListener("touchend",this.onTouchEnd,!0),this.interactionDOMElement.addEventListener("touchmove",this.onTouchMove,!0),window.addEventListener("mouseup",this.onMouseUp,!0),this.eventsAdded=!0)},i.prototype.removeEvents=function(){this.interactionDOMElement&&(n.ticker.shared.remove(this.update),window.navigator.msPointerEnabled&&(this.interactionDOMElement.style["-ms-content-zooming"]="",this.interactionDOMElement.style["-ms-touch-action"]=""),window.document.removeEventListener("mousemove",this.onMouseMove,!0),this.interactionDOMElement.removeEventListener("mousedown",this.onMouseDown,!0),this.interactionDOMElement.removeEventListener("mouseout",this.onMouseOut,!0),this.interactionDOMElement.removeEventListener("touchstart",this.onTouchStart,!0),this.interactionDOMElement.removeEventListener("touchend",this.onTouchEnd,!0),this.interactionDOMElement.removeEventListener("touchmove",this.onTouchMove,!0),
this.interactionDOMElement=null,window.removeEventListener("mouseup",this.onMouseUp,!0),this.eventsAdded=!1)},i.prototype.update=function(t){if(this._deltaTime+=t,!(this._deltaTime<this.interactionFrequency)&&(this._deltaTime=0,this.interactionDOMElement)){if(this.didMove)return void(this.didMove=!1);this.cursor="inherit",this.processInteractive(this.mouse.global,this.renderer._lastObjectRendered,this.processMouseOverOut,!0),this.currentCursorStyle!==this.cursor&&(this.currentCursorStyle=this.cursor,this.interactionDOMElement.style.cursor=this.cursor)}},i.prototype.dispatchEvent=function(t,e,r){r.stopped||(r.target=t,r.type=e,t.emit(e,r),t[e]&&t[e](r))},i.prototype.mapPositionToPoint=function(t,e,r){var i=this.interactionDOMElement.getBoundingClientRect();t.x=(e-i.left)*(this.interactionDOMElement.width/i.width)/this.resolution,t.y=(r-i.top)*(this.interactionDOMElement.height/i.height)/this.resolution},i.prototype.processInteractive=function(t,e,r,i,n){if(!e.visible)return!1;var o=e.children,s=!1;if(n=n||e.interactive,e.interactiveChildren)for(var a=o.length-1;a>=0;a--)!s&&i?s=this.processInteractive(t,o[a],r,!0,n):this.processInteractive(t,o[a],r,!1,!1);return n&&(i&&(e.hitArea?(e.worldTransform.applyInverse(t,this._tempPoint),s=e.hitArea.contains(this._tempPoint.x,this._tempPoint.y)):e.containsPoint&&(s=e.containsPoint(t))),e.interactive&&r(e,s)),s},i.prototype.onMouseDown=function(t){this.mouse.originalEvent=t,this.eventData.data=this.mouse,this.eventData.stopped=!1,this.mapPositionToPoint(this.mouse.global,t.clientX,t.clientY),this.autoPreventDefault&&this.mouse.originalEvent.preventDefault(),this.processInteractive(this.mouse.global,this.renderer._lastObjectRendered,this.processMouseDown,!0)},i.prototype.processMouseDown=function(t,e){var r=this.mouse.originalEvent,i=2===r.button||3===r.which;e&&(t[i?"_isRightDown":"_isLeftDown"]=!0,this.dispatchEvent(t,i?"rightdown":"mousedown",this.eventData))},i.prototype.onMouseUp=function(t){this.mouse.originalEvent=t,this.eventData.data=this.mouse,this.eventData.stopped=!1,this.mapPositionToPoint(this.mouse.global,t.clientX,t.clientY),this.processInteractive(this.mouse.global,this.renderer._lastObjectRendered,this.processMouseUp,!0)},i.prototype.processMouseUp=function(t,e){var r=this.mouse.originalEvent,i=2===r.button||3===r.which,n=i?"_isRightDown":"_isLeftDown";e?(this.dispatchEvent(t,i?"rightup":"mouseup",this.eventData),t[n]&&(t[n]=!1,this.dispatchEvent(t,i?"rightclick":"click",this.eventData))):t[n]&&(t[n]=!1,this.dispatchEvent(t,i?"rightupoutside":"mouseupoutside",this.eventData))},i.prototype.onMouseMove=function(t){this.mouse.originalEvent=t,this.eventData.data=this.mouse,this.eventData.stopped=!1,this.mapPositionToPoint(this.mouse.global,t.clientX,t.clientY),this.didMove=!0,this.cursor="inherit",this.processInteractive(this.mouse.global,this.renderer._lastObjectRendered,this.processMouseMove,!0),this.currentCursorStyle!==this.cursor&&(this.currentCursorStyle=this.cursor,this.interactionDOMElement.style.cursor=this.cursor)},i.prototype.processMouseMove=function(t,e){this.dispatchEvent(t,"mousemove",this.eventData),this.processMouseOverOut(t,e)},i.prototype.onMouseOut=function(t){this.mouse.originalEvent=t,this.eventData.stopped=!1,this.mapPositionToPoint(this.mouse.global,t.clientX,t.clientY),this.interactionDOMElement.style.cursor="inherit",this.mapPositionToPoint(this.mouse.global,t.clientX,t.clientY),this.processInteractive(this.mouse.global,this.renderer._lastObjectRendered,this.processMouseOverOut,!1)},i.prototype.processMouseOverOut=function(t,e){e?(t._over||(t._over=!0,this.dispatchEvent(t,"mouseover",this.eventData)),t.buttonMode&&(this.cursor=t.defaultCursor)):t._over&&(t._over=!1,this.dispatchEvent(t,"mouseout",this.eventData))},i.prototype.onTouchStart=function(t){this.autoPreventDefault&&t.preventDefault();for(var e=t.changedTouches,r=e.length,i=0;r>i;i++){var n=e[i],o=this.getTouchData(n);o.originalEvent=t,this.eventData.data=o,this.eventData.stopped=!1,this.processInteractive(o.global,this.renderer._lastObjectRendered,this.processTouchStart,!0),this.returnTouchData(o)}},i.prototype.processTouchStart=function(t,e){e&&(t._touchDown=!0,this.dispatchEvent(t,"touchstart",this.eventData))},i.prototype.onTouchEnd=function(t){this.autoPreventDefault&&t.preventDefault();for(var e=t.changedTouches,r=e.length,i=0;r>i;i++){var n=e[i],o=this.getTouchData(n);o.originalEvent=t,this.eventData.data=o,this.eventData.stopped=!1,this.processInteractive(o.global,this.renderer._lastObjectRendered,this.processTouchEnd,!0),this.returnTouchData(o)}},i.prototype.processTouchEnd=function(t,e){e?(this.dispatchEvent(t,"touchend",this.eventData),t._touchDown&&(t._touchDown=!1,this.dispatchEvent(t,"tap",this.eventData))):t._touchDown&&(t._touchDown=!1,this.dispatchEvent(t,"touchendoutside",this.eventData))},i.prototype.onTouchMove=function(t){this.autoPreventDefault&&t.preventDefault();for(var e=t.changedTouches,r=e.length,i=0;r>i;i++){var n=e[i],o=this.getTouchData(n);o.originalEvent=t,this.eventData.data=o,this.eventData.stopped=!1,this.processInteractive(o.global,this.renderer._lastObjectRendered,this.processTouchMove,!1),this.returnTouchData(o)}},i.prototype.processTouchMove=function(t,e){e=e,this.dispatchEvent(t,"touchmove",this.eventData)},i.prototype.getTouchData=function(t){var e=this.interactiveDataPool.pop();return e||(e=new o),e.identifier=t.identifier,this.mapPositionToPoint(e.global,t.clientX,t.clientY),navigator.isCocoonJS&&(e.global.x=e.global.x/this.resolution,e.global.y=e.global.y/this.resolution),t.globalX=e.global.x,t.globalY=e.global.y,e},i.prototype.returnTouchData=function(t){this.interactiveDataPool.push(t)},i.prototype.destroy=function(){this.removeEvents(),this.renderer=null,this.mouse=null,this.eventData=null,this.interactiveDataPool=null,this.interactionDOMElement=null,this.onMouseUp=null,this.processMouseUp=null,this.onMouseDown=null,this.processMouseDown=null,this.onMouseMove=null,this.processMouseMove=null,this.onMouseOut=null,this.processMouseOverOut=null,this.onTouchStart=null,this.processTouchStart=null,this.onTouchEnd=null,this.processTouchEnd=null,this.onTouchMove=null,this.processTouchMove=null,this._tempPoint=null},n.WebGLRenderer.registerPlugin("interaction",i),n.CanvasRenderer.registerPlugin("interaction",i)},{"../core":29,"./InteractionData":115,"./interactiveTarget":118}],117:[function(t,e,r){e.exports={InteractionData:t("./InteractionData"),InteractionManager:t("./InteractionManager"),interactiveTarget:t("./interactiveTarget")}},{"./InteractionData":115,"./InteractionManager":116,"./interactiveTarget":118}],118:[function(t,e,r){var i={interactive:!1,buttonMode:!1,interactiveChildren:!0,defaultCursor:"pointer",_over:!1,_touchDown:!1};e.exports=i},{}],119:[function(t,e,r){function i(t,e){var r={},i=t.data.getElementsByTagName("info")[0],n=t.data.getElementsByTagName("common")[0];r.font=i.getAttribute("face"),r.size=parseInt(i.getAttribute("size"),10),r.lineHeight=parseInt(n.getAttribute("lineHeight"),10),r.chars={};for(var a=t.data.getElementsByTagName("char"),h=0;h<a.length;h++){var l=parseInt(a[h].getAttribute("id"),10),u=new o.Rectangle(parseInt(a[h].getAttribute("x"),10)+e.frame.x,parseInt(a[h].getAttribute("y"),10)+e.frame.y,parseInt(a[h].getAttribute("width"),10),parseInt(a[h].getAttribute("height"),10));r.chars[l]={xOffset:parseInt(a[h].getAttribute("xoffset"),10),yOffset:parseInt(a[h].getAttribute("yoffset"),10),xAdvance:parseInt(a[h].getAttribute("xadvance"),10),kerning:{},texture:new o.Texture(e.baseTexture,u)}}var c=t.data.getElementsByTagName("kerning");for(h=0;h<c.length;h++){var p=parseInt(c[h].getAttribute("first"),10),d=parseInt(c[h].getAttribute("second"),10),f=parseInt(c[h].getAttribute("amount"),10);r.chars[d].kerning[p]=f}t.bitmapFont=r,s.BitmapText.fonts[r.font]=r}var n=t("resource-loader").Resource,o=t("../core"),s=t("../extras"),a=t("path");e.exports=function(){return function(t,e){if(!t.data||!t.isXml)return e();if(0===t.data.getElementsByTagName("page").length||0===t.data.getElementsByTagName("info").length||null===t.data.getElementsByTagName("info")[0].getAttribute("face"))return e();var r=a.dirname(t.url);"."===r&&(r=""),this.baseUrl&&r&&("/"===this.baseUrl.charAt(this.baseUrl.length-1)&&(r+="/"),r=r.replace(this.baseUrl,"")),r&&"/"!==r.charAt(r.length-1)&&(r+="/");var s=r+t.data.getElementsByTagName("page")[0].getAttribute("file");if(o.utils.TextureCache[s])i(t,o.utils.TextureCache[s]),e();else{var h={crossOrigin:t.crossOrigin,loadType:n.LOAD_TYPE.IMAGE};this.add(t.name+"_image",s,h,function(r){i(t,r.texture),e()})}}}},{"../core":29,"../extras":85,path:3,"resource-loader":18}],120:[function(t,e,r){e.exports={Loader:t("./loader"),bitmapFontParser:t("./bitmapFontParser"),spritesheetParser:t("./spritesheetParser"),textureParser:t("./textureParser"),Resource:t("resource-loader").Resource}},{"./bitmapFontParser":119,"./loader":121,"./spritesheetParser":122,"./textureParser":123,"resource-loader":18}],121:[function(t,e,r){function i(t,e){n.call(this,t,e);for(var r=0;r<i._pixiMiddleware.length;++r)this.use(i._pixiMiddleware[r]())}var n=t("resource-loader"),o=t("./textureParser"),s=t("./spritesheetParser"),a=t("./bitmapFontParser");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i._pixiMiddleware=[n.middleware.parsing.blob,o,s,a],i.addPixiMiddleware=function(t){i._pixiMiddleware.push(t)};var h=n.Resource;h.setExtensionXhrType("fnt",h.XHR_RESPONSE_TYPE.DOCUMENT)},{"./bitmapFontParser":119,"./spritesheetParser":122,"./textureParser":123,"resource-loader":18}],122:[function(t,e,r){var i=t("resource-loader").Resource,n=t("path"),o=t("../core");e.exports=function(){return function(t,e){if(!t.data||!t.isJson||!t.data.frames)return e();var r={crossOrigin:t.crossOrigin,loadType:i.LOAD_TYPE.IMAGE},s=n.dirname(t.url.replace(this.baseUrl,"")),a=o.utils.getResolutionOfUrl(t.url);this.add(t.name+"_image",s+"/"+t.data.meta.image,r,function(r){t.textures={};var i=t.data.frames;for(var n in i){var s=i[n].frame;if(s){var h=null,l=null;if(h=i[n].rotated?new o.Rectangle(s.x,s.y,s.h,s.w):new o.Rectangle(s.x,s.y,s.w,s.h),i[n].trimmed&&(l=new o.Rectangle(i[n].spriteSourceSize.x/a,i[n].spriteSourceSize.y/a,i[n].sourceSize.w/a,i[n].sourceSize.h/a)),i[n].rotated){var u=h.width;h.width=h.height,h.height=u}h.x/=a,h.y/=a,h.width/=a,h.height/=a,t.textures[n]=new o.Texture(r.texture.baseTexture,h,h.clone(),l,i[n].rotated),o.utils.TextureCache[n]=t.textures[n]}}e()})}}},{"../core":29,path:3,"resource-loader":18}],123:[function(t,e,r){var i=t("../core");e.exports=function(){return function(t,e){t.data&&t.isImage&&(t.texture=new i.Texture(new i.BaseTexture(t.data,null,i.utils.getResolutionOfUrl(t.url))),i.utils.TextureCache[t.url]=t.texture),e()}}},{"../core":29}],124:[function(t,e,r){function i(t,e,r,o,s){n.Container.call(this),this._texture=null,this.uvs=r||new Float32Array([0,1,1,1,1,0,0,1]),this.vertices=e||new Float32Array([0,0,100,0,100,100,0,100]),this.indices=o||new Uint16Array([0,1,2,3]),this.dirty=!0,this.blendMode=n.BLEND_MODES.NORMAL,this.canvasPadding=0,this.drawMode=s||i.DRAW_MODES.TRIANGLE_MESH,this.texture=t}var n=t("../core"),o=new n.Point,s=new n.Polygon;i.prototype=Object.create(n.Container.prototype),i.prototype.constructor=i,e.exports=i,Object.defineProperties(i.prototype,{texture:{get:function(){return this._texture},set:function(t){this._texture!==t&&(this._texture=t,t&&(t.baseTexture.hasLoaded?this._onTextureUpdate():t.once("update",this._onTextureUpdate,this)))}}}),i.prototype._renderWebGL=function(t){t.setObjectRenderer(t.plugins.mesh),t.plugins.mesh.render(this)},i.prototype._renderCanvas=function(t){var e=t.context,r=this.worldTransform;t.roundPixels?e.setTransform(r.a,r.b,r.c,r.d,0|r.tx,0|r.ty):e.setTransform(r.a,r.b,r.c,r.d,r.tx,r.ty),this.drawMode===i.DRAW_MODES.TRIANGLE_MESH?this._renderCanvasTriangleMesh(e):this._renderCanvasTriangles(e)},i.prototype._renderCanvasTriangleMesh=function(t){for(var e=this.vertices,r=this.uvs,i=e.length/2,n=0;i-2>n;n++){var o=2*n;this._renderCanvasDrawTriangle(t,e,r,o,o+2,o+4)}},i.prototype._renderCanvasTriangles=function(t){for(var e=this.vertices,r=this.uvs,i=this.indices,n=i.length,o=0;n>o;o+=3){var s=2*i[o],a=2*i[o+1],h=2*i[o+2];this._renderCanvasDrawTriangle(t,e,r,s,a,h)}},i.prototype._renderCanvasDrawTriangle=function(t,e,r,i,n,o){var s=this._texture.baseTexture.source,a=this._texture.baseTexture.width,h=this._texture.baseTexture.height,l=e[i],u=e[n],c=e[o],p=e[i+1],d=e[n+1],f=e[o+1],v=r[i]*a,g=r[n]*a,m=r[o]*a,y=r[i+1]*h,x=r[n+1]*h,b=r[o+1]*h;if(this.canvasPadding>0){var _=this.canvasPadding/this.worldTransform.a,T=this.canvasPadding/this.worldTransform.d,E=(l+u+c)/3,S=(p+d+f)/3,A=l-E,w=p-S,C=Math.sqrt(A*A+w*w);l=E+A/C*(C+_),p=S+w/C*(C+T),A=u-E,w=d-S,C=Math.sqrt(A*A+w*w),u=E+A/C*(C+_),d=S+w/C*(C+T),A=c-E,w=f-S,C=Math.sqrt(A*A+w*w),c=E+A/C*(C+_),f=S+w/C*(C+T)}t.save(),t.beginPath(),t.moveTo(l,p),t.lineTo(u,d),t.lineTo(c,f),t.closePath(),t.clip();var M=v*x+y*m+g*b-x*m-y*g-v*b,R=l*x+y*c+u*b-x*c-y*u-l*b,D=v*u+l*m+g*c-u*m-l*g-v*c,F=v*x*c+y*u*m+l*g*b-l*x*m-y*g*c-v*u*b,P=p*x+y*f+d*b-x*f-y*d-p*b,O=v*d+p*m+g*f-d*m-p*g-v*f,B=v*x*f+y*d*m+p*g*b-p*x*m-y*g*f-v*d*b;t.transform(R/M,P/M,D/M,O/M,F/M,B/M),t.drawImage(s,0,0),t.restore()},i.prototype.renderMeshFlat=function(t){var e=this.context,r=t.vertices,i=r.length/2;e.beginPath();for(var n=1;i-2>n;n++){var o=2*n,s=r[o],a=r[o+2],h=r[o+4],l=r[o+1],u=r[o+3],c=r[o+5];e.moveTo(s,l),e.lineTo(a,u),e.lineTo(h,c)}e.fillStyle="#FF0000",e.fill(),e.closePath()},i.prototype._onTextureUpdate=function(){this.updateFrame=!0},i.prototype.getBounds=function(t){if(!this._currentBounds){for(var e=t||this.worldTransform,r=e.a,i=e.b,o=e.c,s=e.d,a=e.tx,h=e.ty,l=-(1/0),u=-(1/0),c=1/0,p=1/0,d=this.vertices,f=0,v=d.length;v>f;f+=2){var g=d[f],m=d[f+1],y=r*g+o*m+a,x=s*m+i*g+h;c=c>y?y:c,p=p>x?x:p,l=y>l?y:l,u=x>u?x:u}if(c===-(1/0)||u===1/0)return n.Rectangle.EMPTY;var b=this._bounds;b.x=c,b.width=l-c,b.y=p,b.height=u-p,this._currentBounds=b}return this._currentBounds},i.prototype.containsPoint=function(t){if(!this.getBounds().contains(t.x,t.y))return!1;this.worldTransform.applyInverse(t,o);var e,r,n=this.vertices,a=s.points;if(this.drawMode===i.DRAW_MODES.TRIANGLES){var h=this.indices;for(r=this.indices.length,e=0;r>e;e+=3){var l=2*h[e],u=2*h[e+1],c=2*h[e+2];if(a[0]=n[l],a[1]=n[l+1],a[2]=n[u],a[3]=n[u+1],a[4]=n[c],a[5]=n[c+1],s.contains(o.x,o.y))return!0}}else for(r=n.length,e=0;r>e;e+=6)if(a[0]=n[e],a[1]=n[e+1],a[2]=n[e+2],a[3]=n[e+3],a[4]=n[e+4],a[5]=n[e+5],s.contains(o.x,o.y))return!0;return!1},i.DRAW_MODES={TRIANGLE_MESH:0,TRIANGLES:1}},{"../core":29}],125:[function(t,e,r){function i(t,e){n.call(this,t),this.points=e,this.vertices=new Float32Array(4*e.length),this.uvs=new Float32Array(4*e.length),this.colors=new Float32Array(2*e.length),this.indices=new Uint16Array(2*e.length),this._ready=!0,this.refresh()}var n=t("./Mesh"),o=t("../core");i.prototype=Object.create(n.prototype),i.prototype.constructor=i,e.exports=i,i.prototype.refresh=function(){var t=this.points;if(!(t.length<1)&&this._texture._uvs){var e=this.uvs,r=this.indices,i=this.colors,n=this._texture._uvs,s=new o.Point(n.x0,n.y0),a=new o.Point(n.x2-n.x0,n.y2-n.y0);e[0]=0+s.x,e[1]=0+s.y,e[2]=0+s.x,e[3]=1*a.y+s.y,i[0]=1,i[1]=1,r[0]=0,r[1]=1;for(var h,l,u,c=t.length,p=1;c>p;p++)h=t[p],l=4*p,u=p/(c-1),e[l]=u*a.x+s.x,e[l+1]=0+s.y,e[l+2]=u*a.x+s.x,e[l+3]=1*a.y+s.y,l=2*p,i[l]=1,i[l+1]=1,l=2*p,r[l]=l,r[l+1]=l+1;this.dirty=!0}},i.prototype._onTextureUpdate=function(){n.prototype._onTextureUpdate.call(this),this._ready&&this.refresh()},i.prototype.updateTransform=function(){var t=this.points;if(!(t.length<1)){for(var e,r,i,n,o,s,a=t[0],h=0,l=0,u=this.vertices,c=t.length,p=0;c>p;p++)r=t[p],i=4*p,e=p<t.length-1?t[p+1]:r,l=-(e.x-a.x),h=e.y-a.y,n=10*(1-p/(c-1)),n>1&&(n=1),o=Math.sqrt(h*h+l*l),s=this._texture.height/2,h/=o,l/=o,h*=s,l*=s,u[i]=r.x+h,u[i+1]=r.y+l,u[i+2]=r.x-h,u[i+3]=r.y-l,a=r;this.containerUpdateTransform()}}},{"../core":29,"./Mesh":124}],126:[function(t,e,r){e.exports={Mesh:t("./Mesh"),Rope:t("./Rope"),MeshRenderer:t("./webgl/MeshRenderer"),MeshShader:t("./webgl/MeshShader")}},{"./Mesh":124,"./Rope":125,"./webgl/MeshRenderer":127,"./webgl/MeshShader":128}],127:[function(t,e,r){function i(t){n.ObjectRenderer.call(this,t),this.indices=new Uint16Array(15e3);for(var e=0,r=0;15e3>e;e+=6,r+=4)this.indices[e+0]=r+0,this.indices[e+1]=r+1,this.indices[e+2]=r+2,this.indices[e+3]=r+0,this.indices[e+4]=r+2,this.indices[e+5]=r+3}var n=t("../../core"),o=t("../Mesh");i.prototype=Object.create(n.ObjectRenderer.prototype),i.prototype.constructor=i,e.exports=i,n.WebGLRenderer.registerPlugin("mesh",i),i.prototype.onContextChange=function(){},i.prototype.render=function(t){t._vertexBuffer||this._initWebGL(t);var e=this.renderer,r=e.gl,i=t._texture.baseTexture,n=e.shaderManager.plugins.meshShader,s=t.drawMode===o.DRAW_MODES.TRIANGLE_MESH?r.TRIANGLE_STRIP:r.TRIANGLES;e.blendModeManager.setBlendMode(t.blendMode),r.uniformMatrix3fv(n.uniforms.translationMatrix._location,!1,t.worldTransform.toArray(!0)),r.uniformMatrix3fv(n.uniforms.projectionMatrix._location,!1,e.currentRenderTarget.projectionMatrix.toArray(!0)),r.uniform1f(n.uniforms.alpha._location,t.worldAlpha),t.dirty?(t.dirty=!1,r.bindBuffer(r.ARRAY_BUFFER,t._vertexBuffer),r.bufferData(r.ARRAY_BUFFER,t.vertices,r.STATIC_DRAW),r.vertexAttribPointer(n.attributes.aVertexPosition,2,r.FLOAT,!1,0,0),r.bindBuffer(r.ARRAY_BUFFER,t._uvBuffer),r.bufferData(r.ARRAY_BUFFER,t.uvs,r.STATIC_DRAW),r.vertexAttribPointer(n.attributes.aTextureCoord,2,r.FLOAT,!1,0,0),r.activeTexture(r.TEXTURE0),i._glTextures[r.id]?r.bindTexture(r.TEXTURE_2D,i._glTextures[r.id]):this.renderer.updateTexture(i),r.bindBuffer(r.ELEMENT_ARRAY_BUFFER,t._indexBuffer),r.bufferData(r.ELEMENT_ARRAY_BUFFER,t.indices,r.STATIC_DRAW)):(r.bindBuffer(r.ARRAY_BUFFER,t._vertexBuffer),r.bufferSubData(r.ARRAY_BUFFER,0,t.vertices),r.vertexAttribPointer(n.attributes.aVertexPosition,2,r.FLOAT,!1,0,0),r.bindBuffer(r.ARRAY_BUFFER,t._uvBuffer),r.vertexAttribPointer(n.attributes.aTextureCoord,2,r.FLOAT,!1,0,0),r.activeTexture(r.TEXTURE0),i._glTextures[r.id]?r.bindTexture(r.TEXTURE_2D,i._glTextures[r.id]):this.renderer.updateTexture(i),r.bindBuffer(r.ELEMENT_ARRAY_BUFFER,t._indexBuffer),r.bufferSubData(r.ELEMENT_ARRAY_BUFFER,0,t.indices)),r.drawElements(s,t.indices.length,r.UNSIGNED_SHORT,0)},i.prototype._initWebGL=function(t){var e=this.renderer.gl;t._vertexBuffer=e.createBuffer(),t._indexBuffer=e.createBuffer(),t._uvBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,t._vertexBuffer),e.bufferData(e.ARRAY_BUFFER,t.vertices,e.DYNAMIC_DRAW),e.bindBuffer(e.ARRAY_BUFFER,t._uvBuffer),e.bufferData(e.ARRAY_BUFFER,t.uvs,e.STATIC_DRAW),t.colors&&(t._colorBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,t._colorBuffer),e.bufferData(e.ARRAY_BUFFER,t.colors,e.STATIC_DRAW)),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t._indexBuffer),e.bufferData(e.ELEMENT_ARRAY_BUFFER,t.indices,e.STATIC_DRAW)},i.prototype.flush=function(){},i.prototype.start=function(){var t=this.renderer.shaderManager.plugins.meshShader;this.renderer.shaderManager.setShader(t)},i.prototype.destroy=function(){}},{"../../core":29,"../Mesh":124}],128:[function(t,e,r){function i(t){n.Shader.call(this,t,["precision lowp float;","attribute vec2 aVertexPosition;","attribute vec2 aTextureCoord;","uniform mat3 translationMatrix;","uniform mat3 projectionMatrix;","varying vec2 vTextureCoord;","void main(void){","   gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);","   vTextureCoord = aTextureCoord;","}"].join("\n"),["precision lowp float;","varying vec2 vTextureCoord;","uniform float alpha;","uniform sampler2D uSampler;","void main(void){","   gl_FragColor = texture2D(uSampler, vTextureCoord) * alpha ;","}"].join("\n"),{alpha:{type:"1f",value:0},translationMatrix:{type:"mat3",value:new Float32Array(9)},projectionMatrix:{type:"mat3",value:new Float32Array(9)}},{aVertexPosition:0,aTextureCoord:0})}var n=t("../../core");i.prototype=Object.create(n.Shader.prototype),i.prototype.constructor=i,e.exports=i,n.ShaderManager.registerPlugin("meshShader",i)},{"../../core":29}],129:[function(t,e,r){Object.assign||(Object.assign=t("object-assign"))},{"object-assign":12}],130:[function(t,e,r){t("./Object.assign"),t("./requestAnimationFrame")},{"./Object.assign":129,"./requestAnimationFrame":131}],131:[function(t,e,r){(function(t){if(Date.now&&Date.prototype.getTime||(Date.now=function(){return(new Date).getTime()}),!t.performance||!t.performance.now){var e=Date.now();t.performance||(t.performance={}),t.performance.now=function(){return Date.now()-e}}for(var r=Date.now(),i=["ms","moz","webkit","o"],n=0;n<i.length&&!t.requestAnimationFrame;++n)t.requestAnimationFrame=t[i[n]+"RequestAnimationFrame"],t.cancelAnimationFrame=t[i[n]+"CancelAnimationFrame"]||t[i[n]+"CancelRequestAnimationFrame"];t.requestAnimationFrame||(t.requestAnimationFrame=function(t){if("function"!=typeof t)throw new TypeError(t+"is not a function");var e=Date.now(),i=16+r-e;return 0>i&&(i=0),r=e,setTimeout(function(){r=Date.now(),t(performance.now())},i)}),t.cancelAnimationFrame||(t.cancelAnimationFrame=function(t){clearTimeout(t)})}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}]},{},[1])(1)});
var EZGUI;
(function (EZGUI) {
    EZGUI.Easing = {
        Linear: {
            None: function (k) {
                return k;
            }
        },
        Quadratic: {
            In: function (k) {
                return k * k;
            },
            Out: function (k) {
                return k * (2 - k);
            },
            InOut: function (k) {
                if ((k *= 2) < 1)
                    return 0.5 * k * k;
                return -0.5 * (--k * (k - 2) - 1);
            }
        },
        Cubic: {
            In: function (k) {
                return k * k * k;
            },
            Out: function (k) {
                return --k * k * k + 1;
            },
            InOut: function (k) {
                if ((k *= 2) < 1)
                    return 0.5 * k * k * k;
                return 0.5 * ((k -= 2) * k * k + 2);
            }
        },
        Quartic: {
            In: function (k) {
                return k * k * k * k;
            },
            Out: function (k) {
                return 1 - (--k * k * k * k);
            },
            InOut: function (k) {
                if ((k *= 2) < 1)
                    return 0.5 * k * k * k * k;
                return -0.5 * ((k -= 2) * k * k * k - 2);
            }
        },
        Quintic: {
            In: function (k) {
                return k * k * k * k * k;
            },
            Out: function (k) {
                return --k * k * k * k * k + 1;
            },
            InOut: function (k) {
                if ((k *= 2) < 1)
                    return 0.5 * k * k * k * k * k;
                return 0.5 * ((k -= 2) * k * k * k * k + 2);
            }
        },
        Sinusoidal: {
            In: function (k) {
                return 1 - Math.cos(k * Math.PI / 2);
            },
            Out: function (k) {
                return Math.sin(k * Math.PI / 2);
            },
            InOut: function (k) {
                return 0.5 * (1 - Math.cos(Math.PI * k));
            }
        },
        Exponential: {
            In: function (k) {
                return k === 0 ? 0 : Math.pow(1024, k - 1);
            },
            Out: function (k) {
                return k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
            },
            InOut: function (k) {
                if (k === 0)
                    return 0;
                if (k === 1)
                    return 1;
                if ((k *= 2) < 1)
                    return 0.5 * Math.pow(1024, k - 1);
                return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2);
            }
        },
        Circular: {
            In: function (k) {
                return 1 - Math.sqrt(1 - k * k);
            },
            Out: function (k) {
                return Math.sqrt(1 - (--k * k));
            },
            InOut: function (k) {
                if ((k *= 2) < 1)
                    return -0.5 * (Math.sqrt(1 - k * k) - 1);
                return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
            }
        },
        Elastic: {
            In: function (k) {
                var s, a = 0.1, p = 0.4;
                if (k === 0)
                    return 0;
                if (k === 1)
                    return 1;
                if (!a || a < 1) {
                    a = 1;
                    s = p / 4;
                }
                else
                    s = p * Math.asin(1 / a) / (2 * Math.PI);
                return -(a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
            },
            Out: function (k) {
                var s, a = 0.1, p = 0.4;
                if (k === 0)
                    return 0;
                if (k === 1)
                    return 1;
                if (!a || a < 1) {
                    a = 1;
                    s = p / 4;
                }
                else
                    s = p * Math.asin(1 / a) / (2 * Math.PI);
                return (a * Math.pow(2, -10 * k) * Math.sin((k - s) * (2 * Math.PI) / p) + 1);
            },
            InOut: function (k) {
                var s, a = 0.1, p = 0.4;
                if (k === 0)
                    return 0;
                if (k === 1)
                    return 1;
                if (!a || a < 1) {
                    a = 1;
                    s = p / 4;
                }
                else
                    s = p * Math.asin(1 / a) / (2 * Math.PI);
                if ((k *= 2) < 1)
                    return -0.5 * (a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
                return a * Math.pow(2, -10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;
            }
        },
        Back: {
            In: function (k) {
                var s = 1.70158;
                return k * k * ((s + 1) * k - s);
            },
            Out: function (k) {
                var s = 1.70158;
                return --k * k * ((s + 1) * k + s) + 1;
            },
            InOut: function (k) {
                var s = 1.70158 * 1.525;
                if ((k *= 2) < 1)
                    return 0.5 * (k * k * ((s + 1) * k - s));
                return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
            }
        },
        Bounce: {
            In: function (k) {
                return 1 - EZGUI.Easing.Bounce.Out(1 - k);
            },
            Out: function (k) {
                if (k < (1 / 2.75)) {
                    return 7.5625 * k * k;
                }
                else if (k < (2 / 2.75)) {
                    return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
                }
                else if (k < (2.5 / 2.75)) {
                    return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
                }
                else {
                    return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
                }
            },
            InOut: function (k) {
                if (k < 0.5)
                    return EZGUI.Easing.Bounce.In(k * 2) * 0.5;
                return EZGUI.Easing.Bounce.Out(k * 2 - 1) * 0.5 + 0.5;
            }
        }
    };
})(EZGUI || (EZGUI = {}));
var EZGUI;
(function (EZGUI) {
    EZGUI.Interpolation = {
        Linear: function (v, k) {
            var m = v.length - 1, f = m * k, i = Math.floor(f), fn = EZGUI.Interpolation.Utils.Linear;
            if (k < 0)
                return fn(v[0], v[1], f);
            if (k > 1)
                return fn(v[m], v[m - 1], m - f);
            return fn(v[i], v[i + 1 > m ? m : i + 1], f - i);
        },
        Bezier: function (v, k) {
            var b = 0, n = v.length - 1, pw = Math.pow, bn = EZGUI.Interpolation.Utils.Bernstein, i;
            for (i = 0; i <= n; i++) {
                b += pw(1 - k, n - i) * pw(k, i) * v[i] * bn(n, i);
            }
            return b;
        },
        CatmullRom: function (v, k) {
            var m = v.length - 1, f = m * k, i = Math.floor(f), fn = EZGUI.Interpolation.Utils.CatmullRom;
            if (v[0] === v[m]) {
                if (k < 0)
                    i = Math.floor(f = m * (1 + k));
                return fn(v[(i - 1 + m) % m], v[i], v[(i + 1) % m], v[(i + 2) % m], f - i);
            }
            else {
                if (k < 0)
                    return v[0] - (fn(v[0], v[0], v[1], v[1], -f) - v[0]);
                if (k > 1)
                    return v[m] - (fn(v[m], v[m], v[m - 1], v[m - 1], f - m) - v[m]);
                return fn(v[i ? i - 1 : 0], v[i], v[m < i + 1 ? m : i + 1], v[m < i + 2 ? m : i + 2], f - i);
            }
        },
        Utils: {
            Linear: function (p0, p1, t) {
                return (p1 - p0) * t + p0;
            },
            Bernstein: function (n, i) {
                var fc = EZGUI.Interpolation.Utils.Factorial;
                return fc(n) / fc(i) / fc(n - i);
            },
            Factorial: (function () {
                var a = [1];
                return function (n) {
                    var s = 1, i;
                    if (a[n])
                        return a[n];
                    for (i = n; i > 1; i--)
                        s *= i;
                    return a[n] = s;
                };
            })(),
            CatmullRom: function (p0, p1, p2, p3, t) {
                var v0 = (p2 - p0) * 0.5, v1 = (p3 - p1) * 0.5, t2 = t * t, t3 = t * t2;
                return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
            }
        }
    };
})(EZGUI || (EZGUI = {}));
/// <reference path="easing.ts" />
/// <reference path="interpolation.ts" />
/**
 * This is a part of Tween.js converted to TypeScript
 *
 * Tween.js - Licensed under the MIT license
 * https://github.com/sole/tween.js
 */
var EZGUI;
(function (EZGUI) {
    var Tween = (function () {
        //#endregion
        function Tween(object) {
            this._valuesStart = {};
            this._valuesEnd = {};
            this._valuesStartRepeat = {};
            this._duration = 1000;
            this._repeat = 0;
            this._yoyo = false;
            this._isPlaying = false;
            this._reversed = false;
            this._delayTime = 0;
            this._startTime = null;
            this._easingFunction = EZGUI.Easing.Linear.None;
            this._interpolationFunction = EZGUI.Interpolation.Linear;
            this._chainedTweens = [];
            this._onStartCallback = null;
            this._onStartCallbackFired = false;
            this._onUpdateCallback = null;
            this._onCompleteCallback = null;
            this._onStopCallback = null;
            this._object = object;
            for (var field in object) {
                this._valuesStart[field] = parseFloat(object[field], 10);
            }
        }
        Tween.getAll = function () {
            return this._tweens;
        };
        Tween.removeAll = function () {
            this._tweens = [];
        };
        Tween.add = function (tween) {
            this._tweens.push(tween);
        };
        Tween.remove = function (tween) {
            var i = this._tweens.indexOf(tween);
            if (i !== -1) {
                this._tweens.splice(i, 1);
            }
        };
        Tween.update = function (time) {
            if (this._tweens.length === 0)
                return false;
            var i = 0;
            time = time !== undefined ? time : window.performance.now();
            while (i < this._tweens.length) {
                if (this._tweens[i].update(time)) {
                    i++;
                }
                else {
                    this._tweens.splice(i, 1);
                }
            }
            return true;
        };
        Tween.prototype.to = function (properties, duration) {
            if (duration !== undefined) {
                this._duration = duration;
            }
            this._valuesEnd = properties;
            return this;
        };
        Tween.prototype.start = function (time) {
            Tween.add(this);
            this._isPlaying = true;
            this._onStartCallbackFired = false;
            this._startTime = time !== undefined ? time : window.performance.now();
            this._startTime += this._delayTime;
            for (var property in this._valuesEnd) {
                // check if an Array was provided as property value
                if (this._valuesEnd[property] instanceof Array) {
                    if (this._valuesEnd[property].length === 0) {
                        continue;
                    }
                    // create a local copy of the Array with the start value at the front
                    this._valuesEnd[property] = [this._object[property]].concat(this._valuesEnd[property]);
                }
                this._valuesStart[property] = this._object[property];
                if ((this._valuesStart[property] instanceof Array) === false) {
                    this._valuesStart[property] *= 1.0; // Ensures we're using numbers, not strings
                }
                this._valuesStartRepeat[property] = this._valuesStart[property] || 0;
            }
            return this;
        };
        Tween.prototype.stop = function () {
            if (!this._isPlaying) {
                return this;
            }
            Tween.remove(this);
            this._isPlaying = false;
            if (this._onStopCallback !== null) {
                this._onStopCallback.call(this._object);
            }
            this.stopChainedTweens();
            return this;
        };
        Tween.prototype.stopChainedTweens = function () {
            for (var i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i++) {
                this._chainedTweens[i].stop();
            }
        };
        Tween.prototype.delay = function (amount) {
            this._delayTime = amount;
            return this;
        };
        Tween.prototype.repeat = function (times) {
            this._repeat = times;
            return this;
        };
        Tween.prototype.yoyo = function (yoyo) {
            this._yoyo = yoyo;
            return this;
        };
        Tween.prototype.easing = function (easing) {
            this._easingFunction = easing;
            return this;
        };
        Tween.prototype.interpolation = function (interpolation) {
            this._interpolationFunction = interpolation;
            return this;
        };
        Tween.prototype.chain = function () {
            this._chainedTweens = arguments;
            return this;
        };
        Tween.prototype.onStart = function (callback) {
            this._onStartCallback = callback;
            return this;
        };
        Tween.prototype.onUpdate = function (callback) {
            this._onUpdateCallback = callback;
            return this;
        };
        Tween.prototype.onComplete = function (callback) {
            this._onCompleteCallback = callback;
            return this;
        };
        Tween.prototype.onStop = function (callback) {
            this._onStopCallback = callback;
            return this;
        };
        Tween.prototype.update = function (time) {
            var property;
            if (time < this._startTime) {
                return true;
            }
            if (this._onStartCallbackFired === false) {
                if (this._onStartCallback !== null) {
                    this._onStartCallback.call(this._object);
                }
                this._onStartCallbackFired = true;
            }
            var elapsed = (time - this._startTime) / this._duration;
            elapsed = elapsed > 1 ? 1 : elapsed;
            var value = this._easingFunction(elapsed);
            for (property in this._valuesEnd) {
                var start = this._valuesStart[property] || 0;
                var end = this._valuesEnd[property];
                if (end instanceof Array) {
                    this._object[property] = this._interpolationFunction(end, value);
                }
                else {
                    // Parses relative end values with start as base (e.g.: +10, -3)
                    if (typeof (end) === "string") {
                        end = start + parseFloat(end, 10);
                    }
                    // protect against non numeric properties.
                    if (typeof (end) === "number") {
                        this._object[property] = start + (end - start) * value;
                    }
                }
            }
            if (this._onUpdateCallback !== null) {
                this._onUpdateCallback.call(this._object, value);
            }
            if (elapsed == 1) {
                if (this._repeat > 0) {
                    if (isFinite(this._repeat)) {
                        this._repeat--;
                    }
                    for (property in this._valuesStartRepeat) {
                        if (typeof (this._valuesEnd[property]) === "string") {
                            this._valuesStartRepeat[property] = this._valuesStartRepeat[property] + parseFloat(this._valuesEnd[property], 10);
                        }
                        if (this._yoyo) {
                            var tmp = this._valuesStartRepeat[property];
                            this._valuesStartRepeat[property] = this._valuesEnd[property];
                            this._valuesEnd[property] = tmp;
                        }
                        this._valuesStart[property] = this._valuesStartRepeat[property];
                    }
                    if (this._yoyo) {
                        this._reversed = !this._reversed;
                    }
                    this._startTime = time + this._delayTime;
                    return true;
                }
                else {
                    if (this._onCompleteCallback !== null) {
                        this._onCompleteCallback.call(this._object);
                    }
                    for (var i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i++) {
                        this._chainedTweens[i].start(time);
                    }
                    return false;
                }
            }
            return true;
        };
        //#region Static part replacing TWEEN namespace from original tweenjs
        Tween._tweens = [];
        return Tween;
    })();
    EZGUI.Tween = Tween;
})(EZGUI || (EZGUI = {}));
var EZGUI;
(function (EZGUI) {
    var utils;
    (function (utils) {
        var EventHandler = (function () {
            function EventHandler() {
            }
            EventHandler.prototype.bind = function (event, fct) {
                this._events = this._events || {};
                this._events[event] = this._events[event] || [];
                this._events[event].push(fct);
            };
            //same as bind
            EventHandler.prototype.on = function (event, fct, nbcalls) {
                this._events = this._events || {};
                this._events[event] = this._events[event] || [];
                if (nbcalls)
                    fct.__nbcalls__ = nbcalls;
                this._events[event].push(fct);
            };
            //unbind(event, fct) {
            //    this._events = this._events || {};
            //    //if (event in this._events === false) return;
            //    if (event in this._events === false || typeof this._events[event] != 'array') return;
            //    this._events[event].splice(this._events[event].indexOf(fct), 1);
            //}
            EventHandler.prototype.unbind = function (event, fct) {
                this._events = this._events || {};
                if (event in this._events === false || !this._events[event] || !(this._events[event] instanceof Array))
                    return;
                this._events[event].splice(this._events[event].indexOf(fct), 1);
            };
            EventHandler.prototype.unbindEvent = function (event) {
                this._events = this._events || {};
                this._events[event] = [];
            };
            EventHandler.prototype.unbindAll = function () {
                this._events = this._events || {};
                for (var event in this._events)
                    this._events[event] = false;
            };
            EventHandler.prototype.trigger = function (event) {
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                this._events = this._events || {};
                if (event in this._events !== false) {
                    for (var i = 0; i < this._events[event].length; i++) {
                        var fct = this._events[event][i];
                        fct.apply(this, args);
                        if (fct.__nbcalls__) {
                            fct.__nbcalls__--;
                            if (fct.__nbcalls__ <= 0)
                                this.unbind(event, fct);
                        }
                    }
                }
            };
            return EventHandler;
        })();
        utils.EventHandler = EventHandler;
    })(utils = EZGUI.utils || (EZGUI.utils = {}));
})(EZGUI || (EZGUI = {}));
/**
* Hack in support for Function.name for browsers that don't support it.
* IE, I'm looking at you.
**/
if (Function.prototype['name'] === undefined && Object.defineProperty !== undefined) {
    Object.defineProperty(Function.prototype, 'name', {
        get: function () {
            var funcNameRegex = /function\s([^(]{1,})\(/;
            var results = (funcNameRegex).exec((this).toString());
            return (results && results.length > 1) ? results[1].trim() : "";
        },
        set: function (value) {
        }
    });
}
/// <reference path="polyfills/ie.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
//declare var __extends;
var EZGUI;
(function (EZGUI) {
    var Compatibility;
    (function (Compatibility) {
        Compatibility.PIXIVersion = (PIXI.VERSION.indexOf('v3.') == 0 || PIXI.VERSION.indexOf('3.') == 0) ? 3 : 2;
        Compatibility.isPhaser = (typeof Phaser != 'undefined');
        Compatibility.isPhaser24 = Compatibility.isPhaser && Phaser.VERSION.indexOf('2.4') == 0;
        Compatibility.BitmapText = Compatibility.PIXIVersion >= 3 ? PIXI.extras.BitmapText : PIXI.BitmapText;
        var TilingSprite = (function () {
            function TilingSprite(texture, width, height) {
            }
            return TilingSprite;
        })();
        Compatibility.TilingSprite = TilingSprite;
        var GUIContainer = (function (_super) {
            __extends(GUIContainer, _super);
            function GUIContainer() {
                _super.apply(this, arguments);
            }
            return GUIContainer;
        })(PIXI.DisplayObjectContainer);
        Compatibility.GUIContainer = GUIContainer;
        if (Compatibility.PIXIVersion == 3) {
            Compatibility['GUIContainer'] = PIXI['Container'];
        }
        else {
            Compatibility['GUIContainer'] = PIXI['DisplayObjectContainer'];
        }
        var GUIDisplayObjectContainer = (function (_super) {
            __extends(GUIDisplayObjectContainer, _super);
            function GUIDisplayObjectContainer() {
                _super.call(this);
                if (typeof Phaser != 'undefined') {
                    var game = Phaser.GAMES[0];
                    if (!GUIDisplayObjectContainer.globalPhaserGroup)
                        GUIDisplayObjectContainer.globalPhaserGroup = new Phaser.Group(game, game.stage, 'guigroup');
                    this.phaserGroup = GUIDisplayObjectContainer.globalPhaserGroup.create(0, 0); //new Phaser.Group(Phaser.GAMES[0]);
                    this.phaserGroup.addChild(this);
                    this.phaserGroup.guiSprite = this;
                }
            }
            return GUIDisplayObjectContainer;
        })(GUIContainer);
        Compatibility.GUIDisplayObjectContainer = GUIDisplayObjectContainer;
        //var dummy:any = (function (_super) {
        //    __extends(GUIDisplayObjectContainer, _super);
        //    function GUIDisplayObjectContainer() {
        //        _super.call(this, [Phaser.GAMES[0]]);
        //    }
        //    return GUIDisplayObjectContainer;
        //})(Phaser.Group);
        //Compatibility['GUIDisplayObjectContainer'] = dummy;
        function createRenderTexture(width, height) {
            var texture;
            if (EZGUI.Compatibility.PIXIVersion == 3) {
                texture = new PIXI.RenderTexture(EZGUI.tilingRenderer, width, height);
            }
            else {
                texture = new PIXI.RenderTexture(width, height, EZGUI.tilingRenderer);
            }
            return texture;
        }
        Compatibility.createRenderTexture = createRenderTexture;
        /*
         *
         * this function is used to fix Phaser 2.4 compatibility
         * it need to be attached to onLoadComplete of phaser's loader to copy loaded resources to PIXI.TextureCache
         */
        function fixCache(resources) {
            if (!EZGUI.Compatibility.isPhaser24 || !this._fileList)
                return;
            for (var i = 0; i < this._fileList.length; i++) {
                if (!resources || resources.length == 0 || resources.indexOf(this._fileList[i].key) >= 0) {
                    var tx = new PIXI.Texture(new PIXI.BaseTexture(this._fileList[i].data));
                    PIXI.TextureCache[this._fileList[i].key] = tx;
                }
            }
        }
        Compatibility.fixCache = fixCache;
    })(Compatibility = EZGUI.Compatibility || (EZGUI.Compatibility = {}));
})(EZGUI || (EZGUI = {}));
if (EZGUI.Compatibility.PIXIVersion == 3) {
    PIXI['utils']._saidHello = true;
    //EZGUI.tilingRenderer = new PIXI.WebGLRenderer();
    EZGUI.tilingRenderer = new PIXI.CanvasRenderer();
    EZGUI.Compatibility.TilingSprite = (PIXI.extras).TilingSprite;
    PIXI['utils']._saidHello = false;
}
else {
    EZGUI.tilingRenderer = new PIXI.CanvasRenderer();
    EZGUI.Compatibility.TilingSprite = PIXI.TilingSprite;
}
EZGUI.Compatibility.TilingSprite.prototype['fixPhaser24'] = function () {
    if (EZGUI.Compatibility.isPhaser24) {
        var ltexture = this.originalTexture || this.texture;
        var frame = ltexture.frame;
        var targetWidth, targetHeight;
        //  Check that the frame is the same size as the base texture.
        var isFrame = frame.width !== ltexture.baseTexture.width || frame.height !== ltexture.baseTexture.height;
        this._frame = {};
        if (ltexture.trim) {
            this._frame.spriteSourceSizeX = ltexture.trim.width;
            this._frame.spriteSourceSizeY = ltexture.trim.height;
        }
        else {
            this._frame.sourceSizeW = frame.width;
            this._frame.sourceSizeH = frame.height;
        }
    }
};
if (PIXI.EventTarget) {
    PIXI.EventTarget.mixin(EZGUI.Compatibility.GUIDisplayObjectContainer.prototype);
}
else {
    if (EZGUI.Compatibility.isPhaser) {
        var proto = EZGUI.Compatibility.GUIDisplayObjectContainer.prototype;
        proto.on = function (event, fct) {
            this._listeners = this._listeners || {};
            this._listeners[event] = this._listeners[event] || [];
            this._listeners[event].push(fct);
        };
        proto.off = function (event, fct) {
            this._listeners = this._listeners || {};
            if (!fct) {
                this._listeners[event] = [];
            }
            else {
                if (event in this._listeners === false || typeof this._listeners[event] != 'array')
                    return;
                this._listeners[event].splice(this._listeners[event].indexOf(fct), 1);
            }
        };
        proto.emit = function (event) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            this._listeners = this._listeners || {};
            if (event in this._listeners !== false) {
                for (var i = 0; i < this._listeners[event].length; i++) {
                    var fct = this._listeners[event][i];
                    fct.apply(this, args);
                    if (fct.__nbcalls__) {
                        fct.__nbcalls__--;
                        if (fct.__nbcalls__ <= 0)
                            this.unbind(event, fct);
                    }
                }
            }
        };
    }
}
/// <reference path="ezgui.ts" />
var EZGUI;
(function (EZGUI) {
    var Theme = (function () {
        function Theme(themeConfig) {
            this.themeConfig = themeConfig;
            this._listeners = [];
            this.ready = false;
            this.url = '';
            var _this = this;
            if (typeof themeConfig == 'string') {
                _this.url = themeConfig;
                EZGUI.utils.loadJSON(_this.url, function (themeConfig) {
                    _this.themeConfig = themeConfig;
                    _this.initThemeConfig(themeConfig);
                });
            }
            else {
                this.initThemeConfig(themeConfig);
            }
        }
        Theme.prototype.override = function (themeConfig) {
            var _theme = JSON.parse(JSON.stringify(themeConfig));
            for (var t in _theme) {
                if (t == 'default')
                    continue;
                var skin = _theme[t];
                EZGUI.utils.extendJSON(skin, this._default);
            }
            this.parseComponents(_theme);
            for (var t in _theme) {
                if (t == 'default')
                    continue;
                var skin = _theme[t];
                this._theme[t] = skin;
            }
        };
        Theme.prototype.fixLimits = function (target, source) {
            if (typeof source == 'object') {
                if (target.width != undefined && source.maxWidth)
                    target.width = Math.min(target.width, source.maxWidth);
                if (target.height != undefined && source.maxHeight)
                    target.height = Math.min(target.height, source.maxHeight);
                for (var i in source) {
                    var src = source[i];
                    if (typeof target[i] == 'object') {
                        this.fixLimits(target[i], source[i]);
                    }
                }
            }
        };
        Theme.prototype.initThemeConfig = function (themeConfig) {
            this._theme = JSON.parse(JSON.stringify(themeConfig));
            this.id = this._theme.__config__ ? this._theme.__config__.name : undefined;
            this._default = this._theme['default'];
            for (var t in this._theme) {
                if (t == 'default')
                    continue;
                var skin = this._theme[t];
                /*
                for (var i in this._default) {
                    if (!skin[i]) skin[i] = JSON.parse(JSON.stringify(this._default[i]));
                }
                */
                EZGUI.utils.extendJSON(skin, this._default);
            }
            this.path = this.url.substring(0, this.url.lastIndexOf('/') + 1);
            this.parseComponents(this._theme);
            this.preload();
        };
        Theme.prototype.parseResources = function () {
            var themeResources = this._theme.__config__.resources;
            var resources = [];
            if (!themeResources || themeResources.length <= 0)
                return resources;
            var resToLoad = 0;
            for (var i = 0; i < themeResources.length; i++) {
                var res = themeResources[i];
                if (res.indexOf('http://') == 0 || res.indexOf('https://') == 0 || res.indexOf('file://') == 0 || res.indexOf('/') == 0)
                    continue;
                //TODO : use a path normalizer here
                if (res.indexOf('./') == 0)
                    res = res.substring(2);
                if (PIXI.loader && PIXI.loader.resources[resources[i]]) {
                }
                else {
                    resources.push(this.path + res);
                }
            }
            return resources;
        };
        Theme.prototype.parseComponents = function (theme) {
            for (var i in theme) {
                if (i == '__config__')
                    continue;
                var item = theme[i];
                for (var c = 0; c < Theme.imageComponents.length; c++) {
                    var cc = Theme.imageComponents[c];
                    for (var v = 0; v < Theme.imageVariants.length; v++) {
                        var vv = Theme.imageVariants[v];
                        if (vv != '')
                            cc = cc + '-' + vv;
                        if (item[cc] == undefined)
                            continue;
                        if (typeof item[cc] == 'string') {
                            var str = item[cc];
                            item[cc] = this.normalizeResPath(str);
                        }
                        else {
                            for (var s = 0; s < Theme.imageStates.length; s++) {
                                var st = Theme.imageStates[s];
                                var str = item[cc][st];
                                if (str) {
                                    item[cc][st] = this.normalizeResPath(str);
                                }
                            }
                        }
                    }
                }
            }
        };
        Theme.prototype.normalizeResPath = function (str) {
            if (str.indexOf('./') != 0)
                return str;
            str = str.substring(2);
            return this.path + str;
        };
        Theme.load = function (themes, cb) {
            if (cb === void 0) { cb = null; }
            var remaining = 0;
            for (var i = 0; i < themes.length; i++) {
                remaining++;
                var theme = new Theme(themes[i]);
                theme.onReady(function () {
                    remaining--;
                    if (remaining <= 0 && typeof cb == 'function') {
                        cb();
                    }
                });
            }
        };
        //experimental Theme transparent preload
        Theme.prototype.onReady = function (cb) {
            if (typeof cb != 'function')
                return;
            if (this.ready)
                cb();
            this._listeners.push(cb);
        };
        Theme.prototype.preload = function () {
            var _this = this;
            var onAssetsLoaded = function () {
                _this.ready = true;
                EZGUI.themes[_this.id] = _this;
                var cb;
                while (cb = _this._listeners.pop())
                    cb();
            };
            if (this._theme.__config__ && this._theme.__config__.resources) {
                var resources = this.parseResources();
                if (resources.length == 0) {
                    onAssetsLoaded();
                }
                else {
                    //console.log('Theme preloading ', resources);
                    //utils.loadJSON(_this.url, function (themeConfig) {
                    //    _this.themeConfig = themeConfig;
                    //    _this.initThemeConfig(themeConfig);
                    //});
                    _this.loadResources(resources, onAssetsLoaded);
                }
            }
            else {
                onAssetsLoaded();
            }
        };
        Theme.prototype.loadResources = function (resources, cb) {
            var _this = this;
            var images = [];
            var atlases = [];
            var fonts = [];
            var atlasData = {};
            var fontData = {};
            var resToLoad = 0;
            var cacheAtlas = function () {
                for (var i in atlasData) {
                    var atlasJson = atlasData[i];
                    var imgUrl = _this.path + atlasJson.meta.image;
                    var baseTx = PIXI.utils ? PIXI.utils.TextureCache[imgUrl].baseTexture : PIXI.TextureCache[imgUrl].baseTexture;
                    for (var f in atlasJson.frames) {
                        var frame = atlasJson.frames[f].frame;
                        var texture = new PIXI.Texture(baseTx, {
                            x: frame.x,
                            y: frame.y,
                            width: frame.w,
                            height: frame.h
                        });
                        if (PIXI.utils) {
                            PIXI.utils.TextureCache[f] = texture;
                        }
                        else {
                            PIXI.TextureCache[f] = texture;
                        }
                    }
                }
                for (var i in fontData) {
                    var font = fontData[i];
                    _this.parseFont(font, PIXI.Texture.fromFrame(font.textureId));
                }
                cb();
            };
            //var phaser24cache = function (loader) {
            //    if (!loader._fileList) return;
            //    //console.log(loader._fileList);
            //    for (var i = 0; i < loader._fileList.length; i++) {
            //        var tx = new (<any>PIXI).Texture(new (<any>PIXI).BaseTexture(loader._fileList[i].data));
            //        //tx._frame = { test: 1 };
            //        //console.log('Caching : ', loader._fileList[i].key);
            //        PIXI.TextureCache[loader._fileList[i].key] = tx;
            //        //console.log(tx);
            //    }
            //}
            var loadImages = function () {
                var crossOrigin = (EZGUI.settings.crossOrigin == true);
                if (typeof Phaser != 'undefined') {
                    //console.log('Phaser loader');
                    var loader = new Phaser.Loader(Phaser.GAMES[0]);
                    loader.crossOrigin = crossOrigin;
                    for (var i = 0; i < images.length; i++) {
                        loader.image(images[i], images[i]);
                    }
                    loader.onLoadComplete.add(function () {
                        //loader.onLoadComplete.add(EZGUI.Compatibility.fixCache, loader);
                        EZGUI.Compatibility.fixCache.apply(loader);
                        //phaser24cache(loader);
                        cacheAtlas();
                    });
                    loader.start();
                    return;
                }
                if (PIXI.loader) {
                    for (var i = 0; i < images.length; i++) {
                        PIXI.loader.add({ url: images[i], crossOrigin: crossOrigin });
                    }
                    //(<any>PIXI).loader.add(images);
                    PIXI.loader.load(cacheAtlas);
                }
                else {
                    var loader = new PIXI.AssetLoader(images, crossOrigin);
                    loader.onComplete = cacheAtlas;
                    loader.load();
                }
            };
            for (var i = 0; i < resources.length; i++) {
                var res = resources[i];
                if (res.indexOf('.json') > 0) {
                    atlases.push(res);
                    continue;
                }
                if (res.indexOf('.xml') > 0 || res.indexOf('.fnt') > 0) {
                    fonts.push(res);
                    continue;
                }
                images.push(res);
            }
            if (atlases.length > 0) {
                for (var i = 0; i < atlases.length; i++) {
                    var font = atlases[i];
                    resToLoad++;
                    (function (atlasUrl) {
                        EZGUI.utils.loadJSON(atlasUrl, function (atlasjson) {
                            images.push(_this.path + atlasjson.meta.image);
                            resToLoad--;
                            atlasData[atlasUrl] = atlasjson;
                            if (resToLoad <= 0) {
                                //console.log('Atlas loaded ', images);
                                loadImages();
                            }
                        });
                    })(font);
                }
            }
            if (fonts.length > 0) {
                for (var i = 0; i < fonts.length; i++) {
                    var font = fonts[i];
                    resToLoad++;
                    (function (atlasUrl) {
                        EZGUI.utils.loadXML(atlasUrl, function (xmlfont) {
                            var img = xmlfont.getElementsByTagName('page')[0].getAttribute('file');
                            var path = atlasUrl.substring(0, atlasUrl.lastIndexOf('\\') + atlasUrl.lastIndexOf('/') + 2);
                            var src = path + img;
                            //console.log('Fake font load = ', src);
                            images.push(src);
                            resToLoad--;
                            fontData[atlasUrl] = {
                                data: xmlfont,
                                textureId: src
                            };
                            if (resToLoad <= 0) {
                                //console.log('Fonts loaded ', images);
                                loadImages();
                            }
                        });
                    })(font);
                }
            }
            if (atlases.length <= 0 && fonts.length <= 0) {
                loadImages();
            }
        };
        Theme.prototype.parseFont = function (resource, texture) {
            var data = {};
            var info = resource.data.getElementsByTagName('info')[0];
            var common = resource.data.getElementsByTagName('common')[0];
            data.font = info.getAttribute('face');
            data.size = parseInt(info.getAttribute('size'), 10);
            data.lineHeight = parseInt(common.getAttribute('lineHeight'), 10);
            data.chars = {};
            var Rectangle;
            var BitmapText;
            if (EZGUI.Compatibility.PIXIVersion == 3) {
                Rectangle = PIXI.math.Rectangle;
                BitmapText = PIXI.extras.BitmapText;
            }
            else {
                Rectangle = PIXI.Rectangle;
                BitmapText = PIXI.BitmapText;
            }
            //parse letters
            var letters = resource.data.getElementsByTagName('char');
            for (var i = 0; i < letters.length; i++) {
                var charCode = parseInt(letters[i].getAttribute('id'), 10);
                var textureRect = new Rectangle(parseInt(letters[i].getAttribute('x'), 10) + texture.frame.x, parseInt(letters[i].getAttribute('y'), 10) + texture.frame.y, parseInt(letters[i].getAttribute('width'), 10), parseInt(letters[i].getAttribute('height'), 10));
                data.chars[charCode] = {
                    xOffset: parseInt(letters[i].getAttribute('xoffset'), 10),
                    yOffset: parseInt(letters[i].getAttribute('yoffset'), 10),
                    xAdvance: parseInt(letters[i].getAttribute('xadvance'), 10),
                    kerning: {},
                    texture: new PIXI.Texture(texture.baseTexture, textureRect)
                };
            }
            //parse kernings
            var kernings = resource.data.getElementsByTagName('kerning');
            for (i = 0; i < kernings.length; i++) {
                var first = parseInt(kernings[i].getAttribute('first'), 10);
                var second = parseInt(kernings[i].getAttribute('second'), 10);
                var amount = parseInt(kernings[i].getAttribute('amount'), 10);
                data.chars[second].kerning[first] = amount;
            }
            //resource.bitmapFont = data;
            // I'm leaving this as a temporary fix so we can test the bitmap fonts in v3
            // but it's very likely to change
            BitmapText.fonts[data.font] = data;
        };
        Theme.prototype.getSkin = function (skinId) {
            var skin = this._theme[skinId] || this._theme['default'];
            return skin;
        };
        Theme.prototype.applySkin = function (settings) {
            var skinId = settings['skin'] || settings['component'];
            var skin = this._theme[skinId] || this._theme['default'];
            EZGUI.utils.extendJSON(settings, skin);
            this.fixLimits(settings, skin);
            return settings;
        };
        Theme.imageComponents = ['bg', 'corner', 'line', 'side', 'image', 'checkmark'];
        Theme.imageStates = ['default', 'hover', 'down', 'checked'];
        Theme.imageVariants = ['', 't', 'r', 'b', 'l', 'left', 'right', 'tl', 'tr', 'bl', 'br'];
        return Theme;
    })();
    EZGUI.Theme = Theme;
})(EZGUI || (EZGUI = {}));
/// <reference path="tween/tween.ts" />
/// <reference path="utils/eventhandler.ts" />
/// <reference path="compatibility.ts" />
/// <reference path="theme.ts" />
var EZGUI;
(function (EZGUI) {
    EZGUI.VERSION = '0.2.1 beta';
    //export var states = ['default', 'hover', 'down', 'checked'];
    EZGUI.tilingRenderer;
    EZGUI.dragging;
    EZGUI.dsx;
    EZGUI.dsy;
    EZGUI.startDrag = { x: null, y: null, t: null };
    EZGUI.focused;
    EZGUI.game;
    EZGUI.themes = {};
    EZGUI.components = {};
    EZGUI.radioGroups = [];
    EZGUI.EventsHelper = new EZGUI.utils.EventHandler();
    /**
     * generic settings object
     * accepted parameters
     * crossOrigin : true/false
     */
    EZGUI.settings = {
        crossOrigin: false
    };
    var _components = {};
    function registerComponents(cpt, id) {
        id = id || cpt.name;
        _components[id] = cpt;
    }
    EZGUI.registerComponents = registerComponents;
    function create(settings, theme) {
        var t = settings.component || 'default';
        var cptConstructor = _components[settings.component] || _components['default'];
        var component;
        if (cptConstructor) {
            component = new cptConstructor(settings, theme);
        }
        return component;
    }
    EZGUI.create = create;
    function tween_animate() {
        requestAnimationFrame(tween_animate);
        EZGUI.Tween.update();
    }
    tween_animate();
    function showHeader() {
        //use https://github.com/daniellmb/console.style ?
        var isChrome = (navigator.userAgent.indexOf("Chrome") != -1);
        var isFirefox = (navigator.userAgent.indexOf("Firefox") != -1);
        var isIE = (navigator.userAgent.indexOf("MSIE") != -1);
        if (isChrome) {
            //console.log('%cEZGUI', 'font-size:60px;color:#fff;text-shadow:0 1px 0 #ccc,0 2px 0 #c9c9c9,0 3px 0 #bbb,0 4px 0 #b9b9b9,0 5px 0 #aaa,0 6px 1px rgba(0,0,0,.1),0 0 5px rgba(0,0,0,.1),0 1px 3px rgba(0,0,0,.3),0 3px 5px rgba(0,0,0,.2),0 5px 10px rgba(0,0,0,.25),0 10px 10px rgba(0,0,0,.2),0 20px 20px rgba(0,0,0,.15);');﻿
            console.log('%cEZ%cGUI%c v' + EZGUI.VERSION + '%c | http://ezgui.ezelia.com  %c[We %c❤%c HTML5]', 'font-weight:bold;font-size:20px;color:#b33;text-shadow:0 1px 0 #ccc,0 2px 0 #c9c9c9,0 3px 0 #bbb', 'font-weight:bold;font-size:20px;color:#000;text-shadow:0 1px 0 #ccc,0 2px 0 #c9c9c9,0 3px 0 #bbb', 'font-size:12px;font-weight:bold; color: #b33;', 'font-size:12px;font-weight:bold; color: #000;', 'font-size:12px;font-weight:bold; color: #fff;background:#f18050', 'font-size:12px;font-weight:bold; color: #f00;background:#f18050', 'font-size:12px;font-weight:bold; color: #fff;background:#f18050');
            return;
        }
        if (isFirefox) {
            console.log('%cEZGUI%c v' + EZGUI.VERSION + '%c | http://ezgui.ezelia.com  %c[We ❤ HTML5]', 'font-weight:bold;font-size:20px;color:#b33;text-shadow:0 1px 0 #ccc,0 2px 0 #c9c9c9,0 3px 0 #bbb', 'font-size:12px;font-weight:bold; color: #b33;', 'font-size:12px;font-weight:bold; color: #000;', 'font-size:12px;font-weight:bold; color: #fff;background:#f18050');
            return;
        }
        if (window['console']) {
            console.log(' EZGUI v' + EZGUI.VERSION + '   [We <3 HTML5] | http://ezgui.ezelia.com');
        }
    }
    showHeader();
})(EZGUI || (EZGUI = {}));
/// <reference path="ezgui.ts" />
var EZGUI;
(function (EZGUI) {
    var MultistateSprite = (function (_super) {
        __extends(MultistateSprite, _super);
        function MultistateSprite(texture, states) {
            _super.call(this, texture);
            this.stateTextures = {};
            this.stateTextures['default'] = texture;
            if (states) {
                for (var s in states) {
                    var tx = states[s];
                    if (tx instanceof PIXI.Texture) {
                        this.stateTextures[s] = tx;
                    }
                }
            }
        }
        MultistateSprite.prototype.addState = function (id, texture) {
            this.stateTextures[id] = texture;
        };
        MultistateSprite.prototype.setState = function (state) {
            if (state === void 0) { state = 'default'; }
            var sprite = this;
            if (!sprite.stateTextures[state])
                return;
            if (sprite.texture) {
                sprite.texture = sprite.stateTextures[state];
            }
            else {
                if (sprite._texture)
                    sprite._texture = sprite.stateTextures[state];
            }
            if (sprite._tilingTexture)
                sprite._tilingTexture = sprite.stateTextures[state];
        };
        return MultistateSprite;
    })(PIXI.Sprite);
    EZGUI.MultistateSprite = MultistateSprite;
})(EZGUI || (EZGUI = {}));
/// <reference path="ezgui.ts" />
/// <reference path="../lib/pixi.d.ts" />
/// <reference path="multistatesprite.ts" />
/// <reference path="compatibility.ts" />
var EZGUI;
(function (EZGUI) {
    var GUIObject = (function (_super) {
        __extends(GUIObject, _super);
        function GUIObject() {
            _super.call(this);
            this.container = new EZGUI.Compatibility.GUIContainer();
            this.addChild(this.container);
        }
        Object.defineProperty(GUIObject.prototype, "Id", {
            get: function () {
                return this.guiID;
            },
            set: function (val) {
                this.guiID = val;
            },
            enumerable: true,
            configurable: true
        });
        GUIObject.prototype.setupEvents = function () {
            var _this = this;
            //var _this:any = this;
            _this.interactive = true;
            _this.mouseover = function (event) {
                //console.log('mouseover ', _this.guiID);
                //if PIXI 2 use event else use event.data
                var data = event.data || event;
                if (!_this.canTrigger(event, _this)) {
                    return;
                }
                //console.log('hover ', guiObj.guiID);
                _this._over = true;
                //guiObj.setState('hover');
                _this.emit('ezgui:mouseover', event, _this);
            };
            _this.mouseout = function (event) {
                //console.log('mouseout ', _this.guiID);
                //if PIXI 2 use event else use event.data
                var data = event.data || event;
                _this._over = false;
                //guiObj.setState('out');
                _this.emit('ezgui:mouseout', event, _this);
            };
            //handle drag stuff
            _this.mousedown = _this.touchstart = function (event) {
                //console.log('mousedown ', _this.guiID);
                if (!_this.canTrigger(event, _this)) {
                    return;
                }
                var pos = EZGUI.utils.getRealPos(event);
                EZGUI.startDrag.x = pos.x;
                EZGUI.startDrag.y = pos.y;
                EZGUI.startDrag.t = Date.now();
                var data = event.data || event;
                _this.emit('ezgui:mousedown', event, _this);
                //event.stopped = true;
            };
            _this.mouseup = _this.mouseupoutside = _this.touchend = _this.touchendoutside = function (event) {
                if (!_this.canTrigger(event, _this)) {
                    return;
                }
                var data = event.data || event;
                _this.emit('ezgui:mouseup', event, _this);
                var pos = EZGUI.utils.getRealPos(event);
                if (EZGUI.utils.distance(pos.x, pos.y, EZGUI.startDrag.x, EZGUI.startDrag.y) <= 4) {
                    _this.emit('ezgui:click', event, _this);
                    if (EZGUI.focused && _this != EZGUI.focused && EZGUI.focused.emit)
                        EZGUI.focused.emit('ezgui:blur');
                    EZGUI.focused = _this;
                    EZGUI.focused.emit('ezgui:focus');
                    event.stopped = true;
                }
            };
            _this.mousemove = _this.touchmove = function (event) {
                if (_this._over) {
                    if (_this.canTrigger(event, _this)) {
                        _this._over = false;
                        _this.mouseover(event);
                    }
                    else {
                        _this.mouseout(event);
                    }
                }
                if (!_this.canTrigger(event, _this)) {
                    return;
                }
                var data = event.data || event;
                _this.emit('ezgui:mousemove', event, _this);
            };
            _this.click = _this.tap = function (event) {
                //console.log('click', _this.guiID);
                //var pos = utils.getRealPos(event);
                //if (utils.distance(pos.x, pos.y, _this.startDrag.x, _this.startDrag.y) > 4) return;
                //if (guiObj.canTrigger(event, guiObj)) guiObj.emit('ezgui:click', event);
            };
            if (_this.phaserGroup) {
                _this.phaserGroup.inputEnabled = true;
                _this.phaserGroup.events.onInputOver.add(function (target, event) {
                    _this._over = true;
                    //console.log('ezgui:mouseover', event);
                    _this.emit('ezgui:mouseover', event, _this);
                }, this);
                _this.phaserGroup.events.onInputOut.add(function (target, event) {
                    _this._over = false;
                    _this.emit('ezgui:mouseout', event, _this);
                    //console.log('ezgui:mouseout', event);
                }, this);
                _this.phaserGroup.events.onInputDown.add(function (target, event) {
                    if (!_this.canTrigger(event, _this)) {
                        return;
                    }
                    var pos = EZGUI.utils.getRealPos(event);
                    EZGUI.startDrag.x = pos.x;
                    EZGUI.startDrag.y = pos.y;
                    EZGUI.startDrag.t = Date.now();
                    _this.emit('ezgui:mousedown', event, _this);
                    if (!_this.draggable && _this.guiParent && _this.guiParent.draggable) {
                        _this.guiParent.emit('ezgui:mousedown', event, _this);
                    }
                    //    
                    //console.log('ezgui:mousedown', event);
                }, this);
                _this.phaserGroup.events.onInputUp.add(function (target, event) {
                    //if (!_this.canTrigger(event, _this)) {
                    //    return;
                    //}
                    //_this.emit('ezgui:mouseup', event);
                    _this.emit('ezgui:mouseup', event, _this);
                    var pos = EZGUI.utils.getRealPos(event);
                    if (EZGUI.utils.distance(pos.x, pos.y, EZGUI.startDrag.x, EZGUI.startDrag.y) <= 4) {
                        _this.emit('ezgui:click', event, _this);
                        if (EZGUI.focused && _this != EZGUI.focused && EZGUI.focused.emit)
                            EZGUI.focused.emit('ezgui:blur');
                        EZGUI.focused = _this;
                        EZGUI.focused.emit('ezgui:focus');
                    }
                    if (!_this.draggable && _this.guiParent && _this.guiParent.draggable) {
                        _this.guiParent.emit('ezgui:mouseup', event, _this);
                    }
                }, this);
                //Phaser.GAMES[0].input.moveCallback = function (pointer, x, y) {
                //    console.log(pointer, x, y);
                //}
                Phaser.GAMES[0].input.mouse.mouseMoveCallback = function (event) {
                    if (_this._over) {
                        if (_this.canTrigger(event, _this)) {
                            _this._over = true;
                            _this.emit('ezgui:mouseover', event, _this);
                        }
                        else {
                            _this._over = false;
                            _this.emit('ezgui:mouseout', event, _this);
                        }
                    }
                    if (!_this.canTrigger(event, _this)) {
                        return;
                    }
                    var data = event.data || event;
                    _this.emit('ezgui:mousemove', event, _this);
                };
            }
        };
        GUIObject.prototype.originalAddChildAt = function (child, index) {
            return _super.prototype.addChildAt.call(this, child, index);
        };
        GUIObject.prototype.originalAddChild = function (child) {
            return this.originalAddChildAt(child, this.children.length);
        };
        GUIObject.prototype.addChild = function (child) {
            if (child instanceof EZGUI.GUISprite) {
                //return this.container.addChild(child);
                child.guiParent = this;
                if (child.phaserGroup)
                    return this.container.addChild(child.phaserGroup);
                else
                    return this.container.addChild(child);
            }
            else {
                return _super.prototype.addChild.call(this, child);
            }
        };
        GUIObject.prototype.removeChild = function (child) {
            if (child instanceof EZGUI.GUISprite) {
                child.guiParent = null;
                if (child.phaserGroup)
                    return this.container.removeChild(child.phaserGroup);
                else
                    return this.container.removeChild(child);
            }
            else {
                return _super.prototype.removeChild.call(this, child);
            }
        };
        GUIObject.prototype.mouseInObj = function (event, guiSprite) {
            var data = event.data || event;
            var clientpos = EZGUI.utils.getClientXY(event);
            var origEvt = event;
            if (data.originalEvent && data.originalEvent.changedTouches && data.originalEvent.changedTouches.length > 0) {
                origEvt = data.originalEvent.changedTouches[0];
            }
            else if (data.originalEvent && data.originalEvent.touches && data.originalEvent.touches.length > 0) {
                origEvt = data.originalEvent.touches[0];
            }
            else {
                if (data.originalEvent)
                    origEvt = data.originalEvent;
            }
            var bcr = origEvt.target.getBoundingClientRect();
            var px = clientpos.x - bcr.left;
            var py = clientpos.y - bcr.top;
            var absPos = EZGUI.utils.getAbsPos(guiSprite);
            if (px < absPos.x || px > absPos.x + guiSprite.width || py < absPos.y || py > absPos.y + guiSprite.height)
                return false;
            return true;
        };
        GUIObject.prototype.canTrigger = function (event, guiSprite) {
            var data = event.data || event;
            var clientpos = EZGUI.utils.getClientXY(event);
            var origEvt = event;
            if (data.originalEvent && data.originalEvent.changedTouches && data.originalEvent.changedTouches.length > 0) {
                origEvt = data.originalEvent.changedTouches[0];
            }
            else if (data.originalEvent && data.originalEvent.touches && data.originalEvent.touches.length > 0) {
                origEvt = data.originalEvent.touches[0];
            }
            else {
                if (data.originalEvent)
                    origEvt = data.originalEvent;
            }
            if (!origEvt.target.getBoundingClientRect)
                return false;
            var bcr = origEvt.target.getBoundingClientRect();
            var px = clientpos.x - bcr.left;
            var py = clientpos.y - bcr.top;
            //var absPos = utils.getAbsPos(guiSprite);
            //if (px < absPos.x || px > absPos.x + guiSprite.width || py < absPos.y || py > absPos.y + guiSprite.height) return false;
            //check if click is in visible zone
            var masked = EZGUI.utils.isMasked(px, py, guiSprite);
            return !masked;
        };
        GUIObject.prototype.on = function (event, fn, context) {
            return _super.prototype.on.call(this, 'ezgui:' + event, fn, context);
            //super.on('gui:' + event, cb);
        };
        GUIObject.prototype.off = function (event, fn, context) {
            if (EZGUI.Compatibility.PIXIVersion == 2) {
                if (fn == null && context == null) {
                    this._listeners['ezgui:' + event] = [];
                    return;
                }
            }
            return _super.prototype.off.call(this, 'ezgui:' + event, fn, context);
            //super.on('gui:' + event, cb);
        };
        GUIObject.prototype.bindChildren = function (event, fn) {
            for (var i = 0; i < this.container.children.length; i++) {
                var child = this.container.children[i];
                if (child.guiSprite)
                    child = child.guiSprite;
                child.on(event, fn);
            }
        };
        GUIObject.prototype.bindChildrenOfType = function (_type, event, fn) {
            for (var i = 0; i < this.container.children.length; i++) {
                var child = this.container.children[i];
                if (child.guiSprite)
                    child = child.guiSprite;
                if (child instanceof _type)
                    child.on(event, fn);
            }
        };
        GUIObject.prototype.unbindChildren = function (event, fn) {
            for (var i = 0; i < this.container.children.length; i++) {
                var child = this.container.children[i];
                if (child.guiSprite)
                    child = child.guiSprite;
                child.off(event, fn);
            }
        };
        GUIObject.prototype.unbindChildrenOfType = function (_type, event, fn) {
            for (var i = 0; i < this.container.children.length; i++) {
                var child = this.container.children[i];
                if (child.guiSprite)
                    child = child.guiSprite;
                if (child instanceof _type)
                    child.off(event, fn);
            }
        };
        GUIObject.prototype.preUpdate = function () {
        };
        GUIObject.prototype.update = function () {
        };
        GUIObject.prototype.postUpdate = function () {
        };
        GUIObject.prototype.destroy = function () {
            if (this.phaserGroup) {
                this.phaserGroup.destroy();
            }
            if (this.parent && this.parent.removeChild)
                this.parent.removeChild(this);
            delete EZGUI.components[this.guiID];
        };
        return GUIObject;
    })(EZGUI.Compatibility.GUIDisplayObjectContainer);
    EZGUI.GUIObject = GUIObject;
    EZGUI.registerComponents(EZGUI.GUISprite, 'default');
})(EZGUI || (EZGUI = {}));
/// <reference path="guiobject.ts" />
var EZGUI;
(function (EZGUI) {
    var GUISprite = (function (_super) {
        __extends(GUISprite, _super);
        function GUISprite(_settings, themeId) {
            _super.call(this);
            this._settings = _settings;
            this.themeId = themeId;
            this.dragXInterval = [-Infinity, +Infinity];
            this.dragYInterval = [-Infinity, +Infinity];
            //this.container = new Compatibility.GUIContainer();
            //this.addChild(this.container);
            this.userData = _settings.userData;
            if (themeId instanceof EZGUI.Theme)
                this.theme = themeId;
            else
                this.theme = EZGUI.themes[themeId];
            if (!this.theme || !this.theme.ready) {
                console.error('[EZGUI ERROR]', 'Theme is not ready, nothing to display');
                this.theme = new EZGUI.Theme({});
            }
            this._settings = this.theme.applySkin(_settings);
            this.parseSettings();
            this.draw();
            this.drawText();
            this.setupEvents();
            this.handleEvents();
        }
        Object.defineProperty(GUISprite.prototype, "settings", {
            get: function () {
                return this._settings;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(GUISprite.prototype, "text", {
            get: function () {
                if (this.textObj)
                    return this.textObj.text;
            },
            set: function (val) {
                if (this.textObj) {
                    if (EZGUI.Compatibility.PIXIVersion == 3) {
                        this.textObj.text = val;
                    }
                    else {
                        this.textObj.setText(val);
                    }
                    if (this._settings.anchor) {
                        this.textObj.position.x = 0;
                        this.textObj.position.y = 0;
                        if (this.textObj.anchor) {
                            this.textObj.anchor.x = this._settings.anchor.x;
                            this.textObj.anchor.y = this._settings.anchor.y;
                        }
                        else {
                            //fake anchor for bitmap font
                            this.textObj.position.x -= this.textObj.width / 2;
                            this.textObj.position.y -= this.textObj.height / 2;
                        }
                    }
                    else {
                        this.textObj.position.x = (this._settings.width - this.textObj.width) / 2;
                        this.textObj.position.y = (this._settings.height - this.textObj.height) / 2;
                        if (this.textObj.anchor) {
                            this.textObj.anchor.x = 0;
                            this.textObj.anchor.y = 0;
                        }
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
        GUISprite.prototype.parsePercentageValue = function (str) {
            if (typeof str != 'string')
                return NaN;
            var val = NaN;
            var percentToken = str.split('%');
            if (percentToken.length == 2 && percentToken[1] == '') {
                val = parseFloat(percentToken[0]);
            }
            return val;
        };
        GUISprite.prototype.parseSettings = function () {
        };
        GUISprite.prototype.prepareChildSettings = function (settings) {
            var _settings = JSON.parse(JSON.stringify(settings));
            if (_settings) {
                //support percentage values for width and height
                if (typeof _settings.width == 'string') {
                    var p = this.parsePercentageValue(_settings.width);
                    if (p != NaN)
                        _settings.width = this.width * p / 100;
                }
                if (typeof _settings.height == 'string') {
                    var p = this.parsePercentageValue(_settings.height);
                    if (p != NaN)
                        _settings.height = this.height * p / 100;
                }
                if (typeof _settings.position == 'object') {
                    if (typeof _settings.position.x == 'string') {
                        var px = this.parsePercentageValue(_settings.position.x);
                        if (px != NaN)
                            _settings.position.x = this.width * px / 100;
                    }
                    if (typeof _settings.position.y == 'string') {
                        var py = this.parsePercentageValue(_settings.position.y);
                        if (py != NaN)
                            _settings.position.y = this.height * py / 100;
                    }
                }
            }
            return _settings;
        };
        GUISprite.prototype.setDraggable = function (val) {
            if (val === void 0) { val = true; }
            if (val)
                this.draggable = this;
            else
                this.draggable = undefined;
        };
        GUISprite.prototype.handleEvents = function () {
            var _this = this;
            //var _this = this;
            this.draghandle = _this;
            if (_this._settings.draggable == true) {
                this.draggable = _this;
            }
            if (_this._settings.draggable == 'container') {
                this.draggable = _this.container;
            }
            if (_this._settings.dragX === false) {
                this.dragConstraint = 'y';
            }
            if (_this._settings.dragY === false) {
                this.dragConstraint = 'x';
            }
            //guiObj.on('mouseover', function () {
            //    guiObj.setState('hover');
            //});
            //guiObj.on('mouseout', function () {
            //    //EZGUI.dragging = null;
            //    guiObj.setState('out');
            //});
            //handle drag stuff
            _this.on('mousedown', function (event) {
                if (_this.draggable) {
                    if (_this.mouseInObj(event, _this.draghandle)) {
                        //if PIXI 2 use event else use event.data
                        var data = event.data || event;
                        //guiObj.alpha = 0.9;
                        EZGUI.dragging = _this;
                        //console.log('set dragging', EZGUI.dragging.guiID);
                        var pos = EZGUI.utils.getRealPos(event);
                        EZGUI.dsx = pos.x;
                        EZGUI.dsy = pos.y;
                        EZGUI.startDrag.x = pos.x;
                        EZGUI.startDrag.y = pos.y;
                    }
                }
                //only work in PIXI 3 ?
                //guiObj.setState('click');
            });
            _this.on('mouseup', function (event) {
                //guiObj.alpha = 1
                EZGUI.dragging = null;
                _this.setState('default');
            });
            _this.on('mousemove', function (event) {
                if (EZGUI.dragging) {
                    var dg = _this.draggable ? _this.draggable.guiID : '';
                }
                var PhaserDrag = typeof Phaser != 'undefined' && EZGUI.dragging;
                if (_this.draggable && EZGUI.dragging == _this || PhaserDrag) {
                    var pos = EZGUI.utils.getRealPos(event);
                    var dragObg = EZGUI.dragging;
                    var draggable = EZGUI.dragging.draggable;
                    var dpos = EZGUI.utils.getAbsPos(draggable);
                    if (dragObg.dragConstraint != 'y') {
                        var nextPos = draggable.position.x + pos.x - EZGUI.dsx;
                        if (nextPos >= dragObg.dragXInterval[0] && nextPos <= dragObg.dragXInterval[1])
                            draggable.position.x = nextPos;
                    }
                    if (dragObg.dragConstraint != 'x') {
                        var nextPos = draggable.position.y + pos.y - EZGUI.dsy;
                        if (nextPos >= dragObg.dragYInterval[0] && nextPos <= dragObg.dragYInterval[1])
                            draggable.position.y = nextPos;
                    }
                    EZGUI.dsx = pos.x;
                    EZGUI.dsy = pos.y;
                }
            });
        };
        /**
         * Main draw function
         */
        GUISprite.prototype.draw = function () {
            var settings = this._settings;
            if (settings) {
                this.guiID = settings.id;
                //add reference to component
                if (this.guiID)
                    EZGUI.components[this.guiID] = this;
                for (var s = 0; s < EZGUI.Theme.imageStates.length; s++) {
                    var stateId = EZGUI.Theme.imageStates[s];
                    var container = new EZGUI.Compatibility.GUIContainer();
                    var controls = this.createVisuals(settings, stateId);
                    for (var i = 0; i < controls.length; i++) {
                        container.addChild(controls[i]);
                    }
                    var texture = EZGUI.Compatibility.createRenderTexture(settings.width, settings.height);
                    texture.render(container);
                    if (!this.rootSprite) {
                        this.rootSprite = new EZGUI.MultistateSprite(texture);
                        this.addChild(this.rootSprite);
                    }
                    else {
                        this.rootSprite.addState(stateId, texture);
                    }
                }
                var padding = settings.padding || 0;
                if (settings.position) {
                    this.position.x = settings.position.x;
                    this.position.y = settings.position.y;
                }
                else {
                    this.position.x = 0;
                    this.position.y = 0;
                }
                //this.container = new Compatibility.GUIContainer();
                //this.addChild(this.container);
                if (settings.children) {
                    for (var i = 0; i < settings.children.length; i++) {
                        var btnObj = this.prepareChildSettings(settings.children[i]); // JSON.parse(JSON.stringify(settings.children[i]));
                        var child = this.createChild(btnObj, i);
                        if (!child)
                            continue;
                        //if (child.phaserGroup) this.container.addChild(child.phaserGroup);
                        //else this.container.addChild(child);
                        //force call original addChild to prevent conflict with local addchild
                        _super.prototype.addChild.call(this, child);
                        child.guiParent = this;
                    }
                }
                if (this._settings.anchor) {
                    this.rootSprite.anchor.x = this._settings.anchor.x;
                    this.rootSprite.anchor.y = this._settings.anchor.y;
                    this.container.position.x -= this.rootSprite.width * this._settings.anchor.x;
                    this.container.position.y -= this.rootSprite.height * this._settings.anchor.y;
                    this.position.x += this.rootSprite.width * this._settings.anchor.x;
                    this.position.y += this.rootSprite.height * this._settings.anchor.y;
                }
                //tint color
                if (this._settings.color) {
                    var pixiColor = EZGUI.utils.ColorParser.parseToPixiColor(this._settings.color);
                    if (pixiColor >= 0) {
                        this.rootSprite.tint = pixiColor;
                    }
                }
                //move container to top
                this.addChild(this.container);
                this.sortChildren();
            }
        };
        GUISprite.prototype.sortChildren = function () {
            if (!this.container)
                return;
            var comparator = function (a, b) {
                if (a.guiSprite)
                    a = a.guiSprite;
                if (b.guiSprite)
                    b = b.guiSprite;
                a._settings.z = a._settings.z || 0;
                b._settings.z = b._settings.z || 0;
                return a._settings.z - b._settings.z;
            };
            this.container.children.sort(comparator);
        };
        /**
         * Text draw function
         * shared by all components
         */
        GUISprite.prototype.drawText = function () {
            if (this._settings && this._settings.text != undefined && this.rootSprite) {
                //var settings = this.theme.applySkin(this._settings);
                var settings = this._settings;
                if (EZGUI.Compatibility.BitmapText.fonts && EZGUI.Compatibility.BitmapText.fonts[settings.font.family]) {
                    this.textObj = new EZGUI.Compatibility.BitmapText(this._settings.text, { font: settings.font.size + ' ' + settings.font.family });
                    var pixiColor = EZGUI.utils.ColorParser.parseToPixiColor(settings.font.color);
                    if (pixiColor >= 0) {
                        this.textObj.tint = pixiColor;
                        this.textObj.dirty = true;
                    }
                }
                else {
                    var style = { font: settings.font.size + ' ' + settings.font.family, fill: settings.font.color };
                    for (var s in settings.font) {
                        if (!style[s])
                            style[s] = settings.font[s];
                    }
                    this.textObj = new PIXI.Text(this._settings.text, style);
                }
                //text.height = this.height;
                this.textObj.position.x = 0; //(this._settings.width - this.textObj.width) / 2;
                this.textObj.position.y = 0; //(this._settings.height - this.textObj.height) / 2;
                if (this._settings.anchor) {
                    this.textObj.position.x = 0;
                    this.textObj.position.y = 0;
                    if (this.textObj.anchor) {
                        this.textObj.anchor.x = this._settings.anchor.x;
                        this.textObj.anchor.y = this._settings.anchor.y;
                    }
                    else {
                        //fake anchor for bitmap font
                        this.textObj.position.x -= this.textObj.width / 2;
                        this.textObj.position.y -= this.textObj.height / 2;
                    }
                }
                else {
                    this.textObj.position.x = (this._settings.width - this.textObj.width) / 2;
                    this.textObj.position.y = (this._settings.height - this.textObj.height) / 2;
                    if (this.textObj.anchor) {
                        this.textObj.anchor.x = 0;
                        this.textObj.anchor.y = 0;
                    }
                }
                this.rootSprite.addChild(this.textObj);
            }
        };
        GUISprite.prototype.createChild = function (childSettings, order) {
            if (!childSettings)
                return null;
            var i = order;
            var pos = childSettings.position;
            if (typeof pos == 'string') {
                var parts = pos.split(' ');
                var pos1 = parts[0];
                var pos2 = parts[1];
                //normalize pos
                if (parts[0] == parts[1]) {
                    pos2 = undefined;
                }
                if ((parts[0] == 'top' && parts[2] == 'bottom') || (parts[0] == 'bottom' && parts[2] == 'top') || (parts[0] == 'left' && parts[2] == 'right') || (parts[0] == 'right' && parts[2] == 'left')) {
                    pos1 = 'center';
                    pos2 = 'undefined';
                }
                if ((parts[0] == 'left' || parts[0] == 'right') && (parts[1] == 'top' || parts[1] == 'bottom')) {
                    pos1 = parts[1];
                    pos2 = parts[0];
                }
                if ((pos1 == 'left' || pos1 == 'right') && pos2 === undefined) {
                    pos2 = pos1;
                    pos1 = 'left';
                }
                childSettings.position = { x: 0, y: 0 };
                if (pos1 == 'center') {
                    //childSettings.anchor = { x: 0.5, y: 0.5 };
                    childSettings.position.x = (this._settings.width - childSettings.width) / 2;
                    childSettings.position.y = (this._settings.height - childSettings.height) / 2;
                }
                switch (pos1) {
                    case 'center':
                        childSettings.position.y = (this._settings.height - childSettings.height) / 2;
                        if (pos2 === undefined)
                            childSettings.position.x = (this._settings.width - childSettings.width) / 2;
                        break;
                    case 'bottom':
                        childSettings.position.y = this._settings.height - childSettings.height - this._settings.padding;
                        break;
                }
                switch (pos2) {
                    case 'center':
                        childSettings.position.x = (this._settings.width - childSettings.width) / 2;
                        break;
                    case 'right':
                        childSettings.position.x = this._settings.width - childSettings.width - this._settings.padding;
                        break;
                }
            }
            var child = EZGUI.create(childSettings, this.theme);
            return child;
        };
        /**
         *
         */
        GUISprite.prototype.setState = function (state) {
            if (state === void 0) { state = 'default'; }
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i];
                if (child instanceof EZGUI.MultistateSprite) {
                    child.setState(state);
                }
            }
        };
        GUISprite.prototype.animatePosTo = function (x, y, time, easing, callback) {
            if (time === void 0) { time = 1000; }
            if (easing === void 0) { easing = EZGUI.Easing.Linear.None; }
            easing = easing || EZGUI.Easing.Linear.None;
            if (typeof callback == 'function') {
                var tween = new EZGUI.Tween(this.position).to({ x: x, y: y }, time).easing(easing).onComplete(callback);
            }
            else {
                var tween = new EZGUI.Tween(this.position).to({ x: x, y: y }, time).easing(easing);
            }
            tween.start();
            return tween;
        };
        GUISprite.prototype.animateSizeTo = function (w, h, time, easing, callback) {
            if (time === void 0) { time = 1000; }
            if (easing === void 0) { easing = EZGUI.Easing.Linear.None; }
            easing = easing || EZGUI.Easing.Linear.None;
            if (typeof callback == 'function') {
                var tween = new EZGUI.Tween(this).to({ width: w, height: h }, time).easing(easing).onComplete(callback);
            }
            else {
                var tween = new EZGUI.Tween(this).to({ width: w, height: h }, time).easing(easing);
            }
            tween.start();
            return tween;
        };
        /**
         *
         */
        GUISprite.prototype.getFrameConfig = function (config, state) {
            var cfg = JSON.parse(JSON.stringify(config)); //if (cfg.texture instanceof PIXI.Texture) return cfg;
            if (typeof cfg == 'string') {
                cfg = { 'default': cfg };
            }
            var src = cfg[state] == null ? cfg['default'] : cfg[state];
            var texture;
            if (src.trim() != '')
                texture = PIXI.Texture.fromFrame(src);
            cfg.texture = texture;
            return cfg;
        };
        GUISprite.prototype.getComponentConfig = function (component, part, side, state) {
            //var ctype = this.theme[type] || this.theme['default'];
            var skin = this.theme.getSkin(component);
            if (!skin)
                return;
            var scale = (skin.scale == undefined) ? 1 : skin.scale;
            var rotation = 0;
            //get configuration, if explicit configuration is defined then use it otherwise use theme config
            //var hasSide = this.settings[component + '-' + side] || ctype[component + '-' + side];
            var cfg = this._settings[part + '-' + side] || skin[part + '-' + side] || this._settings[part] || skin[part];
            if (!cfg)
                return;
            if (skin[part] && !skin[part + '-' + side]) {
                switch (side) {
                    case 'tr':
                    case 'r':
                        rotation = 90 * Math.PI / 180;
                        break;
                    case 'bl':
                    case 'l':
                        rotation = -90 * Math.PI / 180;
                        break;
                    case 'br':
                    case 'b':
                        rotation = 180 * Math.PI / 180;
                        break;
                }
            }
            cfg = this.getFrameConfig(cfg, state);
            cfg.rotation = cfg.rotation != undefined ? cfg.rotation : rotation;
            cfg.scale = cfg.scale != undefined ? cfg.scale : scale;
            var bgPadding = this._settings['bgPadding'] != undefined ? this._settings['bgPadding'] : skin['bgPadding'];
            cfg.bgPadding = bgPadding != undefined ? bgPadding : 0;
            //cfg.hoverTexture = cfg.hover ? PIXI.Texture.fromFrame(cfg.hover) : cfg.texture;
            return cfg;
        };
        GUISprite.prototype.createThemeCorner = function (settings, part, side, state) {
            var component = settings.skin || settings.component || 'default';
            var cfg = this.getComponentConfig(component, part, side, state);
            if (!cfg || !cfg.texture)
                return;
            //var ctype = this.theme[type] || this.theme['default'];
            //var skin = this.theme.getSkin(component);
            var skin = settings;
            var hasSide = this._settings[part + '-' + side] || skin[part + '-' + side];
            //var sprite = new MultistateSprite(cfg.texture, cfg.textures);
            var sprite = new PIXI.Sprite(cfg.texture);
            sprite.rotation = cfg.rotation;
            sprite.scale.x = cfg.scale;
            sprite.scale.y = cfg.scale;
            switch (side) {
                case 'tl':
                    sprite.position.x = 0;
                    sprite.position.y = 0;
                    break;
                case 'tr':
                    sprite.position.x = settings.width;
                    sprite.position.y = 0;
                    break;
                case 'bl':
                    sprite.position.x = 0;
                    sprite.position.y = settings.height;
                    break;
                case 'br':
                    sprite.position.x = settings.width;
                    sprite.position.y = settings.height;
                    break;
            }
            //needed for specific corner sides : corner-tl corner-tr corner-bl corner-br
            if (hasSide) {
                if (sprite.position.y != 0)
                    sprite.anchor.y = 1;
                if (sprite.position.x != 0)
                    sprite.anchor.x = 1;
            }
            return sprite;
        };
        GUISprite.prototype.createThemeSide = function (settings, side, state) {
            var component = settings.component;
            var cfg = this.getComponentConfig(component, side, '', state);
            if (!cfg || !cfg.texture)
                return;
            //var sprite = new MultistateSprite(cfg.texture, cfg.textures);
            var sprite = new PIXI.Sprite(cfg.texture);
            //sprite.rotation = cfg.rotation;
            sprite.scale.x = cfg.scale;
            sprite.scale.y = cfg.scale;
            sprite.height = settings.height;
            switch (side) {
                case 'left':
                    sprite.position.x = 0;
                    sprite.position.y = 0;
                    break;
                case 'right':
                    sprite.position.x = settings.width;
                    sprite.position.y = 0;
                    break;
            }
            return sprite;
        };
        GUISprite.prototype.createThemeBorder = function (settings, part, side, state) {
            var component = settings.skin || settings.component || 'default';
            var cfg = this.getComponentConfig(component, part, side, state);
            if (!cfg || !cfg.texture)
                return;
            var tlCornerCfg = this.getComponentConfig(component, 'corner', 'tl', state);
            var blCornerCfg = this.getComponentConfig(component, 'corner', 'bl', state);
            if (!tlCornerCfg || !tlCornerCfg.texture)
                return;
            if (!blCornerCfg || !blCornerCfg.texture)
                return;
            //var ctype = this.theme[type] || this.theme['default'];
            //var ctype = this.theme.getSkin(component);
            var ctype = settings;
            var hasSide = this._settings[part + '-' + side] || ctype[part + '-' + side];
            var cwidth, cheight;
            var twidth, theight;
            switch (side) {
                case 't':
                case 'b':
                    cwidth = tlCornerCfg.texture.width * tlCornerCfg.scale;
                    cheight = blCornerCfg.texture.height * blCornerCfg.scale;
                    twidth = (settings.width - (cwidth * 2)) * 1 / cfg.scale;
                    theight = cfg.texture.height;
                    break;
                case 'r':
                case 'l':
                    cwidth = tlCornerCfg.texture.height * tlCornerCfg.scale;
                    twidth = (settings.height - (cwidth * 2)) * 1 / cfg.scale;
                    theight = cfg.texture.height;
                    if (hasSide) {
                        cheight = tlCornerCfg.texture.width * tlCornerCfg.scale;
                        twidth = tlCornerCfg.texture.width;
                        theight = (settings.height - (cwidth * 2)) * 1 / cfg.scale;
                    }
                    break;
            }
            //var cwidth = cornerCfg.texture.width * cornerCfg.scale;
            //var line: any = new MultistateTilingSprite(cfg.texture, twidth, theight, cfg.textures);
            var line = new EZGUI.Compatibility.TilingSprite(cfg.texture, twidth, theight);
            //phaser 2.4 compatibility /////////////////////////////////
            line.fixPhaser24();
            switch (side) {
                case 't':
                    line.position.x = cwidth;
                    line.position.y = 0;
                    break;
                case 'r':
                    line.position.y = cwidth;
                    if (!hasSide) {
                        line.position.x = settings.width - cwidth;
                        line.anchor.x = 0;
                        line.anchor.y = 1;
                    }
                    else {
                        line.position.x = settings.width;
                        line.anchor.x = 1;
                        line.anchor.y = 0;
                    }
                    break;
                case 'b':
                    line.position.x = cwidth;
                    if (!hasSide) {
                        line.position.y = settings.height - cwidth;
                        line.anchor.x = 1;
                        line.anchor.y = 1;
                    }
                    else {
                        line.position.y = settings.height - cheight;
                    }
                    break;
                case 'l':
                    line.position.y = cwidth;
                    if (!hasSide) {
                        line.anchor.x = 1;
                        line.anchor.y = 0;
                    }
                    else {
                        line.anchor.x = 0;
                        line.anchor.y = 0;
                    }
                    break;
            }
            line.scale.x = cfg.scale;
            line.scale.y = cfg.scale;
            line.rotation = cfg.rotation; //180 * Math.PI / 180;
            return line;
        };
        GUISprite.prototype.createThemeTilableBackground = function (settings, state) {
            var component = settings.skin || settings.component || 'default';
            var cfg = this.getComponentConfig(component, 'bg', null, state);
            if (!cfg || !cfg.texture)
                return;
            //cfg.bgPadding = 0;
            //var bg: any = new MultistateTilingSprite(cfg.texture, settings.width - cfg.bgPadding * 2, settings.height - cfg.bgPadding * 2, cfg.textures);
            var bg = new EZGUI.Compatibility.TilingSprite(cfg.texture, settings.width - cfg.bgPadding * 2, settings.height - cfg.bgPadding * 2);
            //phaser 2.4 compatibility /////////////////////////////////
            bg.fixPhaser24();
            ////////////////////////////////////////////////////////////
            bg.position.x = cfg.bgPadding;
            bg.position.y = cfg.bgPadding;
            if (settings.bgTiling) {
                if (settings.bgTiling == "x") {
                    bg.tileScale.y = (settings.height - cfg.bgPadding * 2) / cfg.texture.height;
                }
                if (settings.bgTiling == "y") {
                    bg.tileScale.x = (settings.width - cfg.bgPadding * 2) / cfg.texture.width;
                }
            }
            return bg;
        };
        GUISprite.prototype.createThemeBackground = function (settings, state, leftSide, rightSide) {
            var component = settings.skin || settings.component || 'default';
            var cfg = this.getComponentConfig(component, 'bg', null, state);
            if (!cfg || !cfg.texture)
                return;
            //cfg.bgPadding = 0;
            //var bg: any = new MultistateSprite(cfg.texture, cfg.textures);
            var bg = new PIXI.Sprite(cfg.texture);
            bg.position.x = leftSide.width;
            bg.position.y = 0;
            bg.scale.x = cfg.scale;
            bg.scale.y = cfg.scale;
            bg.width = settings.width - leftSide.width;
            bg.height = settings.height;
            return bg;
        };
        GUISprite.prototype.createThemeImage = function (settings, state, imagefield) {
            if (imagefield === void 0) { imagefield = 'image'; }
            var component = settings.skin || settings.component || 'default';
            //var ctype = this.theme[type] || this.theme['default'];
            var ctype = settings; //this.theme.getSkin(component);
            if (ctype[imagefield]) {
                var cfg = this.getFrameConfig(ctype[imagefield], state);
                //var img = new MultistateSprite(cfg.texture, cfg.textures);
                var img = new PIXI.Sprite(cfg.texture);
                img.width = settings.width;
                img.height = settings.height;
                return img;
            }
            return null;
        };
        GUISprite.prototype.createVisuals = function (settings, state) {
            if (settings.transparent === true)
                return [];
            //priority to image
            var img = this.createThemeImage(settings, state);
            if (img != null)
                return [img];
            var controls = [];
            var leftSide = this.createThemeSide(settings, 'left', state);
            var rightSide = this.createThemeSide(settings, 'right', state);
            var bg = this.createThemeTilableBackground(settings, state);
            if (bg)
                controls.push(bg);
            //if (!leftSide && !rightSide) {
            //    var bg = this.createThemeTilableBackground(settings, state);
            //    if (bg) controls.push(bg);
            //}
            //else {
            //    var bg = this.createThemeBackground(settings, state, leftSide);
            //    if (bg) controls.push(bg);
            //}
            if (leftSide) {
                controls.push(leftSide);
            }
            else {
                var tl = this.createThemeCorner(settings, 'corner', 'tl', state);
                if (tl)
                    controls.push(tl);
                var bl = this.createThemeCorner(settings, 'corner', 'bl', state);
                if (bl)
                    controls.push(bl);
                var lineLeft = this.createThemeBorder(settings, 'line', 'l', state);
                if (lineLeft)
                    controls.push(lineLeft);
            }
            if (rightSide) {
                controls.push(rightSide);
            }
            else {
                var tr = this.createThemeCorner(settings, 'corner', 'tr', state);
                if (tr)
                    controls.push(tr);
                var br = this.createThemeCorner(settings, 'corner', 'br', state);
                if (br)
                    controls.push(br);
                var lineRight = this.createThemeBorder(settings, 'line', 'r', state);
                if (lineRight)
                    controls.push(lineRight);
            }
            if (!leftSide && !rightSide) {
                var lineTop = this.createThemeBorder(settings, 'line', 't', state);
                if (lineTop)
                    controls.push(lineTop);
                var lineBottom = this.createThemeBorder(settings, 'line', 'b', state);
                if (lineBottom)
                    controls.push(lineBottom);
            }
            return controls;
        };
        return GUISprite;
    })(EZGUI.GUIObject);
    EZGUI.GUISprite = GUISprite;
    EZGUI.registerComponents(GUISprite, 'default');
})(EZGUI || (EZGUI = {}));
/// <reference path="../guisprite.ts" />
var EZGUI;
(function (EZGUI) {
    var Component;
    (function (Component) {
        var Input = (function (_super) {
            __extends(Input, _super);
            function Input(_settings, themeId) {
                _super.call(this, _settings, themeId);
                this._settings = _settings;
                this.themeId = themeId;
                if (_settings.text)
                    this.text = _settings.text;
            }
            Object.defineProperty(Input.prototype, "text", {
                get: function () {
                    if (this.domInput)
                        return this.domInput.value;
                    if (this.textObj)
                        return this.textObj.text;
                },
                set: function (val) {
                    if (this.domInput) {
                        var cpos = this.getCaretPosition();
                        this.domInput.value = val;
                        this.setCaretPosition(cpos);
                        this.setTextWithCaret(val);
                    }
                    if (this.textObj) {
                        this.textObj.text = val;
                    }
                },
                enumerable: true,
                configurable: true
            });
            Input.prototype.setTextWithCaret = function (val, event) {
                if (event === void 0) { event = null; }
                if (this.textObj) {
                    if (EZGUI.Compatibility.PIXIVersion == 3) {
                        this.textObj.text = val;
                    }
                    else {
                        this.textObj.setText(val);
                    }
                    if (this._settings.anchor) {
                        this.textObj.position.x = 0;
                        this.textObj.position.y = 0;
                        if (this.textObj.anchor) {
                            this.textObj.anchor.x = this._settings.anchor.x;
                            this.textObj.anchor.y = this._settings.anchor.y;
                        }
                        else {
                            //fake anchor for bitmap font
                            this.textObj.position.x -= this.textObj.width / 2;
                            this.textObj.position.y -= this.textObj.height / 2;
                        }
                    }
                    else {
                        this.textObj.position.x = (this._settings.width - this.textObj.width) / 2;
                        this.textObj.position.y = (this._settings.height - this.textObj.height) / 2;
                        if (this.textObj.anchor) {
                            this.textObj.anchor.x = 0;
                            this.textObj.anchor.y = 0;
                        }
                    }
                }
                //var cpos = this.getCaretPosition();
                //console.log('setting value ', val, cpos, val.substr(0, cpos - 1), val.substr(cpos));
                //this.domInput.value = val.substr(0, cpos - 1) + val.substr(cpos);
                this.textObj.position.x = 5;
                if (event)
                    this.emit('ezgui:change', event, this);
            };
            Input.prototype.draw = function () {
                _super.prototype.draw.call(this);
                this.guiMask = { width: 0, height: 0 };
                var settings = this._settings;
                if (settings) {
                    var padding = settings.padding || 0;
                    var myMask = new PIXI.Graphics();
                    myMask.beginFill();
                    myMask.drawRect(padding, padding, settings.width - padding * 2, settings.height - padding * 2);
                    myMask.endFill();
                    this.addChild(myMask);
                    if (this._settings.anchor) {
                        myMask.position.x = this.container.position.x + padding;
                        myMask.position.y = this.container.position.y + padding;
                    }
                    this.container.mask = myMask;
                    this.guiMask.x = padding;
                    this.guiMask.y = padding;
                    this.guiMask.width = settings.width - padding * 2;
                    this.guiMask.height = settings.height - padding * 2;
                }
                //move container back to the top
                this.addChild(this.container);
            };
            Input.prototype.drawText = function () {
                this._settings.text = this._settings.text || '';
                _super.prototype.drawText.call(this);
                this.textObj.position.x = 5;
                this.container.addChild(this.textObj);
                //this.textObj
            };
            Input.prototype.setupEvents = function () {
                _super.prototype.setupEvents.call(this);
                if (!EZGUI.Device.isMobile && document && document.createElement) {
                    this.domInput = document.createElement("input");
                    this.domInput.id = this.guiID + "_input";
                    this.domInput.style.position = 'absolute';
                    this.domInput.style.top = '-100px';
                    this.domInput.value = '';
                    document.body.appendChild(this.domInput);
                    var _this = this;
                    this.domInput.addEventListener('input', function (event) {
                        var cpos = _this.getCaretPosition();
                        var str = _this.domInput.value;
                        _this.setTextWithCaret(str.substr(0, cpos) + '|' + str.substr(cpos));
                        _this.setTextWithCaret(str, true);
                    });
                    this.domInput.addEventListener('keydown', function (event) {
                        var cpos = _this.getCaretPosition();
                        var str = _this.domInput.value;
                        _this.setTextWithCaret(str.substr(0, cpos) + '|' + str.substr(cpos));
                    });
                    this.domInput.addEventListener('keyup', function (event) {
                        var cpos = _this.getCaretPosition();
                        var str = _this.domInput.value;
                        _this.setTextWithCaret(str.substr(0, cpos) + '|' + str.substr(cpos));
                    });
                }
            };
            Input.prototype.handleEvents = function () {
                _super.prototype.handleEvents.call(this);
                var guiObj = this;
                var _this = this;
                if (EZGUI.Device.isMobile) {
                    guiObj.on('click', function (event) {
                        _this.setTextWithCaret(prompt('', _this.text), event);
                    });
                    return;
                }
                guiObj.on('focus', function () {
                    if (_this.focused)
                        return;
                    _this.focused = true;
                    if (!_this.domInput)
                        return;
                    _this.domInput.value = _this.text;
                    _this.setCaretPosition(_this.domInput.value.length);
                    var cpos = _this.getCaretPosition();
                    var str = _this.domInput.value;
                    _this.setTextWithCaret(str.substr(0, cpos) + '|' + str.substr(cpos));
                    _this.domInput.focus();
                });
                guiObj.on('blur', function () {
                    if (!_this.focused)
                        return;
                    _this.focused = false;
                    if (!_this.domInput)
                        return;
                    _this.setTextWithCaret(_this.domInput.value);
                    //_this.text = _this.text.substr(0, _this.text.length - 1);
                    _this.domInput.blur();
                });
            };
            Input.prototype.getCaretPosition = function () {
                var ctrl = this.domInput;
                if (!ctrl)
                    return 0;
                var CaretPos = 0;
                // IE Support
                if (document.selection) {
                    ctrl.focus();
                    var Sel = document.selection.createRange();
                    Sel.moveStart('character', -ctrl.value.length);
                    CaretPos = Sel.text.length;
                }
                else if (ctrl.selectionStart || ctrl.selectionStart == '0')
                    CaretPos = ctrl.selectionStart;
                return (CaretPos);
            };
            Input.prototype.setCaretPosition = function (pos) {
                var ctrl = this.domInput;
                if (!ctrl)
                    return 0;
                if (ctrl.setSelectionRange) {
                    ctrl.focus();
                    ctrl.setSelectionRange(pos, pos);
                }
                else if (ctrl.createTextRange) {
                    var range = ctrl.createTextRange();
                    range.collapse(true);
                    range.moveEnd('character', pos);
                    range.moveStart('character', pos);
                    range.select();
                }
            };
            return Input;
        })(EZGUI.GUISprite);
        Component.Input = Input;
        EZGUI.registerComponents(Input, 'Input');
    })(Component = EZGUI.Component || (EZGUI.Component = {}));
})(EZGUI || (EZGUI = {}));
/// <reference path="../guisprite.ts" />
var EZGUI;
(function (EZGUI) {
    var Component;
    (function (Component) {
        var Label = (function (_super) {
            __extends(Label, _super);
            function Label(_settings, themeId) {
                _super.call(this, _settings, themeId);
                this._settings = _settings;
                this.themeId = themeId;
                if (_settings.text)
                    this.text = _settings.text;
            }
            Label.prototype.setupEvents = function () {
                //clear events
            };
            Label.prototype.handleEvents = function () {
                //clear event handlers
            };
            Label.prototype.drawText = function () {
                this._settings.text = this._settings.text || '';
                _super.prototype.drawText.call(this);
            };
            Label.prototype.draw = function () {
                var settings = this._settings;
                if (settings) {
                    this.guiID = settings.id;
                    if (this.guiID)
                        EZGUI.components[this.guiID] = this;
                    this.position.x = settings.position.x;
                    this.position.y = settings.position.y;
                    this.rootSprite = new EZGUI.Compatibility.GUIContainer();
                    this.addChild(this.rootSprite);
                }
            };
            return Label;
        })(EZGUI.GUISprite);
        Component.Label = Label;
        EZGUI.registerComponents(Label, 'Label');
    })(Component = EZGUI.Component || (EZGUI.Component = {}));
})(EZGUI || (EZGUI = {}));
/// <reference path="../guisprite.ts" />
var EZGUI;
(function (EZGUI) {
    var Component;
    (function (Component) {
        var Slider = (function (_super) {
            __extends(Slider, _super);
            function Slider(_settings, themeId) {
                _super.call(this, _settings, themeId);
                this._settings = _settings;
                this.themeId = themeId;
            }
            Object.defineProperty(Slider.prototype, "value", {
                get: function () {
                    if (this.horizontalSlide) {
                        return this.slide.position.x / (this.width - this.slide.width);
                    }
                    else {
                        return 1 + this.slide.position.y / (this.slide.height - this.height);
                    }
                },
                set: function (val) {
                    val = Math.max(0, val);
                    val = Math.min(val, 1);
                    if (this.horizontalSlide) {
                        this.slide.position.x = val * (this.width - this.slide.width);
                    }
                    else {
                        this.slide.position.y = (val - 1) * (this.slide.height - this.height);
                    }
                },
                enumerable: true,
                configurable: true
            });
            Slider.prototype.setupEvents = function () {
                _super.prototype.setupEvents.call(this);
                var guiObj = this;
                var _this = this;
            };
            Slider.prototype.drawText = function () {
                //prevent text drawing
            };
            Slider.prototype.handleEvents = function () {
                _super.prototype.handleEvents.call(this);
                var guiObj = this;
                var _this = this;
                if (EZGUI.Compatibility.isPhaser) {
                    guiObj.on('mousemove', function () {
                    });
                    guiObj.on('mousedown', function (event, any) {
                        if (_this.canTrigger(event, _this.slide)) {
                            _this.slide.emit('ezgui:mousedown', event);
                        }
                    });
                    guiObj.on('mouseup', function () {
                        if (_this.canTrigger(event, _this.slide)) {
                            _this.slide.emit('ezgui:mouseup', event);
                        }
                    });
                    guiObj.on('mouseover', function () {
                    });
                    guiObj.on('mouseout', function () {
                    });
                }
                this.slide.on('mousemove', function () {
                    if (EZGUI.dragging == _this.slide) {
                        _this.emit('ezgui:value', _this.value);
                    }
                });
            };
            Slider.prototype.draw = function () {
                _super.prototype.draw.call(this);
                var cfg = this._settings.slide;
                cfg.component = 'Button';
                cfg.skin = 'Slide';
                cfg.position = { x: 0, y: 0 };
                cfg.draggable = true;
                //{ id: 'slide1', component: 'Button', position: { x: 0, y: 0 }, width: 30, height: this.height, draggable: true };
                var dir = this._settings.dir;
                if (this._settings.height > this._settings.width)
                    this._settings.dir = 'v';
                else
                    this._settings.dir = 'h';
                if (this._settings.dir == 'v') {
                    cfg.dragX = false;
                    this.horizontalSlide = false;
                }
                else {
                    cfg.dragY = false;
                    this.horizontalSlide = true;
                }
                this.slide = EZGUI.create(cfg, this.theme);
                this.slide.dragXInterval = [0, this.width - this.slide.width];
                this.slide.dragYInterval = [0, this.height - this.slide.height];
                this.value = 0;
                this.container.addChild(this.slide);
            };
            return Slider;
        })(EZGUI.GUISprite);
        Component.Slider = Slider;
        EZGUI.registerComponents(Slider, 'Slider');
    })(Component = EZGUI.Component || (EZGUI.Component = {}));
})(EZGUI || (EZGUI = {}));
var EZGUI;
(function (EZGUI) {
    var Device;
    (function (Device) {
        //Code taken from https://github.com/g13n/ua.js 
        var userAgent = (window.navigator && navigator.userAgent) || "";
        function detect(pattern) {
            return (pattern).test(userAgent);
        }
        /**
         * Return true if the browser is Chrome or compatible.
         *
         * @method isChrome
         */
        Device.isChrome = detect(/webkit\W.*(chrome|chromium)\W/i);
        /**
         * Return true if the browser is Firefox.
         *
         * @method isFirefox
         */
        Device.isFirefox = detect(/mozilla.*\Wfirefox\W/i);
        /**
         * Return true if the browser is using the Gecko engine.
         *
         * This is probably a better way to identify Firefox and other browsers
         * that use XulRunner.
         *
         * @method isGecko
         */
        Device.isGecko = detect(/mozilla(?!.*webkit).*\Wgecko\W/i);
        /**
         * Return true if the browser is Internet Explorer.
         *
         * @method isIE
         */
        Device.isIE = function () {
            if (navigator.appName === "Microsoft Internet Explorer") {
                return true;
            }
            else if (detect(/\bTrident\b/)) {
                return true;
            }
            else {
                return false;
            }
        };
        /**
         * Return true if the browser is running on Kindle.
         *
         * @method isKindle
         */
        Device.isKindle = detect(/\W(kindle|silk)\W/i);
        /**
         * Return true if the browser is running on a mobile device.
         *
         * @method isMobile
         */
        Device.isMobile = detect(/(iphone|ipod|((?:android)?.*?mobile)|blackberry|nokia)/i);
        /**
         * Return true if we are running on Opera.
         *
         * @method isOpera
         */
        Device.isOpera = detect(/opera.*\Wpresto\W|OPR/i);
        /**
         * Return true if the browser is Safari.
         *
         * @method isSafari
         */
        Device.isSafari = detect(/webkit\W(?!.*chrome).*safari\W/i);
        /**
         * Return true if the browser is running on a tablet.
         *
         * One way to distinguish Android mobiles from tablets is that the
         * mobiles contain the string "mobile" in their UserAgent string.
         * If the word "Android" isn't followed by "mobile" then its a
         * tablet.
         *
         * @method isTablet
         */
        Device.isTablet = detect(/(ipad|android(?!.*mobile)|tablet)/i);
        /**
         * Return true if the browser is running on a TV!
         *
         * @method isTV
         */
        Device.isTV = detect(/googletv|sonydtv/i);
        /**
         * Return true if the browser is running on a WebKit browser.
         *
         * @method isWebKit
         */
        Device.isWebKit = detect(/webkit\W/i);
        /**
         * Return true if the browser is running on an Android browser.
         *
         * @method isAndroid
         */
        Device.isAndroid = detect(/android/i);
        /**
         * Return true if the browser is running on any iOS device.
         *
         * @method isIOS
         */
        Device.isIOS = detect(/(ipad|iphone|ipod)/i);
        /**
         * Return true if the browser is running on an iPad.
         *
         * @method isIPad
         */
        Device.isIPad = detect(/ipad/i);
        /**
         * Return true if the browser is running on an iPhone.
         *
         * @method isIPhone
         */
        Device.isIPhone = detect(/iphone/i);
        /**
         * Return true if the browser is running on an iPod touch.
         *
         * @method isIPod
         */
        Device.isIPod = detect(/ipod/i);
        Device.isMobile = detect(/mobile/i) || Device.isAndroid || Device.isIOS;
        /**
         * Return the complete UserAgent string verbatim.
         *
         * @method whoami
         */
        Device.whoami = function () {
            return userAgent;
        };
    })(Device = EZGUI.Device || (EZGUI.Device = {}));
})(EZGUI || (EZGUI = {}));
/// <reference path="../guisprite.ts" />
var EZGUI;
(function (EZGUI) {
    var Component;
    (function (Component) {
        var Layout = (function (_super) {
            __extends(Layout, _super);
            function Layout(_settings, themeId) {
                _super.call(this, _settings, themeId);
                this._settings = _settings;
                this.themeId = themeId;
            }
            Layout.prototype.handleEvents = function () {
                _super.prototype.handleEvents.call(this);
            };
            Layout.prototype.draw = function () {
                _super.prototype.draw.call(this);
                this.guiMask = { width: 0, height: 0 };
                var settings = this._settings;
                if (settings) {
                    var padding = settings.padding || 0;
                    if (this._settings.mask !== false) {
                        var myMask = new PIXI.Graphics();
                        myMask.beginFill();
                        myMask.drawRect(padding, padding, settings.width - padding * 2, settings.height - padding * 2);
                        myMask.endFill();
                        this.addChild(myMask);
                        if (this._settings.anchor) {
                            myMask.position.x = this.container.position.x + padding;
                            myMask.position.y = this.container.position.y + padding;
                        }
                        this.container.mask = myMask;
                    }
                    this.guiMask.x = padding;
                    this.guiMask.y = padding;
                    this.guiMask.width = settings.width - padding * 2;
                    this.guiMask.height = settings.height - padding * 2;
                }
                //move container back to the top
                this.addChild(this.container);
            };
            Layout.prototype.createChild = function (childSettings, order) {
                if (!childSettings)
                    return null;
                var i = order;
                //console.log('adding ', i);
                var padTop = this._settings['padding-top'] || this._settings.padding || 0;
                var padLeft = this._settings['padding-left'] || this._settings.padding || 0;
                var swidth = this._settings.width - padLeft;
                var sheight = this._settings.height - padTop;
                var dx = padLeft;
                var dy = padTop;
                var lx = 1;
                var ly = 1;
                if (this._settings.layout != undefined) {
                    lx = this._settings.layout[0];
                    ly = this._settings.layout[1];
                    var x, y;
                    //horizontal layout 
                    if (ly == null) {
                        x = i;
                        y = 0;
                    }
                    else if (lx == null) {
                        x = 0;
                        y = i;
                    }
                    else {
                        var adjust = Math.floor(i / (lx * ly));
                        if (this._settings.dragY === false) {
                            dx += adjust * swidth;
                            dy -= adjust * sheight;
                        }
                        else if (this._settings.dragX === false) {
                        }
                        x = i % lx;
                        y = Math.floor(i / lx);
                    }
                    ly = ly || 1;
                    lx = lx || 1;
                    dx += x * (swidth / lx);
                    dy += y * (sheight / ly);
                }
                var pos = childSettings.position;
                if (typeof pos == 'string') {
                    var parts = pos.split(' ');
                    var pos1 = parts[0];
                    var pos2 = parts[1];
                    //normalize pos
                    if (parts[0] == parts[1]) {
                        pos2 = undefined;
                    }
                    if ((parts[0] == 'top' && parts[2] == 'bottom') || (parts[0] == 'bottom' && parts[2] == 'top') || (parts[0] == 'left' && parts[2] == 'right') || (parts[0] == 'right' && parts[2] == 'left')) {
                        pos1 = 'center';
                        pos2 = 'undefined';
                    }
                    if ((parts[0] == 'left' || parts[0] == 'right') && (parts[1] == 'top' || parts[1] == 'bottom')) {
                        pos1 = parts[1];
                        pos2 = parts[0];
                    }
                    if ((pos1 == 'left' || pos1 == 'right') && pos2 === undefined) {
                        pos2 = pos1;
                        pos1 = 'left';
                    }
                    childSettings.position = { x: dx, y: dy };
                    switch (pos1) {
                        case 'center':
                            childSettings.position.y = dy + (this._settings.height / ly) / 2 - childSettings.height / 2;
                            if (pos2 === undefined)
                                childSettings.position.x = dx + (this._settings.width / lx) / 2 - childSettings.width / 2;
                            break;
                        case 'bottom':
                            childSettings.position.y = dy + (this._settings.height / ly) - childSettings.height - this._settings.padding;
                            break;
                    }
                    switch (pos2) {
                        case 'center':
                            childSettings.position.x = dx + (this._settings.width / lx) / 2 - childSettings.width / 2;
                            break;
                        case 'right':
                            childSettings.position.x = dx + (this._settings.width / lx) - childSettings.width - this._settings.padding;
                            break;
                    }
                }
                else {
                    childSettings.position.x = dx + childSettings.position.x;
                    childSettings.position.y = dy + childSettings.position.y;
                }
                //console.log(' >> ', dx.toFixed(2), dy.toFixed(2), childSettings.position.x.toFixed(2), childSettings.position.y.toFixed(2));
                var child = EZGUI.create(childSettings, this.theme);
                return child;
            };
            Layout.prototype.addChild = function (child) {
                if (child instanceof EZGUI.GUISprite) {
                    return this.addChildAt(child, this.container.children.length);
                }
                else {
                    return _super.prototype.addChild.call(this, child);
                }
            };
            Layout.prototype.addChildAt = function (child, index) {
                if (child instanceof EZGUI.GUISprite) {
                    var i = index;
                    //console.log('adding ', i);
                    var padTop = this._settings['padding-top'] || this._settings.padding || 0;
                    var padLeft = this._settings['padding-left'] || this._settings.padding || 0;
                    var swidth = this._settings.width - padLeft;
                    var sheight = this._settings.height - padTop;
                    var dx = padLeft;
                    var dy = padTop;
                    var lx = 1;
                    var ly = 1;
                    if (this._settings.layout != undefined) {
                        lx = this._settings.layout[0];
                        ly = this._settings.layout[1];
                        var x, y;
                        //horizontal layout 
                        if (ly == null) {
                            x = i;
                            y = 0;
                        }
                        else if (lx == null) {
                            x = 0;
                            y = i;
                        }
                        else {
                            var adjust = Math.floor(i / (lx * ly));
                            if (this._settings.dragY === false) {
                                dx += adjust * swidth;
                                dy -= adjust * sheight;
                            }
                            else if (this._settings.dragX === false) {
                            }
                            x = i % lx;
                            y = Math.floor(i / lx);
                        }
                        ly = ly || 1;
                        lx = lx || 1;
                        dx += x * (swidth / lx);
                        dy += y * (sheight / ly);
                    }
                    var childSettings = child._settings;
                    var pos = childSettings.position;
                    if (typeof pos == 'string') {
                        var parts = pos.split(' ');
                        var pos1 = parts[0];
                        var pos2 = parts[1];
                        //normalize pos
                        if (parts[0] == parts[1]) {
                            pos2 = undefined;
                        }
                        if ((parts[0] == 'top' && parts[2] == 'bottom') || (parts[0] == 'bottom' && parts[2] == 'top') || (parts[0] == 'left' && parts[2] == 'right') || (parts[0] == 'right' && parts[2] == 'left')) {
                            pos1 = 'center';
                            pos2 = 'undefined';
                        }
                        if ((parts[0] == 'left' || parts[0] == 'right') && (parts[1] == 'top' || parts[1] == 'bottom')) {
                            pos1 = parts[1];
                            pos2 = parts[0];
                        }
                        if ((pos1 == 'left' || pos1 == 'right') && pos2 === undefined) {
                            pos2 = pos1;
                            pos1 = 'left';
                        }
                        childSettings.position = { x: dx, y: dy };
                        switch (pos1) {
                            case 'center':
                                childSettings.position.y = dy + (this._settings.height / ly) / 2 - childSettings.height / 2;
                                if (pos2 === undefined)
                                    childSettings.position.x = dx + (this._settings.width / lx) / 2 - childSettings.width / 2;
                                break;
                            case 'bottom':
                                childSettings.position.y = dy + (this._settings.height / ly) - childSettings.height - this._settings.padding;
                                break;
                        }
                        switch (pos2) {
                            case 'center':
                                childSettings.position.x = dx + (this._settings.width / lx) / 2 - childSettings.width / 2;
                                break;
                            case 'right':
                                childSettings.position.x = dx + (this._settings.width / lx) - childSettings.width - this._settings.padding;
                                break;
                        }
                    }
                    else {
                        childSettings.position.x = dx + childSettings.position.x;
                        childSettings.position.y = dy + childSettings.position.y;
                    }
                    child.position.x = childSettings.position.x;
                    child.position.y = childSettings.position.y;
                    child.guiParent = this;
                    if (child.phaserGroup)
                        return this.container.addChild(child.phaserGroup);
                    else
                        return this.container.addChild(child);
                }
                else {
                    //return Compatibility.GUIDisplayObjectContainer.prototype.addChild.call(this, child, index);
                    return _super.prototype.addChildAt.call(this, child, index);
                }
            };
            return Layout;
        })(EZGUI.GUISprite);
        Component.Layout = Layout;
        EZGUI.registerComponents(Layout, 'Layout');
    })(Component = EZGUI.Component || (EZGUI.Component = {}));
})(EZGUI || (EZGUI = {}));
/// <reference path="layout.ts" />
var EZGUI;
(function (EZGUI) {
    var Component;
    (function (Component) {
        var Window = (function (_super) {
            __extends(Window, _super);
            function Window(_settings, themeId) {
                _super.call(this, _settings, themeId);
                this._settings = _settings;
                this.themeId = themeId;
            }
            Window.prototype.draw = function () {
                var headerCfg = this._settings.header;
                if (headerCfg) {
                    headerCfg.height = headerCfg.height || 0;
                    headerCfg.skin = headerCfg.skin || 'Header';
                    this._settings['padding-top'] = headerCfg.height;
                }
                _super.prototype.draw.call(this);
                if (headerCfg) {
                    //this.position.y += headerCfg.height;
                    if (headerCfg.width == undefined)
                        headerCfg.width = this._settings.width;
                    this.titleBar = new EZGUI.GUISprite(headerCfg, this.theme);
                    //this.titleBar.position.y -= headerCfg.height - this.settings.padding*2;
                    this.originalAddChild(this.titleBar);
                }
            };
            Window.prototype.handleEvents = function () {
                _super.prototype.handleEvents.call(this);
                if (this._settings.draggable) {
                    //if (this.titleBar) this.draghandle = this.titleBar;
                    //else this.draghandle = this;
                    //this.draggable = this;
                    this.setDraggable(true);
                }
            };
            Window.prototype.setDraggable = function (val) {
                if (val === void 0) { val = true; }
                if (val) {
                    this.draggable = this;
                    if (this.titleBar)
                        this.draghandle = this.titleBar;
                    else
                        this.draghandle = this;
                }
                else {
                    this.draggable = undefined;
                    this.draghandle = undefined;
                }
            };
            return Window;
        })(Component.Layout);
        Component.Window = Window;
        EZGUI.registerComponents(Window, 'Window');
    })(Component = EZGUI.Component || (EZGUI.Component = {}));
})(EZGUI || (EZGUI = {}));
/// <reference path="../components/window.ts" />
var EZGUI;
(function (EZGUI) {
    var Kit;
    (function (Kit) {
        var MainScreen = (function (_super) {
            __extends(MainScreen, _super);
            function MainScreen(_settings, themeId) {
                _super.call(this, _settings, themeId);
                this._settings = _settings;
                this.themeId = themeId;
                //this.parseSettings();
            }
            MainScreen.prototype.parseSettings = function () {
                var txCache = EZGUI.Compatibility.PIXIVersion >= 3 ? PIXI.utils.TextureCache : PIXI.TextureCache;
                //parse logo
                if (this._settings.logo) {
                    if (typeof this._settings.logo == 'string') {
                        if (txCache[this._settings.logo]) {
                            var tx = txCache[this._settings.logo];
                            var px = (this._settings.width - tx.width) / 2;
                            this._settings.header = { position: { x: px, y: 0 }, image: this._settings.logo, height: tx.height, width: tx.width };
                        }
                    }
                    else {
                        this._settings.header = this._settings.logo;
                    }
                }
                //parse buttons
                if (this._settings.buttons && this._settings.buttons.length > 0) {
                    this.buttonsEvents = {};
                    var children = [];
                    var maxHeight = 1;
                    for (var i = 0; i < this._settings.buttons.length; i++) {
                        var btn = this._settings.buttons[i];
                        if (btn) {
                            btn.component = 'Button';
                            btn.id = this._settings.id + '-btn-' + i;
                            btn.position = btn.position || 'center';
                            if (maxHeight < btn.height)
                                maxHeight = btn.height;
                            if (btn.event) {
                                this.buttonsEvents[btn.id] = btn.event;
                            }
                        }
                        children.push(btn);
                    }
                    var yParts = Math.floor((this._settings.height - this._settings.header.height) / (maxHeight * 1.1));
                    this._settings.layout = [1, yParts];
                    this._settings.children = children;
                }
                this._settings = this.theme.applySkin(this._settings);
            };
            MainScreen.prototype.handleEvents = function () {
                _super.prototype.handleEvents.call(this);
                var _this = this;
                this.bindChildren('click', function (event, btn) {
                    if (_this.buttonsEvents && _this.buttonsEvents[btn.Id]) {
                        _this.emit('ezgui:' + _this.buttonsEvents[btn.Id], event, btn);
                    }
                });
            };
            return MainScreen;
        })(EZGUI.Component.Window);
        Kit.MainScreen = MainScreen;
        EZGUI.registerComponents(MainScreen, 'MainScreen');
    })(Kit = EZGUI.Kit || (EZGUI.Kit = {}));
})(EZGUI || (EZGUI = {}));
// (c) Dean McNamee <dean@gmail.com>, 2012.
//
// https://github.com/deanm/css-color-parser-js
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.
// http://www.w3.org/TR/css3-color/
var EZGUI;
(function (EZGUI) {
    var utils;
    (function (utils) {
        var ColorParser;
        (function (ColorParser) {
            var kCSSColorTable = {
                "transparent": [0, 0, 0, 0],
                "aliceblue": [240, 248, 255, 1],
                "antiquewhite": [250, 235, 215, 1],
                "aqua": [0, 255, 255, 1],
                "aquamarine": [127, 255, 212, 1],
                "azure": [240, 255, 255, 1],
                "beige": [245, 245, 220, 1],
                "bisque": [255, 228, 196, 1],
                "black": [0, 0, 0, 1],
                "blanchedalmond": [255, 235, 205, 1],
                "blue": [0, 0, 255, 1],
                "blueviolet": [138, 43, 226, 1],
                "brown": [165, 42, 42, 1],
                "burlywood": [222, 184, 135, 1],
                "cadetblue": [95, 158, 160, 1],
                "chartreuse": [127, 255, 0, 1],
                "chocolate": [210, 105, 30, 1],
                "coral": [255, 127, 80, 1],
                "cornflowerblue": [100, 149, 237, 1],
                "cornsilk": [255, 248, 220, 1],
                "crimson": [220, 20, 60, 1],
                "cyan": [0, 255, 255, 1],
                "darkblue": [0, 0, 139, 1],
                "darkcyan": [0, 139, 139, 1],
                "darkgoldenrod": [184, 134, 11, 1],
                "darkgray": [169, 169, 169, 1],
                "darkgreen": [0, 100, 0, 1],
                "darkgrey": [169, 169, 169, 1],
                "darkkhaki": [189, 183, 107, 1],
                "darkmagenta": [139, 0, 139, 1],
                "darkolivegreen": [85, 107, 47, 1],
                "darkorange": [255, 140, 0, 1],
                "darkorchid": [153, 50, 204, 1],
                "darkred": [139, 0, 0, 1],
                "darksalmon": [233, 150, 122, 1],
                "darkseagreen": [143, 188, 143, 1],
                "darkslateblue": [72, 61, 139, 1],
                "darkslategray": [47, 79, 79, 1],
                "darkslategrey": [47, 79, 79, 1],
                "darkturquoise": [0, 206, 209, 1],
                "darkviolet": [148, 0, 211, 1],
                "deeppink": [255, 20, 147, 1],
                "deepskyblue": [0, 191, 255, 1],
                "dimgray": [105, 105, 105, 1],
                "dimgrey": [105, 105, 105, 1],
                "dodgerblue": [30, 144, 255, 1],
                "firebrick": [178, 34, 34, 1],
                "floralwhite": [255, 250, 240, 1],
                "forestgreen": [34, 139, 34, 1],
                "fuchsia": [255, 0, 255, 1],
                "gainsboro": [220, 220, 220, 1],
                "ghostwhite": [248, 248, 255, 1],
                "gold": [255, 215, 0, 1],
                "goldenrod": [218, 165, 32, 1],
                "gray": [128, 128, 128, 1],
                "green": [0, 128, 0, 1],
                "greenyellow": [173, 255, 47, 1],
                "grey": [128, 128, 128, 1],
                "honeydew": [240, 255, 240, 1],
                "hotpink": [255, 105, 180, 1],
                "indianred": [205, 92, 92, 1],
                "indigo": [75, 0, 130, 1],
                "ivory": [255, 255, 240, 1],
                "khaki": [240, 230, 140, 1],
                "lavender": [230, 230, 250, 1],
                "lavenderblush": [255, 240, 245, 1],
                "lawngreen": [124, 252, 0, 1],
                "lemonchiffon": [255, 250, 205, 1],
                "lightblue": [173, 216, 230, 1],
                "lightcoral": [240, 128, 128, 1],
                "lightcyan": [224, 255, 255, 1],
                "lightgoldenrodyellow": [250, 250, 210, 1],
                "lightgray": [211, 211, 211, 1],
                "lightgreen": [144, 238, 144, 1],
                "lightgrey": [211, 211, 211, 1],
                "lightpink": [255, 182, 193, 1],
                "lightsalmon": [255, 160, 122, 1],
                "lightseagreen": [32, 178, 170, 1],
                "lightskyblue": [135, 206, 250, 1],
                "lightslategray": [119, 136, 153, 1],
                "lightslategrey": [119, 136, 153, 1],
                "lightsteelblue": [176, 196, 222, 1],
                "lightyellow": [255, 255, 224, 1],
                "lime": [0, 255, 0, 1],
                "limegreen": [50, 205, 50, 1],
                "linen": [250, 240, 230, 1],
                "magenta": [255, 0, 255, 1],
                "maroon": [128, 0, 0, 1],
                "mediumaquamarine": [102, 205, 170, 1],
                "mediumblue": [0, 0, 205, 1],
                "mediumorchid": [186, 85, 211, 1],
                "mediumpurple": [147, 112, 219, 1],
                "mediumseagreen": [60, 179, 113, 1],
                "mediumslateblue": [123, 104, 238, 1],
                "mediumspringgreen": [0, 250, 154, 1],
                "mediumturquoise": [72, 209, 204, 1],
                "mediumvioletred": [199, 21, 133, 1],
                "midnightblue": [25, 25, 112, 1],
                "mintcream": [245, 255, 250, 1],
                "mistyrose": [255, 228, 225, 1],
                "moccasin": [255, 228, 181, 1],
                "navajowhite": [255, 222, 173, 1],
                "navy": [0, 0, 128, 1],
                "oldlace": [253, 245, 230, 1],
                "olive": [128, 128, 0, 1],
                "olivedrab": [107, 142, 35, 1],
                "orange": [255, 165, 0, 1],
                "orangered": [255, 69, 0, 1],
                "orchid": [218, 112, 214, 1],
                "palegoldenrod": [238, 232, 170, 1],
                "palegreen": [152, 251, 152, 1],
                "paleturquoise": [175, 238, 238, 1],
                "palevioletred": [219, 112, 147, 1],
                "papayawhip": [255, 239, 213, 1],
                "peachpuff": [255, 218, 185, 1],
                "peru": [205, 133, 63, 1],
                "pink": [255, 192, 203, 1],
                "plum": [221, 160, 221, 1],
                "powderblue": [176, 224, 230, 1],
                "purple": [128, 0, 128, 1],
                "red": [255, 0, 0, 1],
                "rosybrown": [188, 143, 143, 1],
                "royalblue": [65, 105, 225, 1],
                "saddlebrown": [139, 69, 19, 1],
                "salmon": [250, 128, 114, 1],
                "sandybrown": [244, 164, 96, 1],
                "seagreen": [46, 139, 87, 1],
                "seashell": [255, 245, 238, 1],
                "sienna": [160, 82, 45, 1],
                "silver": [192, 192, 192, 1],
                "skyblue": [135, 206, 235, 1],
                "slateblue": [106, 90, 205, 1],
                "slategray": [112, 128, 144, 1],
                "slategrey": [112, 128, 144, 1],
                "snow": [255, 250, 250, 1],
                "springgreen": [0, 255, 127, 1],
                "steelblue": [70, 130, 180, 1],
                "tan": [210, 180, 140, 1],
                "teal": [0, 128, 128, 1],
                "thistle": [216, 191, 216, 1],
                "tomato": [255, 99, 71, 1],
                "turquoise": [64, 224, 208, 1],
                "violet": [238, 130, 238, 1],
                "wheat": [245, 222, 179, 1],
                "white": [255, 255, 255, 1],
                "whitesmoke": [245, 245, 245, 1],
                "yellow": [255, 255, 0, 1],
                "yellowgreen": [154, 205, 50, 1]
            };
            function clamp_css_byte(i) {
                i = Math.round(i); // Seems to be what Chrome does (vs truncation).
                return i < 0 ? 0 : i > 255 ? 255 : i;
            }
            function clamp_css_float(f) {
                return f < 0 ? 0 : f > 1 ? 1 : f;
            }
            function parse_css_int(str) {
                if (str[str.length - 1] === '%')
                    return clamp_css_byte(parseFloat(str) / 100 * 255);
                return clamp_css_byte(parseInt(str));
            }
            function parse_css_float(str) {
                if (str[str.length - 1] === '%')
                    return clamp_css_float(parseFloat(str) / 100);
                return clamp_css_float(parseFloat(str));
            }
            function css_hue_to_rgb(m1, m2, h) {
                if (h < 0)
                    h += 1;
                else if (h > 1)
                    h -= 1;
                if (h * 6 < 1)
                    return m1 + (m2 - m1) * h * 6;
                if (h * 2 < 1)
                    return m2;
                if (h * 3 < 2)
                    return m1 + (m2 - m1) * (2 / 3 - h) * 6;
                return m1;
            }
            function parseToPixiColor(str) {
                var rgb = parseToRGB(str);
                if (!rgb)
                    return -1;
                var intRGB = rgb[0];
                intRGB = (intRGB << 8) + rgb[1];
                intRGB = (intRGB << 8) + rgb[2];
                return intRGB;
            }
            ColorParser.parseToPixiColor = parseToPixiColor;
            function parseToRGB(str) {
                // Remove all whitespace, not compliant, but should just be more accepting.
                var str = str.replace(/ /g, '').toLowerCase();
                // Color keywords (and transparent) lookup.
                if (str in kCSSColorTable)
                    return kCSSColorTable[str].slice(); // dup.
                // #abc and #abc123 syntax.
                if (str[0] === '#') {
                    if (str.length === 4) {
                        var iv = parseInt(str.substr(1), 16); // TODO(deanm): Stricter parsing.
                        if (!(iv >= 0 && iv <= 0xfff))
                            return null; // Covers NaN.
                        return [((iv & 0xf00) >> 4) | ((iv & 0xf00) >> 8), (iv & 0xf0) | ((iv & 0xf0) >> 4), (iv & 0xf) | ((iv & 0xf) << 4), 1];
                    }
                    else if (str.length === 7) {
                        var iv = parseInt(str.substr(1), 16); // TODO(deanm): Stricter parsing.
                        if (!(iv >= 0 && iv <= 0xffffff))
                            return null; // Covers NaN.
                        return [(iv & 0xff0000) >> 16, (iv & 0xff00) >> 8, iv & 0xff, 1];
                    }
                    return null;
                }
                var op = str.indexOf('('), ep = str.indexOf(')');
                if (op !== -1 && ep + 1 === str.length) {
                    var fname = str.substr(0, op);
                    var params = str.substr(op + 1, ep - (op + 1)).split(',');
                    var alpha = 1; // To allow case fallthrough.
                    switch (fname) {
                        case 'rgba':
                            if (params.length !== 4)
                                return null;
                            alpha = parse_css_float(params.pop());
                        case 'rgb':
                            if (params.length !== 3)
                                return null;
                            return [parse_css_int(params[0]), parse_css_int(params[1]), parse_css_int(params[2]), alpha];
                        case 'hsla':
                            if (params.length !== 4)
                                return null;
                            alpha = parse_css_float(params.pop());
                        case 'hsl':
                            if (params.length !== 3)
                                return null;
                            var h = (((parseFloat(params[0]) % 360) + 360) % 360) / 360; // 0 .. 1
                            // NOTE(deanm): According to the CSS spec s/l should only be
                            // percentages, but we don't bother and let float or percentage.
                            var s = parse_css_float(params[1]);
                            var l = parse_css_float(params[2]);
                            var m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
                            var m1 = l * 2 - m2;
                            return [clamp_css_byte(css_hue_to_rgb(m1, m2, h + 1 / 3) * 255), clamp_css_byte(css_hue_to_rgb(m1, m2, h) * 255), clamp_css_byte(css_hue_to_rgb(m1, m2, h - 1 / 3) * 255), alpha];
                        default:
                            return null;
                    }
                }
                return null;
            }
            ColorParser.parseToRGB = parseToRGB;
        })(ColorParser = utils.ColorParser || (utils.ColorParser = {}));
    })(utils = EZGUI.utils || (EZGUI.utils = {}));
})(EZGUI || (EZGUI = {}));
/// <reference path="../guisprite.ts" />
var EZGUI;
(function (EZGUI) {
    var Component;
    (function (Component) {
        var Button = (function (_super) {
            __extends(Button, _super);
            function Button(_settings, themeId) {
                _super.call(this, _settings, themeId);
                this._settings = _settings;
                this.themeId = themeId;
                if (_settings.text)
                    this.text = _settings.text;
            }
            Button.prototype.handleEvents = function () {
                _super.prototype.handleEvents.call(this);
                var guiObj = this;
                var _this = this;
                var isDown = false;
                guiObj.on('mousemove', function () {
                });
                guiObj.on('mousedown', function () {
                    isDown = true;
                    //console.log('down', _this.guiID);
                    guiObj.setState('down');
                });
                guiObj.on('mouseup', function () {
                    isDown = false;
                    //console.log('up', _this.guiID);
                    guiObj.setState('default');
                });
                guiObj.on('mouseover', function () {
                    //console.log('hover', _this.guiID);
                    if (!isDown)
                        guiObj.setState('hover');
                });
                guiObj.on('mouseout', function () {
                    //console.log('out', _this.guiID);
                    //EZGUI.dragging = null;
                    //temporary workaround for phaser
                    if (!EZGUI.Compatibility.isPhaser) {
                        isDown = false;
                        guiObj.setState('default');
                    }
                });
            };
            return Button;
        })(EZGUI.GUISprite);
        Component.Button = Button;
        EZGUI.registerComponents(Button, 'Button');
    })(Component = EZGUI.Component || (EZGUI.Component = {}));
})(EZGUI || (EZGUI = {}));
/// <reference path="../guisprite.ts" />
var EZGUI;
(function (EZGUI) {
    var Component;
    (function (Component) {
        var Checkbox = (function (_super) {
            __extends(Checkbox, _super);
            function Checkbox(_settings, themeId) {
                _super.call(this, _settings, themeId);
                this._settings = _settings;
                this.themeId = themeId;
            }
            Object.defineProperty(Checkbox.prototype, "checked", {
                //Getter & setter for check state
                get: function () {
                    return this._checked;
                },
                set: function (chk) {
                    if (chk) {
                        this.setState('checked');
                        if (this._checkmark)
                            this._checkmark.visible = true;
                    }
                    else {
                        this.setState('default');
                        if (this._checkmark)
                            this._checkmark.visible = false;
                    }
                    this._checked = chk;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Checkbox.prototype, "text", {
                //Getter & setter for text vakue which need to be placed on the right
                get: function () {
                    if (this.textObj)
                        return this.textObj.text;
                },
                set: function (val) {
                    if (this.textObj) {
                        this.textObj.text = val;
                        if (this._settings.anchor) {
                            this.textObj.position.x = 0;
                            this.textObj.position.y = 0;
                            this.textObj.anchor.x = this._settings.anchor.x;
                            this.textObj.anchor.y = this._settings.anchor.y;
                        }
                        else {
                            this.textObj.position.x = this._settings.width;
                            this.textObj.position.y = (this._settings.height) / 2 - this.textObj.height / 2.5;
                            this.textObj.anchor.x = 0;
                            this.textObj.anchor.y = 0;
                        }
                    }
                },
                enumerable: true,
                configurable: true
            });
            Checkbox.prototype.handleEvents = function () {
                _super.prototype.handleEvents.call(this);
                var guiObj = this;
                var _this = this;
                var _this = this;
                var guiObj = this;
                guiObj.on('mouseover', function (event) {
                    //guiObj.alpha = 0.7;
                });
                //clear parent event
                guiObj.off('mouseout');
                guiObj.on('mouseout', function () {
                    //prevent state clear
                    //if (_this.checked) {
                    //    _this.setState('checked');
                    //}
                    //guiObj.alpha = 1;
                });
                guiObj.on('click', function () {
                    _this.checked = !_this.checked;
                });
            };
            Checkbox.prototype.draw = function () {
                _super.prototype.draw.call(this);
                this._checkmark = this.createThemeImage(this._settings, 'default', 'checkmark');
                if (this._checkmark != null) {
                    this.addChild(this._checkmark);
                    this._checkmark.visible = false;
                    this._checkmark.width = this._settings.width;
                    this._checkmark.height = this._settings.height;
                    if (this._settings.anchor) {
                        this._checkmark.anchor.x = this._settings.anchor.x;
                        this._checkmark.anchor.y = this._settings.anchor.y;
                    }
                }
            };
            Checkbox.prototype.drawText = function () {
                _super.prototype.drawText.call(this);
                if (this.textObj) {
                    this.textObj.position.x = this._settings.width;
                    this.textObj.position.y = (this._settings.height) / 2 - this.textObj.height / 2.5;
                }
            };
            return Checkbox;
        })(Component.Button);
        Component.Checkbox = Checkbox;
        EZGUI.registerComponents(Checkbox, 'Checkbox');
    })(Component = EZGUI.Component || (EZGUI.Component = {}));
})(EZGUI || (EZGUI = {}));
/// <reference path="checkbox.ts" />
var EZGUI;
(function (EZGUI) {
    var Component;
    (function (Component) {
        var Radio = (function (_super) {
            __extends(Radio, _super);
            function Radio(_settings, themeId) {
                _super.call(this, _settings, themeId);
                this._settings = _settings;
                this.themeId = themeId;
                this.group = null;
                this.group = _settings.group;
                if (!EZGUI.radioGroups[this.group])
                    EZGUI.radioGroups[this.group] = [];
                EZGUI.radioGroups[this.group].push(this);
                if (this._settings.checked === true)
                    this.checked = true;
            }
            Object.defineProperty(Radio, "groups", {
                //static groups: any = {};
                //static selectedFrom: any = {};
                get: function () {
                    return EZGUI.radioGroups;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Radio.prototype, "checked", {
                get: function () {
                    return this._checked;
                },
                set: function (chk) {
                    if (chk) {
                        this.clearGroup();
                        this.setState('checked');
                        if (this._checkmark)
                            this._checkmark.visible = true;
                    }
                    else {
                        this.setState('default');
                        if (this._checkmark)
                            this._checkmark.visible = false;
                    }
                    this._checked = chk;
                    EZGUI.radioGroups[this.group].selected = this;
                },
                enumerable: true,
                configurable: true
            });
            Radio.prototype.clearGroup = function () {
                if (!EZGUI.radioGroups[this.group])
                    return;
                for (var i = 0; i < EZGUI.radioGroups[this.group].length; i++) {
                    EZGUI.radioGroups[this.group][i].checked = false;
                }
            };
            Radio.prototype.handleEvents = function () {
                _super.prototype.handleEvents.call(this);
                var _this = this;
                //clear default action
                _this.off('click');
                _this.on('click', function (event) {
                    _this.checked = true;
                    _this.emit('ezgui:checked', event, _this);
                });
            };
            Radio.prototype.draw = function () {
                _super.prototype.draw.call(this);
            };
            return Radio;
        })(Component.Checkbox);
        Component.Radio = Radio;
        EZGUI.registerComponents(Radio, 'Radio');
    })(Component = EZGUI.Component || (EZGUI.Component = {}));
})(EZGUI || (EZGUI = {}));
var EZGUI;
(function (EZGUI) {
    var Component;
    (function (Component) {
        var List = (function (_super) {
            __extends(List, _super);
            function List(_settings, themeId) {
                _super.call(this, _settings, themeId);
                this._settings = _settings;
                this.themeId = themeId;
                //this.draghandle = this.uichildren['sbtn1'];
            }
            List.prototype.handleEvents = function () {
                var _this = this;
                var ssize;
                this.draggable = this.container;
                if (_this._settings.dragY === false || (this._settings.layout && this._settings.layout[1] == null)) {
                    this.dragConstraint = 'x';
                    this.horizontalSlide = true;
                    this.slotSize = (this._settings.width / this._settings.layout[0]);
                }
                if (_this._settings.dragX === false || (this._settings.layout && this._settings.layout[0] == null)) {
                    this.dragConstraint = 'y';
                    this.horizontalSlide = false;
                    this.slotSize = (this._settings.height / this._settings.layout[1]);
                }
                if (this._settings.layout && this._settings.layout[0] != null && this._settings.layout[1] != null) {
                    if (_this._settings.dragY === false) {
                        this.slotSize = this.slotSize / this._settings.layout[1];
                    }
                    if (_this._settings.dragX === false) {
                        this.slotSize = this.slotSize / this._settings.layout[0];
                    }
                }
                //console.log(' >>>> ', this.draggable.width, this._settings.width);
                ssize = this.slotSize * this.container.children.length;
                this.dragXInterval[0] = -ssize + this._settings.width * 0.5;
                this.dragXInterval[1] = this._settings.width * 0.2;
                this.dragYInterval[0] = -ssize + this._settings.height * 0.5;
                this.dragYInterval[1] = this._settings.height * 0.2;
                _super.prototype.handleEvents.call(this);
                _this.on('mousedown', function (event) {
                    if (_this.decelerationItv) {
                        clearInterval(_this.decelerationItv);
                        _this.decelerationItv = null;
                    }
                    for (var i = 0; i < _this.container.children.length; i++) {
                        var child = _this.container.children[i];
                        if (!(child instanceof EZGUI.GUISprite))
                            continue;
                        if (!child.mouseInObj(event, child))
                            continue;
                        if (!child.canTrigger(event, child))
                            continue;
                        child.emit('ezgui:mousedown', event);
                    }
                });
                _this.on('mouseup', function (event) {
                    if (_this.decelerationItv)
                        return;
                    var endPos = EZGUI.utils.getRealPos(event);
                    //console.log('slide end ', EZGUI.startDrag.x, EZGUI.startDrag.x, endPos);
                    _this.decelerateScroll(endPos);
                });
            };
            List.prototype.decelerateScroll = function (endPos) {
                var _this = this;
                var sign = 0;
                if (_this.dragConstraint != 'y') {
                    sign = Math.sign(endPos.x - EZGUI.startDrag.x);
                }
                if (_this.dragConstraint != 'x') {
                    sign = Math.sign(endPos.y - EZGUI.startDrag.y);
                }
                var x1 = EZGUI.startDrag.x;
                var y1 = EZGUI.startDrag.y;
                var x2 = endPos.x;
                var y2 = endPos.y;
                var distance = Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2));
                var time = Date.now() - EZGUI.startDrag.t;
                var speed = distance / time;
                var timeConstant = 10;
                var amplitude = sign * speed * 150;
                var step = 0;
                var initialPosX = _this.draggable.position.x;
                var initialPosY = _this.draggable.position.y;
                var posX = 0;
                var posY = 0;
                if (_this.decelerationItv)
                    clearInterval(_this.decelerationItv);
                _this.decelerationItv = setInterval(function () {
                    //console.log('.');
                    var delta = amplitude / timeConstant;
                    if (_this.dragConstraint != 'y') {
                        posX += delta;
                        var nextPos = initialPosX + posX;
                        if (nextPos >= _this.dragXInterval[0] && nextPos <= _this.dragXInterval[1])
                            _this.draggable.position.x = nextPos;
                        else
                            clearInterval(_this.decelerationItv);
                    }
                    if (_this.dragConstraint != 'x') {
                        posY += delta;
                        var nextPos = initialPosY + posY;
                        if (nextPos >= _this.dragYInterval[0] && nextPos <= _this.dragYInterval[1])
                            _this.draggable.position.y = nextPos;
                        else
                            clearInterval(_this.decelerationItv);
                    }
                    amplitude -= delta;
                    step += 1;
                    if (step > 6 * timeConstant) {
                        clearInterval(_this.decelerationItv);
                        _this.decelerationItv = null;
                    }
                }, 16);
            };
            List.prototype.addChildAt = function (child, index) {
                var result = _super.prototype.addChildAt.call(this, child, index);
                if (result instanceof EZGUI.GUISprite) {
                    var ssize = this.slotSize * this.container.children.length;
                    this.dragXInterval[0] = -ssize + this._settings.width * 0.5;
                    this.dragXInterval[1] = this._settings.width * 0.2;
                    this.dragYInterval[0] = -ssize + this._settings.height * 0.9;
                    this.dragYInterval[1] = this._settings.height * 0.1;
                }
                return result;
            };
            List.prototype.removeChild = function (child) {
                var result = _super.prototype.removeChild.call(this, child);
                if (child instanceof EZGUI.GUISprite) {
                    var ssize = this.slotSize * this.container.children.length;
                    this.dragXInterval[0] = -ssize + this._settings.width * 0.5;
                    this.dragXInterval[1] = this._settings.width * 0.2;
                    this.dragYInterval[0] = -ssize + this._settings.height * 0.9;
                    this.dragYInterval[1] = this._settings.height * 0.1;
                    this.draggable.position.x = 0;
                    this.draggable.position.y = 0;
                }
                return result;
            };
            List.prototype.slideBy = function (value, delay) {
                delay = delay || Math.abs(value) * 5;
                var _this = this;
                if (_this.dragConstraint != 'y') {
                    var nextPos = _this.draggable.position.x + value;
                    nextPos = Math.max(nextPos, _this.dragXInterval[0]);
                    nextPos = Math.min(nextPos, _this.dragXInterval[1]);
                    if (_this.tween)
                        _this.tween.stop();
                    _this.tween = new EZGUI.Tween(_this.container.position).to({ x: nextPos }, delay).easing(EZGUI.Easing.Cubic.Out);
                    _this.tween.start();
                }
                if (_this.dragConstraint != 'x') {
                    var nextPos = _this.draggable.position.y + value;
                    nextPos = Math.max(nextPos, _this.dragYInterval[0]);
                    nextPos = Math.min(nextPos, _this.dragYInterval[1]);
                    if (_this.tween)
                        _this.tween.stop();
                    _this.tween = new EZGUI.Tween(_this.container.position).to({ y: nextPos }, delay).easing(EZGUI.Easing.Cubic.Out);
                    _this.tween.start();
                }
            };
            List.prototype.slideTo = function (value, delay) {
                var _this = this;
                if (_this.dragConstraint != 'y') {
                    var nextPos = value;
                    delay = delay || Math.abs(value - _this.draggable.position.x) * 5;
                    nextPos = Math.max(nextPos, _this.dragXInterval[0]);
                    nextPos = Math.min(nextPos, _this.dragXInterval[1]);
                    if (_this.tween)
                        _this.tween.stop();
                    _this.tween = new EZGUI.Tween(_this.container.position).to({ x: nextPos }, delay).easing(EZGUI.Easing.Cubic.Out);
                    _this.tween.start();
                }
                if (_this.dragConstraint != 'x') {
                    var nextPos = value;
                    delay = delay || Math.abs(value - _this.draggable.position.y) * 5;
                    nextPos = Math.max(nextPos, _this.dragYInterval[0]);
                    nextPos = Math.min(nextPos, _this.dragYInterval[1]);
                    if (_this.tween)
                        _this.tween.stop();
                    _this.tween = new EZGUI.Tween(_this.container.position).to({ y: nextPos }, delay).easing(EZGUI.Easing.Cubic.Out);
                    _this.tween.start();
                }
            };
            return List;
        })(Component.Layout);
        Component.List = List;
        EZGUI.registerComponents(List, 'List');
    })(Component = EZGUI.Component || (EZGUI.Component = {}));
})(EZGUI || (EZGUI = {}));
var EZGUI;
(function (EZGUI) {
    var MultistateTilingSprite = (function (_super) {
        __extends(MultistateTilingSprite, _super);
        function MultistateTilingSprite(texture, width, height, states) {
            _super.call(this, texture, width, height);
            this.stateTextures = {};
            this.currentState = 'default';
            this.stateTextures['default'] = texture;
            var _this = this;
            if (states) {
                for (var s in states) {
                    var tx = states[s];
                    if (tx instanceof PIXI.Texture && !this.stateTextures[s]) {
                        //var mtx:any = new MultistateTilingSprite(tx, width, height);
                        this.stateTextures[s] = tx;
                    }
                }
            }
        }
        MultistateTilingSprite.prototype.setState = function (state) {
            if (state === void 0) { state = 'default'; }
            var sprite = this;
            if (!sprite.stateTextures[state] || state == this.currentState)
                return;
            if (sprite.texture == sprite.stateTextures[state])
                return;
            if (sprite.texture) {
                sprite.texture = sprite.stateTextures[state];
            }
            else {
                if (sprite._texture)
                    sprite._texture = sprite.stateTextures[state];
            }
            if (sprite.tilingTexture)
                sprite.tilingTexture = sprite.stateTextures[state];
            if (sprite._tilingTexture)
                sprite._tilingTexture = sprite.stateTextures[state];
            if (EZGUI.Compatibility.PIXIVersion == 2) {
            }
        };
        return MultistateTilingSprite;
    })(EZGUI.Compatibility.TilingSprite);
    EZGUI.MultistateTilingSprite = MultistateTilingSprite;
})(EZGUI || (EZGUI = {}));
(function (root) {
    if ('performance' in root === false) {
        root.performance = {};
    }
    // IE 8
    Date.now = (Date.now || function () {
        return new Date().getTime();
    });
    if ('now' in root.performance === false) {
        var offset = root.performance.timing && root.performance.timing.navigationStart ? performance.timing.navigationStart : Date.now();
        root.performance.now = function () {
            return Date.now() - offset;
        };
    }
})(this);
var EZGUI;
(function (EZGUI) {
    var utils;
    (function (utils) {
        /**
         * check if the the point defined by x and y outside a visible gui element
         *
         */
        function isMasked(x, y, obj) {
            var parent = obj.parent;
            if (parent == null)
                return false;
            if (!parent.worldTransform || !parent.guiMask)
                return isMasked(x, y, parent);
            var wratio = 1;
            var hratio = 1;
            if (EZGUI.Compatibility.isPhaser) {
                wratio = Phaser.GAMES[0].scale.width / Phaser.GAMES[0].width;
                hratio = Phaser.GAMES[0].scale.height / Phaser.GAMES[0].height;
            }
            var tx = (parent.worldTransform.tx + parent.guiMask.x) * wratio;
            var ty = (parent.worldTransform.ty + parent.guiMask.y) * hratio;
            var w = parent.guiMask.width * wratio;
            var h = parent.guiMask.height * hratio;
            if (x < tx || y < ty || x > tx + w || y > ty + h)
                return true;
            return isMasked(x, y, parent);
        }
        utils.isMasked = isMasked;
        function getAbsPos(obj, from) {
            if (from === void 0) { from = null; }
            //if (EZGUI.Compatibility.PIXIVersion == 3) {
            if (from == null)
                from = { x: 0, y: 0 };
            from.x += obj.position.x;
            from.y += obj.position.y;
            if (obj.parent != null)
                return getAbsPos(obj.parent, from);
            return from;
            //}
            //else {
            //return { x: obj.worldTransform.tx, y: obj.worldTransform.ty };
            //}
        }
        utils.getAbsPos = getAbsPos;
        function getClientXY(event) {
            var data = event.data || event;
            var origEvt = event;
            if (data.originalEvent && data.originalEvent.changedTouches && data.originalEvent.changedTouches.length > 0) {
                origEvt = data.originalEvent.changedTouches[0];
            }
            else if (data.originalEvent && data.originalEvent.touches && data.originalEvent.touches.length > 0) {
                origEvt = data.originalEvent.touches[0];
            }
            else {
                if (data.originalEvent)
                    origEvt = data.originalEvent;
            }
            return { x: origEvt.clientX, y: origEvt.clientY };
        }
        utils.getClientXY = getClientXY;
        function getRealPos(event) {
            var data = event.data || event;
            var origEvt = event;
            if (data.originalEvent && data.originalEvent.changedTouches && data.originalEvent.changedTouches.length > 0) {
                origEvt = data.originalEvent.changedTouches[0];
            }
            else if (data.originalEvent && data.originalEvent.touches && data.originalEvent.touches.length > 0) {
                origEvt = data.originalEvent.touches[0];
            }
            else {
                if (data.originalEvent)
                    origEvt = data.originalEvent;
            }
            var bcr = origEvt.target.getBoundingClientRect();
            var px = origEvt.clientX - bcr.left;
            var py = origEvt.clientY - bcr.top;
            return { x: px, y: py };
        }
        utils.getRealPos = getRealPos;
        function distance(x, y, x0, y0) {
            return Math.sqrt((x -= x0) * x + (y -= y0) * y);
        }
        utils.distance = distance;
        ;
        function extendJSON(target, source) {
            if (typeof source == 'object') {
                for (var i in source) {
                    var src = source[i];
                    if (target[i] == '') {
                        continue;
                    }
                    if (target[i]) {
                        extendJSON(target[i], source[i]);
                    }
                    else {
                        target[i] = JSON.parse(JSON.stringify(source[i]));
                    }
                }
            }
        }
        utils.extendJSON = extendJSON;
        function loadJSON(url, cb, crossOrigin) {
            if (crossOrigin === void 0) { crossOrigin = true; }
            var xmlhttp = new XMLHttpRequest();
            xmlhttp.onreadystatechange = function () {
                if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                    var jsonContent = JSON.parse(xmlhttp.responseText);
                    cb(jsonContent);
                }
            };
            xmlhttp.open("GET", url, crossOrigin);
            xmlhttp.send();
        }
        utils.loadJSON = loadJSON;
        function loadXML(url, cb, crossOrigin) {
            if (crossOrigin === void 0) { crossOrigin = true; }
            var xmlhttp = new XMLHttpRequest();
            xmlhttp.onreadystatechange = function () {
                if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                    var xmlDoc;
                    if (window['DOMParser']) {
                        var parser = new DOMParser();
                        xmlDoc = parser.parseFromString(xmlhttp.responseText, "text/xml");
                    }
                    else {
                        xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
                        xmlDoc.async = false;
                        xmlDoc.loadXML(xmlhttp.responseText);
                    }
                    cb(xmlDoc);
                }
            };
            xmlhttp.open("GET", url, crossOrigin);
            xmlhttp.send();
        }
        utils.loadXML = loadXML;
    })(utils = EZGUI.utils || (EZGUI.utils = {}));
})(EZGUI || (EZGUI = {}));
//# sourceMappingURL=EZGUI.js.map
/*
 MIT license
 @link http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136
*/
var artemis;(function(artemis){function getClassName(klass){return klass.className||klass.name}artemis.getClassName=getClassName})(artemis||(artemis={}));(function(root,factory){if("function"===typeof define&&define.amd)define(factory);else if("object"===typeof exports)module.exports["artemis"]=factory();else root["artemis"]=factory()})(this,function(){return artemis});var artemis;
(function(artemis){var signals;(function(signals){var ListenerNode=function(){function ListenerNode(){this.previous=null;this.next=null;this.listener=null;this.once=false}return ListenerNode}();signals.ListenerNode=ListenerNode})(signals=artemis.signals||(artemis.signals={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var signals;(function(signals){var ListenerNode=artemis.signals.ListenerNode;var ListenerNodePool=function(){function ListenerNodePool(){this.tail=null;this.cacheTail=null}ListenerNodePool.prototype.get=function(){var node;if(this.tail!==null){node=this.tail;this.tail=this.tail.previous;node.previous=null;return node}else return new ListenerNode};ListenerNodePool.prototype.dispose=function(node){node.listener=null;node.once=false;node.next=null;node.previous=this.tail;this.tail=
node};ListenerNodePool.prototype.cache=function(node){node.listener=null;node.previous=this.cacheTail;this.cacheTail=node};ListenerNodePool.prototype.releaseCache=function(){var node;while(this.cacheTail!==null){node=this.cacheTail;this.cacheTail=node.previous;node.next=null;node.previous=this.tail;this.tail=node}};return ListenerNodePool}();signals.ListenerNodePool=ListenerNodePool})(signals=artemis.signals||(artemis.signals={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var signals;(function(signals){var ListenerNodePool=artemis.signals.ListenerNodePool;var SignalBase=function(){function SignalBase(){this.head=null;this.tail=null;this.numListeners=0;this.keys=null;this.nodes=null;this.listenerNodePool=null;this.toAddHead=null;this.toAddTail=null;this.dispatching=false;this.nodes=[];this.keys=[];this.listenerNodePool=new ListenerNodePool;this.numListeners=0}SignalBase.prototype.startDispatch=function(){this.dispatching=true};SignalBase.prototype.endDispatch=
function(){this.dispatching=false;if(this.toAddHead){if(!this.head){this.head=this.toAddHead;this.tail=this.toAddTail}else{this.tail.next=this.toAddHead;this.toAddHead.previous=this.tail;this.tail=this.toAddTail}this.toAddHead=null;this.toAddTail=null}this.listenerNodePool.releaseCache()};SignalBase.prototype.getNode=function(listener){var node;node=this.head;while(node!==null){if(node.listener===listener)break;node=node.next}if(node===null){node=this.toAddHead;while(node!==null){if(node.listener===
listener)break;node=node.next}}return node};SignalBase.prototype.add=function(listener){var node;if(this.keys.indexOf(listener)!==-1)return;node=this.listenerNodePool.get();node.listener=listener;this.nodes.push(node);this.keys.push(listener);this.addNode(node)};SignalBase.prototype.addOnce=function(listener){var node;if(this.keys.indexOf(listener)!==-1)return;node=this.listenerNodePool.get();node.listener=listener;node.once=true;this.nodes.push(node);this.keys.push(listener);this.addNode(node)};
SignalBase.prototype.addNode=function(node){if(this.dispatching)if(this.toAddHead===null)this.toAddHead=this.toAddTail=node;else{this.toAddTail.next=node;node.previous=this.toAddTail;this.toAddTail=node}else if(this.head===null)this.head=this.tail=node;else{this.tail.next=node;node.previous=this.tail;this.tail=node}this.numListeners++};SignalBase.prototype.remove=function(listener){var index,node;index=this.keys.indexOf(listener);node=this.nodes[index];if(node){if(this.head===node)this.head=this.head.next;
if(this.tail===node)this.tail=this.tail.previous;if(this.toAddHead===node)this.toAddHead=this.toAddHead.next;if(this.toAddTail===node)this.toAddTail=this.toAddTail.previous;if(node.previous)node.previous.next=node.next;if(node.next)node.next.previous=node.previous;this.nodes.splice(index,1);this.keys.splice(index,1);if(this.dispatching)this.listenerNodePool.cache(node);else this.listenerNodePool.dispose(node);this.numListeners--}};SignalBase.prototype.removeAll=function(){var index,node;while(this.head){node=
this.head;this.head=this.head.next;index=this.keys.indexOf(node.listener);this.nodes.splice(index,1);this.listenerNodePool.dispose(node)}this.nodes=[];this.keys=[];this.tail=null;this.toAddHead=null;this.toAddTail=null;this.numListeners=0};return SignalBase}();signals.SignalBase=SignalBase})(signals=artemis.signals||(artemis.signals={}))})(artemis||(artemis={}));
var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var signals;(function(signals){var Signal0=function(_super){__extends(Signal0,_super);function Signal0(){_super.apply(this,arguments)}Signal0.prototype.dispatch=function(){var node;this.startDispatch();node=this.head;while(node!==null){node.listener();if(node.once)this.remove(node.listener);node=node.next}return this.endDispatch()};return Signal0}(artemis.signals.SignalBase);signals.Signal0=Signal0})(signals=artemis.signals||(artemis.signals={}))})(artemis||(artemis={}));
var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var signals;(function(signals){var Signal1=function(_super){__extends(Signal1,_super);function Signal1(){_super.apply(this,arguments)}Signal1.prototype.dispatch=function($1){var node;this.startDispatch();node=this.head;while(node!==null){node.listener($1);if(node.once)this.remove(node.listener);node=node.next}return this.endDispatch()};return Signal1}(artemis.signals.SignalBase);signals.Signal1=Signal1})(signals=artemis.signals||(artemis.signals={}))})(artemis||(artemis={}));
var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var signals;(function(signals){var Signal2=function(_super){__extends(Signal2,_super);function Signal2(){_super.apply(this,arguments)}Signal2.prototype.dispatch=function($1,$2){var node;this.startDispatch();node=this.head;while(node){node.listener($1,$2);if(node.once)this.remove(node.listener);node=node.next}return this.endDispatch()};return Signal2}(artemis.signals.SignalBase);signals.Signal2=Signal2})(signals=artemis.signals||(artemis.signals={}))})(artemis||(artemis={}));
var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var signals;(function(signals){var Signal3=function(_super){__extends(Signal3,_super);function Signal3(){_super.apply(this,arguments)}Signal3.prototype.dispatch=function($1,$2,$3){var node;this.startDispatch();node=this.head;while(node!==null){node.listener($1,$2,$3);if(node.once)this.remove(node.listener);node=node.next}return this.endDispatch()};return Signal3}(artemis.signals.SignalBase);signals.Signal3=Signal3})(signals=artemis.signals||(artemis.signals={}))})(artemis||(artemis=
{}));var artemis;
(function(artemis){var utils;(function(utils){var Bag=function(){function Bag(capacity){if(capacity===void 0)capacity=64;this.size_=0;this.data_=new Array(capacity)}Bag.prototype.removeAt=function(index){var data=this.data_;var e=data[index];data[index]=data[--this.size_];data[this.size_]=null;return e};Bag.prototype.remove=function(e){var i;var e2;var data;for(i=0;i<this.size_;i++){data=this.data_;e2=data[i];if(e==e2){data[i]=data[--this.size_];data[this.size_]=null;return true}}return false};Bag.prototype.removeLast=
function(){if(this.size_>0){var data=this.data_;var e=data[--this.size_];data[this.size_]=null;return e}return null};Bag.prototype.contains=function(e){var i;var size;var data=this.data_;for(i=0,size=this.size_;size>i;i++)if(e===data[i])return true;return false};Bag.prototype.removeAll=function(bag){var modified=false;var i;var j;var l;var e1;var e2;var data=this.data_;for(i=0,l=bag.size();i<l;i++){e1=bag.get(i);for(j=0;j<this.size_;j++){e2=data[j];if(e1===e2){this.removeAt(j);j--;modified=true;break}}}return modified};
Bag.prototype.get=function(index){var data=this.data_;if(index>=data.length)throw new Error("ArrayIndexOutOfBoundsException");return data[index]};Bag.prototype.safeGet=function(index){var data=this.data_;if(index>=data.length)this.grow(index*7/4+1);return data[index]};Bag.prototype.size=function(){return this.size_};Bag.prototype.getCapacity=function(){return this.data_.length};Bag.prototype.isIndexWithinBounds=function(index){return index<this.getCapacity()};Bag.prototype.isEmpty=function(){return this.size_==
0};Bag.prototype.add=function(e){var data=this.data_;if(this.size_===data.length)this.grow();data[this.size_++]=e};Bag.prototype.set=function(index,e){var data=this.data_;if(index>=data.length)this.grow(index*2);this.size_=index+1;data[index]=e};Bag.prototype.grow=function(newCapacity){if(newCapacity===void 0)newCapacity=~~(this.data_.length*3/2)+1;this.data_.length=~~newCapacity};Bag.prototype.ensureCapacity=function(index){if(index>=this.data_.length)this.grow(index*2)};Bag.prototype.clear=function(){var i;
var size;var data=this.data_;for(i=0,size=this.size_;i<size;i++)data[i]=null;this.size_=0};Bag.prototype.addAll=function(items){var i;for(i=0;items.size()>i;i++)this.add(items.get(i))};return Bag}();utils.Bag=Bag})(utils=artemis.utils||(artemis.utils={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var utils;(function(utils){var ADDRESS_BITS_PER_WORD=5;var BITS_PER_WORD=1<<ADDRESS_BITS_PER_WORD;var WORD_MASK=4294967295;function numberOfTrailingZeros(i){if(i==0)return 64;var x=i;var y;var n=63;y=x<<32;if(y!=0){n-=32;x=y}y=x<<16;if(y!=0){n-=16;x=y}y=x<<8;if(y!=0){n-=8;x=y}y=x<<4;if(y!=0){n-=4;x=y}y=x<<2;if(y!=0){n-=2;x=y}return n-(x<<1>>>63)}var BitSet=function(){function BitSet(nbits){if(nbits===void 0)nbits=0;if(nbits<0)throw RangeError("Negative Array Size: ["+nbits+"]");
else if(nbits===0)this.words_=[];else{var words=this.words_=new Array((nbits-1>>ADDRESS_BITS_PER_WORD)+1);for(var i=0,l=words.length;i<l;i++)words[i]=0}}BitSet.prototype.nextSetBit=function(fromIndex){var u=fromIndex>>ADDRESS_BITS_PER_WORD;var words=this.words_;var wordsInUse=words.length;var word=words[u]&WORD_MASK<<fromIndex;while(true){if(word!==0)return u*BITS_PER_WORD+numberOfTrailingZeros(word);if(++u===wordsInUse)return-1;word=words[u]}};BitSet.prototype.intersects=function(set){var words=
this.words_;var wordsInUse=words.length;for(var i=Math.min(wordsInUse,set.words_.length)-1;i>=0;i--)if((words[i]&set.words_[i])!=0)return true;return false};BitSet.prototype.isEmpty=function(){return this.words_.length===0};BitSet.prototype.set=function(bitIndex,value){if(value===void 0)value=true;var wordIndex=bitIndex>>ADDRESS_BITS_PER_WORD;var words=this.words_;var wordsInUse=words.length;var wordsRequired=wordIndex+1;if(wordsInUse<wordsRequired){words.length=Math.max(2*wordsInUse,wordsRequired);
for(var i=wordsInUse,l=words.length;i<l;i++)words[i]=0}if(value)return words[wordIndex]|=1<<bitIndex;else return words[wordIndex]&=~(1<<bitIndex)};BitSet.prototype.get=function(bitIndex){var wordIndex=bitIndex>>ADDRESS_BITS_PER_WORD;var words=this.words_;var wordsInUse=words.length;return wordIndex<wordsInUse&&(words[wordIndex]&1<<bitIndex)!=0};BitSet.prototype.clear=function(bitIndex){if(bitIndex===null){var words=this.words_;var wordsInUse=words.length;while(wordsInUse>0)words[--wordsInUse]=0;return}var wordIndex=
bitIndex>>ADDRESS_BITS_PER_WORD;this.words_[wordIndex]&=~(1<<bitIndex)};return BitSet}();utils.BitSet=BitSet})(utils=artemis.utils||(artemis.utils={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var utils;(function(utils){var MathUtils=function(){function MathUtils(){}MathUtils.nextBool=function(){return(~~(Math.random()*32767)&1)===1};MathUtils.nextDouble=function(){return Math.random()};MathUtils.nextInt=function(max){return~~(Math.random()*max)};MathUtils.random=function(start,end){if(end===undefined)return MathUtils.nextInt(start+1);else if(parseInt(start)===parseFloat(start)&&parseInt(end)===parseFloat(end))return start+MathUtils.nextInt(end-start+1);else return start+
MathUtils.nextDouble()*(end-start)};return MathUtils}();utils.MathUtils=MathUtils})(utils=artemis.utils||(artemis.utils={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var utils;(function(utils){function decode(key){switch(typeof key){case "boolean":return""+key;case "number":return""+key;case "string":return""+key;case "function":return artemis.getClassName(key);default:key.uuid=key.uuid?key.uuid:utils.UUID.randomUUID();return key.uuid}}var HashMap=function(){function HashMap(){this.clear()}HashMap.prototype.clear=function(){this.map_={};this.keys_={}};HashMap.prototype.values=function(){var result=[];var map=this.map_;for(var key in map)result.push(map[key]);
return result};HashMap.prototype.contains=function(value){var map=this.map_;for(var key in map)if(value===map[key])return true;return false};HashMap.prototype.containsKey=function(key){return decode(key)in this.map_};HashMap.prototype.containsValue=function(value){var map=this.map_;for(var key in map)if(value===map[key])return true;return false};HashMap.prototype.get=function(key){return this.map_[decode(key)]};HashMap.prototype.isEmpty=function(){return Object.keys(this.map_).length===0};HashMap.prototype.keys=
function(){var keys=this.map_;var result=[];for(var key in keys)result.push(keys[key]);return result};HashMap.prototype.put=function(key,value){var k=decode(key);this.map_[k]=value;this.keys_[k]=key};HashMap.prototype.remove=function(key){var map=this.map_;var k=decode(key);var value=map[k];delete map[k];delete this.keys_[k];return value};HashMap.prototype.size=function(){return Object.keys(this.map_).length};return HashMap}();utils.HashMap=HashMap})(utils=artemis.utils||(artemis.utils={}))})(artemis||
(artemis={}));var artemis;
(function(artemis){var utils;(function(utils){var Timer=function(){function Timer(delay,repeat){if(repeat===void 0)repeat=false;this.execute=function(){};this.delay=delay;this.repeat=repeat;this.acc=0}Timer.prototype.update=function(delta){if(!this.done&&!this.stopped){this.acc+=delta;if(this.acc>=this.delay){this.acc-=this.delay;if(this.repeat)this.reset();else this.done=true;this.execute()}}};Timer.prototype.reset=function(){this.stopped=false;this.done=false;this.acc=0};Timer.prototype.isDone=
function(){return this.done};Timer.prototype.isRunning=function(){return!this.done&&this.acc<this.delay&&!this.stopped};Timer.prototype.stop=function(){this.stopped=true};Timer.prototype.setDelay=function(delay){this.delay=delay};Timer.prototype.getPercentageRemaining=function(){if(this.done)return 100;else if(this.stopped)return 0;else return 1-(this.delay-this.acc)/this.delay};Timer.prototype.getDelay=function(){return this.delay};return Timer}();utils.Timer=Timer})(utils=artemis.utils||(artemis.utils=
{}))})(artemis||(artemis={}));var artemis;
(function(artemis){var utils;(function(utils){var TrigLUT=function(){function TrigLUT(){}TrigLUT.sin=function(rad){return TrigLUT.sin_[rad*TrigLUT.radToIndex&TrigLUT.SIN_MASK]};TrigLUT.cos=function(rad){return TrigLUT.cos_[rad*TrigLUT.radToIndex&TrigLUT.SIN_MASK]};TrigLUT.sinDeg=function(deg){return TrigLUT.sin_[deg*TrigLUT.degToIndex&TrigLUT.SIN_MASK]};TrigLUT.cosDeg=function(deg){return TrigLUT.cos_[deg*TrigLUT.degToIndex&TrigLUT.SIN_MASK]};TrigLUT.init=function(update){TrigLUT.RAD=Math.PI/180;
TrigLUT.DEG=180/Math.PI;TrigLUT.SIN_BITS=12;TrigLUT.SIN_MASK=~(-1<<TrigLUT.SIN_BITS);TrigLUT.SIN_COUNT=TrigLUT.SIN_MASK+1;TrigLUT.radFull=Math.PI*2;TrigLUT.degFull=360;TrigLUT.radToIndex=TrigLUT.SIN_COUNT/TrigLUT.radFull;TrigLUT.degToIndex=TrigLUT.SIN_COUNT/TrigLUT.degFull;TrigLUT.sin_=new Array(TrigLUT.SIN_COUNT);TrigLUT.cos_=new Array(TrigLUT.SIN_COUNT);for(var i=0;i<TrigLUT.SIN_COUNT;i++){TrigLUT.sin_[i]=Math.sin((i+.5)/TrigLUT.SIN_COUNT*TrigLUT.radFull);TrigLUT.cos_[i]=Math.cos((i+.5)/TrigLUT.SIN_COUNT*
TrigLUT.radFull)}if(update){Math.sin=TrigLUT.sin;Math.cos=TrigLUT.cos}};return TrigLUT}();utils.TrigLUT=TrigLUT})(utils=artemis.utils||(artemis.utils={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var utils;(function(utils){var hex=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59",
"5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be",
"bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var UUID=function(){function UUID(){}UUID.randomUUID=function(){var d0=Math.random()*4294967295|0;var d1=Math.random()*4294967295|0;var d2=Math.random()*4294967295|0;var d3=Math.random()*
4294967295|0;return hex[d0&255]+hex[d0>>8&255]+hex[d0>>16&255]+hex[d0>>24&255]+"-"+hex[d1&255]+hex[d1>>8&255]+"-"+hex[d1>>16&15|64]+hex[d1>>24&255]+"-"+hex[d2&63|128]+hex[d2>>8&255]+"-"+hex[d2>>16&255]+hex[d2>>24&255]+hex[d3&255]+hex[d3>>8&255]+hex[d3>>16&255]+hex[d3>>24&255]};return UUID}();utils.UUID=UUID})(utils=artemis.utils||(artemis.utils={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var annotations;(function(annotations){function EntityTemplate(component){return function(target,propertyKey,descriptor){EntityTemplate["entityTemplates"]=EntityTemplate["entityTemplates"]||{};EntityTemplate["entityTemplates"][component]=target}}annotations.EntityTemplate=EntityTemplate})(annotations=artemis.annotations||(artemis.annotations={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var annotations;(function(annotations){function Mapper(component){return function(target,propertyKey,descriptor){var klass=target.constructor;klass.declaredFields=klass.declaredFields||[];klass.declaredFields.push(propertyKey);klass.prototype[propertyKey]=component}}annotations.Mapper=Mapper})(annotations=artemis.annotations||(artemis.annotations={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var annotations;(function(annotations){function Pooled(){return function(klass,propertyKey,descriptor){Pooled["pooledComponents"]=Pooled["pooledComponents"]||{};Pooled["pooledComponents"][artemis.getClassName(klass)]=klass}}annotations.Pooled=Pooled;Pooled["pooledComponents"]={}})(annotations=artemis.annotations||(artemis.annotations={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var blackboard;(function(blackboard){(function(TriggerStateType){TriggerStateType[TriggerStateType["ValueAdded"]=1]="ValueAdded";TriggerStateType[TriggerStateType["ValueRemoved"]=16]="ValueRemoved";TriggerStateType[TriggerStateType["ValueChanged"]=256]="ValueChanged";TriggerStateType[TriggerStateType["TriggerAdded"]=4096]="TriggerAdded"})(blackboard.TriggerStateType||(blackboard.TriggerStateType={}));var TriggerStateType=blackboard.TriggerStateType})(blackboard=artemis.blackboard||
(artemis.blackboard={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var blackboard;(function(blackboard){var BlackBoard=function(){function BlackBoard(){this.intelligence={};this.triggers={}}BlackBoard.prototype.addTrigger=function(trigger,evaluateNow){if(evaluateNow===void 0)evaluateNow=false;trigger.blackboard=this;for(var i in trigger.worldPropertiesMonitored){var intelName=trigger.worldPropertiesMonitored[i];if(this.triggers[name])this.triggers[name].push(trigger);else this.triggers[name]=[trigger]}if(evaluateNow)if(trigger.isFired===false)trigger.fire(blackboard.TriggerStateType.TriggerAdded)};
BlackBoard.prototype.atomicOperateOnEntry=function(operation){operation(this)};BlackBoard.prototype.getEntry=function(name){return this.intelligence[name]};BlackBoard.prototype.removeEntry=function(name){if(this.intelligence[name]){delete this.intelligence[name];if(this.triggers[name])for(var i in this.triggers[name]){var item=this.triggers[name][i];if(item.isFired===false)item.fire(blackboard.TriggerStateType.ValueRemoved)}}};BlackBoard.prototype.removeTrigger=function(trigger){for(var i in trigger.worldPropertiesMonitored){var intelName=
trigger.worldPropertiesMonitored[i];var t=this.triggers[intelName].indexOf(trigger);if(t!==-1)this.triggers[intelName].slice(t,1)}};BlackBoard.prototype.setEntry=function(name,intel){var triggerStateType=this.intelligence[name]?blackboard.TriggerStateType.ValueChanged:blackboard.TriggerStateType.ValueAdded;this.intelligence[name]=intel;if(this.triggers[name])for(var i in this.triggers[name]){var item=this.triggers[name][i];if(item.isFired===false)item.fire(triggerStateType)}};BlackBoard.prototype.triggerList=
function(name){return this.triggers[name]};return BlackBoard}();blackboard.BlackBoard=BlackBoard})(blackboard=artemis.blackboard||(artemis.blackboard={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var blackboard;(function(blackboard){var Trigger=function(){function Trigger(propertyName){this.isFired=false;this.worldPropertiesMonitored=[].concat(propertyName)}Trigger.prototype.removeThisTrigger=function(){this.blackboard.removeTrigger(this)};Trigger.prototype.fire=function(triggerStateType){this.isFired=true;this.triggerStateType=triggerStateType;if(this.checkConditionToFire()){this.calledOnFire(triggerStateType);if(this.onFire!==null)this.onFire(this)}this.isFired=false};
Trigger.prototype.calledOnFire=function(triggerStateType){};Trigger.prototype.checkConditionToFire=function(){return true};return Trigger}();blackboard.Trigger=Trigger})(blackboard=artemis.blackboard||(artemis.blackboard={}))})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var blackboard;(function(blackboard){var SimpleTrigger=function(_super){__extends(SimpleTrigger,_super);function SimpleTrigger(name,condition,onFire){_super.call(this,[name]);this.condition=condition;this.onFire=onFire}SimpleTrigger.prototype.calledOnFire=function(triggerStateType){if(this.onFire!==null)this.onFire(triggerStateType)};SimpleTrigger.prototype.checkConditionToFire=function(){return this.condition(this.blackboard,this.triggerStateType)};return SimpleTrigger}(blackboard.Trigger);
blackboard.SimpleTrigger=SimpleTrigger})(blackboard=artemis.blackboard||(artemis.blackboard={}))})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var blackboard;(function(blackboard){var TriggerMultiCondition=function(_super){__extends(TriggerMultiCondition,_super);function TriggerMultiCondition(condition,onFire,names){_super.call(this,names);this.condition=condition;this.onFire=onFire}TriggerMultiCondition.prototype.removeThisTrigger=function(){this.blackboard.removeTrigger(this)};TriggerMultiCondition.prototype.calledOnFire=function(triggerStateType){if(this.onFire!==null)this.onFire(triggerStateType)};TriggerMultiCondition.prototype.checkConditionToFire=
function(){return this.condition(this.blackboard,this.triggerStateType)};return TriggerMultiCondition}(blackboard.Trigger);blackboard.TriggerMultiCondition=TriggerMultiCondition})(blackboard=artemis.blackboard||(artemis.blackboard={}))})(artemis||(artemis={}));var artemis;
(function(artemis){var Component=function(){function Component(){}Component.prototype.initialize=function(){var args=[];for(var _i=0;_i<arguments.length;_i++)args[_i-0]=arguments[_i]};return Component}();artemis.Component=Component})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var PooledComponent=function(_super){__extends(PooledComponent,_super);function PooledComponent(){_super.apply(this,arguments)}PooledComponent.prototype.reset=function(){};return PooledComponent}(artemis.Component);artemis.PooledComponent=PooledComponent})(artemis||(artemis={}));var artemis;
(function(artemis){var BitSet=artemis.utils.BitSet;var Aspect=function(){function Aspect(){this.allSet_=new BitSet;this.exclusionSet_=new BitSet;this.oneSet_=new BitSet}Aspect.prototype.setWorld=function(world){this.world_=world};Aspect.prototype.getAllSet=function(){return this.allSet_};Aspect.prototype.getExclusionSet=function(){return this.exclusionSet_};Aspect.prototype.getOneSet=function(){return this.oneSet_};Aspect.prototype.getIndexFor=function(c){return Aspect.typeFactory.getIndexFor(c)};
Aspect.prototype.all=function(type){var types=[];for(var _i=1;_i<arguments.length;_i++)types[_i-1]=arguments[_i];this.allSet_.set(this.getIndexFor(type));var t;for(t in types)this.allSet_.set(this.getIndexFor(types[t]));return this};Aspect.prototype.exclude=function(type){var types=[];for(var _i=1;_i<arguments.length;_i++)types[_i-1]=arguments[_i];this.exclusionSet_.set(this.getIndexFor(type));var t;for(t in types)this.exclusionSet_.set(this.getIndexFor(types[t]));return this};Aspect.prototype.one=
function(type){var types=[];for(var _i=1;_i<arguments.length;_i++)types[_i-1]=arguments[_i];this.oneSet_.set(this.getIndexFor(type));for(var t in types)this.oneSet_.set(this.getIndexFor(types[t]));return this};Aspect.getAspectFor=function(type){var types=[];for(var _i=1;_i<arguments.length;_i++)types[_i-1]=arguments[_i];return Aspect.getAspectForAll.apply(Aspect,[type].concat(types))};Aspect.getAspectForAll=function(type){var types=[];for(var _i=1;_i<arguments.length;_i++)types[_i-1]=arguments[_i];
var aspect=new Aspect;aspect.all.apply(aspect,[type].concat(types));return aspect};Aspect.getAspectForOne=function(type){var types=[];for(var _i=1;_i<arguments.length;_i++)types[_i-1]=arguments[_i];var aspect=new Aspect;aspect.one.apply(aspect,[type].concat(types));return aspect};Aspect.getEmpty=function(){return new Aspect};return Aspect}();artemis.Aspect=Aspect})(artemis||(artemis={}));var artemis;
(function(artemis){var BitSet=artemis.utils.BitSet;var UUID=artemis.utils.UUID;var Entity=function(){function Entity(world,id){this.world_=world;this.id_=id;this.entityManager_=world.getEntityManager();this.componentManager_=world.getComponentManager();this.systemBits_=new BitSet;this.componentBits_=new BitSet;this.reset()}Entity.prototype.getId=function(){return this.id_};Entity.prototype.getComponentBits=function(){return this.componentBits_};Entity.prototype.getSystemBits=function(){return this.systemBits_};
Entity.prototype.reset=function(){this.systemBits_.clear();this.componentBits_.clear();this.uuid=UUID.randomUUID()};Entity.prototype.toString=function(){return"Entity["+this.id_+"]"};Entity.prototype.createComponent=function(componentKlazz){var args=[];for(var _i=1;_i<arguments.length;_i++)args[_i-1]=arguments[_i];var componentManager=this.world_.getComponentManager();var component=componentManager.create(this,componentKlazz);if(args.length)(_a=component).initialize.apply(_a,args);var tf=this.world_.getComponentManager().typeFactory;
var componentType=tf.getTypeFor(componentKlazz);this.componentBits_.set(componentType.getIndex());return component;var _a};Entity.prototype.addComponent=function(component){var args=[];for(var _i=1;_i<arguments.length;_i++)args[_i-1]=arguments[_i];var type;if(component instanceof artemis.Component)type=args[0];else{component=this.createComponent.apply(this,[component].concat(args));type=this.getTypeFor(component.constructor)}if(type===undefined)type=this.getTypeFor(component.constructor);this.componentManager_.addComponent(this,
type,component);return this};Entity.prototype.getTypeFor=function(c){return this.world_.getComponentManager().typeFactory.getTypeFor(c)};Entity.prototype.removeComponentInstance=function(component){this.removeComponent(this.getTypeFor(component.constructor));return this};Entity.prototype.removeComponent=function(type){this.componentManager_.removeComponent(this,type);return this};Entity.prototype.removeComponentByType=function(type){this.removeComponent(this.getTypeFor(type));return this};Entity.prototype.isActive=
function(){return this.entityManager_.isActive(this.id_)};Entity.prototype.isEnabled=function(){return this.entityManager_.isEnabled(this.id_)};Entity.prototype.getComponent=function(type){return this.componentManager_.getComponent(this,type)};Entity.prototype.getComponentByType=function(type){return this.componentManager_.getComponent(this,this.getTypeFor(type))};Entity.prototype.getComponents=function(fillBag){return this.componentManager_.getComponentsFor(this,fillBag)};Entity.prototype.addToWorld=
function(){this.world_.addEntity(this)};Entity.prototype.changedInWorld=function(){this.world_.changedEntity(this)};Entity.prototype.deleteFromWorld=function(){this.world_.deleteEntity(this)};Entity.prototype.enable=function(){this.world_.enable(this)};Entity.prototype.disable=function(){this.world_.disable(this)};Entity.prototype.getUuid=function(){return this.uuid};Entity.prototype.getWorld=function(){return this.world_};return Entity}();artemis.Entity=Entity})(artemis||(artemis={}));var artemis;
(function(artemis){var Manager=function(){function Manager(){}Manager.prototype.initialize=function(){};Manager.prototype.setWorld=function(world){this.world_=world};Manager.prototype.getWorld=function(){return this.world_};Manager.prototype.added=function(e){};Manager.prototype.changed=function(e){};Manager.prototype.deleted=function(e){};Manager.prototype.disabled=function(e){};Manager.prototype.enabled=function(e){};return Manager}();artemis.Manager=Manager})(artemis||(artemis={}));var artemis;
(function(artemis){var Bag=artemis.utils.Bag;var HashMap=artemis.utils.HashMap;var EntityTemplate=artemis.annotations.EntityTemplate;var World=function(){function World(){this.managers_=new HashMap;this.managersBag_=new Bag;this.systems_=new HashMap;this.systemsBag_=new Bag;this.added_=new Bag;this.changed_=new Bag;this.deleted_=new Bag;this.enable_=new Bag;this.disable_=new Bag;this.cm_=new artemis.ComponentManager;this.setManager(this.cm_);this.em_=new artemis.EntityManager;this.setManager(this.em_)}
World.prototype.initialize=function(){for(var i=0;i<this.managersBag_.size();i++)this.managersBag_.get(i).initialize();for(var i=0;i<this.systemsBag_.size();i++){ComponentMapperInitHelper.config(this.systemsBag_.get(i),this);this.systemsBag_.get(i).initialize()}this.entityTemplates={};for(var component in EntityTemplate["entityTemplates"]){var Template=EntityTemplate["entityTemplates"][component];this.setEntityTemplate(component,new Template)}};World.prototype.getEntityManager=function(){return this.em_};
World.prototype.getComponentManager=function(){return this.cm_};World.prototype.setManager=function(manager){this.managers_.put(manager.constructor,manager);this.managersBag_.add(manager);manager.setWorld(this);return manager};World.prototype.getManager=function(managerType){return this.managers_.get(managerType)};World.prototype.deleteManager=function(manager){this.managers_.remove(manager);this.managersBag_.remove(manager)};World.prototype.getDelta=function(){return this.delta};World.prototype.setDelta=
function(delta){this.delta=delta};World.prototype.addEntity=function(e){this.added_.add(e)};World.prototype.changedEntity=function(e){this.changed_.add(e)};World.prototype.deleteEntity=function(e){if(!this.deleted_.contains(e))this.deleted_.add(e)};World.prototype.enable=function(e){this.enable_.add(e)};World.prototype.disable=function(e){this.disable_.add(e)};World.prototype.createEntity=function(){return this.em_.createEntityInstance()};World.prototype.getEntity=function(entityId){return this.em_.getEntity(entityId)};
World.prototype.getSystems=function(){return this.systemsBag_};World.prototype.setSystem=function(system,passive){if(passive===void 0)passive=false;system.setWorld(this);system.setPassive(passive);this.systems_.put(system.constructor,system);this.systemsBag_.add(system);return system};World.prototype.deleteSystem=function(system){this.systems_.remove(system.constructor);this.systemsBag_.remove(system)};World.prototype.notifySystems=function(performer,e){for(var i=0,s=this.systemsBag_.size();s>i;i++)performer.perform(this.systemsBag_.get(i),
e)};World.prototype.notifyManagers=function(performer,e){for(var a=0,s=this.managersBag_.size();s>a;a++)performer.perform(this.managersBag_.get(a),e)};World.prototype.getSystem=function(type){return this.systems_.get(type)};World.prototype.check=function(entities,performer){if(!entities.isEmpty()){for(var i=0,s=entities.size();s>i;i++){var e=entities.get(i);this.notifyManagers(performer,e);this.notifySystems(performer,e)}entities.clear()}};World.prototype.process=function(){this.check(this.added_,
{perform:function(observer,e){observer.added(e)}});this.check(this.changed_,{perform:function(observer,e){observer.changed(e)}});this.check(this.disable_,{perform:function(observer,e){observer.disabled(e)}});this.check(this.enable_,{perform:function(observer,e){observer.enabled(e)}});this.check(this.deleted_,{perform:function(observer,e){observer.deleted(e)}});this.cm_.clean();for(var i=0;this.systemsBag_.size()>i;i++){var system=this.systemsBag_.get(i);if(!system.isPassive())system.process()}};World.prototype.getMapper=
function(type){return artemis.ComponentMapper.getFor(type,this)};World.prototype.setEntityTemplate=function(entityTag,entityTemplate){this.entityTemplates[entityTag]=entityTemplate};World.prototype.createEntityFromTemplate=function(name){var args=[];for(var _i=1;_i<arguments.length;_i++)args[_i-1]=arguments[_i];return(_a=this.entityTemplates[name]).buildEntity.apply(_a,[this.createEntity(),this].concat(args));var _a};return World}();artemis.World=World;var ComponentMapperInitHelper=function(){function ComponentMapperInitHelper(){}
ComponentMapperInitHelper.config=function(target,world){try{var clazz=target.constructor;for(var fieldIndex in clazz.declaredFields){var field=clazz.declaredFields[fieldIndex];if(!target.hasOwnProperty(field)){var componentType=clazz.prototype[field];target[field]=world.getMapper(componentType)}}}catch(e){throw new Error("Error while setting component mappers");}};return ComponentMapperInitHelper}()})(artemis||(artemis={}));var artemis;
(function(artemis){var Bag=artemis.utils.Bag;var ComponentPool=function(){function ComponentPool(){this.pools=new Bag}ComponentPool.prototype.obtain=function(componentClass,type){var pool=this.getPool(type.getIndex());return pool.size()>0?pool.obtain():new componentClass};ComponentPool.prototype.free=function(c,type){this.freeByIndex(c,type.getIndex())};ComponentPool.prototype.freeByIndex=function(c,typeIndex){c.reset();this.getPool(typeIndex).free(c)};ComponentPool.prototype.getPool=function(typeIndex){var pool=
this.pools.safeGet(typeIndex);if(pool==null){pool=new Pool;this.pools.set(typeIndex,pool)}return pool};return ComponentPool}();artemis.ComponentPool=ComponentPool;var Pool=function(){function Pool(){this.cache=new Bag}Pool.prototype.obtain=function(){return this.cache.removeLast()};Pool.prototype.size=function(){return this.cache.size()};Pool.prototype.free=function(component){this.cache.add(component)};return Pool}()})(artemis||(artemis={}));var artemis;
(function(artemis){var Pooled=artemis.annotations.Pooled;(function(Taxonomy){Taxonomy[Taxonomy["BASIC"]=0]="BASIC";Taxonomy[Taxonomy["POOLED"]=1]="POOLED"})(artemis.Taxonomy||(artemis.Taxonomy={}));var Taxonomy=artemis.Taxonomy;var ComponentType=function(){function ComponentType(type,index){this.index_=0;if(index!==undefined)this.index_=ComponentType.INDEX++;else this.index_=index;this.type_=type;if(Pooled["pooledComponents"][artemis.getClassName(type)]===type)this.taxonomy_=Taxonomy.POOLED;else this.taxonomy_=
Taxonomy.BASIC}ComponentType.prototype.getName=function(){return artemis.getClassName(this.type_)};ComponentType.prototype.getIndex=function(){return this.index_};ComponentType.prototype.getTaxonomy=function(){return this.taxonomy_};ComponentType.prototype.toString=function(){return"ComponentType["+artemis.getClassName(ComponentType)+"] ("+this.index_+")"};ComponentType.INDEX=0;return ComponentType}();artemis.ComponentType=ComponentType})(artemis||(artemis={}));var artemis;
(function(artemis){var Bag=artemis.utils.Bag;var ComponentType=artemis.ComponentType;var Aspect=artemis.Aspect;var ComponentTypeFactory=function(){function ComponentTypeFactory(){this.componentTypeCount_=0;this.componentTypes_={};this.types=new Bag;Aspect.typeFactory=this}ComponentTypeFactory.prototype.getTypeFor=function(c){if("number"===typeof c)return this.types.get(parseInt(c));var type=this.componentTypes_[artemis.getClassName(c)];if(type==null){var index=this.componentTypeCount_++;type=new ComponentType(c,
index);this.componentTypes_[artemis.getClassName(c)]=type;this.types.set(index,type)}return type};ComponentTypeFactory.prototype.getIndexFor=function(c){return this.getTypeFor(c).getIndex()};ComponentTypeFactory.prototype.getTaxonomy=function(index){return this.types.get(index).getTaxonomy()};return ComponentTypeFactory}();artemis.ComponentTypeFactory=ComponentTypeFactory})(artemis||(artemis={}));
var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var Bag=artemis.utils.Bag;var Manager=artemis.Manager;var ComponentTypeFactory=artemis.ComponentTypeFactory;var ComponentPool=artemis.ComponentPool;var Taxonomy=artemis.Taxonomy;var ComponentManager=function(_super){__extends(ComponentManager,_super);function ComponentManager(){_super.call(this);this.componentsByType_=new Bag;this.pooledComponents_=new ComponentPool;this.deleted_=new Bag;this.typeFactory=new ComponentTypeFactory}ComponentManager.prototype.initialize=function(){};
ComponentManager.prototype.create=function(owner,componentClass){var type=this.typeFactory.getTypeFor(componentClass);var component=null;switch(type.getTaxonomy()){case Taxonomy.BASIC:component=this.newInstance(componentClass,false);break;case Taxonomy.POOLED:this.reclaimPooled(owner,type);component=this.pooledComponents_.obtain(componentClass,type);break;default:throw new Error("InvalidComponentException unknown component type:"+type.getTaxonomy());}this.addComponent(owner,type,component);return component};
ComponentManager.prototype.reclaimPooled=function(owner,type){var components=this.componentsByType_.safeGet(type.getIndex());if(components==null)return;var old=components.safeGet(owner.getId());if(old!==undefined&&old!==null)this.pooledComponents_.free(old,type)};ComponentManager.prototype.newInstance=function(constructor,constructorHasWorldParameter){if(constructorHasWorldParameter)return new constructor(this.world_);else return new constructor};ComponentManager.prototype.removeComponentsOfEntity=
function(e){var componentBits=e.getComponentBits();for(var i=componentBits.nextSetBit(0);i>=0;i=componentBits.nextSetBit(i+1))switch(this.typeFactory.getTaxonomy(i)){case Taxonomy.BASIC:this.componentsByType_.get(i).set(e.getId(),null);break;case Taxonomy.POOLED:var pooled=this.componentsByType_.get(i).get(e.getId());this.pooledComponents_.freeByIndex(pooled,i);this.componentsByType_.get(i).set(e.getId(),null);break;default:throw new Error("InvalidComponentException"+" unknown component type: "+this.typeFactory.getTaxonomy(i));
}componentBits.clear()};ComponentManager.prototype.addComponent=function(e,type,component){this.componentsByType_.ensureCapacity(type.getIndex());var components=this.componentsByType_.get(type.getIndex());if(components==null){components=new Bag;this.componentsByType_.set(type.getIndex(),components)}components.set(e.getId(),component);e.getComponentBits().set(type.getIndex())};ComponentManager.prototype.removeComponent=function(e,type){var index=type.getIndex();switch(type.getTaxonomy()){case Taxonomy.BASIC:this.componentsByType_.get(index).set(e.getId(),
null);e.getComponentBits().clear(type.getIndex());break;case Taxonomy.POOLED:var pooled=this.componentsByType_.get(index).get(e.getId());e.getComponentBits().clear(type.getIndex());this.pooledComponents_.free(pooled,type);this.componentsByType_.get(index).set(e.getId(),null);break;default:throw new Error("InvalidComponentException"+type+" unknown component type: "+type.getTaxonomy());}};ComponentManager.prototype.getComponentsByType=function(type){var components=this.componentsByType_.get(type.getIndex());
if(components==null){components=new Bag;this.componentsByType_.set(type.getIndex(),components)}return components};ComponentManager.prototype.getComponent=function(e,type){var components=this.componentsByType_.get(type.getIndex());if(components!=null)return components.get(e.getId());return null};ComponentManager.prototype.getComponentsFor=function(e,fillBag){var componentBits=e.getComponentBits();for(var i=componentBits.nextSetBit(0);i>=0;i=componentBits.nextSetBit(i+1))fillBag.add(this.componentsByType_.get(i).get(e.getId()));
return fillBag};ComponentManager.prototype.deleted=function(e){this.deleted_.add(e)};ComponentManager.prototype.clean=function(){if(this.deleted_.size()>0){for(var i=0;this.deleted_.size()>i;i++)this.removeComponentsOfEntity(this.deleted_.get(i));this.deleted_.clear()}};return ComponentManager}(Manager);artemis.ComponentManager=ComponentManager})(artemis||(artemis={}));var artemis;
(function(artemis){var ComponentMapper=function(){function ComponentMapper(type,world){this.type_=world.getComponentManager().typeFactory.getTypeFor(type);this.components_=world.getComponentManager().getComponentsByType(this.type_);this.classType_=type}ComponentMapper.prototype.get=function(e){return this.components_.get(e.getId())};ComponentMapper.prototype.getSafe=function(e){if(this.components_.isIndexWithinBounds(e.getId()))return this.components_.get(e.getId());return null};ComponentMapper.prototype.has=
function(e){return this.getSafe(e)!=null};ComponentMapper.getFor=function(type,world){return new ComponentMapper(type,world)};return ComponentMapper}();artemis.ComponentMapper=ComponentMapper})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var Bag=artemis.utils.Bag;var BitSet=artemis.utils.BitSet;var Manager=artemis.Manager;var EntityManager=function(_super){__extends(EntityManager,_super);function EntityManager(){_super.call(this);this.entities_=new Bag;this.disabled_=new BitSet;this.identifierPool_=new IdentifierPool;this.active_=0;this.added_=0;this.created_=0;this.deleted_=0}EntityManager.prototype.initialize=function(){};EntityManager.prototype.createEntityInstance=function(){var e=new artemis.Entity(this.world_,
this.identifierPool_.checkOut());this.created_++;return e};EntityManager.prototype.added=function(e){this.active_++;this.added_++;this.entities_.set(e.getId(),e)};EntityManager.prototype.enabled=function(e){this.disabled_.clear(e.getId())};EntityManager.prototype.disabled=function(e){this.disabled_.set(e.getId())};EntityManager.prototype.deleted=function(e){this.entities_.set(e.getId(),null);this.disabled_.clear(e.getId());this.identifierPool_.checkIn(e.getId());this.active_--;this.deleted_++};EntityManager.prototype.isActive=
function(entityId){return this.entities_.get(entityId)!=null};EntityManager.prototype.isEnabled=function(entityId){return!this.disabled_.get(entityId)};EntityManager.prototype.getEntity=function(entityId){return this.entities_.get(entityId)};EntityManager.prototype.getActiveEntityCount=function(){return this.active_};EntityManager.prototype.getTotalCreated=function(){return this.created_};EntityManager.prototype.getTotalAdded=function(){return this.added_};EntityManager.prototype.getTotalDeleted=
function(){return this.deleted_};return EntityManager}(Manager);artemis.EntityManager=EntityManager;var IdentifierPool=function(){function IdentifierPool(){this.nextAvailableId_=0;this.ids_=new Bag}IdentifierPool.prototype.checkOut=function(){if(this.ids_.size()>0)return this.ids_.removeLast();return this.nextAvailableId_++};IdentifierPool.prototype.checkIn=function(id){this.ids_.add(id)};return IdentifierPool}()})(artemis||(artemis={}));var artemis;
(function(artemis){var Bag=artemis.utils.Bag;var HashMap=artemis.utils.HashMap;var BlackBoard=artemis.blackboard.BlackBoard;var EntitySystem=function(){function EntitySystem(aspect){this.actives_=new Bag;this.aspect_=aspect;this.systemIndex_=SystemIndexManager.getIndexFor(this.constructor);this.allSet_=aspect.getAllSet();this.exclusionSet_=aspect.getExclusionSet();this.oneSet_=aspect.getOneSet();this.dummy_=this.allSet_.isEmpty()&&this.oneSet_.isEmpty()}EntitySystem.prototype.begin=function(){};EntitySystem.prototype.process=
function(){if(this.checkProcessing()){this.begin();this.processEntities(this.actives_);this.end()}};EntitySystem.prototype.end=function(){};EntitySystem.prototype.processEntities=function(entities){};EntitySystem.prototype.checkProcessing=function(){return true};EntitySystem.prototype.initialize=function(){};EntitySystem.prototype.inserted=function(e){};EntitySystem.prototype.removed=function(e){};EntitySystem.prototype.check=function(e){if(this.dummy_)return;var contains=e.getSystemBits().get(this.systemIndex_);
var interested=true;var componentBits=e.getComponentBits();if(!this.allSet_.isEmpty())for(var i=this.allSet_.nextSetBit(0);i>=0;i=this.allSet_.nextSetBit(i+1))if(!componentBits.get(i)){interested=false;break}if(!this.exclusionSet_.isEmpty()&&interested)interested=!this.exclusionSet_.intersects(componentBits);if(!this.oneSet_.isEmpty())interested=this.oneSet_.intersects(componentBits);if(interested&&!contains)this.insertToSystem(e);else if(!interested&&contains)this.removeFromSystem(e)};EntitySystem.prototype.removeFromSystem=
function(e){this.actives_.remove(e);e.getSystemBits().clear(this.systemIndex_);this.removed(e)};EntitySystem.prototype.insertToSystem=function(e){this.actives_.add(e);e.getSystemBits().set(this.systemIndex_);this.inserted(e)};EntitySystem.prototype.added=function(e){this.check(e)};EntitySystem.prototype.changed=function(e){this.check(e)};EntitySystem.prototype.deleted=function(e){if(e.getSystemBits().get(this.systemIndex_))this.removeFromSystem(e)};EntitySystem.prototype.disabled=function(e){if(e.getSystemBits().get(this.systemIndex_))this.removeFromSystem(e)};
EntitySystem.prototype.enabled=function(e){this.check(e)};EntitySystem.prototype.setWorld=function(world){this.world=world};EntitySystem.prototype.isPassive=function(){return this.passive_};EntitySystem.prototype.setPassive=function(passive){this.passive_=passive};EntitySystem.prototype.getActive=function(){return this.actives_};EntitySystem.blackBoard=new BlackBoard;return EntitySystem}();artemis.EntitySystem=EntitySystem;var SystemIndexManager=function(){function SystemIndexManager(){}SystemIndexManager.getIndexFor=
function(es){var index=SystemIndexManager.indices.get(es);if(index===undefined){index=SystemIndexManager.INDEX++;SystemIndexManager.indices.put(es,index)}return index};SystemIndexManager.INDEX=0;SystemIndexManager.indices=new HashMap;return SystemIndexManager}()})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var managers;(function(managers){var Bag=artemis.utils.Bag;var HashMap=artemis.utils.HashMap;var Manager=artemis.Manager;var GroupManager=function(_super){__extends(GroupManager,_super);function GroupManager(){_super.call(this);this.entitiesByGroup_=new HashMap;this.groupsByEntity_=new HashMap}GroupManager.prototype.initialize=function(){};GroupManager.prototype.add=function(e,group){var entities=this.entitiesByGroup_.get(group);if(entities==null){entities=new Bag;this.entitiesByGroup_.put(group,
entities)}entities.add(e);var groups=this.groupsByEntity_.get(e);if(groups==null){groups=new Bag;this.groupsByEntity_.put(e,groups)}groups.add(group)};GroupManager.prototype.remove=function(e,group){var entities=this.entitiesByGroup_.get(group);if(entities!=null)entities.remove(e);var groups=this.groupsByEntity_.get(e);if(groups!=null)groups.remove(group)};GroupManager.prototype.removeFromAllGroups=function(e){var groups=this.groupsByEntity_.get(e);if(groups!=null){for(var i=0,s=groups.size();s>i;i++){var entities=
this.entitiesByGroup_.get(groups.get(i));if(entities!=null)entities.remove(e)}groups.clear()}};GroupManager.prototype.getEntities=function(group){var entities=this.entitiesByGroup_.get(group);if(entities==null){entities=new Bag;this.entitiesByGroup_.put(group,entities)}return entities};GroupManager.prototype.getGroups=function(e){return this.groupsByEntity_.get(e)};GroupManager.prototype.isInAnyGroup=function(e){return this.getGroups(e)!=null};GroupManager.prototype.isInGroup=function(e,group){if(group!=
null){var groups=this.groupsByEntity_.get(e);for(var i=0,s=groups.size();s>i;i++){var g=groups.get(i);if(group===g)return true}}return false};GroupManager.prototype.deleted=function(e){this.removeFromAllGroups(e)};return GroupManager}(Manager);managers.GroupManager=GroupManager})(managers=artemis.managers||(artemis.managers={}))})(artemis||(artemis={}));
var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var managers;(function(managers){var Bag=artemis.utils.Bag;var HashMap=artemis.utils.HashMap;var Manager=artemis.Manager;var PlayerManager=function(_super){__extends(PlayerManager,_super);function PlayerManager(){_super.call(this);this.playerByEntity_=new HashMap;this.entitiesByPlayer_=new HashMap}PlayerManager.prototype.setPlayer=function(e,player){this.playerByEntity_.put(e,player);var entities=this.entitiesByPlayer_.get(player);if(entities==null){entities=new Bag;this.entitiesByPlayer_.put(player,
entities)}entities.add(e)};PlayerManager.prototype.getEntitiesOfPlayer=function(player){var entities=this.entitiesByPlayer_.get(player);if(entities==null)entities=new Bag;return entities};PlayerManager.prototype.removeFromPlayer=function(e){var player=this.playerByEntity_.get(e);if(player!==null){var entities=this.entitiesByPlayer_.get(player);if(entities!==null)entities.remove(e)}};PlayerManager.prototype.getPlayer=function(e){return this.playerByEntity_.get(e)};PlayerManager.prototype.initialize=
function(){};PlayerManager.prototype.deleted=function(e){this.removeFromPlayer(e)};return PlayerManager}(Manager);managers.PlayerManager=PlayerManager})(managers=artemis.managers||(artemis.managers={}))})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var managers;(function(managers){var HashMap=artemis.utils.HashMap;var Manager=artemis.Manager;var TagManager=function(_super){__extends(TagManager,_super);function TagManager(){_super.call(this);this.entitiesByTag_=new HashMap;this.tagsByEntity_=new HashMap}TagManager.prototype.register=function(tag,e){this.entitiesByTag_.put(tag,e);this.tagsByEntity_.put(e,tag)};TagManager.prototype.unregister=function(tag){this.tagsByEntity_.remove(this.entitiesByTag_.remove(tag))};TagManager.prototype.isRegistered=
function(tag){return this.entitiesByTag_.containsKey(tag)};TagManager.prototype.getEntity=function(tag){return this.entitiesByTag_.get(tag)};TagManager.prototype.getRegisteredTags=function(){return this.tagsByEntity_.values()};TagManager.prototype.deleted=function(e){var removedTag=this.tagsByEntity_.remove(e);if(removedTag!=null)this.entitiesByTag_.remove(removedTag)};TagManager.prototype.initialize=function(){};return TagManager}(Manager);managers.TagManager=TagManager})(managers=artemis.managers||
(artemis.managers={}))})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var managers;(function(managers){var Bag=artemis.utils.Bag;var HashMap=artemis.utils.HashMap;var Manager=artemis.Manager;var TeamManager=function(_super){__extends(TeamManager,_super);function TeamManager(){_super.call(this);this.playersByTeam_=new HashMap;this.teamByPlayer_=new HashMap}TeamManager.prototype.initialize=function(){};TeamManager.prototype.getTeam=function(player){return this.teamByPlayer_.get(player)};TeamManager.prototype.setTeam=function(player,team){this.removeFromTeam(player);
this.teamByPlayer_.put(player,team);var players=this.playersByTeam_.get(team);if(players==null){players=new Bag;this.playersByTeam_.put(team,players)}players.add(player)};TeamManager.prototype.getPlayers=function(team){return this.playersByTeam_.get(team)};TeamManager.prototype.removeFromTeam=function(player){var team=this.teamByPlayer_.remove(player);if(team!=null){var players=this.playersByTeam_.get(team);if(players!=null)players.remove(player)}};return TeamManager}(Manager);managers.TeamManager=
TeamManager})(managers=artemis.managers||(artemis.managers={}))})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var systems;(function(systems){var EntitySystem=artemis.EntitySystem;var DelayedEntityProcessingSystem=function(_super){__extends(DelayedEntityProcessingSystem,_super);function DelayedEntityProcessingSystem(aspect){_super.call(this,aspect)}DelayedEntityProcessingSystem.prototype.processEntities=function(entities){for(var i=0,s=entities.size();s>i;i++){var entity=entities.get(i);this.processDelta(entity,this.acc_);var remaining=this.getRemainingDelay(entity);if(remaining<=0)this.processExpired(entity);
else this.offerDelay(remaining)}this.stop()};DelayedEntityProcessingSystem.prototype.inserted=function(e){var delay=this.getRemainingDelay(e);if(delay>0)this.offerDelay(delay)};DelayedEntityProcessingSystem.prototype.getRemainingDelay=function(e){throw Error("Abstract Method");};DelayedEntityProcessingSystem.prototype.checkProcessing=function(){if(this.running_)if((this.acc_+=this.world.getDelta())>=this.delay_)return true;return false};DelayedEntityProcessingSystem.prototype.processDelta=function(e,
accumulatedDelta){};DelayedEntityProcessingSystem.prototype.processExpired=function(e){};DelayedEntityProcessingSystem.prototype.restart=function(delay){this.delay_=delay;this.acc_=0;this.running_=true};DelayedEntityProcessingSystem.prototype.offerDelay=function(delay){if(!this.running_||delay<this.getRemainingTimeUntilProcessing())this.restart(delay)};DelayedEntityProcessingSystem.prototype.getInitialTimeDelay=function(){return this.delay_};DelayedEntityProcessingSystem.prototype.getRemainingTimeUntilProcessing=
function(){if(this.running_)return this.delay_-this.acc_;return 0};DelayedEntityProcessingSystem.prototype.isRunning=function(){return this.running_};DelayedEntityProcessingSystem.prototype.stop=function(){this.running_=false;this.acc_=0};return DelayedEntityProcessingSystem}(EntitySystem);systems.DelayedEntityProcessingSystem=DelayedEntityProcessingSystem})(systems=artemis.systems||(artemis.systems={}))})(artemis||(artemis={}));
var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var systems;(function(systems){var EntitySystem=artemis.EntitySystem;var EntityProcessingSystem=function(_super){__extends(EntityProcessingSystem,_super);function EntityProcessingSystem(aspect){_super.call(this,aspect)}EntityProcessingSystem.prototype.processEach=function(e){};EntityProcessingSystem.prototype.processEntities=function(entities){for(var i=0,s=entities.size();s>i;i++)this.processEach(entities.get(i))};EntityProcessingSystem.prototype.checkProcessing=function(){return true};
return EntityProcessingSystem}(EntitySystem);systems.EntityProcessingSystem=EntityProcessingSystem})(systems=artemis.systems||(artemis.systems={}))})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var systems;(function(systems){var EntitySystem=artemis.EntitySystem;var IntervalEntitySystem=function(_super){__extends(IntervalEntitySystem,_super);function IntervalEntitySystem(aspect,interval){_super.call(this,aspect);this.acc_=0;this.interval_=0;this.interval_=interval}IntervalEntitySystem.prototype.checkProcessing=function(){if((this.acc_+=this.world.getDelta())>=this.interval_){this.acc_-=this.interval_;return true}return false};return IntervalEntitySystem}(EntitySystem);
systems.IntervalEntitySystem=IntervalEntitySystem})(systems=artemis.systems||(artemis.systems={}))})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var systems;(function(systems){var EntitySystem=artemis.EntitySystem;var Aspect=artemis.Aspect;var VoidEntitySystem=function(_super){__extends(VoidEntitySystem,_super);function VoidEntitySystem(){_super.call(this,Aspect.getEmpty())}VoidEntitySystem.prototype.processEntities=function(entities){this.processSystem()};VoidEntitySystem.prototype.processSystem=function(){};VoidEntitySystem.prototype.checkProcessing=function(){return true};return VoidEntitySystem}(EntitySystem);systems.VoidEntitySystem=
VoidEntitySystem})(systems=artemis.systems||(artemis.systems={}))})(artemis||(artemis={}));var __extends=this&&this.__extends||function(d,b){for(var p in b)if(b.hasOwnProperty(p))d[p]=b[p];function __(){this.constructor=d}d.prototype=b===null?Object.create(b):(__.prototype=b.prototype,new __)};var artemis;
(function(artemis){var systems;(function(systems){var IntervalEntitySystem=artemis.systems.IntervalEntitySystem;var IntervalEntityProcessingSystem=function(_super){__extends(IntervalEntityProcessingSystem,_super);function IntervalEntityProcessingSystem(aspect,interval){_super.call(this,aspect,interval)}IntervalEntityProcessingSystem.prototype.processEach=function(e){};IntervalEntityProcessingSystem.prototype.processEntities=function(entities){for(var i=0,s=entities.size();s>i;i++)this.processEach(entities.get(i))};
return IntervalEntityProcessingSystem}(IntervalEntitySystem);systems.IntervalEntityProcessingSystem=IntervalEntityProcessingSystem})(systems=artemis.systems||(artemis.systems={}))})(artemis||(artemis={}));

/**
 * core/Constants.ts
 *
 * Core Constants for Schmup Warz
 *
 */
var example;
(function (example) {
    var core;
    (function (core) {
        /**
         * GroupManager Groups
         */
        (function (Groups) {
            Groups[Groups["PLAYER_BULLETS"] = 0] = "PLAYER_BULLETS";
            Groups[Groups["PLAYER_SHIP"] = 1] = "PLAYER_SHIP";
            Groups[Groups["PLAYER_LIVES"] = 2] = "PLAYER_LIVES";
            Groups[Groups["PLAYER_STATUS"] = 3] = "PLAYER_STATUS";
            Groups[Groups["ENEMY_SHIPS"] = 4] = "ENEMY_SHIPS";
            Groups[Groups["ENEMY_BULLETS"] = 5] = "ENEMY_BULLETS";
            Groups[Groups["ENEMY_MINES"] = 6] = "ENEMY_MINES";
            Groups[Groups["GUI"] = 7] = "GUI";
            Groups[Groups["GUI_CREDITS"] = 8] = "GUI_CREDITS";
            Groups[Groups["GUI_LEADERBOARD"] = 9] = "GUI_LEADERBOARD";
        })(core.Groups || (core.Groups = {}));
        var Groups = core.Groups;
        (function (ScaleType) {
            ScaleType[ScaleType["FILL"] = 0] = "FILL";
            ScaleType[ScaleType["FIXED"] = 1] = "FIXED"; // scale fixed size to fit the screen
        })(core.ScaleType || (core.ScaleType = {}));
        var ScaleType = core.ScaleType;
        var Constants = (function () {
            function Constants() {
            }
            Constants.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            Constants.theme = 'kenney';
            Constants.font = { font: '18px Skranji', align: 'left' };
            Constants.appName = "schmupwarz";
            Constants.FRAME_WIDTH = window.innerWidth;
            Constants.FRAME_HEIGHT = window.innerHeight;
            Constants.RATIO = window.devicePixelRatio * .6;
            Constants.SCALE_TYPE = ScaleType.FILL;
            Constants.properties = {
                skip: "false",
                leaderboard: "off",
                player: "",
                userId: "",
                playMusic: "true",
                playSfx: "true" // soundfx volume
            };
            Constants.assets = {
                images_json: 'res/images.json',
                logo_png: 'res/images/logo.png',
                panel_png: 'res/images/panel.png',
                opendyslexic20_fnt: 'res/ezgui/fonts/OpenDyslexic20.fnt',
                opendyslexic24_fnt: 'res/ezgui/fonts/OpenDyslexic24.fnt',
                opendyslexic32_fnt: 'res/ezgui/fonts/OpenDyslexic32.fnt',
                normal_fnt: 'res/ezgui/fonts/normal.fnt',
                hud_fnt: 'res/ezgui/fonts/hud.fnt',
                desyrel_fnt: 'res/ezgui/fonts/desyrel.fnt',
                skranji_fnt: 'res/ezgui/fonts/Skranji-Bold-40.fnt',
                asplode_ogg: 'res/sounds/asplode.ogg',
                pew_ogg: 'res/sounds/pew.ogg',
                smallasplode_ogg: 'res/sounds/smallasplode.ogg',
                parallaxStars_frag: 'res/glsl/parallaxStars.frag'
            };
            Constants.fortune = [
                '♬ Give me those ♫ Schmup Wars',
                "I <3 URANUS",
                'May the Schmup be with you',
                "Schmup It Good!",
                "So, at last we meet for the \nfirst time for the last time",
                "I am your father's brother's \nmother's cousin's ex \nwife's lawyer's father's",
                'The schmup is strong in this one',
                "Prepare for ludicrous speed!",
                "We are not men we are schmup",
                'Schmup is the path to the\n dark side',
                "There goes the planet"
            ];
            Constants.credits = "\n    Built by darkoverlordofdata, using artmemis, pixi.js,\n    localStorageDB, howler, and ezgui.\n\n    Schmup Warz is a demo of ArtemisTS, and is based on\n    Spaceship Warrior by @Flet\n    (https://github.com/Flet/spaceship-warrior-gradle)\n\n    MIT License\n    ";
            return Constants;
        })();
        core.Constants = Constants;
    })(core = example.core || (example.core = {}));
})(example || (example = {}));
//# sourceMappingURL=Constants.js.map
/**
 * core/Properties.ts
 *
 * Persist properties using LocalStorage
 *
 */
var example;
(function (example) {
    var core;
    (function (core) {
        var Properties = (function () {
            function Properties() {
            }
            Properties.init = function (name, properties) {
                if (Properties.db !== null)
                    return;
                /** Initialize the db with the properties */
                function initializeDb(db) {
                    if (db.isNew()) {
                        db.createTable("settings", ["name", "value"]);
                        db.createTable("leaderboard", ["date", "score"]);
                        for (var key in properties) {
                            if (properties.hasOwnProperty(key)) {
                                db.insert("settings", {
                                    name: key,
                                    value: properties[key]
                                });
                            }
                        }
                        db.commit();
                    }
                }
                Properties.dbname = name;
                Properties.properties = properties;
                //initializeDb(Properties.db = new localStorageDB(Properties.dbname));
                if (window['cordova'] || navigator['isCocoonJS']) {
                    // use localStorage only
                    initializeDb(Properties.db = new localStorageDB(Properties.dbname));
                }
                else {
                    // try chrome.storage with fallback to localStorage
                    chromeStorageDB(Properties.dbname, localStorage, function (db) { return initializeDb(Properties.db = db); });
                }
            };
            /*
             * Get Game Property from local storage
             *
             * @param property name
             * @return property value
             */
            Properties.get = function (prop) {
                return Properties.db.queryAll("settings", {
                    query: {
                        name: prop
                    }
                })[0].value;
            };
            Properties.setScore = function (score) {
                var today = new Date();
                var mm = (today.getMonth() + 1).toString();
                if (mm.length === 1)
                    mm = '0' + mm;
                var dd = today.getDate().toString();
                if (dd.length === 1)
                    dd = '0' + dd;
                var yyyy = today.getFullYear().toString();
                var yyyymmdd = yyyy + mm + dd;
                if (0 === Properties.db.queryAll('leaderboard', { query: { date: yyyymmdd } }).length) {
                    Properties.db.insert('leaderboard', { date: yyyymmdd, score: score });
                }
                else {
                    Properties.db.update('leaderboard', { date: yyyymmdd }, function (row) {
                        if (score > row.score) {
                            row.score = score;
                        }
                        return row;
                    });
                }
                Properties.db.commit();
            };
            Properties.getLeaderboard = function (count) {
                return Properties.db.queryAll('leaderboard', { limit: count, sort: [['score', 'DESC']] });
            };
            Properties.db = null;
            Properties.dbname = "";
            Properties.properties = null;
            /*
             * Set Game Property in local storage
             *
             * @param property name
             * @param property value
             * @return nothing
             */
            Properties.set = function (prop, value) {
                Properties.db.update("settings", {
                    name: prop
                }, function (row) {
                    row.value = "" + value;
                    return row;
                });
                Properties.db.commit();
            };
            return Properties;
        })();
        core.Properties = Properties;
    })(core = example.core || (example.core = {}));
})(example || (example = {}));
//# sourceMappingURL=Properties.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var components;
    (function (components) {
        var PooledComponent = artemis.PooledComponent;
        var Pooled = artemis.annotations.Pooled;
        var Background = (function (_super) {
            __extends(Background, _super);
            function Background() {
                _super.apply(this, arguments);
            }
            Background.prototype.initialize = function (filter) {
                if (filter === void 0) { filter = null; }
                this.filter = filter;
            };
            Background.className = 'Background';
            Background = __decorate([
                Pooled()
            ], Background);
            return Background;
        })(PooledComponent);
        components.Background = Background;
        Background.prototype.filter = null;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Background.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var components;
    (function (components) {
        var PooledComponent = artemis.PooledComponent;
        var Pooled = artemis.annotations.Pooled;
        var Bounds = (function (_super) {
            __extends(Bounds, _super);
            function Bounds() {
                _super.apply(this, arguments);
            }
            Bounds.prototype.initialize = function (radius) {
                if (radius === void 0) { radius = 0; }
                this.radius = radius;
            };
            Bounds.className = 'Bounds';
            Bounds = __decorate([
                Pooled()
            ], Bounds);
            return Bounds;
        })(PooledComponent);
        components.Bounds = Bounds;
        Bounds.prototype.radius = 0;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Bounds.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var example;
(function (example) {
    var components;
    (function (components) {
        var Component = artemis.Component;
        var ColorAnimation = (function (_super) {
            __extends(ColorAnimation, _super);
            function ColorAnimation() {
                _super.apply(this, arguments);
            }
            ColorAnimation.prototype.initialize = function (lambda) {
                if (lambda !== undefined) {
                    lambda(this);
                }
            };
            ColorAnimation.className = 'ColorAnimation';
            return ColorAnimation;
        })(Component);
        components.ColorAnimation = ColorAnimation;
        ColorAnimation.prototype.redMin = 0;
        ColorAnimation.prototype.redMax = 0;
        ColorAnimation.prototype.redSpeed = 0;
        ColorAnimation.prototype.redAnimate = false;
        ColorAnimation.prototype.greenMin = 0;
        ColorAnimation.prototype.greenMax = 0;
        ColorAnimation.prototype.greenSpeed = 0;
        ColorAnimation.prototype.greenAnimate = false;
        ColorAnimation.prototype.blueMin = 0;
        ColorAnimation.prototype.blueMax = 0;
        ColorAnimation.prototype.blueSpeed = 0;
        ColorAnimation.prototype.blueAnimate = false;
        ColorAnimation.prototype.alphaMin = 0;
        ColorAnimation.prototype.alphaMax = 0;
        ColorAnimation.prototype.alphaSpeed = 0;
        ColorAnimation.prototype.alphaAnimate = false;
        ColorAnimation.prototype.repeat = false;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=ColorAnimation.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var example;
(function (example) {
    var components;
    (function (components) {
        var Component = artemis.Component;
        var Enemy = (function (_super) {
            __extends(Enemy, _super);
            function Enemy() {
                _super.apply(this, arguments);
            }
            Enemy.className = 'Enemy';
            return Enemy;
        })(Component);
        components.Enemy = Enemy;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Enemy.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var components;
    (function (components) {
        var PooledComponent = artemis.PooledComponent;
        var Pooled = artemis.annotations.Pooled;
        var Expires = (function (_super) {
            __extends(Expires, _super);
            function Expires() {
                _super.apply(this, arguments);
            }
            Expires.prototype.initialize = function (delay) {
                if (delay === void 0) { delay = 0; }
                this.delay = delay;
            };
            Expires.className = 'Expires';
            Expires = __decorate([
                Pooled()
            ], Expires);
            return Expires;
        })(PooledComponent);
        components.Expires = Expires;
        Expires.prototype.delay = 0;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Expires.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var components;
    (function (components) {
        var PooledComponent = artemis.PooledComponent;
        var Pooled = artemis.annotations.Pooled;
        var Gui = (function (_super) {
            __extends(Gui, _super);
            function Gui() {
                _super.apply(this, arguments);
            }
            Gui.prototype.initialize = function (gui) {
                this.gui = gui;
            };
            Gui.className = 'Gui';
            Gui = __decorate([
                Pooled()
            ], Gui);
            return Gui;
        })(PooledComponent);
        components.Gui = Gui;
        Gui.prototype.gui = null;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Gui.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var example;
(function (example) {
    var components;
    (function (components) {
        var Component = artemis.Component;
        var Health = (function (_super) {
            __extends(Health, _super);
            function Health() {
                _super.apply(this, arguments);
            }
            Health.prototype.initialize = function (health, maximumHealth) {
                if (health === void 0) { health = 0; }
                if (maximumHealth === void 0) { maximumHealth = 0; }
                this.health = health;
                this.maximumHealth = maximumHealth;
            };
            Health.className = 'Health';
            return Health;
        })(Component);
        components.Health = Health;
        Health.prototype.health = 0;
        Health.prototype.maximumHealth = 0;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Health.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var example;
(function (example) {
    var components;
    (function (components) {
        var Component = artemis.Component;
        var Mine = (function (_super) {
            __extends(Mine, _super);
            function Mine() {
                _super.apply(this, arguments);
            }
            Mine.className = 'Mine';
            return Mine;
        })(Component);
        components.Mine = Mine;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Mine.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var example;
(function (example) {
    var components;
    (function (components) {
        var Component = artemis.Component;
        var ParallaxStar = (function (_super) {
            __extends(ParallaxStar, _super);
            function ParallaxStar() {
                _super.apply(this, arguments);
            }
            ParallaxStar.className = 'ParallaxStar';
            return ParallaxStar;
        })(Component);
        components.ParallaxStar = ParallaxStar;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=ParallaxStar.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var example;
(function (example) {
    var components;
    (function (components) {
        var Component = artemis.Component;
        var Player = (function (_super) {
            __extends(Player, _super);
            function Player() {
                _super.apply(this, arguments);
            }
            Player.className = 'Player';
            return Player;
        })(Component);
        components.Player = Player;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Player.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var components;
    (function (components) {
        var PooledComponent = artemis.PooledComponent;
        var Pooled = artemis.annotations.Pooled;
        var Position = (function (_super) {
            __extends(Position, _super);
            function Position() {
                _super.apply(this, arguments);
            }
            Position.prototype.initialize = function (x, y) {
                if (x === void 0) { x = 0; }
                if (y === void 0) { y = 0; }
                this.x = x;
                this.y = y;
            };
            Position.className = 'Position';
            Position = __decorate([
                Pooled()
            ], Position);
            return Position;
        })(PooledComponent);
        components.Position = Position;
        Position.prototype.x = 0;
        Position.prototype.y = 0;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Position.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var example;
(function (example) {
    var components;
    (function (components) {
        var Component = artemis.Component;
        var ScaleAnimation = (function (_super) {
            __extends(ScaleAnimation, _super);
            function ScaleAnimation() {
                _super.apply(this, arguments);
            }
            ScaleAnimation.prototype.initialize = function (lambda) {
                if (lambda !== undefined) {
                    lambda(this);
                }
            };
            ScaleAnimation.className = 'ScaleAnimation';
            return ScaleAnimation;
        })(Component);
        components.ScaleAnimation = ScaleAnimation;
        ScaleAnimation.prototype.min = 0;
        ScaleAnimation.prototype.max = 0;
        ScaleAnimation.prototype.speed = 0;
        ScaleAnimation.prototype.repeat = false;
        ScaleAnimation.prototype.active = false;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=ScaleAnimation.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var components;
    (function (components) {
        var PooledComponent = artemis.PooledComponent;
        var Pooled = artemis.annotations.Pooled;
        (function (EFFECT) {
            EFFECT[EFFECT["PEW"] = 0] = "PEW";
            EFFECT[EFFECT["ASPLODE"] = 1] = "ASPLODE";
            EFFECT[EFFECT["SMALLASPLODE"] = 2] = "SMALLASPLODE";
        })(components.EFFECT || (components.EFFECT = {}));
        var EFFECT = components.EFFECT;
        var SoundEffect = (function (_super) {
            __extends(SoundEffect, _super);
            function SoundEffect() {
                _super.apply(this, arguments);
            }
            SoundEffect.prototype.initialize = function (effect) {
                if (effect === void 0) { effect = EFFECT.PEW; }
                this.effect = effect;
            };
            SoundEffect.className = 'SoundEffect';
            SoundEffect = __decorate([
                Pooled()
            ], SoundEffect);
            return SoundEffect;
        })(PooledComponent);
        components.SoundEffect = SoundEffect;
        SoundEffect.prototype.effect = EFFECT.PEW;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=SoundEffect.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var components;
    (function (components) {
        var Constants = example.core.Constants;
        var PooledComponent = artemis.PooledComponent;
        var Pooled = artemis.annotations.Pooled;
        var Texture = PIXI.Texture;
        var ZSprite = PIXI.Sprite;
        /**
         * ZSprite!?! Is that SAP?
         * Careful with that axe, Eugene.
         */
        (function (Layer) {
            Layer[Layer["DEFAULT"] = 0] = "DEFAULT";
            Layer[Layer["BACKGROUND"] = 1] = "BACKGROUND";
            Layer[Layer["TEXT"] = 2] = "TEXT";
            Layer[Layer["LIVES"] = 3] = "LIVES";
            Layer[Layer["MINES"] = 4] = "MINES";
            Layer[Layer["ACTORS_1"] = 5] = "ACTORS_1";
            Layer[Layer["ACTORS_2"] = 6] = "ACTORS_2";
            Layer[Layer["ACTORS_3"] = 7] = "ACTORS_3";
            Layer[Layer["PARTICLES"] = 8] = "PARTICLES";
        })(components.Layer || (components.Layer = {}));
        var Layer = components.Layer;
        var Sprite = (function (_super) {
            __extends(Sprite, _super);
            function Sprite() {
                _super.apply(this, arguments);
            }
            Sprite.prototype.initialize = function (name, lambda) {
                var _this = this;
                var ctor = {
                    'string': function () {
                        _this.name = name;
                        var s = _this.sprite_ = new ZSprite(Texture.fromFrame(_this.name + ".png"));
                        s.scale.set(1 / Constants.RATIO);
                        s.anchor.set(.5, .5);
                    },
                    'object': function () {
                        _this.sprite_ = name;
                    },
                    'function': function () {
                        _this.sprite_ = new ZSprite();
                        lambda = name;
                    }
                }[typeof name];
                if (ctor)
                    ctor();
                if (lambda)
                    lambda(this);
            };
            Sprite.prototype.addTo = function (layer) {
                this.sprite_['layer'] = this.layer;
                layer.addChild(this.sprite_, 0);
                layer.children.sort(function (a, b) {
                    if (a['layer'] < b['layer'])
                        return -1;
                    if (a['layer'] > b['layer'])
                        return 1;
                    return 0;
                });
            };
            Sprite.prototype.removeFrom = function (layer) {
                layer.removeChild(this.sprite_);
            };
            Sprite.prototype.reset = function () {
                this.sprite_ = null;
            };
            Sprite.className = 'Sprite';
            Sprite = __decorate([
                Pooled()
            ], Sprite);
            return Sprite;
        })(PooledComponent);
        components.Sprite = Sprite;
        Sprite.prototype.layer = Layer.DEFAULT;
        Sprite.prototype.name = '';
        Sprite.prototype.sprite_ = null;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Sprite.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var components;
    (function (components) {
        var PooledComponent = artemis.PooledComponent;
        var Pooled = artemis.annotations.Pooled;
        var Sprite = PIXI.Sprite;
        var Texture = PIXI.Texture;
        var Vital = (function (_super) {
            __extends(Vital, _super);
            function Vital() {
                _super.apply(this, arguments);
            }
            Vital.prototype.initialize = function (good, bad, lambda) {
                this.good = new Sprite(Texture.fromFrame(good + ".png"));
                this.bad = new Sprite(Texture.fromFrame(bad + ".png"));
                if (lambda)
                    lambda(this);
            };
            Vital.className = 'Vital';
            Vital = __decorate([
                Pooled()
            ], Vital);
            return Vital;
        })(PooledComponent);
        components.Vital = Vital;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Vital.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var components;
    (function (components) {
        var PooledComponent = artemis.PooledComponent;
        var Pooled = artemis.annotations.Pooled;
        var Velocity = (function (_super) {
            __extends(Velocity, _super);
            function Velocity() {
                _super.apply(this, arguments);
            }
            Velocity.prototype.initialize = function (vectorX, vectorY) {
                if (vectorX === void 0) { vectorX = 0; }
                if (vectorY === void 0) { vectorY = 0; }
                this.vectorX = vectorX;
                this.vectorY = vectorY;
            };
            Velocity.className = 'Velocity';
            Velocity = __decorate([
                Pooled()
            ], Velocity);
            return Velocity;
        })(PooledComponent);
        components.Velocity = Velocity;
        Velocity.prototype.vectorX = 0;
        Velocity.prototype.vectorY = 0;
    })(components = example.components || (example.components = {}));
})(example || (example = {}));
//# sourceMappingURL=Velocity.js.map
var example;
(function (example) {
    var views;
    (function (views) {
        var Fonts = (function () {
            function Fonts() {
            }
            Fonts.font45 = {
                size: '45px',
                fontWeight: 'bold',
                family: 'OpenDyslexic',
                color: '8f8'
            };
            Fonts.font32 = {
                size: '32px',
                fontWeight: 'bold',
                family: 'OpenDyslexic',
                color: '8f8'
            };
            Fonts.font20 = {
                size: '20px',
                fontWeight: 'bold',
                family: 'OpenDyslexic',
                color: '8f8'
            };
            return Fonts;
        })();
        views.Fonts = Fonts;
    })(views = example.views || (example.views = {}));
})(example || (example = {}));
//# sourceMappingURL=Fonts.js.map
/**
 * views/AbstractView.ts
 *
 * Base class for Views
 *
 */
var example;
(function (example) {
    var views;
    (function (views) {
        var Constants = example.core.Constants;
        var AbstractView = (function () {
            function AbstractView(options) {
                if (options === void 0) { options = {}; }
                this.options = options;
                this._view = EZGUI.create(this.options, Constants.theme);
                this.initialize();
            }
            Object.defineProperty(AbstractView.prototype, "view", {
                get: function () {
                    return this._view;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(AbstractView.prototype, "visible", {
                get: function () {
                    return this._view.visible;
                },
                set: function (value) {
                    this._view.visible = value;
                },
                enumerable: true,
                configurable: true
            });
            AbstractView.prototype.initialize = function () { };
            return AbstractView;
        })();
        views.AbstractView = AbstractView;
    })(views = example.views || (example.views = {}));
})(example || (example = {}));
//# sourceMappingURL=AbstractView.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/**
 * views/MenuView.ts
 *
 * Main application menu
 *
 */
var example;
(function (example) {
    var views;
    (function (views) {
        var color = '#c0c0c0';
        var EntitySystem = artemis.EntitySystem;
        var AbstractView = example.views.AbstractView;
        var CreditsView = (function (_super) {
            __extends(CreditsView, _super);
            function CreditsView(parent) {
                var _this = this;
                _super.call(this, {
                    id: 'creditsScreen',
                    component: 'Window',
                    padding: 4,
                    color: '#bcd8fe',
                    position: { x: 0, y: 0 },
                    //header: { position: { x: 20, y: 20 }, height: 120, width: 360, image:'res/images/Logo.png', },
                    width: window.innerWidth,
                    height: window.innerHeight,
                    layout: [1, 1],
                    children: [
                        {
                            id: 'buttonCreditsBack',
                            text: 'BACK',
                            component: 'Button',
                            position: { x: (window.innerWidth - 200) / 2, y: window.innerHeight * .85 },
                            color: color,
                            font: {
                                size: '24px',
                                family: 'Skranji',
                                color: 'white'
                            },
                            anchor: { x: 0.5, y: 0.5 },
                            width: 200,
                            height: 50
                        }
                    ]
                });
                this.parent = parent;
                this.backOnClick = function (e) {
                    _this.parent.system.hideCredits();
                    _this.hide(_this.next);
                };
                this.show = function (next) {
                    _this.next = next;
                    _this._view.visible = true;
                };
                this.hide = function (next) {
                    _this._view.visible = false;
                    next();
                };
            }
            CreditsView.prototype.initialize = function () {
                var _this = this;
                this.back = EZGUI.components.buttonCreditsBack;
                this.back.on('click', function (e) { return _this.backOnClick(e); });
                this.view['layer'] = -1;
                var c = EntitySystem.blackBoard.getEntry('sprites');
                c.addChild(this.view);
            };
            return CreditsView;
        })(AbstractView);
        views.CreditsView = CreditsView;
    })(views = example.views || (example.views = {}));
})(example || (example = {}));
//# sourceMappingURL=CreditsView.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/**
 * views/OptionsView.ts
 *
 * Set preferences, view scores
 *
 */
var example;
(function (example) {
    var views;
    (function (views) {
        var color = '#c0c0c0';
        var font = {
            size: '12px',
            family: 'Skranji',
            color: 'white'
        };
        var EntitySystem = artemis.EntitySystem;
        var AbstractView = example.views.AbstractView;
        var LeaderboardView = (function (_super) {
            __extends(LeaderboardView, _super);
            function LeaderboardView(parent) {
                var _this = this;
                _super.call(this, {
                    id: 'scoreScreen',
                    component: 'Window',
                    padding: 4,
                    color: '#bcd8fe',
                    position: { x: 0, y: 0 },
                    //header: { position: { x: 20, y: 20 }, height: 120, width: 360, image:'res/images/Logo.png', },
                    width: window.innerWidth,
                    height: window.innerHeight,
                    layout: [1, 1],
                    children: [
                        {
                            id: 'buttonLeaderboardBack',
                            text: 'BACK',
                            component: 'Button',
                            position: { x: (window.innerWidth - 200) / 2, y: window.innerHeight * .85 },
                            color: color,
                            font: {
                                size: '24px',
                                family: 'Skranji',
                                color: 'white'
                            },
                            anchor: { x: 0.5, y: 0.5 },
                            width: 200,
                            height: 50
                        }
                    ]
                });
                this.parent = parent;
                this.backOnClick = function (e) {
                    _this.hide(_this.next);
                    _this.parent.system.hideLeaderboard();
                };
                this.show = function (next) {
                    _this.next = next;
                    _this._view.visible = true;
                };
                this.hide = function (next) {
                    _this._view.visible = false;
                    next();
                };
            }
            LeaderboardView.prototype.initialize = function () {
                var _this = this;
                this.back = EZGUI.components.buttonLeaderboardBack;
                this.back.on('click', function (e) { return _this.backOnClick(e); });
                this.view['layer'] = -1;
                var c = EntitySystem.blackBoard.getEntry('sprites');
                c.addChild(this.view);
            };
            return LeaderboardView;
        })(AbstractView);
        views.LeaderboardView = LeaderboardView;
    })(views = example.views || (example.views = {}));
})(example || (example = {}));
//# sourceMappingURL=LeaderboardView.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/**
 * views/MenuView.ts
 *
 * Main application menu
 *
 */
var example;
(function (example) {
    var views;
    (function (views) {
        var AbstractView = example.views.AbstractView;
        var LeaderboardView = example.views.LeaderboardView;
        var CreditsView = example.views.CreditsView;
        //const color = '#29d87e';
        var color = '#c0c0c0';
        var MenuView = (function (_super) {
            __extends(MenuView, _super);
            function MenuView(system) {
                var _this = this;
                _super.call(this, {
                    id: 'mainScreen',
                    component: 'Window',
                    padding: 4,
                    color: '#bcd8fe',
                    position: { x: 0, y: 0 },
                    //header: { position: { x: 20, y: 20 }, height: 120, width: 360, image:'res/images/Logo.png', },
                    width: window.innerWidth,
                    height: window.innerHeight,
                    layout: [1, 7],
                    children: [
                        {
                            id: 'labelTitle',
                            component: 'label',
                            position: { x: -1000, y: -1000 },
                            height: 120,
                            width: 380,
                            color: color,
                            text: 'Schmup Warz',
                            font: {
                                size: '44px',
                                family: 'Skranji',
                                color: 'white'
                            }
                        },
                        {
                            id: 'buttonPlay',
                            text: 'PLAY',
                            component: 'Button',
                            position: { x: -1000, y: -1000 },
                            color: color,
                            font: {
                                size: '32px',
                                family: 'Skranji',
                                color: 'white'
                            },
                            anchor: { x: 0.5, y: 0.5 },
                            width: 200,
                            height: 50
                        },
                        {
                            id: 'buttonHighScore',
                            text: 'HIGHSCORE',
                            component: 'Button',
                            //position: 'center',
                            position: { x: -1000, y: -1000 },
                            color: color,
                            font: {
                                size: '32px',
                                family: 'Skranji',
                                color: 'white'
                            },
                            anchor: { x: 0.5, y: 0.5 },
                            width: 200,
                            height: 50
                        },
                        {
                            id: 'buttonCredits',
                            text: 'CREDITS',
                            component: 'Button',
                            position: { x: -1000, y: -1000 },
                            //position: 'center',
                            color: color,
                            font: {
                                size: '32px',
                                family: 'Skranji',
                                color: 'white'
                            },
                            anchor: { x: 0.5, y: 0.5 },
                            width: 200,
                            height: 50
                        }
                    ]
                });
                this.system = system;
                this.hide = function (next) {
                    _this.title.animatePosTo(_this.title.position.x, -20 - _this.title.settings.height, 500, EZGUI.Easing.Back.Out, function () {
                        _this.title.visible = false;
                        _this.play.animatePosTo(_this.play.position.x, -20 - _this.play.settings.height, 200, EZGUI.Easing.Circular.Out, function () {
                            _this.play.visible = false;
                            _this.highScore.animatePosTo(_this.highScore.position.x, -20 - _this.highScore.settings.height, 200, EZGUI.Easing.Circular.Out, function () {
                                _this.highScore.visible = false;
                                _this.credits.animatePosTo(_this.highScore.position.x, -20 - _this.credits.settings.height, 200, EZGUI.Easing.Circular.Out, function () {
                                    if (next)
                                        next();
                                });
                            });
                        });
                    });
                };
                this.show = function (next) {
                    _this.title.visible = true;
                    _this.title.position.x = ((window.innerWidth - _this.title.settings.width) / 2);
                    _this.title.position.y = -20 - _this.title.settings.height;
                    _this.title.animatePosTo(_this.title.position.x, 10, 500, EZGUI.Easing.Back.Out, function () {
                        _this.play.visible = true;
                        _this.play.position.x = ((window.innerWidth - _this.play.settings.width) / 2) + 100;
                        _this.play.position.y = -20 - _this.play.settings.height;
                        var targetY = ((window.innerHeight - _this.play.settings.height) / 2) - 40;
                        _this.play.animatePosTo(_this.play.position.x, targetY, 200, EZGUI.Easing.Circular.Out, function () {
                            _this.highScore.visible = true;
                            _this.highScore.position.x = ((window.innerWidth - _this.highScore.settings.width) / 2) + 100;
                            _this.highScore.position.y = -20 - _this.highScore.settings.height;
                            var targetY = ((window.innerHeight - _this.highScore.settings.height) / 2) + 28;
                            _this.highScore.animatePosTo(_this.highScore.position.x, targetY, 200, EZGUI.Easing.Circular.Out, function () {
                                _this.credits.visible = true;
                                _this.credits.position.x = ((window.innerWidth - _this.credits.settings.width) / 2) + 100;
                                _this.credits.position.y = -20 - _this.credits.settings.height;
                                var targetY = ((window.innerHeight - _this.credits.settings.height) / 2) + 28 + 66;
                                _this.credits.animatePosTo(_this.credits.position.x, targetY, 200, EZGUI.Easing.Circular.Out, function () {
                                    if (next)
                                        next();
                                });
                            });
                        });
                    });
                };
                this.playOnClick = function (e) {
                    _this.hide(function () {
                        _this.system.start();
                    });
                };
                this.highScoreOnClick = function (e) {
                    _this.hide(function () {
                        if (!_this.leader)
                            _this.leader = new LeaderboardView(_this);
                        _this.leader.show(_this.show);
                        _this.system.showLeaderboard();
                    });
                };
                this.creditsOnClick = function (e) {
                    _this.hide(function () {
                        if (!_this.help)
                            _this.help = new CreditsView(_this);
                        _this.help.show(_this.show);
                        _this.system.showCredits();
                    });
                };
            }
            /**
             * Wire up the events
             */
            MenuView.prototype.initialize = function () {
                var _this = this;
                this.title = EZGUI.components.labelTitle;
                this.play = EZGUI.components.buttonPlay;
                this.highScore = EZGUI.components.buttonHighScore;
                this.credits = EZGUI.components.buttonCredits;
                this.play.on('click', function (e) { return _this.playOnClick(e); });
                this.highScore.on('click', function (e) { return _this.highScoreOnClick(e); });
                this.credits.on('click', function (e) { return _this.creditsOnClick(e); });
                this.view['layer'] = -1;
            };
            return MenuView;
        })(AbstractView);
        views.MenuView = MenuView;
    })(views = example.views || (example.views = {}));
})(example || (example = {}));
//# sourceMappingURL=MenuView.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Background = example.components.Background;
        var Layer = example.components.Layer;
        var EntitySystem = artemis.EntitySystem;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var AbstractFilter = PIXI.AbstractFilter;
        var BackgroundTemplate = (function () {
            function BackgroundTemplate() {
            }
            BackgroundTemplate.prototype.buildEntity = function (entity, world) {
                var resources = EntitySystem.blackBoard.getEntry('resources');
                var shader = new AbstractFilter(null, resources.parallaxStars_frag.data, {
                    //time: {type: 'f', value: performance.now()},
                    time: { type: 'f', value: 0 },
                    resolution: { type: '2f', value: [window.innerHeight, window.innerWidth] }
                });
                entity.addComponent(Background, shader);
                entity.addComponent(Position, 0, 0);
                entity.addComponent(Sprite, function (sprite) {
                    var s = sprite.sprite_;
                    s.position.set(0, 0);
                    s.filters = [shader];
                    s.height = window.innerHeight;
                    s.width = window.innerWidth;
                    sprite.layer = Layer.BACKGROUND;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                return entity;
            };
            BackgroundTemplate = __decorate([
                EntityTemplate('background')
            ], BackgroundTemplate);
            return BackgroundTemplate;
        })();
        templates.BackgroundTemplate = BackgroundTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=BackgroundTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var GroupManager = artemis.managers.GroupManager;
        var EntitySystem = artemis.EntitySystem;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Constants = example.core.Constants;
        var Groups = example.core.Groups;
        var CreditsTemplate = (function () {
            function CreditsTemplate() {
            }
            CreditsTemplate.prototype.buildEntity = function (entity, world) {
                var x = window.innerWidth / 2;
                var y = window.innerHeight / 2;
                var f = window.devicePixelRatio === 1 ? 2 : 1;
                var text = new PIXI.Text(Constants.credits, Constants.font);
                text.anchor.set(0);
                text.position.set(-(x / f), -(y / 2));
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Sprite, 'panel', function (sprite) {
                    var s = sprite.sprite_;
                    s.addChild(text);
                    s.width = window.innerWidth * .75;
                    s.height = window.innerHeight / 2;
                    s.position.set(~~x, ~~y);
                    sprite.layer = 5;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                world.getManager(GroupManager).add(entity, Groups.GUI_CREDITS);
                return entity;
            };
            CreditsTemplate = __decorate([
                EntityTemplate('credits')
            ], CreditsTemplate);
            return CreditsTemplate;
        })();
        templates.CreditsTemplate = CreditsTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=CreditsTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Velocity = example.components.Velocity;
        var Bounds = example.components.Bounds;
        var Health = example.components.Health;
        var GroupManager = artemis.managers.GroupManager;
        var EntitySystem = artemis.EntitySystem;
        var Groups = example.core.Groups;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var EnemyShipTemplate = (function () {
            function EnemyShipTemplate() {
            }
            EnemyShipTemplate.prototype.buildEntity = function (entity, world, name, layer, health, x, y, velocityX, velocityY, boundsRadius) {
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Velocity, velocityX, velocityY);
                entity.addComponent(Bounds, boundsRadius);
                entity.addComponent(Health, health, health);
                entity.addComponent(Sprite, name, function (sprite) {
                    var s = sprite.sprite_;
                    //s.tint = 0xff008e;
                    s.position.set(~~x, ~~y);
                    sprite.layer = layer;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                world.getManager(GroupManager).add(entity, Groups.ENEMY_SHIPS);
                return entity;
            };
            EnemyShipTemplate = __decorate([
                EntityTemplate('enemy')
            ], EnemyShipTemplate);
            return EnemyShipTemplate;
        })();
        templates.EnemyShipTemplate = EnemyShipTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=EnemyShipTemplate.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Expires = example.components.Expires;
        var SoundEffect = example.components.SoundEffect;
        var ScaleAnimation = example.components.ScaleAnimation;
        var Layer = example.components.Layer;
        var EFFECT = example.components.EFFECT;
        var EntitySystem = artemis.EntitySystem;
        var Constants = example.core.Constants;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        /**
         * Base Explosion Template
         */
        var ExplosionTemplate = (function () {
            function ExplosionTemplate() {
            }
            ExplosionTemplate.prototype.buildEntity = function (entity, world, x, y, scale) {
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Expires, 0.5);
                entity.addComponent(Sprite, 'explosion', function (sprite) {
                    var s = sprite.sprite_;
                    s.tint = 0xffd80080;
                    s.scale.set(scale / (Constants.RATIO * 2));
                    s.position.set(~~x, ~~y);
                    sprite.layer = Layer.PARTICLES;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                entity.addComponent(ScaleAnimation, function (scaleAnimation) {
                    scaleAnimation.active = true;
                    scaleAnimation.max = scale / (Constants.RATIO * 2);
                    scaleAnimation.min = scale / (100 * (Constants.RATIO * 2));
                    scaleAnimation.speed = -3.0;
                    scaleAnimation.repeat = false;
                });
                return entity;
            };
            return ExplosionTemplate;
        })();
        /**
         * Small Explosion
         */
        var SmallExplosionTemplate = (function (_super) {
            __extends(SmallExplosionTemplate, _super);
            function SmallExplosionTemplate() {
                _super.apply(this, arguments);
            }
            SmallExplosionTemplate.prototype.buildEntity = function (entity, world, x, y) {
                _super.prototype.buildEntity.call(this, entity, world, x, y, 0.1);
                var sf = new SoundEffect();
                sf.effect = EFFECT.SMALLASPLODE;
                entity.addComponent(sf);
                return entity;
            };
            SmallExplosionTemplate = __decorate([
                EntityTemplate('small')
            ], SmallExplosionTemplate);
            return SmallExplosionTemplate;
        })(ExplosionTemplate);
        templates.SmallExplosionTemplate = SmallExplosionTemplate;
        /**
         * Big Explosion
         */
        var BigExplosionTemplate = (function (_super) {
            __extends(BigExplosionTemplate, _super);
            function BigExplosionTemplate() {
                _super.apply(this, arguments);
            }
            BigExplosionTemplate.prototype.buildEntity = function (entity, world, x, y) {
                _super.prototype.buildEntity.call(this, entity, world, x, y, 0.5);
                var sf = new SoundEffect();
                sf.effect = EFFECT.ASPLODE;
                entity.addComponent(sf);
                return entity;
            };
            BigExplosionTemplate = __decorate([
                EntityTemplate('big')
            ], BigExplosionTemplate);
            return BigExplosionTemplate;
        })(ExplosionTemplate);
        templates.BigExplosionTemplate = BigExplosionTemplate;
        /**
         * Big Explosion
         */
        var HugeExplosionTemplate = (function (_super) {
            __extends(HugeExplosionTemplate, _super);
            function HugeExplosionTemplate() {
                _super.apply(this, arguments);
            }
            HugeExplosionTemplate.prototype.buildEntity = function (entity, world, x, y) {
                _super.prototype.buildEntity.call(this, entity, world, x, y, Constants.RATIO);
                var sf = new SoundEffect();
                sf.effect = EFFECT.ASPLODE;
                entity.addComponent(sf);
                return entity;
            };
            HugeExplosionTemplate = __decorate([
                EntityTemplate('huge')
            ], HugeExplosionTemplate);
            return HugeExplosionTemplate;
        })(ExplosionTemplate);
        templates.HugeExplosionTemplate = HugeExplosionTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=ExplosionTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
console.log('loading GuiTemplate');
var example;
(function (example) {
    var templates;
    (function (templates) {
        var GroupManager = artemis.managers.GroupManager;
        var EntitySystem = artemis.EntitySystem;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var Gui = example.components.Gui;
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Groups = example.core.Groups;
        var MenuView = example.views.MenuView;
        var GuiTemplate = (function () {
            function GuiTemplate() {
            }
            GuiTemplate.prototype.buildEntity = function (entity, world, system) {
                this.gui = new MenuView(system);
                this.gui.show();
                EntitySystem.blackBoard.setEntry('gui', this.gui);
                entity.addComponent(Gui, this.gui);
                entity.addComponent(Position, 0, 0);
                entity.addComponent(Sprite, this.gui.view, function (sprite) {
                    //var s:PIXI.Sprite = sprite.sprite_;
                    //s.position.set(0, 0);
                    sprite.layer = -1;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                world.getManager(GroupManager).add(entity, Groups.GUI);
                return entity;
            };
            GuiTemplate = __decorate([
                EntityTemplate('gui')
            ], GuiTemplate);
            return GuiTemplate;
        })();
        templates.GuiTemplate = GuiTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=GuiTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var GroupManager = artemis.managers.GroupManager;
        var EntitySystem = artemis.EntitySystem;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var Properties = example.core.Properties;
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Groups = example.core.Groups;
        var font = {
            font: '40px Skranji',
            tint: 0xfffff
        };
        var LeaderboardTemplate = (function () {
            function LeaderboardTemplate() {
            }
            LeaderboardTemplate.prototype.buildEntity = function (entity, world) {
                var x = window.innerWidth / 2;
                var y = window.innerHeight / 2;
                var f1 = window.devicePixelRatio === 1 ? 0 : 1;
                var f2 = window.devicePixelRatio === 1 ? 1 : 0;
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Sprite, 'panel', function (sprite) {
                    var s = sprite.sprite_;
                    var data = Properties.getLeaderboard(3);
                    for (var k in data) {
                        var row = data[k];
                        var i = parseInt(k) + 1;
                        var mmddyyyy = row.date.substr(4, 2) + '/' + row.date.substr(6, 2) + '/' + row.date.substr(0, 4);
                        var text = new PIXI.extras.BitmapText(mmddyyyy + '', font);
                        //text.anchor.set(0);
                        text.position.set(-(x / 2) - (100 * f1), -(y / 2) + (i * 40));
                        s.addChild(text);
                        var text = new PIXI.extras.BitmapText(row.score + '', font);
                        //text.anchor.set(0);
                        text.position.set(-(x / 2) + 200 + (100 * f2), -(y / 2) + (i * 40));
                        s.addChild(text);
                    }
                    s.width = window.innerWidth * .75;
                    s.height = window.innerHeight / 2;
                    s.position.set(~~x, ~~y);
                    sprite.layer = 5;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                world.getManager(GroupManager).add(entity, Groups.GUI_LEADERBOARD);
                return entity;
            };
            LeaderboardTemplate = __decorate([
                EntityTemplate('leaderboard')
            ], LeaderboardTemplate);
            return LeaderboardTemplate;
        })();
        templates.LeaderboardTemplate = LeaderboardTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=LeaderboardTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var GroupManager = artemis.managers.GroupManager;
        var EntitySystem = artemis.EntitySystem;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Layer = example.components.Layer;
        var Constants = example.core.Constants;
        var Groups = example.core.Groups;
        var LifeTemplate = (function () {
            function LifeTemplate() {
            }
            LifeTemplate.prototype.buildEntity = function (entity, world, ordinal) {
                var x = (Constants.FRAME_WIDTH / 2) - ((ordinal + 1) * 40) + 87;
                var y = 80;
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Sprite, 'life', function (sprite) {
                    var s = sprite.sprite_;
                    //s.tint = 0x0000ff;
                    s.position.set(~~x, ~~y);
                    sprite.layer = Layer.LIVES;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                world.getManager(GroupManager).add(entity, Groups.PLAYER_LIVES);
                return entity;
            };
            LifeTemplate = __decorate([
                EntityTemplate('life')
            ], LifeTemplate);
            return LifeTemplate;
        })();
        templates.LifeTemplate = LifeTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=LifeTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var GroupManager = artemis.managers.GroupManager;
        var EntitySystem = artemis.EntitySystem;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var Mine = example.components.Mine;
        var Sprite = example.components.Sprite;
        var Position = example.components.Position;
        var Velocity = example.components.Velocity;
        var Health = example.components.Health;
        var Bounds = example.components.Bounds;
        var Layer = example.components.Layer;
        var Groups = example.core.Groups;
        var MineTemplate = (function () {
            function MineTemplate() {
            }
            MineTemplate.prototype.buildEntity = function (entity, world, name, health, x, y, velocityX, velocityY, boundsRadius) {
                entity.addComponent(Mine);
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Velocity, velocityX, velocityY);
                entity.addComponent(Bounds, boundsRadius);
                entity.addComponent(Health, health, health);
                entity.addComponent(Sprite, name, function (sprite) {
                    var s = sprite.sprite_;
                    s.position.set(~~x, ~~y);
                    sprite.layer = Layer.MINES;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                world.getManager(GroupManager).add(entity, Groups.ENEMY_MINES);
                return entity;
            };
            MineTemplate = __decorate([
                EntityTemplate('mine')
            ], MineTemplate);
            return MineTemplate;
        })();
        templates.MineTemplate = MineTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=MineTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var Tau = 2 * Math.PI;
        var MathUtils = artemis.utils.MathUtils;
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Velocity = example.components.Velocity;
        var ColorAnimation = example.components.ColorAnimation;
        var Expires = example.components.Expires;
        var Layer = example.components.Layer;
        var EntitySystem = artemis.EntitySystem;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var ParticleTemplate = (function () {
            function ParticleTemplate() {
            }
            ParticleTemplate.prototype.buildEntity = function (entity, world, x, y) {
                var radians = Math.random() * Tau; // MathUtils.random(Tau);
                var magnitude = MathUtils.random(200);
                var velocityX = magnitude * Math.cos(radians);
                var velocityY = magnitude * Math.sin(radians);
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Velocity, velocityX, velocityY);
                entity.addComponent(Expires, 1);
                //0xffd800ff
                entity.addComponent(Sprite, 'particle', function (sprite) {
                    var s = sprite.sprite_;
                    s.tint = 0xffd800ff;
                    s.scale.set(MathUtils.random(0.5, 1));
                    s.position.set(~~x, ~~y);
                    sprite.layer = Layer.PARTICLES;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                entity.addComponent(ColorAnimation, function (colorAnimation) {
                    colorAnimation.alphaAnimate = true;
                    colorAnimation.alphaSpeed = -1;
                    colorAnimation.alphaMin = 0;
                    colorAnimation.alphaMax = 1;
                    colorAnimation.repeat = false;
                });
                return entity;
            };
            ParticleTemplate = __decorate([
                EntityTemplate('particle')
            ], ParticleTemplate);
            return ParticleTemplate;
        })();
        templates.ParticleTemplate = ParticleTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=ParticleTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Velocity = example.components.Velocity;
        var Bounds = example.components.Bounds;
        var Expires = example.components.Expires;
        var SoundEffect = example.components.SoundEffect;
        var Layer = example.components.Layer;
        var EFFECT = example.components.EFFECT;
        var GroupManager = artemis.managers.GroupManager;
        var EntitySystem = artemis.EntitySystem;
        var Groups = example.core.Groups;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var PlayerBulletTemplate = (function () {
            function PlayerBulletTemplate() {
            }
            PlayerBulletTemplate.prototype.buildEntity = function (entity, world, x, y) {
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Velocity, 0, 800);
                entity.addComponent(Bounds, 5);
                entity.addComponent(Expires, 5);
                entity.addComponent(SoundEffect, EFFECT.PEW);
                entity.addComponent(Sprite, 'bullet', function (sprite) {
                    var s = sprite.sprite_;
                    s.tint = 0xffffff;
                    s.position.set(~~x, ~~y);
                    sprite.layer = Layer.PARTICLES;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                world.getManager(GroupManager).add(entity, Groups.PLAYER_BULLETS);
                return entity;
            };
            PlayerBulletTemplate = __decorate([
                EntityTemplate('bullet')
            ], PlayerBulletTemplate);
            return PlayerBulletTemplate;
        })();
        templates.PlayerBulletTemplate = PlayerBulletTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=PlayerBulletTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var GroupManager = artemis.managers.GroupManager;
        var EntitySystem = artemis.EntitySystem;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Health = example.components.Health;
        var Velocity = example.components.Velocity;
        var Bounds = example.components.Bounds;
        var Player = example.components.Player;
        var Layer = example.components.Layer;
        var Constants = example.core.Constants;
        var Groups = example.core.Groups;
        var PlayerTemplate = (function () {
            function PlayerTemplate() {
            }
            PlayerTemplate.prototype.buildEntity = function (entity, world) {
                var x = Constants.FRAME_WIDTH / 2;
                var y = Constants.FRAME_HEIGHT - 80;
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Velocity, 0, 0);
                entity.addComponent(Bounds, 43);
                entity.addComponent(Health, 100, 100);
                entity.addComponent(Player);
                entity.addComponent(Sprite, 'fighter', function (sprite) {
                    var s = sprite.sprite_;
                    //s.tint = 0x5dff81;
                    s.position.set(~~x, ~~y);
                    sprite.layer = Layer.ACTORS_3;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                world.getManager(GroupManager).add(entity, Groups.PLAYER_SHIP);
                return entity;
            };
            PlayerTemplate = __decorate([
                EntityTemplate('player')
            ], PlayerTemplate);
            return PlayerTemplate;
        })();
        templates.PlayerTemplate = PlayerTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=PlayerTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var MathUtils = artemis.utils.MathUtils;
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Velocity = example.components.Velocity;
        var ParallaxStar = example.components.ParallaxStar;
        var ColorAnimation = example.components.ColorAnimation;
        var Layer = example.components.Layer;
        var EntitySystem = artemis.EntitySystem;
        var Constants = example.core.Constants;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var StarTemplate = (function () {
            function StarTemplate() {
            }
            StarTemplate.prototype.buildEntity = function (entity, world) {
                var x = MathUtils.nextInt(Constants.FRAME_WIDTH);
                var y = MathUtils.nextInt(Constants.FRAME_HEIGHT);
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Velocity, 0, MathUtils.random(-10, -60));
                entity.addComponent(ParallaxStar);
                entity.addComponent(Sprite, 'particle', function (sprite) {
                    var s = sprite.sprite_;
                    s.tint = 0xffd800ff;
                    s.scale.set(MathUtils.random(0.5, 1));
                    s.position.set(~~x, ~~y);
                    s.alpha = MathUtils.nextDouble() * 127;
                    sprite.layer = Layer.BACKGROUND;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                entity.addComponent(ColorAnimation, function (colorAnimation) {
                    colorAnimation.alphaAnimate = true;
                    colorAnimation.repeat = true;
                    colorAnimation.alphaSpeed = MathUtils.random(0.2, 0.7);
                    colorAnimation.alphaMin = 0;
                    colorAnimation.alphaMax = 255;
                });
                return entity;
            };
            StarTemplate = __decorate([
                EntityTemplate('star')
            ], StarTemplate);
            return StarTemplate;
        })();
        templates.StarTemplate = StarTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=StarTemplate.js.map
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var templates;
    (function (templates) {
        var GroupManager = artemis.managers.GroupManager;
        var EntitySystem = artemis.EntitySystem;
        var EntityTemplate = artemis.annotations.EntityTemplate;
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Vital = example.components.Vital;
        var Layer = example.components.Layer;
        var Constants = example.core.Constants;
        var Groups = example.core.Groups;
        var StatusTemplate = (function () {
            function StatusTemplate() {
            }
            StatusTemplate.prototype.buildEntity = function (entity, world) {
                var x = (Constants.FRAME_WIDTH / 2) - 50;
                var y = 20;
                entity.addComponent(Position, ~~x, ~~y);
                entity.addComponent(Sprite, new PIXI.Sprite(), function (sprite) {
                    var s = sprite.sprite_;
                    entity.addComponent(Vital, 'status_yellow', 'status_red', function (vital) {
                        s.addChild(vital.bad);
                        s.addChild(vital.good);
                    });
                    s.position.set(~~x, ~~y);
                    sprite.layer = Layer.LIVES;
                    sprite.addTo(EntitySystem.blackBoard.getEntry('sprites'));
                });
                world.getManager(GroupManager).add(entity, Groups.PLAYER_STATUS);
                return entity;
            };
            StatusTemplate = __decorate([
                EntityTemplate('status')
            ], StatusTemplate);
            return StatusTemplate;
        })();
        templates.StatusTemplate = StatusTemplate;
    })(templates = example.templates || (example.templates = {}));
})(example || (example = {}));
//# sourceMappingURL=StatusTemplate.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
/**
 * systems/BackgroundSystem.ts
 *
 * Display player status
 */
var example;
(function (example) {
    var systems;
    (function (systems) {
        var Background = example.components.Background;
        var Sprite = example.components.Sprite;
        var Aspect = artemis.Aspect;
        var EntityProcessingSystem = artemis.systems.EntityProcessingSystem;
        var Mapper = artemis.annotations.Mapper;
        var MathUtils = artemis.utils.MathUtils;
        var BackgroundSystem = (function (_super) {
            __extends(BackgroundSystem, _super);
            function BackgroundSystem() {
                _super.call(this, Aspect.getAspectForAll(Background, Sprite));
            }
            BackgroundSystem.prototype.processEach = function (e) {
                var background = this.bm.get(e);
                var sprite = this.sm.get(e);
                var uniforms = background.filter.uniforms;
                if (uniforms.time.value === 0) {
                    uniforms.time.value = MathUtils.nextInt(1000) + 500;
                }
                else {
                    uniforms.time.value += this.world.delta;
                }
                //uniforms.time.value += this.world.delta;
                uniforms.resolution.value = [window.innerHeight, window.innerWidth];
                var value = uniforms.resolution.value;
                sprite.sprite_.height = value[0] = window.innerHeight;
                sprite.sprite_.width = value[1] = window.innerWidth;
            };
            __decorate([
                Mapper(Background)
            ], BackgroundSystem.prototype, "bm");
            __decorate([
                Mapper(Sprite)
            ], BackgroundSystem.prototype, "sm");
            return BackgroundSystem;
        })(EntityProcessingSystem);
        systems.BackgroundSystem = BackgroundSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=BackgroundSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var Bag = artemis.utils.Bag;
        var Bounds = example.components.Bounds;
        var Expires = example.components.Expires;
        var Health = example.components.Health;
        var Position = example.components.Position;
        var Constants = example.core.Constants;
        var Groups = example.core.Groups;
        var Mapper = artemis.annotations.Mapper;
        var Timer = artemis.utils.Timer;
        var EntitySystem = artemis.EntitySystem;
        var Aspect = artemis.Aspect;
        var GroupManager = artemis.managers.GroupManager;
        var CollisionSystem = (function (_super) {
            __extends(CollisionSystem, _super);
            function CollisionSystem() {
                _super.call(this, Aspect.getAspectForAll(Position, Bounds));
            }
            CollisionSystem.prototype.initialize = function () {
                var _this = this;
                this.score = EntitySystem.blackBoard.getEntry('score');
                this.groupManager = this.world.getManager(GroupManager);
                this.collisionPairs = new Bag();
                /** Check for bullets hitting enemy ship */
                this.collisionPairs.add(new CollisionPair(this, Groups.PLAYER_BULLETS, Groups.ENEMY_SHIPS, {
                    handleCollision: function (bullet, ship) {
                        var bp = _this.pm.get(bullet);
                        var health = _this.hm.get(ship);
                        var position = _this.pm.get(ship);
                        _this.world.createEntityFromTemplate('small', bp.x, bp.y).addToWorld();
                        for (var i = 0; 4 > i; i++) {
                            _this.world.createEntityFromTemplate('particle', bp.x, bp.y).addToWorld();
                        }
                        bullet.deleteFromWorld();
                        health.health -= 1;
                        if (health.health < 0) {
                            _this.score.score += health.maximumHealth;
                            health.health = 0;
                            ship.deleteFromWorld();
                            _this.world.createEntityFromTemplate('big', position.x, position.y).addToWorld();
                        }
                    }
                }));
                /** Check for enemy mines hitting player ship */
                this.collisionPairs.add(new CollisionPair(this, Groups.ENEMY_MINES, Groups.PLAYER_SHIP, {
                    handleCollision: function (mine, ship) {
                        var bp = _this.pm.get(mine);
                        var health = _this.hm.get(ship);
                        var position = _this.pm.get(ship);
                        mine.deleteFromWorld();
                        health.health -= _this.hm.get(mine).health;
                        if (health.health < 0) {
                            health.health = 0;
                            ship.deleteFromWorld();
                            _this.world.createEntityFromTemplate('huge', position.x, position.y).addToWorld();
                            var lives = _this.groupManager.getEntities(Groups.PLAYER_LIVES);
                            if (lives.size() === 0) {
                                /** Game Over!! */
                                var game = EntitySystem.blackBoard.getEntry('game');
                                game.systems.stop();
                                var gui = EntitySystem.blackBoard.getEntry('gui');
                                gui.show();
                            }
                            else {
                                var life = lives.get(0);
                                life.deleteFromWorld();
                                _this.groupManager.remove(life, Groups.PLAYER_LIVES);
                                _this.timer = new Timer(1, true);
                                _this.timer.execute = function () {
                                    _this.world.createEntityFromTemplate('player').addToWorld();
                                    _this.timer = null;
                                };
                            }
                        }
                    }
                }));
            };
            CollisionSystem.prototype.processEntities = function (entities) {
                for (var i = 0; this.collisionPairs.size() > i; i++) {
                    this.collisionPairs.get(i).checkForCollisions();
                }
                if (this.timer) {
                    this.timer.update(this.world.delta);
                }
            };
            CollisionSystem.prototype.checkProcessing = function () {
                return true;
            };
            __decorate([
                Mapper(Position)
            ], CollisionSystem.prototype, "pm");
            __decorate([
                Mapper(Bounds)
            ], CollisionSystem.prototype, "bm");
            __decorate([
                Mapper(Health)
            ], CollisionSystem.prototype, "hm");
            __decorate([
                Mapper(Expires)
            ], CollisionSystem.prototype, "ex");
            return CollisionSystem;
        })(EntitySystem);
        systems.CollisionSystem = CollisionSystem;
        var CollisionPair = (function () {
            function CollisionPair(cs, group1, group2, handler) {
                this.groupEntitiesA = cs.world.getManager(GroupManager).getEntities(group1);
                this.groupEntitiesB = cs.world.getManager(GroupManager).getEntities(group2);
                this.handler = handler;
                this.cs = cs;
            }
            CollisionPair.prototype.checkForCollisions = function () {
                for (var a = 0; this.groupEntitiesA.size() > a; a++) {
                    var entityA = this.groupEntitiesA.get(a);
                    for (var b = 0; this.groupEntitiesB.size() > b; b++) {
                        var entityB = this.groupEntitiesB.get(b);
                        if (this.collisionExists(entityA, entityB)) {
                            this.handler.handleCollision(entityA, entityB);
                        }
                    }
                }
            };
            CollisionPair.prototype.collisionExists = function (e1, e2) {
                if (e1 === null || e2 === null)
                    return false;
                //NPE!!!
                var p1 = this.cs.pm.get(e1);
                var p2 = this.cs.pm.get(e2);
                var b1 = this.cs.bm.get(e1);
                var b2 = this.cs.bm.get(e2);
                var a = p1.x - p2.x;
                var b = p1.y - p2.y;
                return Math.sqrt(a * a + b * b) - (b1.radius / Constants.RATIO) < (b2.radius / Constants.RATIO);
            };
            return CollisionPair;
        })();
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=CollisionSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var ColorAnimation = example.components.ColorAnimation;
        var Sprite = example.components.Sprite;
        var Mapper = artemis.annotations.Mapper;
        var EntityProcessingSystem = artemis.systems.EntityProcessingSystem;
        var Aspect = artemis.Aspect;
        var ColorAnimationSystem = (function (_super) {
            __extends(ColorAnimationSystem, _super);
            function ColorAnimationSystem() {
                _super.call(this, Aspect.getAspectForAll(ColorAnimation, Sprite));
            }
            ColorAnimationSystem.prototype.processEach = function (e) {
                var c = this.cam.get(e);
                var sprite = this.sm.get(e).sprite_;
                if (c.alphaAnimate) {
                    sprite.alpha += c.alphaSpeed * this.world.delta;
                    if (sprite.alpha > c.alphaMax || sprite.alpha < c.alphaMin) {
                        if (c.repeat) {
                            c.alphaSpeed = -c.alphaSpeed;
                        }
                        else {
                            c.alphaAnimate = false;
                        }
                    }
                }
            };
            __decorate([
                Mapper(ColorAnimation)
            ], ColorAnimationSystem.prototype, "cam");
            __decorate([
                Mapper(Sprite)
            ], ColorAnimationSystem.prototype, "sm");
            return ColorAnimationSystem;
        })(EntityProcessingSystem);
        systems.ColorAnimationSystem = ColorAnimationSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=ColorAnimationSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var MathUtils = artemis.utils.MathUtils;
        var Layer = example.components.Layer;
        var Constants = example.core.Constants;
        var VoidEntitySystem = artemis.systems.VoidEntitySystem;
        var Timer = artemis.utils.Timer;
        var EntitySpawningTimerSystem = (function (_super) {
            __extends(EntitySpawningTimerSystem, _super);
            function EntitySpawningTimerSystem() {
                var _this = this;
                _super.call(this);
                this.ai = 0;
                this.mine = 0;
                this.offset = 0;
                this.pos = [
                    [20, 20],
                    [50, 20],
                    [80, 20]
                ];
                this.initializeAi();
                this.timer1 = new Timer(2, true);
                this.timer1.execute = function () {
                    _this.world.createEntityFromTemplate('enemy', "enemy1", Layer.ACTORS_3, 10, MathUtils.nextInt(Constants.FRAME_WIDTH), Constants.FRAME_HEIGHT / 2 - 200, 0, -40, 20).addToWorld();
                };
                this.timer2 = new Timer(6, true);
                this.timer2.execute = function () {
                    var x = MathUtils.nextInt(Constants.FRAME_WIDTH);
                    var y = Constants.FRAME_HEIGHT / 2 - 100;
                    _this.world.createEntityFromTemplate('enemy', "enemy2", Layer.ACTORS_2, 20, x, y, 0, -30, 40).addToWorld();
                };
                this.timer3 = new Timer(12, true);
                this.timer3.execute = function () {
                    var x = MathUtils.nextInt(Constants.FRAME_WIDTH);
                    var y = Constants.FRAME_HEIGHT / 2 - 50;
                    _this.world.createEntityFromTemplate('enemy', "enemy3", Layer.ACTORS_1, 60, x, y, 0, -20, 70).addToWorld();
                };
            }
            /**
             * Mine AI
             */
            EntitySpawningTimerSystem.prototype.initializeAi = function () {
                var _this = this;
                this.timer4 = new Timer(.85 / (window.innerWidth / 640), true);
                this.timer4.execute = function () {
                    _this.ai = (_this.ai + 1) % 3;
                    _this.mine = (_this.mine + 1) % 2;
                    var m = _this.mine + 1;
                    _this.offset += 100;
                    if (_this.offset > window.innerWidth)
                        _this.offset = 0;
                    var v = -MathUtils.nextInt(50) - 50;
                    var x = _this.offset + _this.pos[_this.ai][0];
                    var y = _this.pos[_this.ai][1];
                    _this.world.createEntityFromTemplate('mine', "mine" + m, m * 10, x, y, 0, v, 10).addToWorld();
                };
            };
            EntitySpawningTimerSystem.prototype.processSystem = function () {
                var rnd = Math.random();
                if (rnd < .5)
                    rnd = 1 - rnd;
                var delta = rnd * this.world.delta;
                this.timer1.update(delta);
                this.timer2.update(delta);
                this.timer3.update(delta);
                this.timer4.update(delta);
            };
            return EntitySpawningTimerSystem;
        })(VoidEntitySystem);
        systems.EntitySpawningTimerSystem = EntitySpawningTimerSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=EntitySpawningTimerSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var Expires = example.components.Expires;
        var Aspect = artemis.Aspect;
        var DelayedEntityProcessingSystem = artemis.systems.DelayedEntityProcessingSystem;
        var Mapper = artemis.annotations.Mapper;
        var ExpiringSystem = (function (_super) {
            __extends(ExpiringSystem, _super);
            function ExpiringSystem() {
                _super.call(this, Aspect.getAspectForAll(Expires));
            }
            ExpiringSystem.prototype.processDelta = function (e, accumulatedDelta) {
                var expires = this.em.get(e);
                expires.delay -= accumulatedDelta;
            };
            ExpiringSystem.prototype.processExpired = function (e) {
                e.deleteFromWorld();
            };
            ExpiringSystem.prototype.getRemainingDelay = function (e) {
                var expires = this.em.get(e);
                return expires.delay;
            };
            __decorate([
                Mapper(Expires)
            ], ExpiringSystem.prototype, "em");
            return ExpiringSystem;
        })(DelayedEntityProcessingSystem);
        systems.ExpiringSystem = ExpiringSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=ExpiringSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
/**
 * Track ships health and display damage
 */
var example;
(function (example) {
    var systems;
    (function (systems) {
        var Bounds = example.components.Bounds;
        var Health = example.components.Health;
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Aspect = artemis.Aspect;
        var EntitySystem = artemis.EntitySystem;
        var EntityProcessingSystem = artemis.systems.EntityProcessingSystem;
        var Mapper = artemis.annotations.Mapper;
        var Constants = example.core.Constants;
        var InvertFilter = PIXI.filters.InvertFilter;
        var HealthRenderSystem = (function (_super) {
            __extends(HealthRenderSystem, _super);
            function HealthRenderSystem() {
                _super.call(this, Aspect.getAspectForAll(Position, Health));
                this.texts = {};
            }
            HealthRenderSystem.prototype.initialize = function () {
                this.sprites = EntitySystem.blackBoard.getEntry('sprites');
                this.font = Constants.font;
            };
            HealthRenderSystem.prototype.processEach = function (e) {
                //var position:Position = this.pm.get(e);
                var health = this.hm.get(e);
                var percentage = Math.round(health.health / health.maximumHealth * 100);
                if (percentage < 100) {
                    var sprite = this.sm.get(e).sprite_;
                    if (!sprite.filters) {
                        sprite.filters = [new InvertFilter()];
                    }
                    sprite.filters[0]['invert'] = (100 - percentage) / 100;
                }
            };
            __decorate([
                Mapper(Position)
            ], HealthRenderSystem.prototype, "pm");
            __decorate([
                Mapper(Health)
            ], HealthRenderSystem.prototype, "hm");
            __decorate([
                Mapper(Bounds)
            ], HealthRenderSystem.prototype, "bm");
            __decorate([
                Mapper(Sprite)
            ], HealthRenderSystem.prototype, "sm");
            return HealthRenderSystem;
        })(EntityProcessingSystem);
        systems.HealthRenderSystem = HealthRenderSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=HealthRenderSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
/**
 * Display player status
 */
var example;
(function (example) {
    var systems;
    (function (systems) {
        var Aspect = artemis.Aspect;
        var Player = example.components.Player;
        var Vital = example.components.Vital;
        var Health = example.components.Health;
        var Constants = example.core.Constants;
        var Layer = example.components.Layer;
        var EntitySystem = artemis.EntitySystem;
        var Mapper = artemis.annotations.Mapper;
        var EntityProcessingSystem = artemis.systems.EntityProcessingSystem;
        var BitmapText = PIXI.extras.BitmapText;
        var Point = PIXI.Point;
        var HudRenderSystem = (function (_super) {
            __extends(HudRenderSystem, _super);
            function HudRenderSystem() {
                _super.call(this, Aspect.getAspectForAll(Player, Health));
                this.totalFrames = 0;
                this.elapsedTime = 0;
                this.fps = 0;
            }
            HudRenderSystem.prototype.initialize = function () {
                this.score = EntitySystem.blackBoard.getEntry('score');
                var sprites = EntitySystem.blackBoard.getEntry('sprites');
                var font = Constants.font;
                this.framesPerSecond = new BitmapText('FPS: 60', font);
                this.framesPerSecond['layer'] = Layer.TEXT;
                var scale = 1 / Constants.RATIO;
                this.framesPerSecond.scale = new Point(scale, scale);
                this.framesPerSecond.position = new Point(20, 20 / Constants.RATIO);
                sprites.addChild(this.framesPerSecond);
                this.totalScore = new BitmapText('Score: 00000', font);
                this.totalScore['layer'] = Layer.TEXT;
                var scale = 1 / Constants.RATIO;
                this.totalScore.scale = new Point(scale, scale);
                this.totalScore.position = new Point(Constants.FRAME_WIDTH - this.totalScore.width - 20, 20 / Constants.RATIO);
                sprites.addChild(this.totalScore);
                if (!Constants.isMobile) {
                    this.activeEntities = new BitmapText('Active entities: ', font);
                    this.totalCreated = new BitmapText('Total created: ', font);
                    this.totalDeleted = new BitmapText('Total deleted: ', font);
                    this.activeEntities['layer'] = Layer.TEXT;
                    this.totalCreated['layer'] = Layer.TEXT;
                    this.totalDeleted['layer'] = Layer.TEXT;
                    this.activeEntities.scale = new Point(scale, scale);
                    this.totalCreated.scale = new Point(scale, scale);
                    this.totalDeleted.scale = new Point(scale, scale);
                    this.activeEntities.position = new Point(20, 40 / Constants.RATIO);
                    this.totalCreated.position = new Point(20, 60 / Constants.RATIO);
                    this.totalDeleted.position = new Point(20, 80 / Constants.RATIO);
                    sprites.addChild(this.activeEntities);
                    sprites.addChild(this.totalCreated);
                    sprites.addChild(this.totalDeleted);
                }
            };
            HudRenderSystem.prototype.setStatus = function (status) {
                this.status = status;
            };
            HudRenderSystem.prototype.processEach = function (e) {
                var health = this.hm.get(e);
                var vital = this.vm.get(this.status);
                vital.good.width = ~~Math.round(health.health / health.maximumHealth * 100);
                this.totalFrames++;
                this.elapsedTime += this.world.delta;
                if (this.elapsedTime > 1) {
                    this.fps = this.totalFrames;
                    this.totalFrames = 0;
                    this.elapsedTime = 0;
                }
                this.framesPerSecond.text = "FPS: " + this.fps;
                this.totalScore.text = "Score: " + this.score.score;
                if (!Constants.isMobile) {
                    this.activeEntities.text = "Active entities: " + this.world.getEntityManager().getActiveEntityCount();
                    this.totalCreated.text = "Total created: " + this.world.getEntityManager().getTotalCreated();
                    this.totalDeleted.text = "Total deleted: " + this.world.getEntityManager().getTotalDeleted();
                }
            };
            __decorate([
                Mapper(Health)
            ], HudRenderSystem.prototype, "hm");
            __decorate([
                Mapper(Vital)
            ], HudRenderSystem.prototype, "vm");
            return HudRenderSystem;
        })(EntityProcessingSystem);
        systems.HudRenderSystem = HudRenderSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=HudRenderSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var Position = example.components.Position;
        var Velocity = example.components.Velocity;
        var Constants = example.core.Constants;
        var Aspect = artemis.Aspect;
        var EntityProcessingSystem = artemis.systems.EntityProcessingSystem;
        var Mapper = artemis.annotations.Mapper;
        var MovementSystem = (function (_super) {
            __extends(MovementSystem, _super);
            function MovementSystem() {
                _super.call(this, Aspect.getAspectForAll(Position, Velocity));
            }
            MovementSystem.prototype.processEach = function (e) {
                var position = this.pm.get(e);
                var velocity = this.vm.get(e);
                var delta = 1 / Constants.RATIO * this.world.delta;
                ;
                position.x += velocity.vectorX * delta;
                position.y -= velocity.vectorY * delta;
            };
            __decorate([
                Mapper(Position)
            ], MovementSystem.prototype, "pm");
            __decorate([
                Mapper(Velocity)
            ], MovementSystem.prototype, "vm");
            return MovementSystem;
        })(EntityProcessingSystem);
        systems.MovementSystem = MovementSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=MovementSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var ParallaxStar = example.components.ParallaxStar;
        var Position = example.components.Position;
        var Constants = example.core.Constants;
        var Aspect = artemis.Aspect;
        var IntervalEntityProcessingSystem = artemis.systems.IntervalEntityProcessingSystem;
        var Mapper = artemis.annotations.Mapper;
        var ParallaxStarRepeatingSystem = (function (_super) {
            __extends(ParallaxStarRepeatingSystem, _super);
            function ParallaxStarRepeatingSystem() {
                _super.call(this, Aspect.getAspectForAll(ParallaxStar, Position), 1);
            }
            ParallaxStarRepeatingSystem.prototype.processEach = function (e) {
                var position = this.pm.get(e);
                if (position.y >= Constants.FRAME_HEIGHT) {
                    position.y = 0;
                }
            };
            __decorate([
                Mapper(Position)
            ], ParallaxStarRepeatingSystem.prototype, "pm");
            return ParallaxStarRepeatingSystem;
        })(IntervalEntityProcessingSystem);
        systems.ParallaxStarRepeatingSystem = ParallaxStarRepeatingSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=ParallaxStarRepeatingSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var Player = example.components.Player;
        var Position = example.components.Position;
        var Velocity = example.components.Velocity;
        var Aspect = artemis.Aspect;
        var Mapper = artemis.annotations.Mapper;
        var EntityProcessingSystem = artemis.systems.EntityProcessingSystem;
        var Constants = example.core.Constants;
        var PlayerInputSystem = (function (_super) {
            __extends(PlayerInputSystem, _super);
            function PlayerInputSystem() {
                var _this = this;
                _super.call(this, Aspect.getAspectForAll(Position, Velocity, Player));
                this.timeToFire = 0;
                this.onTouchStart = function (event) {
                    event = event.changedTouches ? event.changedTouches[0] : event;
                    if (Constants.isMobile) {
                        try {
                            if (document.documentElement['requestFullscreen']) {
                                document.documentElement['requestFullscreen']();
                            }
                            else if (document.documentElement['mozRequestFullScreen']) {
                                document.documentElement['mozRequestFullScreen']();
                            }
                            else if (document.documentElement['webkitRequestFullscreen']) {
                                document.documentElement['webkitRequestFullscreen']();
                            }
                            else if (document.documentElement['msRequestFullscreen']) {
                                document.documentElement['msRequestFullscreen']();
                            }
                        }
                        catch (e) { }
                    }
                    _this.shoot = true;
                    _this.mouseVector = {
                        x: parseInt(event.clientX),
                        y: parseInt(event.clientY)
                    };
                    return true;
                };
                this.onTouchMove = function (event) {
                    event = event.changedTouches ? event.changedTouches[0] : event;
                    //this.shoot = true;
                    _this.mouseVector = {
                        x: parseInt(event.clientX),
                        y: parseInt(event.clientY)
                    };
                    return true;
                };
                this.onTouchEnd = function (event) {
                    _this.shoot = false;
                };
            }
            PlayerInputSystem.prototype.initialize = function () {
                document.addEventListener('touchstart', this.onTouchStart, true);
                document.addEventListener('touchmove', this.onTouchMove, true);
                document.addEventListener('touchend', this.onTouchEnd, true);
                document.addEventListener('mousedown', this.onTouchStart, true);
                document.addEventListener('mousemove', this.onTouchMove, true);
                document.addEventListener('mouseup', this.onTouchEnd, true);
            };
            PlayerInputSystem.prototype.processEach = function (e) {
                if (this.mouseVector === undefined)
                    return;
                var position = this.pm.get(e);
                var velocity = this.vm.get(e);
                var destinationX = this.mouseVector.x;
                var destinationY = this.mouseVector.y;
                if (destinationX === undefined || destinationY === undefined)
                    return;
                position.x = this.mouseVector.x;
                position.y = this.mouseVector.y - 60;
                if (this.shoot) {
                    if (this.timeToFire <= 0) {
                        var s = ~~(24 / Constants.RATIO);
                        this.world.createEntityFromTemplate('bullet', position.x - s, position.y + 2).addToWorld();
                        this.world.createEntityFromTemplate('bullet', position.x + s, position.y + 2).addToWorld();
                        this.timeToFire = PlayerInputSystem.FireRate;
                    }
                }
                if (this.timeToFire > 0) {
                    this.timeToFire -= this.world.delta;
                    if (this.timeToFire < 0) {
                        this.timeToFire = 0;
                    }
                }
            };
            PlayerInputSystem.FireRate = 0.1;
            __decorate([
                Mapper(Position)
            ], PlayerInputSystem.prototype, "pm");
            __decorate([
                Mapper(Velocity)
            ], PlayerInputSystem.prototype, "vm");
            return PlayerInputSystem;
        })(EntityProcessingSystem);
        systems.PlayerInputSystem = PlayerInputSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=PlayerInputSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var Bounds = example.components.Bounds;
        var Player = example.components.Player;
        var Position = example.components.Position;
        var Velocity = example.components.Velocity;
        var Constants = example.core.Constants;
        var Aspect = artemis.Aspect;
        var IntervalEntityProcessingSystem = artemis.systems.IntervalEntityProcessingSystem;
        var Mapper = artemis.annotations.Mapper;
        var RemoveOffscreenShipsSystem = (function (_super) {
            __extends(RemoveOffscreenShipsSystem, _super);
            function RemoveOffscreenShipsSystem() {
                //super(Aspect.getAspectForAll(Velocity, Position, Health, Bounds), 5);
                _super.call(this, Aspect.getAspectForAll(Velocity, Position, Bounds).exclude(Player), 5);
            }
            RemoveOffscreenShipsSystem.prototype.processEach = function (e) {
                var position = this.pm.get(e);
                var bounds = this.bm.get(e);
                if (position.y > Constants.FRAME_HEIGHT - bounds.radius) {
                    e.deleteFromWorld();
                }
            };
            __decorate([
                Mapper(Position)
            ], RemoveOffscreenShipsSystem.prototype, "pm");
            __decorate([
                Mapper(Bounds)
            ], RemoveOffscreenShipsSystem.prototype, "bm");
            return RemoveOffscreenShipsSystem;
        })(IntervalEntityProcessingSystem);
        systems.RemoveOffscreenShipsSystem = RemoveOffscreenShipsSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=RemoveOffscreenShipsSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var ScaleAnimation = example.components.ScaleAnimation;
        var Sprite = example.components.Sprite;
        var Aspect = artemis.Aspect;
        var EntityProcessingSystem = artemis.systems.EntityProcessingSystem;
        var Mapper = artemis.annotations.Mapper;
        var ScaleAnimationSystem = (function (_super) {
            __extends(ScaleAnimationSystem, _super);
            //@SuppressWarnings("unchecked")
            function ScaleAnimationSystem() {
                _super.call(this, Aspect.getAspectForAll(ScaleAnimation));
            }
            ScaleAnimationSystem.prototype.processEach = function (e) {
                var scaleAnimation = this.sa.get(e);
                if (scaleAnimation.active) {
                    var sprite = this.sm.get(e).sprite_;
                    sprite.scale.x += scaleAnimation.speed * this.world.delta;
                    sprite.scale.y = sprite.scale.x;
                    if (sprite.scale.x > scaleAnimation.max) {
                        sprite.scale.x = scaleAnimation.max;
                        scaleAnimation.active = false;
                    }
                    else if (sprite.scale.x < scaleAnimation.min) {
                        sprite.scale.x = scaleAnimation.min;
                        scaleAnimation.active = false;
                    }
                }
            };
            __decorate([
                Mapper(ScaleAnimation)
            ], ScaleAnimationSystem.prototype, "sa");
            __decorate([
                Mapper(Sprite)
            ], ScaleAnimationSystem.prototype, "sm");
            return ScaleAnimationSystem;
        })(EntityProcessingSystem);
        systems.ScaleAnimationSystem = ScaleAnimationSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=ScaleAnimationSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var SoundEffect = example.components.SoundEffect;
        var EFFECT = example.components.EFFECT;
        var Aspect = artemis.Aspect;
        var EntityProcessingSystem = artemis.systems.EntityProcessingSystem;
        var Mapper = artemis.annotations.Mapper;
        var EntitySystem = artemis.EntitySystem;
        var SoundEffectSystem = (function (_super) {
            __extends(SoundEffectSystem, _super);
            function SoundEffectSystem() {
                _super.call(this, Aspect.getAspectForAll(SoundEffect));
                this.playSfx = false;
            }
            SoundEffectSystem.prototype.initialize = function () {
                var Howl = window['Howl'];
                this.pew = new Howl({ urls: ['res/sounds/pew.ogg'] });
                this.asplode = new Howl({ urls: ['res/sounds/asplode.ogg'] });
                this.smallasplode = new Howl({ urls: ['res/sounds/smallasplode.ogg'] });
                this.playSfx = EntitySystem.blackBoard.getEntry('playSfx');
                //var trigger:SimpleTrigger = new SimpleTrigger('playSfx', this.condition, this.onChange);
                //EntitySystem.blackBoard.addTrigger(trigger);
            };
            //private onChange(t:TriggerStateType) {
            //  console.log('changed');
            //
            //}
            //private condition(b:BlackBoard, t:TriggerStateType):boolean {
            //  console.log('condition');
            //  return true;
            //}
            SoundEffectSystem.prototype.processEach = function (e) {
                if (!this.playSfx)
                    return;
                var soundEffect = this.se.get(e);
                switch (soundEffect.effect) {
                    case EFFECT.PEW:
                        this.pew.play();
                        break;
                    case EFFECT.ASPLODE:
                        this.asplode.play();
                        break;
                    case EFFECT.SMALLASPLODE:
                        this.smallasplode.play();
                        break;
                    default:
                        break;
                }
                e.removeComponentInstance(soundEffect);
                e.changedInWorld();
            };
            __decorate([
                Mapper(SoundEffect)
            ], SoundEffectSystem.prototype, "se");
            return SoundEffectSystem;
        })(EntityProcessingSystem);
        systems.SoundEffectSystem = SoundEffectSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=SoundEffectSystem.js.map
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var example;
(function (example) {
    var systems;
    (function (systems) {
        var Position = example.components.Position;
        var Sprite = example.components.Sprite;
        var Aspect = artemis.Aspect;
        var EntitySystem = artemis.EntitySystem;
        var Mapper = artemis.annotations.Mapper;
        var SpriteRenderSystem = (function (_super) {
            __extends(SpriteRenderSystem, _super);
            function SpriteRenderSystem() {
                _super.call(this, Aspect.getAspectForAll(Position, Sprite));
            }
            SpriteRenderSystem.prototype.initialize = function () {
                this.sprites = EntitySystem.blackBoard.getEntry('sprites');
            };
            SpriteRenderSystem.prototype.checkProcessing = function () {
                return true;
            };
            SpriteRenderSystem.prototype.processEntities = function (entities) {
                for (var i = 0, l = entities.size(); i < l; i++) {
                    this.processEach(entities.get(i));
                }
            };
            SpriteRenderSystem.prototype.processEach = function (e) {
                if (this.pm.has(e)) {
                    var position = this.pm.getSafe(e);
                    var sprite = this.sm.get(e);
                    sprite.sprite_.position.set(position.x, position.y);
                }
            };
            //public inserted(e:Entity) {
            //  var sprite:Sprite = this.sm.get(e);
            //  sprite.sprite_['layer'] = sprite.layer;
            //
            //  this.sprites.children.sort((a, b) => {
            //    if (a['layer'] < b['layer']) return -1;
            //    if (a['layer'] > b['layer']) return 1;
            //    return 0;
            //  });
            //}
            SpriteRenderSystem.prototype.removed = function (e) {
                var c = e.getComponentByType(Sprite);
                c.removeFrom(this.sprites);
            };
            __decorate([
                Mapper(Position)
            ], SpriteRenderSystem.prototype, "pm");
            __decorate([
                Mapper(Sprite)
            ], SpriteRenderSystem.prototype, "sm");
            return SpriteRenderSystem;
        })(EntitySystem);
        systems.SpriteRenderSystem = SpriteRenderSystem;
    })(systems = example.systems || (example.systems = {}));
})(example || (example = {}));
//# sourceMappingURL=SpriteRenderSystem.js.map
/**
 * core/GameSystems.ts
 *
 * The main game loop
 *
 */
var example;
(function (example) {
    var core;
    (function (core) {
        var GroupManager = artemis.managers.GroupManager;
        var EntitySystem = artemis.EntitySystem;
        var BackgroundSystem = example.systems.BackgroundSystem;
        var CollisionSystem = example.systems.CollisionSystem;
        var ColorAnimationSystem = example.systems.ColorAnimationSystem;
        var EntitySpawningTimerSystem = example.systems.EntitySpawningTimerSystem;
        var ExpiringSystem = example.systems.ExpiringSystem;
        var HealthRenderSystem = example.systems.HealthRenderSystem;
        var HudRenderSystem = example.systems.HudRenderSystem;
        var MovementSystem = example.systems.MovementSystem;
        var ParallaxStarRepeatingSystem = example.systems.ParallaxStarRepeatingSystem;
        var PlayerInputSystem = example.systems.PlayerInputSystem;
        var RemoveOffscreenShipsSystem = example.systems.RemoveOffscreenShipsSystem;
        var ScaleAnimationSystem = example.systems.ScaleAnimationSystem;
        var SoundEffectSystem = example.systems.SoundEffectSystem;
        var SpriteRenderSystem = example.systems.SpriteRenderSystem;
        var GameSystems = (function () {
            function GameSystems(webgl) {
                this.webgl = webgl;
                artemis.utils.TrigLUT.init(true);
                this.score = EntitySystem.blackBoard.getEntry('score');
                var world = this.world = new artemis.World();
                world.setManager(new GroupManager());
                world.setSystem(new MovementSystem());
                world.setSystem(new PlayerInputSystem());
                world.setSystem(new SoundEffectSystem());
                world.setSystem(new CollisionSystem());
                world.setSystem(new ExpiringSystem());
                world.setSystem(new EntitySpawningTimerSystem());
                if (webgl) {
                    world.setSystem(new BackgroundSystem());
                }
                else {
                    world.setSystem(new ParallaxStarRepeatingSystem());
                    world.setSystem(new ColorAnimationSystem());
                }
                world.setSystem(new ScaleAnimationSystem());
                world.setSystem(new RemoveOffscreenShipsSystem());
                this.spriteRenderSystem = world.setSystem(new SpriteRenderSystem(), true);
                this.healthRenderSystem = world.setSystem(new HealthRenderSystem(), true);
                this.hudRenderSystem = world.setSystem(new HudRenderSystem(), true);
                world.initialize();
                world.createEntityFromTemplate('gui', this).addToWorld();
            }
            GameSystems.prototype.start = function () {
                this.score.score = 0;
                var world = this.world;
                world.createEntityFromTemplate('player').addToWorld();
                for (var life = 0; life < 3; life++) {
                    world.createEntityFromTemplate('life', life).addToWorld();
                }
                this.status = world.createEntityFromTemplate('status');
                this.status.addToWorld();
                this.hudRenderSystem.setStatus(this.status);
                if (this.webgl) {
                    this.bg = world.createEntityFromTemplate('background');
                    this.bg.addToWorld();
                }
                else {
                    for (var i = 0; 500 > i; i++) {
                        world.createEntityFromTemplate('star').addToWorld();
                    }
                }
            };
            GameSystems.prototype.stop = function () {
                this.bg.deleteFromWorld();
                this.status.deleteFromWorld();
            };
            GameSystems.prototype.showCredits = function () {
                this.credits = this.world.createEntityFromTemplate('credits');
                this.credits.addToWorld();
            };
            GameSystems.prototype.hideCredits = function () {
                this.credits.deleteFromWorld();
            };
            GameSystems.prototype.showLeaderboard = function () {
                this.leaderboard = this.world.createEntityFromTemplate('leaderboard');
                this.leaderboard.addToWorld();
            };
            GameSystems.prototype.hideLeaderboard = function () {
                this.leaderboard.deleteFromWorld();
            };
            GameSystems.prototype.update = function (delta) {
                this.world.setDelta(delta);
                this.world.process();
                this.spriteRenderSystem.process();
                this.healthRenderSystem.process();
                this.hudRenderSystem.process();
            };
            return GameSystems;
        })();
        core.GameSystems = GameSystems;
    })(core = example.core || (example.core = {}));
})(example || (example = {}));
//# sourceMappingURL=GameSystems.js.map
/**
 * core/Game.ts
 *
 * Top level application object
 *
 */
var example;
(function (example) {
    var core;
    (function (core) {
        var Container = PIXI.Container;
        var Constants = example.core.Constants;
        var EntitySystem = artemis.EntitySystem;
        var ScaleType = example.core.ScaleType;
        var Properties = example.core.Properties;
        var GameSystems = example.core.GameSystems;
        var Game = (function () {
            /**
             * Create the game instance
             * @param resources
             */
            function Game(resources) {
                var _this = this;
                this.delta = 0;
                this.previousTime = 0;
                this.score = { score: 0 };
                /**
                 * Game Loop
                 * @param time
                 */
                this.update = function (time) {
                    _this.delta = _this.previousTime || time;
                    _this.previousTime = time;
                    if (_this.systems)
                        _this.systems.update((time - _this.delta) * 0.001);
                    _this.renderer.render(_this.stage);
                    requestAnimationFrame(_this.update);
                };
                /**
                 * Resize window
                 */
                this.resize = function () {
                    switch (Constants.SCALE_TYPE) {
                        case ScaleType.FILL:
                            var height = window.innerHeight;
                            var width = window.innerWidth;
                            _this.renderer.resize(width, height);
                            break;
                        case ScaleType.FIXED:
                            _this.renderer.view.style.width = window.innerWidth + 'px';
                            _this.renderer.view.style.height = window.innerHeight + 'px';
                            break;
                    }
                };
                this.stage = new Container();
                this.sprites = new Container();
                EntitySystem.blackBoard.setEntry('game', this);
                EntitySystem.blackBoard.setEntry('sprites', this.sprites);
                EntitySystem.blackBoard.setEntry('resources', resources);
                EntitySystem.blackBoard.setEntry('score', this.score);
                var renderer = this.renderer = PIXI.autoDetectRenderer(Constants.FRAME_WIDTH, Constants.FRAME_HEIGHT, { backgroundColor: 0x000000 });
                switch (Constants.SCALE_TYPE) {
                    case ScaleType.FILL:
                        this.renderer.view.style.position = 'absolute';
                        break;
                    case ScaleType.FIXED:
                        renderer.view.style.position = 'absolute';
                        renderer.view.style.width = window.innerWidth + 'px';
                        renderer.view.style.height = window.innerHeight + 'px';
                        renderer.view.style.display = 'block';
                        break;
                }
                document.body.appendChild(this.renderer.view);
                window.addEventListener('resize', this.resize, true);
                window.onorientationchange = this.resize;
                this.stage.addChild(this.sprites);
                EZGUI.Theme.load([("res/ezgui/" + Constants.theme + "-theme/" + Constants.theme + "-theme.json")], function () {
                    var auto = Properties.get('skip') === 'true';
                    Properties.set('skip', 'false');
                    _this.systems = new GameSystems(_this.renderer.type === PIXI.RENDERER_TYPE.WEBGL);
                    requestAnimationFrame(_this.update);
                });
            }
            /**
             * Load assets and start
             */
            Game.main = function () {
                Properties.init(Constants.appName, Constants.properties);
                for (var asset in Constants.assets) {
                    PIXI.loader.add(asset, Constants.assets[asset]);
                }
                PIXI.loader.load(function (loader, resources) { return new Game(resources); });
            };
            return Game;
        })();
        core.Game = Game;
    })(core = example.core || (example.core = {}));
})(example || (example = {}));
//# sourceMappingURL=Game.js.map
example.core.Game.main();
