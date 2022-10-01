/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const { buildTracerizer } = require('./tracerizer');
const { buildPinomor } = require('./pinomor');
const { buildJsonBodyErrorHandler } = require('./jsonBodyErrorHandler');
const { buildAuthnerizer } = require('./authnerizer');
const { buildAuthzerizer } = require('./authzerizer');

module.exports = {
	buildTracerizer,
	buildPinomor,
	buildJsonBodyErrorHandler,
	buildAuthnerizer,
	buildAuthzerizer,
};
