'use strict';

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly)
      symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    keys.push.apply(keys, symbols);
  }
  return keys;
}

function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(
          target,
          key,
          Object.getOwnPropertyDescriptor(source, key)
        );
      });
    }
  }
  return target;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  } else {
    obj[key] = value;
  }
  return obj;
}

/**
 * @param {Object}              [query={}]
 * @param {Object}              [options={}]
 * @param {Object|String}       [options.select='']
 * @param {Object|String}       [options.projection={}]
 * @param {Object}              [options.options={}]
 * @param {Object|String}       [options.sort]
 * @param {Object|String}       [options.customLabels]
 * @param {Object}              [options.collation]
 * @param {Array|Object|String} [options.populate]
 * @param {Boolean}             [options.lean=false]
 * @param {Boolean}             [options.leanWithId=true]
 * @param {Number}              [options.offset=0] - Use offset or page to set skip position
 * @param {Number}              [options.page=1]
 * @param {Number}              [options.limit=10]
 * @param {Boolean}             [options.useEstimatedCount=true] - Enable estimatedDocumentCount for larger datasets. As the name says, the count may not abe accurate.
 * @param {Object}              [options.read={}] - Determines the MongoDB nodes from which to read.
 * @param {Function}            [callback]
 *
 * @returns {Promise}
 */
var defaultOptions = {
  customLabels: {
    totalDocs: 'totalDocs',
    limit: 'limit',
    // page: 'page',
    // totalPages: 'totalPages',
    docs: 'docs',
    // nextPage: 'nextPage',
    // prevPage: 'prevPage',
    // pagingCounter: 'pagingCounter',
    // hasPrevPage: 'hasPrevPage',
    // hasNextPage: 'hasNextPage',
    meta: null,
  },
  collation: {},
  lean: false,
  leanWithId: true,
  limit: 10,
  paginatePopulates: false,
  projection: {},
  select: '',
  options: {},
  pagination: true,
  useEstimatedCount: false,
  forceCountFn: false,
  customFind: 'find',
  customCount: 'countDocuments',
};

function paginate(query, options, callback) {
  var _this = this;

  options = _objectSpread(
    _objectSpread(_objectSpread({}, defaultOptions), paginate.options),
    options
  );
  query = query || {};
  var _options = options,
    collation = _options.collation,
    lean = _options.lean,
    leanWithId = _options.leanWithId,
    populate = _options.populate,
    paginatePopulates = _options.paginatePopulates,
    projection = _options.projection,
    read = _options.read,
    select = _options.select,
    sort = _options.sort,
    pagination = _options.pagination,
    useEstimatedCount = _options.useEstimatedCount,
    forceCountFn = _options.forceCountFn,
    customFind = _options.customFind,
    customCount = _options.customCount;

  var customLabels = _objectSpread(
    _objectSpread({}, defaultOptions.customLabels),
    options.customLabels
  );

  var limit = parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 0;
  var isCallbackSpecified = typeof callback === 'function';
  var findOptions = options.options;
  var offset; // let page;

  var skip;
  var docsPromise = []; // Labels

  var labelDocs = customLabels.docs;
  var labelLimit = customLabels.limit; // const labelNextPage = customLabels.nextPage;
  // const labelPage = customLabels.page;
  // const labelPagingCounter = customLabels.pagingCounter;
  // const labelPrevPage = customLabels.prevPage;

  var labelTotal = customLabels.totalDocs; // const labelTotalPages = customLabels.totalPages;
  // const labelHasPrevPage = customLabels.hasPrevPage;
  // const labelHasNextPage = customLabels.hasNextPage;

  var labelMeta = customLabels.meta;

  if (Object.prototype.hasOwnProperty.call(options, 'offset')) {
    offset = parseInt(options.offset, 10);
    skip = offset;
  } else if (Object.prototype.hasOwnProperty.call(options, 'page')) {
    // page = parseInt(options.page, 10);
    // skip = (page - 1) * limit;
  } else {
    offset = 0; // page = 1;

    skip = offset;
  }

  var countPromise;

  if (forceCountFn === true) {
    // Deprecated since starting from MongoDB Node.JS driver v3.1
    countPromise = this.estimatedDocumentCount(query).exec();
  } else {
    if (useEstimatedCount === true) {
      countPromise = this.estimatedDocumentCount().exec();
    } else {
      if (query['$where']) {
        countPromise = this.count(query).exec();
      } else {
        countPromise = this[customCount](query).exec();
      }
    }
  }

  if (limit) {
    var mQuery = this[customFind](query, projection, findOptions);
    mQuery.select(select);
    mQuery.sort(sort);
    mQuery.lean(lean);

    if (read && read.pref) {
      /**
       * Determines the MongoDB nodes from which to read.
       * @param read.pref one of the listed preference options or aliases
       * @param read.tags optional tags for this query
       */
      mQuery.read(read.pref, read.tags);
    } // Hack for mongo < v3.4

    if (Object.keys(collation).length > 0) {
      mQuery.collation(collation);
    }

    if (populate) {
      mQuery.populate(populate);
    }

    if (pagination) {
      mQuery.skip(skip);
      mQuery.limit(limit);
    }

    docsPromise = mQuery.exec();

    if (lean && leanWithId) {
      docsPromise = docsPromise.then(function (docs) {
        docs.forEach(function (doc) {
          if (doc._id) {
            doc.id = String(doc._id);
          }
        });
        return docs;
      });
    }
  }

  return Promise.all([countPromise, docsPromise])
    .then(function (values) {
      var _values$0$length;

      // const [count, docs] = values;
      var count =
        (_values$0$length = values[0].length) !== null &&
        _values$0$length !== void 0
          ? _values$0$length
          : values[0];
      var docs = values[1];

      if (paginatePopulates) {
        if (populate && Array.isArray(populate)) {
          for (var j = 0; j < docs.length; j++) {
            for (var i = 0; i < populate.length; i++) {
              if (
                populate[i] &&
                populate[i].path &&
                !_this.schema.virtuals[populate[i].path].options.justOne
              ) {
                var documentObject = docs[j].toObject();
                documentObject[populate[i].path] = undefined;
                documentObject[populate[i].path] = paginatePopulate(
                  docs[j][populate[i].path],
                  options.populateOptions &&
                    options.populateOptions[populate[i].path]
                );
                docs[j] = documentObject;
              }
            }
          }
        } else if (populate && typeof populate === 'object') {
          for (var _i = 0; _i < docs.length; _i++) {
            docs[_i][populate.path] = paginatePopulate(
              docs[_i][populate.path],
              options.populateOptions && options.populateOptions[populate.path]
            );
          }
        }
      }

      var meta = {
        [labelTotal]: count,
      };
      var result = {};

      if (typeof offset !== 'undefined') {
        meta.offset = parseInt(offset, 10); // page = Math.ceil((offset + 1) / limit);
      } // const pages = limit > 0 ? Math.ceil(count / limit) || 1 : null;
      // Setting default values

      meta[labelLimit] = parseInt(count, 10); // meta[labelTotalPages] = 1;
      // meta[labelPage] = page;
      // meta[labelPagingCounter] = (page - 1) * limit + 1;
      // meta[labelHasPrevPage] = false;
      // meta[labelHasNextPage] = false;
      // meta[labelPrevPage] = null;
      // meta[labelNextPage] = null;

      if (pagination) {
        meta[labelLimit] = limit; // meta[labelTotalPages] = pages;
        // Set prev page
        // if (page > 1) {
        //   meta[labelHasPrevPage] = true;
        //   meta[labelPrevPage] = page - 1;
        // } else if (page == 1 && typeof offset !== 'undefined' && offset !== 0) {
        //   meta[labelHasPrevPage] = true;
        //   meta[labelPrevPage] = 1;
        // } else {
        //   meta[labelPrevPage] = null;
        // }
        // Set next page
        // if (page < pages) {
        //   meta[labelHasNextPage] = true;
        //   meta[labelNextPage] = page + 1;
        // } else {
        //   meta[labelNextPage] = null;
        // }
      } // Remove customLabels set to false

      delete meta['false'];

      if (limit == 0) {
        meta[labelLimit] = 0; // meta[labelTotalPages] = null;
        // meta[labelPage] = null;
        // meta[labelPagingCounter] = null;
        // meta[labelPrevPage] = null;
        // meta[labelNextPage] = null;
        // meta[labelHasPrevPage] = false;
        // meta[labelHasNextPage] = false;
      }

      if (labelMeta) {
        result = {
          [labelDocs]: docs,
          [labelMeta]: meta,
        };
      } else {
        result = _objectSpread(
          {
            [labelDocs]: docs,
          },
          meta
        );
      }

      return isCallbackSpecified
        ? callback(null, result)
        : Promise.resolve(result);
    })
    .catch(function (error) {
      return isCallbackSpecified ? callback(error) : Promise.reject(error);
    });
}

function paginatePopulate() {
  var populateArray =
    arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

  var _ref =
      arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
    _ref$limit = _ref.limit,
    limit = _ref$limit === void 0 ? 10 : _ref$limit,
    _ref$offset = _ref.offset,
    offset = _ref$offset === void 0 ? 0 : _ref$offset;

  var customLabels = _objectSpread({}, defaultOptions.customLabels);

  var labelDocs = customLabels.docs;
  var labelLimit = customLabels.limit;
  var labelTotal = customLabels.totalDocs;
  var labelMeta = customLabels.meta;
  var paginated = paginator(populateArray, offset, limit);
  var count = paginated.totalDocs;
  var docs = paginated.docs;
  var meta = {
    [labelTotal]: count,
    [labelLimit]: parseInt(limit, 10),
  };
  var result = {};

  if (typeof offset !== 'undefined') {
    meta.offset = parseInt(offset, 10);
  } // Remove customLabels set to false

  delete meta['false'];

  if (labelMeta) {
    result = {
      [labelDocs]: docs,
      [labelMeta]: meta,
    };
  } else {
    result = _objectSpread(
      {
        [labelDocs]: docs,
      },
      meta
    );
  }

  return result;
}

function paginator() {
  var items =
    arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var offset =
    arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var limit =
    arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 10;
  return {
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    totalDocs: parseInt(items.length, 10),
    docs: items.slice(offset).slice(0, limit),
  };
}
/**
 * @param {Schema} schema
 */

module.exports = function (schema) {
  schema.statics.paginate = paginate;
};

module.exports.paginate = paginate;
