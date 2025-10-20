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

const defaultOptions = {
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
  options = {
    ...defaultOptions,
    ...paginate.options,
    ...options,
  };
  query = query || {};

  const {
    collation,
    lean,
    leanWithId,
    populate,
    paginatePopulates,
    projection,
    read,
    select,
    sort,
    pagination,
    useEstimatedCount,
    forceCountFn,
    customFind,
    customCount,
  } = options;

  const customLabels = {
    ...defaultOptions.customLabels,
    ...options.customLabels,
  };

  const limit =
    parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 0;

  const isCallbackSpecified = typeof callback === 'function';
  const findOptions = options.options;

  let offset;
  // let page;
  let skip;

  let docsPromise = [];

  // Labels
  const labelDocs = customLabels.docs;
  const labelLimit = customLabels.limit;
  // const labelNextPage = customLabels.nextPage;
  // const labelPage = customLabels.page;
  // const labelPagingCounter = customLabels.pagingCounter;
  // const labelPrevPage = customLabels.prevPage;
  const labelTotal = customLabels.totalDocs;
  // const labelTotalPages = customLabels.totalPages;
  // const labelHasPrevPage = customLabels.hasPrevPage;
  // const labelHasNextPage = customLabels.hasNextPage;
  const labelMeta = customLabels.meta;

  if (Object.prototype.hasOwnProperty.call(options, 'offset')) {
    offset = parseInt(options.offset, 10);
    skip = offset;
  } else if (Object.prototype.hasOwnProperty.call(options, 'page')) {
    // page = parseInt(options.page, 10);
    // skip = (page - 1) * limit;
  } else {
    offset = 0;
    // page = 1;
    skip = offset;
  }

  let countPromise;

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
    const mQuery = this[customFind](query, projection, findOptions);
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
    }

    // Hack for mongo < v3.4
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
      docsPromise = docsPromise.then((docs) => {
        docs.forEach((doc) => {
          if (doc._id) {
            doc.id = String(doc._id);
          }
        });
        return docs;
      });
    }
  }

  return Promise.all([countPromise, docsPromise])
    .then((values) => {
      // const [count, docs] = values;

      const count = values[0].length ?? values[0];
      const docs = values[1];

      if (paginatePopulates) {
        if (populate && Array.isArray(populate)) {
          for (let j = 0; j < docs.length; j++) {
            for (let i = 0; i < populate.length; i++) {
              if (
                populate[i] &&
                populate[i].path &&
                !this.schema.virtuals[populate[i].path].options.justOne
              ) {
                const documentObject = docs[j].toObject();
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
          for (let i = 0; i < docs.length; i++) {
            docs[i][populate.path] = paginatePopulate(
              docs[i][populate.path],
              options.populateOptions && options.populateOptions[populate.path]
            );
          }
        }
      }
      const meta = {
        [labelTotal]: count,
      };

      let result = {};

      if (typeof offset !== 'undefined') {
        meta.offset = parseInt(offset, 10);
        // page = Math.ceil((offset + 1) / limit);
      }

      // const pages = limit > 0 ? Math.ceil(count / limit) || 1 : null;

      // Setting default values
      meta[labelLimit] = parseInt(count, 10);
      // meta[labelTotalPages] = 1;
      // meta[labelPage] = page;
      // meta[labelPagingCounter] = (page - 1) * limit + 1;

      // meta[labelHasPrevPage] = false;
      // meta[labelHasNextPage] = false;
      // meta[labelPrevPage] = null;
      // meta[labelNextPage] = null;

      if (pagination) {
        meta[labelLimit] = limit;
        // meta[labelTotalPages] = pages;

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
      }

      // Remove customLabels set to false
      delete meta['false'];

      if (limit == 0) {
        meta[labelLimit] = 0;
        // meta[labelTotalPages] = null;
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
        result = {
          [labelDocs]: docs,
          ...meta,
        };
      }

      return isCallbackSpecified
        ? callback(null, result)
        : Promise.resolve(result);
    })
    .catch((error) => {
      return isCallbackSpecified ? callback(error) : Promise.reject(error);
    });
}

function paginatePopulate(populateArray = [], { limit = 10, offset = 0 } = {}) {
  const customLabels = {
    ...defaultOptions.customLabels,
  };

  const labelDocs = customLabels.docs;
  const labelLimit = customLabels.limit;
  const labelTotal = customLabels.totalDocs;
  const labelMeta = customLabels.meta;
  const paginated = paginator(populateArray, offset, limit);
  const count = paginated.totalDocs;
  const docs = paginated.docs;
  const meta = {
    [labelTotal]: count,
    [labelLimit]: parseInt(limit, 10),
  };
  let result = {};

  if (typeof offset !== 'undefined') {
    meta.offset = parseInt(offset, 10);
  }

  // Remove customLabels set to false
  delete meta['false'];

  if (labelMeta) {
    result = {
      [labelDocs]: docs,
      [labelMeta]: meta,
    };
  } else {
    result = {
      [labelDocs]: docs,
      ...meta,
    };
  }
  return result;
}

function paginator(items = [], offset = 0, limit = 10) {
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
module.exports = (schema) => {
  schema.statics.paginate = paginate;
};

module.exports.paginate = paginate;
