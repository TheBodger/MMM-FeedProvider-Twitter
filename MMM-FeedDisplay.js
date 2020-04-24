//\MMM-MMM-FeedDisplay.js

var startTime = new Date(); //use for getting elapsed times during debugging

var feedDisplayPayload = { consumerid: '', providerid: '', payload: '' };

Module.register("MMM-FeedDisplay", {

	// Default module config.
	// WARNING - added 2 layers of config, so make sure you have a display and an article section as parents to the settings
	//in config.js

	defaults: {

		text: "... loading",
		id: "MMFD1", // the unique id of this consumer

		//display details

		display: {

			articleage: false,			//adds the formatted age of the article to the meta details line
			articlecount: 10,			//number of articles to display
			articledescription: false,	//show the article description 
			articletitle: true,			//show the article title
			articlimage: false,			//if an image has been passed as a url, then include it, if missing dont (no nasty missing image /size)
			clearhilighttime: 10000,	//leave the highlights in place for at least this time period, negating losing highlights as multiple feeds come in
			feedtitle: false,			//TODO display whatever title(s) of the feed has been provided for a group of arcticles above the articles
			firstfulltext: false,		//the top most text only post contains all text
			formatstyle: 'default',		//the format to use for whatever article options to display have been included
										//default - mirror the tweeter format for no image
										//default - mirror the instagram2020 format with an image
										//TODO add alternative formats
			hilightnewarticles: true,	//any never before shown feeds will be hilighted (all initially)
			modulewidth: "10vw",		//constrain the width to this // maybe should go into the css
			refreshtime: 5000,			//5000, refresh the displayed stuff every 5 seconds
			rotationstyle: 'default',	//how to rotate the list of articles on refresh cycle
										//the refresh cycle is reset when new articles are made available
										//default - display the next n articles, where n is the articlecount
										//scroll - move the articles up by 1 at each refresh
			sourcenamelength: 4,		//displays the 1st n characters of the source name on the same line as the age of the item each item, good for merge and alternate
			textbelowimage: true,		//either display the text for an image below it or over it if false
			textlength: 0,				//truncate the title and description each to this length and add ... to show it is truncated
										//default is 0 which means show all, control over showing the title and is elsewhere
										//length constraint is applied after the text is cleaned if requested
			wraparticles: false,		//wrap into / fill all display slots (articlecount) 

	
		},
		article: {

			//article ordered details, define how the aggregator returns the current list of articles

			mergetype: 'none',		// how to merge multiple feeds togther
									// none - no merging
									// merge - merge all feed details before applying the order type
									// alternate - merge by taking alternate articles from each feed (i.e. 1st,1st,1st,2nd,2nd,2nd), will apply sort order before merging 
			ordertype: 'default',	//options are 
									//	default - fifo grouped by the title as this is how they are recevied from the provider
									//	date(same as age), age, - ascending or descending by how old they are
									// TODO - we may want other options such as by provider or alphabetically title or most active feed
			order: 'ascending',		//options are ascending or descending, youngest first or oldest first
			maxcount: 20,			//TODO the maximum number of articles in a feed ( this includes the merged one ) before there is clipping, clipping takes place after articles have been displayed at least once 
			cleanedtext: false,		//removes any html tags and (TODO bad-words), leaving just text from title and description
			ignorecategorylist: [], //ignore articles matching any category, full word, in this list i.e. ["horoscopes"]

		},

	},

	// we have to override the default setConfig as we will be merging a deep clone of .display and .article
	setConfig: function (config) {
		this.config = Object.assign({}, this.defaults, config);
		if (config.display != null) { this.config.display = Object.assign({}, this.defaults.display, config.display); }
		if (config.article != null) { this.config.article = Object.assign({}, this.defaults.article, config.article); }

	},

	//this.name String The name of the module.
	//this.identifier String This is a unique identifier for the module instance.
	//this.hidden Boolean This represents if the module is currently hidden(faded away).
	//this.config Boolean The configuration of the module instance as set in the user's config.js file. This config will also contain the module's defaults if these properties are not over- written by the user config.
	//this.data Object The data object contain additional metadata about the module instance. (See below)


	//The this.data data object contain the following metadata:
	//	data.classes - The classes which are added to the module dom wrapper.
	//	data.file - The filename of the core module file.
	//	data.path - The path of the module folder.
	//	data.header - The header added to the module.
	//	data.position - The position in which the instance will be shown.

	start: function () {

		Log.log(this.name + ' is started!');

		//this.updateDom(speed)
		//speed Number - Optional.Animation speed in milliseconds.
		//Whenever your module need to be updated, call the updateDom(speed) method.

		var self = this;

		//local variables

		this.displayarticleidx = 0; // the pointer into the list of articles that the next display cycle will start displaying from
		this.totalarticlecount = 0; // the total number of articles available for dispaying at the moment
		this.displayarticles = []; //{title: '', articles: []};  // all the actual articles available for display, grouped by the title

		this.hilightarticletimer = new Date(); // used to wait a specifriced time before removing any hilights from new articles

		this.timer = '', //contains the current display loop timer, used to clear it so we only have one timer running

		feedDisplayPayload.id = this.config.id;
		feedDisplayPayload.payload = "";

		//tell the node helper this config

		this.sendNotificationToNodeHelper("CONFIG", { moduleinstance:this.identifier, config: this.config });

		//now we wait for the providers to start ... providing

		this.sendNotificationToNodeHelper("STATUS", this.identifier);

	},

	showElapsed: function () {
		endTime = new Date();
		var timeDiff = endTime - startTime; //in ms
		// strip the ms
		timeDiff /= 1000;

		// get seconds 
		var seconds = Math.round(timeDiff);
		return(" " + seconds + " seconds");
	},

	getScripts: function () {
		return [
			'moment.js',	// this file is available in the vendor folder, so it doesn't need to be available in the module folder.
		]
	},

	getStyles: function () {
		return [
			'MMM-FeedDisplay.css', // will try to load it from the vendor folder, otherwise it will load is from the module folder.
		]
	},

	getTranslations: function () {
		return {
			en: "translations/en.json",
			de: "translations/de.json"
		}
	},

	notificationReceived: function (notification, payload, sender) {

		var self = this;

		if (sender) {
			Log.log(this.name + " received a module notification: " + notification + " from sender: " + sender.name);
		} else {
			Log.log(this.name + " received a system notification: " + notification);
		}

		//this.sendNotification(notification, payload)
		//notification String - The notification identifier.
		//payload AnyType - Optional.A notification payload.
		//If you want to send a notification to all other modules, use the sendNotification(notification, payload).All other modules will receive the message via the notificationReceived method.In that case, the sender is automatically set to the instance calling the sendNotification method.


		if (notification == 'ALL_MODULES_STARTED') {
			//build my initial payload for any providers listening to me

			feedDisplayPayload.consumerid = this.config.id;
			feedDisplayPayload.payload = "";
			this.sendNotification('MMM-FeedDisplay_READY_FOR_ACTION', feedDisplayPayload);
			Log.log("ALL MODULES STARTED");
		}

		if (notification == 'FEED_PROVIDER_DATA') {
			//some one said they have data, it might be for me !
			
			if (payload.consumerid == this.config.id) {

				Log.log("Got some new data @ " + this.showElapsed());

				//send the data to the aggregator

				//console.log(payload);

				this.sendNotificationToNodeHelper("AGGREGATE_THIS", { moduleinstance: self.identifier, payload :payload});

			}
		}

	},

	getStringTimeDifference: function (ageinmilliseconds) {
		
		var diffSecs = Math.round(ageinmilliseconds / 1000);

		if (diffSecs < 60) { //seconds
			return diffSecs + "s";
		}
		if (diffSecs < (60 * 60)) {//seconds * minutes
			var diffMins = Math.ceil(diffSecs / 60);
			return diffMins + "m";
		}
		if (diffSecs < (60 * 60 * 24)) {//seconds * minutes * hours
			var diffHours = Math.ceil(diffSecs / (60 * 60));
			return diffHours + "h";
		}
		if (diffSecs < (60 * 60 * 24 * 7)) {//seconds * minutes * hours * days
			var diffDays = Math.ceil(diffSecs / (60 * 60 * 24));
			return diffDays + "d";
		}
		if (diffSecs < (60 * 60 * 24 * 30 )) {//seconds * minutes * hours * days in week
			var diffWeeks = Math.ceil(diffSecs / (60 * 60 * 24 * 30));
			return diffWeeks + "w";
		}
		if (diffSecs < (60 * 60 * 24 * 365)) {//seconds * minutes * hours * days in year
			var diffMonths = Math.ceil(diffSecs / (60 * 60 * 24 * 365));
			return diffMonths + "m";
		}
		if (diffSecs >= (60 * 60 * 24 * 366)) {//seconds * minutes * hours * days in year
			var diffYears = Math.ceil(diffSecs / (60 * 60 * 24 * 365));
			return diffYears + "y";
		}
	},

	//ALL_MODULES_STARTED - All modules are started.You can now send notifications to other modules.
	//DOM_OBJECTS_CREATED - All dom objects are created.The system is now ready to perform visual changes.
	//MODULE_DOM_CREATED - This module 's dom has been fully loaded. You can now access your module's dom objects.

	//When using a node_helper, the node helper can send your module notifications.When this module is called, it has 2 arguments:
	//notification - String - The notification identifier.
	//payload - AnyType - The payload of a notification.

	socketNotificationReceived: function(notification, payload) {
		Log.log(this.identifier + "hello, received a socket notification @ " +  this.showElapsed() + " " + notification + " - Payload: " + payload);

		var self = this;

		//{payload: { titles: titles, payload: articles } }

		if (notification == "NEW_FEEDS_" + this.identifier) {

			//firstly clean up

			this.resetdisplaycycle();

			//here our aggregator tells us we have something to show, he is sending everything every time

			this.displayarticles = payload.payload.articles;

			this.totalarticlecount = this.displayarticles.length;

			this.initiatedisplaycycle();

		}

	},

	resetdisplaycycle: function () { //shuts down the current display cycle and clears any stored data/ pointers / counters used for display purposes only etc

		this.displayarticleidx = 0;
		this.hilightarticletimer = new Date();

		//clear the timer if it exists

		//console.log("clearing the timer");

		if (this.timer != '') {
			clearInterval(this.timer);
		}

	},

	initiatedisplaycycle: function () {//start the display cycle, assumes all variables are reset to default

		var self = this;

		self.buildwrapper();

		self.updateDom(); // speed in milliseconds

		this.timer = setInterval(function () {

			//main display loop
			//each cycle adjust the display according to the settings

			self.buildwrapper();

			self.updateDom(); // speed in milliseconds

			if (self.config.display.rotationstyle.toLowerCase() == 'default') {
				self.displayarticleidx += self.config.display.articlecount;
			}
			else if (self.config.display.rotationstyle.toLowerCase() == 'scroll'){
				self.displayarticleidx++;
			}

			if (self.displayarticleidx > self.totalarticlecount - 1) {
				self.displayarticleidx = 0;
			}

			self.buildwrapper();

			self.updateDom(150); // speed in milliseconds
			
		}, this.config.display.refreshtime); //perform every ? milliseconds.

	},

	// Override dom generator.
	getDom: function () {
		Log.log(this.identifier + " Hello from getdom @" + this.showElapsed());
		var wrapper = document.createElement("div");
		wrapper.innerHTML = this.config.text;
		return wrapper;
	},

	trunctext: function (text, trunclength) {

		if (text == null) { return ""; }

		var textlength = text.length;
		var textsuffix = "";

		if (trunclength > 0) {
			if (trunclength < textlength) {
				textsuffix = "...";
			};
			textlength = trunclength - textsuffix.length;
		}

		return text.substring(0, textlength) + textsuffix;

	},

	colour: function (item, colour) {

		return `<span style='color:${colour}'> ${item} </span>`;

    },

	buildwrapper: function () {

		var self = this;

		var trext = '';

		//pull the articles starting at the current idx for the display count, wrapping if required
		//wrapping is required when the aidx > totalarticlcount 
		//so we need a calculation that will return a pseudo index such that for all values of aidx we point to a valid array item

		var aidx;

		var endidx = this.config.display.articlecount;

		//if wrapping, increase endidx so we always show a set of wrapped articles
		if (self.config.display.wraparticles) {
			endidx = endidx + this.displayarticleidx;
		}
		else { //make sure we dont try and show non existing articles
			endidx = Math.min(endidx, this.totalarticlecount);
		}

		var altrowclassname = "altrow1";

		for (aidx = this.displayarticleidx; aidx < endidx; aidx++) {

			tidx = aidx;

			//if wrapping 		//displaywraparticles: true,

			if (self.config.display.wraparticles) {
				tidx = aidx % this.totalarticlecount;
			}
			//we apply common processes here before hitting the image or text formatting

			if (self.config.display.firstfulltext && aidx == this.displayarticleidx) {
				var temptitle = this.displayarticles[tidx].title;
				var tempdescription = this.displayarticles[tidx].description;
			}
			else {
				var temptitle = this.trunctext(this.displayarticles[tidx].title, self.config.display.textlength)
				var tempdescription = this.trunctext(this.displayarticles[tidx].description, self.config.display.textlength)
			}

			if (self.config.display.articlimage && this.displayarticles[tidx].imageURL != null) { //just works for image only feeds initially

				var imageMain = document.createElement('div');
				imageMain.className = 'div_feather';
				imageMain.style = "position:relative";

				var actualImage = document.createElement('div');
				actualImage.className = 'crop';
				actualImage.innerHTML = `<img class='img_feather imgstyle' src='${self.displayarticles[tidx].imageURL}' alt=''  />`;

				imageMain.appendChild(actualImage);

				var newarticleClass = "";

				if (self.config.display.hilightnewarticles && (new Date() - new Date(this.displayarticles[tidx]['sentdate'])) < self.config.display.clearhilighttime) {
					newarticleClass = " newarticle"; //hilight the title when it is a new feed
				};

				var allTextDiv = document.createElement('div');
				allTextDiv.className = (self.config.display.textbelowimage ? 'divtextbelowimg':'divtextoverimg') + " txtstyle";
				
				var titleDiv = document.createElement('div');
				titleDiv.className = 'xsmall bright' + newarticleClass;
				titleDiv.innerHTML = `${temptitle}`;

				if (self.config.display.articledescription) {
					titleDiv.innerHTML += `<br>${tempdescription}`
				};

				allTextDiv.appendChild(titleDiv);

				var metaDiv = document.createElement('div');
				metaDiv.className = 'xsmall bright subtext'

				metaDiv.innerHTML = `${(self.config.display.sourcenamelength > 0) ? this.displayarticles[tidx].source + ' - ' : ''}${(self.config.display.articleage) ? self.getStringTimeDifference(this.displayarticles[tidx].age + (new Date() - new Date(this.displayarticles[tidx].sentdate))) : ''}`;

				if (metaDiv.innerHTML != '') { allTextDiv.appendChild(metaDiv); } //dont add if empty

				if (self.config.display.textbelowimage) {
						trext += imageMain.outerHTML;
						trext += allTextDiv.outerHTML;
				}
				else {

					imageMain.appendChild(allTextDiv);

					trext += imageMain.outerHTML;
                }

			}
			else  //format for text only feeds

			{
				var textcontainer = document.createElement("div");
				textcontainer.style = "width:" + this.config.display.modulewidth;

				if (self.config.display.hilightnewarticles && (new Date() - new Date(this.displayarticles[tidx]['sentdate'])) < self.config.display.clearhilighttime) {
					altrowclassname = (altrowclassname == "altrow1" ? "newaltrow1" : "newaltrow2"); //hilight the title when it is a new feed
				};
				
				var titleDiv = document.createElement("div");
				titleDiv.className = "small maintext " + altrowclassname;
				titleDiv.innerHTML = temptitle;
				if (self.config.display.articledescription) {
					titleDiv.innerHTML += `<br>${tempdescription}`
				};

				textcontainer.appendChild(titleDiv);
				var metadiv = document.createElement("div");
				metadiv.className = 'xsmall subtext ' + altrowclassname;
				metadiv.innerHTML = `${(self.config.display.sourcenamelength > 0) ? this.displayarticles[tidx].source + ' - ' : ''}${(self.config.display.articleage) ? self.getStringTimeDifference(this.displayarticles[tidx].age + (new Date() - new Date(this.displayarticles[tidx].sentdate))) : ''}`;
				if (metadiv.innerHTML != '') {
					textcontainer.appendChild(metadiv);
				} //dont add if empty

				if (altrowclassname == "newaltrow1") { //reverse the setting needs tidying up
					altrowclassname = "altrow1"
				}
				else if (altrowclassname == "newaltrow2")
				{
					altrowclassname = "altrow2"
				}

				if (altrowclassname == "altrow1") { altrowclassname = "altrow2" } else { altrowclassname = "altrow1" }

				trext += textcontainer.outerHTML;

			}

		}

		this.config.text = trext;

	},

	//this.sendSocketNotification(notification, payload)
	//notification String - The notification identifier.
	//payload AnyType - Optional.A notification payload.
	//If you want to send a notification to the node_helper, use the sendSocketNotification(notification, payload).
	//Only the node_helper of this module will receive the socket notification.

	sendNotificationToNodeHelper: function (notification, payload) {
		this.sendSocketNotification(notification, payload);
	},

	doSomeTranslation: function () {
		var timeUntilEnd = moment(event.endDate, "x").fromNow(true);
		this.translate("RUNNING", { "timeUntilEnd": timeUntilEnd });

		// Will return a translated string for the identifier RUNNING, replacing `{timeUntilEnd}` with the contents of the variable `timeUntilEnd` in the order that translator intended.
	},


});

