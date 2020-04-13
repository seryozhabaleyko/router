const parseRouteParamToCorrectType = (paramValue) => {
	if (!Number.isNaN(paramValue)) {
		return parseInt(paramValue, 10);
	}

	if (paramValue === 'true' || paramValue === 'false') {
		return JSON.parse(paramValue);
	}

	return paramValue;
};

const extractRouteParams = (routeIdentifier, currentHash) => {
	const splittedHash = currentHash.split('/');
	const splittedRouteIdentifier = routeIdentifier.split('/');

	return splittedRouteIdentifier.map((routeIdentifierToken, index) => {
		if (routeIdentifierToken.indexOf(':', 0) === -1) {
			return null;
		}
		const routeParam = {};
		const key = routeIdentifierToken.substr(1, routeIdentifierToken.length - 1);
		routeParam[key] = splittedHash[index];
		return routeParam;
	}).filter((p) => p !== null).reduce((acc, curr) => {
		Object.keys(curr).forEach((key) => {
			acc[key] = parseRouteParamToCorrectType(curr[key]);
		});
		return acc;
	}, {});
};

const findMatchingRouteIdentifier = (currentHash, routeKeys) => {
	const splittedHash = currentHash.split('/');
	const firstHashToken = splittedHash[0];

	return routeKeys.filter((routeKey) => {
		const splittedRouteKey = routeKey.split('/');
		const staticRouteTokensAreEqual = splittedRouteKey.map((routeToken, i) => {
			if (routeToken.indexOf(':', 0) !== -1) {
				return true;
			}
			return routeToken === splittedHash[i];
		}).reduce((countInvalid, currentValidationState) => {
			if (currentValidationState === false) {
				++countInvalid;
			}
			return countInvalid;
		}, 0) === 0;

		return routeKey.indexOf(firstHashToken, 0) !== -1 && staticRouteTokensAreEqual && splittedHash.length === splittedRouteKey.length;
	})[0];
};

const XMLHttpRequestFactory = window.XMLHttpRequest;

const loadTemplate = (templateUrl, successCallback) => {
	const xhr = new XMLHttpRequestFactory();
	xhr.onreadystatechange = () => {
		if (xhr.readyState === 4) {
			successCallback(xhr.responseText);
		}
	};
	xhr.open('GET', templateUrl);
	xhr.send();
};

const renderTemplates = (routeConfiguration, domEntryPoint, successCallback) => {
	if (!routeConfiguration) {
		return;
	}

	if (routeConfiguration.templateString) {
		domEntryPoint.innerHTML = routeConfiguration.templateString;
		successCallback();
	}

	if (routeConfiguration.templateUrl) {
		loadTemplate(routeConfiguration.templateUrl, (templateString) => {
			domEntryPoint.innerHTML = templateString;
			successCallback();
		});
	}

	if (routeConfiguration.templateId) {
		const templateScript = document.getElementById(routeConfiguration.templateId);
		domEntryPoint.innerHTML = templateScript.text;
		successCallback();
	}
};

const createRouter = (domEntryPoint) => {
	const routes = {};
	const lastDomEntryPoint = domEntryPoint.cloneNode(true);
	let lastRouteHandler = null;

	const navigateTo = (hashUrl) => {
		window.location.hash = hashUrl;
	};

	const otherwise = (routeHandler) => {
		routes['*'] = routeHandler;
	};

	const addRoute = (hashUrl, routeHandler, data) => {
		routes[hashUrl] = routeHandler;
		routes[hashUrl].data = data;

		return { addRoute, otherwise, navigateTo };
	};

	const initializeDomElement = () => {
		if (!domEntryPoint.parentElement) {
			return;
		}

		const domClone = lastDomEntryPoint.cloneNode(true);
		domEntryPoint.parentElement.insertBefore(domClone, domEntryPoint);

		if (typeof domEntryPoint.remove === 'undefined') {
			domEntryPoint.removeNode(true);
		} else {
			domEntryPoint.remove();
		}

		domEntryPoint = domClone;
	};

	const disposeLastRoute = () => {
		if (!lastRouteHandler) return;
		if (typeof lastRouteHandler.dispose === 'undefined') return;
		lastRouteHandler.dispose(domEntryPoint);
	};

	const handleRouting = () => {
		const defaultRouteIdentifier = '*';
		const currentHash = window.location.hash.slice(1);

		const maybeMatchingRouteIdentifier = findMatchingRouteIdentifier(currentHash, Object.keys(routes));
		let routeParams = {};
		if (maybeMatchingRouteIdentifier) {
			routeParams = extractRouteParams(maybeMatchingRouteIdentifier, currentHash);
		}

		const routeHandler = Object.keys(routes).indexOf(maybeMatchingRouteIdentifier) > -1 ? routes[maybeMatchingRouteIdentifier] : routes[defaultRouteIdentifier];

		if (!routeHandler) {
			return;
		}

		disposeLastRoute(routeHandler);

		lastRouteHandler = routeHandler;

		initializeDomElement();

		if (typeof routeHandler === 'function') {
			routeHandler(domEntryPoint, routeParams, routeHandler.data);
		} else {
			if (!routeHandler.templateString && !routeHandler.templateId && !routeHandler.templateUrl) {
				throw Error(`Шаблон не настроен для маршрута ${currentHash}`);
			}

			renderTemplates(routeHandler, domEntryPoint, () => {
				if (typeof routeHandler.routeHandler === 'function') {
					routeHandler.routeHandler(domEntryPoint, routeParams, routeHandler.data);
				}
			});
		}
	};

	if (window) {
		window.removeEventListener('hashchange', handleRouting);
		window.addEventListener('hashchange', handleRouting);
		window.removeEventListener('load', handleRouting);
		window.addEventListener('load', handleRouting);
	}

	return { addRoute, otherwise, navigateTo };
};

export default createRouter;