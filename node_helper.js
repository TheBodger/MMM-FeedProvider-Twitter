//this loads tweets depending on its config when called to from the main module
//to minimise activity, it will track what data has been already sent back to the module
//and only send the delta each time

//this is done by making a note of the last published data of tweets sent to the module tracked at the tweet seach key level
//and ignoring anything older than that

//as some tweets wont have a published date, they will be allocated a pseudo published date of the latest published date in the current processed feeds

//if the module calls a RESET, then the date tracking is reset and all data will be sent 

//this is copies from other MMM-FeedPRovider modules and uses a common terminoly of feed, feeds. this simply represent the incoming
//information and doesnt represent what the actual data is
//only the core changes will appear differently and reference the actual purpose of the module.

//nodehelper stuff:
//this.name String The name of the module

var NodeHelper = require("node_helper");
var moment = require("moment");

var FeedParser = require('feedparser');
var request = require('request'); // for fetching the feed

const axios = require('axios');
const fs = require('fs').promises;

const Twitter = require('twitter');

//pseudo structures for commonality across all modules
//obtained from a helper file of modules

var LOG = require('../MMM-FeedUtilities/LOG');
var RSS = require('../MMM-FeedUtilities/RSS');
var QUEUE = require('../MMM-FeedUtilities/queueidea');
var UTILITIES = require('../MMM-FeedUtilities/utilities');

// structures

var rsssource = new RSS.RSSsource();

// local variables, held at provider level as this is a common module
//these are largely for the authors reference and are not actually used in thsi code

var providerstorage = {};

var trackingfeeddates = []; //an array of last date of feed recevied, one for each feed in the feeds index, build from the config
var aFeed = { lastFeedDate: '', feedURL: '' };

var payloadformodule = []; //we send back an array of identified stuff
var payloadstuffitem = { stuffID: '', stuff: '' }

var latestfeedpublisheddate = new Date(0) // set the date so no feeds are filtered, it is stored in providerstorage

module.exports = NodeHelper.create({

	start: function () {
		this.debug = true;
		console.log(this.name + ' node_helper is started!');
		this.logger = {};
		this.logger[null] = LOG.createLogger("MMM-FeedProvider-Twitter-node_helper" + ".log", this.name);
		this.queue = new QUEUE.queue("single", false);
		this.maxfeeddate = new Date(0); //used for date checking of posts
	},

	stop: function () {
		console.log("Shutting down node_helper");
	},

	setconfig: function (moduleinstance, config) {

		if (this.debug) { this.logger[moduleinstance].info("In setconfig: " + moduleinstance + " " + config); }

		//store a local copy so we dont have keep moving it about

		providerstorage[moduleinstance] = { config: config, trackingfeeddates: [] };

		var self = this;

		//process the feed details into the local feed tracker

		providerstorage[moduleinstance].config.feeds.forEach(function (configfeed) {

			var feed = { sourcetitle: '', lastFeedDate: '', searchterm: '', latestfeedpublisheddate: new Date(0) };

			//store the actual timestamp to start filtering, this will change as new feeds are pulled to the latest date of those feeds
			//if no date is available on a feed, then the current latest date of a feed published is allocated to it

			feed.lastFeedDate = self.calcTimestamp(configfeed.oldestage);
			feed.searchHashtag = configfeed.searchHashtag;
			feed.sourcetitle = configfeed.feedtitle;

			providerstorage[moduleinstance].trackingfeeddates.push(feed);

		});

	},

	calcTimestamp: function (age) {

		//calculate the actual timestamp to use for filtering feeds, 
		//options are timestamp format, today for midnight + 0.0001 seconds today, or age in minutes
		//determine the format of the data in age

		console.log(age);

		var filterDate = new Date();

		if (typeof (age) == 'number') {

			filterDate = new Date(filterDate.getTime() - (age * 60 * 1000));

		}
		else { //age is hopefully a string ha ha

			if (age.toLowerCase() == 'today') {
				filterDate = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 0, 0, 0, 0)
			}

			else { //we assume the user entered a correct date - we can try some basic validation

				if (moment(age, "YYYY-MM-DD HH:mm:ss", true).isValid()) {
					filterDate = new Date(age);
				}
				else {

					console.log(this.name + " Invalid date provided for filter age of feeds:" + age.toString());
				}

			}
		}

		return filterDate;

	},

	getconfig: function () { return config; },

	reset: function (moduleinstance) {

		//clear the date we have been using to determine the latest data pulled for each feed

		//console.log(providerstorage[id].trackingfeeddates);

		providerstorage[moduleinstance].trackingfeeddates.forEach(function (feed) {

			//console.log(feed);

			feed['latestfeedpublisheddate'] = new Date(0);

			//console.log(feed);

		});

		//console.log(providerstorage[moduleinstance].trackingfeeddates);

	},

	socketNotificationReceived: function (notification, payload) {

		var self = this;

		if (this.logger[payload.moduleinstance] == null) {

			this.logger[payload.moduleinstance] = LOG.createLogger("logfile_" + payload.moduleinstance + ".log", payload.moduleinstance);

		};

		if (this.debug) {
			this.logger[payload.moduleinstance].info(this.name + " NODE HELPER notification: " + notification + " - Payload: ");
			this.logger[payload.moduleinstance].info(JSON.stringify(payload));
		}

		//we can receive these messages:
		//
		//RESET: clear any date processing or other so that all available stuff is returned to the module
		//CONFIG: we get our copy of the config to look after
		//UPDATE: request for any MORE stuff that we have not already sent
		//

		switch (notification) {
			case "CONFIG":
				this.setconfig(payload.moduleinstance, payload.config);
				break;
			case "RESET":
				this.reset(payload);
				break;
			case "UPDATE":
				//because we can get some of these in a browser refresh scenario, we check for the
				//local storage before accepting the request

				if (providerstorage[payload.moduleinstance] == null) { break; } //need to sort this out later !!
				self.processtweets(payload.moduleinstance, payload.providerid);
				break;
			case "STATUS":
				this.showstatus(payload.moduleinstance);
				break;
		}

	},

	showstatus: function (moduleinstance) {

		console.log('============================ start of status ========================================');

		console.log('config for provider: ' + moduleinstance);

		console.log(providerstorage[moduleinstance].config);

		console.log('feeds for provider: ' + moduleinstance);

		console.log(providerstorage[moduleinstance].trackingfeeddates);

		console.log('============================= end of status =========================================');

	},

	processtweets: function (moduleinstance, providerid) {

		var self = this;
		var feedidx = -1;

		if (this.debug) { this.logger[moduleinstance].info("In processfeeds: " + moduleinstance + " " + providerid); }

		providerstorage[moduleinstance].trackingfeeddates.forEach(function (feed) {

			if (self.debug) {
				self.logger[moduleinstance].info("In process feed: " + JSON.stringify(feed));
				self.logger[moduleinstance].info("In process feed: " + moduleinstance);
				self.logger[moduleinstance].info("In process feed: " + providerid);
				self.logger[moduleinstance].info("In process feed: " + feedidx);
				self.logger[moduleinstance].info("building queue " + self.queue.queue.length);
			}

			//we have to pass the providerid as we are going async now

			self.queue.addtoqueue(function () { self.fetchfeed(feed, moduleinstance, providerid, ++feedidx); });

		});

		this.queue.startqueue(providerstorage[moduleinstance].config.waitforqueuetime);

	},

	sendNotificationToMasterModule: function (stuff, stuff2) {
		this.sendSocketNotification(stuff, stuff2);
	},

	getParams: function (str) {

		var params = str.split(';').reduce(function (params, param) {

			var parts = param.split('=').map(function (part) { return part.trim(); });

			if (parts.length === 2) {

				params[parts[0]] = parts[1];

			}

			return params;

		}, {});

		return params;

	},

	done: function (err) {

		if (err) {

			console.log(err, err.stack);

		}

	},

	send: function (moduleinstance, providerid, source, feeds) {

		var payloadforprovider = { providerid: providerid, source: source, payloadformodule: feeds.items }

		if (this.debug) {
			this.logger[moduleinstance].info("In send, source, feeds // sending items this time: " + feeds.items.length );
			this.logger[moduleinstance].info(JSON.stringify(source));
			this.logger[moduleinstance].info(JSON.stringify(feeds));
		}

		if (feeds.items.length > 0) {
			this.sendNotificationToMasterModule("UPDATED_STUFF_" + moduleinstance, payloadforprovider);
		}

		this.queue.processended();

	},

	fetchfeed: function (feed, moduleinstance, providerid, feedidx) {

		if (this.debug) {
			this.logger[moduleinstance].info("In fetch feed: " + JSON.stringify(feed));
			this.logger[moduleinstance].info("In fetch feed: " + moduleinstance);
			this.logger[moduleinstance].info("In fetch feed: " + providerid);
			this.logger[moduleinstance].info("In fetch feed: " + feedidx);
		}

		this.maxfeeddate = new Date(0);

		var rssitems = new RSS.RSSitems();

		//use these in the feedparser area
		var sourcetitle = feed.sourcetitle;
		//we use twitter module to create the url for us

		var theConfig = providerstorage[moduleinstance].config;

		var client = new Twitter({
			consumer_key: theConfig.consumer_key,
			consumer_secret: theConfig.consumer_secret,
			access_token_key: theConfig.access_token_key,
			access_token_secret: theConfig.access_token_secret
		});

		// this to self
		var self = this;
		// prepare the twitter client param, clear query and params
		var query = '';
		var params = {};

		var languageParam = '';
		if (!theConfig.language == '') {
			params = {
				q: feed.searchHashtag,
				count: theConfig.totalTweetsPerUpdate,
				lang: theConfig.language,
			}
		}
		else {
			params = {
				q: feed.searchHashtag,
				count: theConfig.totalTweetsPerUpdate
			}
		}

		query = 'search/tweets';

		//call twitter client based on query and params

		client.get(query, params, function (error, tweets, response) {
			// if no error, send tweets for processing

			console.log("-----------------");
			console.log(client);
			console.log(query, params);

			if (!error) {

				//create a psuedo meta object
				if (self.debug) { self.logger[moduleinstance].info("meta: "); }

				//rsssource.title = meta.title;
				//rsssource.sourcetitle = sourcetitle;
				//rsssource.url = feedurl;

				tweets = tweets['statuses']; //the actual tweets required are in here

				self.parseTweets(theConfig, tweets, feed, moduleinstance, rssitems); 

				if (self.debug) { self.logger[moduleinstance].info("tweets all pushed"); }

				for (var idx = 0; idx < rssitems.length; idx++) {

					if (rssitems[idx].imageURL != null) {
						if (RSS.checkfortrackingpixel(rssitems[idx].imageURL, moduleinstance)) {
							rssitems[idx].imageURL = null;
						}
					}
				}

				if (new Date(0) < self.maxfeeddate) {
					providerstorage[moduleinstance].trackingfeeddates[feedidx]['latestfeedpublisheddate'] = self.maxfeeddate;
				}

				self.send(moduleinstance, providerid, rsssource, rssitems);

				self.done();

			}
			// otherwise process error
			else {
				self.processError();
			}
		});

	},

	processError: function (err) {

		if (err) {

			console.log(err, err.stack);

		}

	},

	parseTweets: function (theConfig, tweets, feed, moduleinstance, rssitems) {

		var self = this;

		var includedTweetList = [];
		var userTweetCountList = {};
		var nowTime = Date.now();

		console.log(this.name + " #### tweets.length " + tweets.length);

		if (self.debug) { self.logger[moduleinstance].info("feedparser readable: "); }

		for (var cIndex = 0; cIndex < tweets.length; cIndex++) {

			var rssarticle = new RSS.RSSitem();
			var post = {};

			var cTweet = tweets[cIndex]; //first we convert to our standard post format

			post['pubdate'] = new Date(cTweet.created_at);
			post['title'] = cTweet.text;
			post['description'] = '';
			post['categories'] = ['twitter', 'tweet'];
			post['source'] = cTweet.user.screen_name;
			post['image'] = {};

			var cIsQuoteStatus = cTweet.is_quote_status;
			var cIsRetweeted = (cTweet.retweeted_status !== undefined);
			var cHasMedia = (cTweet.entities.media !== undefined);

			//post.image.url

			var cHasURLs = (cTweet.entities.urls.length !== 0);

			var cTweetDoInclude = true;

			// if set to exclude quote and has a quote, exclude
			if (theConfig.excludeTweetsWithQuotes && cIsQuoteStatus)
				cTweetDoInclude = false;
			if (this.debug) { console.log(this.name + " #### cTweetDoInclude 1" + cTweetDoInclude) };
			// if set to exclude retweets and is a retweet, exclude
			if (theConfig.excludeRetweets && cIsRetweeted)
				cTweetDoInclude = false;
			if (this.debug) { console.log(this.name + " #### cTweetDoInclude 2" + cTweetDoInclude) };
			// if set to exclude tweets with media has media, exclude
			if (theConfig.excludeMediaTweets && cHasMedia)
				cTweetDoInclude = false;
			if (this.debug) { console.log(this.name + " #### cTweetDoInclude 3" + cTweetDoInclude) };
			// if set to exclude tweets with links and has a link, exclude
			if (theConfig.excludeLinkTweets && cHasURLs)
				cTweetDoInclude = false;
			if (this.debug) { console.log(this.name + " #### cTweetDoInclude 4" + cTweetDoInclude) };
			// if set to exclude short tweets and is short, exclude
			if ((theConfig.excludeTweetLengthLessThan > 0) &&
				(cTweet.text.length < theConfig.excludeTweetLengthLessThan))
				cTweetDoInclude = false;
			if ((theConfig.excludeTweetsWithoutText.length > 0) &&
				(this.doesNotHaveRequiredText(cTweet.text, theConfig)))
				cTweetDoInclude = false;
			if (this.debug) { console.log(this.name + " #### cTweetDoInclude 8" + cTweetDoInclude) };

			//end of converting the tweet into a post format for standard processing

			if (this.debug) { self.logger[moduleinstance].info("feedparser post read: " + JSON.stringify(post.title)); }

			//ignore any feed older than feed.lastFeedDate or older than the last feed sent back to the modules
			//feed without a feed will be given the current latest feed data

			//because the feeds can come in in reverse date order, we only update the latest feed date at the end in send

			if (post.pubdate == null) {
				post.pubdate = new Date(feed.latestfeedpublisheddate.getTime() + 1);
				console.log("Article missing a date - so used: " + feed['latestfeedpublisheddate']);
			}

			if (post.pubdate >= feed.lastFeedDate && post.pubdate > feed.latestfeedpublisheddate) {

				rssarticle.id = rssarticle.gethashCode(post.title);
				rssarticle.title = post.title;

				rssarticle.pubdate = post.pubdate;
				self.maxfeeddate = new Date(Math.max(self.maxfeeddate, post.pubdate));

				rssarticle.description = post.description;
				rssarticle.age = rssarticle.getage(new Date(), rssarticle.pubdate); //in microseconds
				rssarticle.categories = post.categories;
				rssarticle.source = post.source;

				//go find an image

				//https://pbs.twimg.com/media/EV5VJb9XQAAgAUX?format=jpg&name=large

				if (cHasMedia) {

					//find the url

					rssarticle.imageURL = cTweet.entities.media[0].media_url_https + "?format=jpg&name=small"

                }

				if (self.debug) { self.logger[moduleinstance].info("article " + JSON.stringify(rssarticle)); }

				if (cTweetDoInclude) {
					rssitems.items.push(rssarticle);
				}

			}
			else {
				if (self.debug) { self.logger[moduleinstance].info("Allready sent this item or it is too old - just like me"); }
			}

		} //end of processing this particular batch of tweets

	},

});