'use strict';

// set up ======================================================================

var express = require('express');
var app = express();
var https = require('https');
//https.globalAgent.maxSockets = 5; //handled with custom logic

var fs = require('fs');
var cheerio = require('cheerio');


var baseUrl = 'https://www.rentomojo.com'; //enter your base url here
var internalUrlsToScrape = [];
var extractedLinks = [];
var connectionCount = 0,
	globalConnectionLimit = 5;

var options = {
	headers: {
		'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)'
	},
	host: 'rentomojo.com',
	//path: '/?_escaped_fragment_=',
	method: 'GET'
};


Array.prototype.unique = function () {
	return this.reduce(function (previous, current, index, array) {
		previous[current.toString() + typeof (current)] = current;
		return array.length - 1 == index ? Object.keys(previous).reduce(function (prev, cur) {
			prev.push(previous[cur]);
			return prev;
		}, []) : previous;
	}, []);
};


function collectLinks($) {

	var originalStartPointForInternalUrls = internalUrlsToScrape.length;
	var originalStartPointForExtractedLinks = extractedLinks.length;

	var relativeLinks = $("a[href^='/']");
	relativeLinks.each(function () {
		extractedLinks.push(baseUrl + $(this).attr('href'));
		if ($(this).attr('href') !== undefined) {
			internalUrlsToScrape.push(baseUrl + $(this).attr('href'));
		}

	});

	var absoluteLinks = $("a[href^='http']");
	absoluteLinks.each(function () {
		extractedLinks.push($(this).attr('href'));
		//adding url belonging to the same host for crawling
		if ($(this).attr('href').indexOf(baseUrl) == 0) {
			if ($(this).attr('href') !== undefined) {
				internalUrlsToScrape.push($(this).attr('href'));
			}
		}
	});

	extractedLinks = extractedLinks.unique();
	internalUrlsToScrape = internalUrlsToScrape.unique();

	for (var i = originalStartPointForInternalUrls; i < internalUrlsToScrape.length; i++) {
		queueForCrawling(internalUrlsToScrape[i]);
	}

	var arrayToPrint = extractedLinks !== null && extractedLinks.length > 0 ? extractedLinks.slice(originalStartPointForExtractedLinks, extractedLinks.length) : [];
	fs.appendFile("links.csv", (arrayToPrint !== null && arrayToPrint.length > 0 ? arrayToPrint.join('\n') : ''), function (err) {
		if (err) {
			return console.log(err);
		}
	});

}

function crawlLink(url) {
	console.log('crawling url ' + url);
	options.url = url;
	connectionCount = connectionCount + 1;
	var req = https.request(options, function (res) {
		console.log(res.statusCode);
		if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location !== undefined) {
			crawlLink(res.headers.location);
		} else {
			var output = '';

			res.on('data', function (chunk) {
				output += chunk;
			});

			res.on('end', function () {
				connectionCount = connectionCount - 1;
				var $ = cheerio.load(output);
				collectLinks($);
			});
		}

	});

	req.on('error', function (err) {
		console.log(err);
	});

	req.end();
}

function checkConnectionAvailablity() {
	if (connectionCount < globalConnectionLimit) {
		return true;
	} else {
		return false;
	}
}

function queueForCrawling(url) {
	if (checkConnectionAvailablity()) {
		crawlLink(url);
	} else {
		setTimeout(function () {
			queueForCrawling(url);
		}, 500);
	}
}

//start crawling the base url
crawlLink(baseUrl);




// listen (start app with node server.js) ======================================
var port = 8080;
app.listen(port);
console.log("App listening on port " + port);

// expose app           
exports = module.exports = app;