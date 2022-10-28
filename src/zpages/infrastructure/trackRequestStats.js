let requestStats = {};

function buildTrackRequestStats() {
	requestStats = {
		requestCount: 0,
		responseCount: 0,
		responsesByStatus: new Map(),
	};

	requestStats.addRequest = function (req) {
		this.requestCount++;
	};

	requestStats.addResponse = function (req, res) {
		this.responseCount++;
		// if !req.route -> invalid route, so slice the last node of path
		// for more details, see logs where statusCode = 404 and requestUrl like the part of the path shown
		const route = req.route ? req.baseUrl + req.route.path : req.path.slice(0, req.path.lastIndexOf('/'));
		const mapKey = `${req.method}_${route}_${res.statusCode}`;
		const resCount = (this.responsesByStatus.get(mapKey) || 0) + 1;
		this.responsesByStatus.set(mapKey, resCount);
	};

	requestStats.toObject = function () {
		return {
			requestCount: this.requestCount,
			responseCount: this.responseCount,
			responsesByStatus: Object.fromEntries(this.responsesByStatus.entries()),
		};
	};

	return function (req, res, next) {
		requestStats.addRequest(req);

		res.on('finish', () => {
			requestStats.addResponse(req, res);
		});

		next();
	};
}

function getRequestStats() {
	return requestStats.toObject();
}

module.exports = { buildTrackRequestStats, getRequestStats };
