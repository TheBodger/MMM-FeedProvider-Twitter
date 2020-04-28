var startTime = new Date();

var feedDisplayPayload = { consumerid: '', providerid: '', payload: '' };

var providerstorage = {};
var providerconfigs = [];

var trackingStuffEntry = { stuffID: '', consumerids: [], actualstuff: '' }; //format of the items that we need to track to see if we need to send them back again
//var trackingStuff = {};

//var trackingconsumerids = [];

var consumerpayload = { consumerid: '', stuffitems: [] };
var consumerpayloads = {};

Module.register("MMM-FeedProvider-Twitter", {
    // setup the default config options
    defaults: {
        // required
        text: "MMM-FeedProvider-Twitter",
        consumerids: [], // the unique id of the consumer(s) to listen out for
        id: "", //the unique id of this provider
        consumer_key: null,
        consumer_secret: null,
        access_token_key: null,
        access_token_secret: null,
        // optional
        datarefreshinterval: 5000*60,
        totalTweetsPerUpdate: 25,
        excludeTweetsWithQuotes: false,
        excludeRetweets: true,
        excludeMediaTweets: false,
        excludeLinkTweets: false,
        excludeTweetLengthLessThan: 16,
        excludeTweetsWithoutText: [],
        language: '', //leave empty and only use if requested
        feeds: [
            { feedname: 'TKMaxx', feedtitle: 'TKMaxx', searchHashtag: 'YYYY', oldestage: '2020-04-01 00:00:01' },
            { feedname: 'BBC', feedtitle: 'BBC', searchHashtag: 'XXX', oldestage: 'today' },
            
        ],
        waitforqueuetime: 0010, //dont change this - it simply helps the queue processor to run with a controlled internal loop
    },

    start: function () {

        Log.log(this.name + ' is started!');

        providerstorage[this.config.id] = { 'trackingconsumerids': [], 'trackingStuff': {} }

        this.sendNotificationToNodeHelper("CONFIG", { moduleinstance: this.identifier, config: this.config });
        this.sendNotificationToNodeHelper("STATUS", { moduleinstance: this.identifier });

    },

    myconsumer: function (consumerid) {

        //check if this is one of  my consumers

        if (this.config.consumerids.indexOf(consumerid) >= 0) {
            return true;
        }

        return false;

    },

    notificationReceived: function (notification, payload, sender) {

        //console.log(this.name + " recevived notification: " + notification + " with payload:");
        //console.log(JSON.stringify(payload));
            ;
        if (sender) {
            Log.log(this.name + " received a module notification: " + notification + " from sender: " + sender.name);
        } else {
            Log.log(this.name + " received a system notification: " + notification);
        }

        //this.sendNotification(notification, payload)
        //notification String - The notification identifier.
        //payload AnyType - Optional.A notification payload.
        //If you want to send a notification to all other modules, use the sendNotification(notification, payload).All other modules will receive the message via the notificationReceived method.In that case, the sender is automatically set to the instance calling the sendNotification method.


        //if we get a notification that there is a consumer out there, if it one of our consumers, start processing
        //and mimic a response - we also want to start our cycles here - may have to handle some case of multipel restarts to a cycle
        //when we get multiple consumers to look after

        if ((notification == 'MMM-FeedDisplay_READY_FOR_ACTION' || notification == 'MMM-FeedDisplay_SEND_MORE_DATA') && this.myconsumer(payload.consumerid)) {

            var self = this

            //clear all the tracking data for this consumer
            //var trackingStuffEntry = { stuffID: '', consumerids: [], actualstuff: '' };

            for (var key in providerstorage[self.config.id]['trackingStuff']) {

                stuffitem = providerstorage[self.config.id]['trackingStuff'][key];

                if (stuffitem['consumerids'].indexOf(payload.consumerid) > -1) {
                    providerstorage[self.config.id]['trackingStuff'][key]['consumerids'].splice(stuffitem['consumerids'].indexOf(payload.consumerid), 1);
                }

            }

            //store the consumer id so we know who to send data to in future
            //if we havnt already stored it

            if (providerstorage[this.config.id]['trackingconsumerids'].indexOf(payload.consumerid) == -1) {
                providerstorage[this.config.id]['trackingconsumerids'].push(payload.consumerid);
            }

            //now we need to use our nice little nodehelper to get us the stuff - be aware this is async and we migh hit twisty nickers

            // tell the nodehlper to reset all data and give the node helper a config

            //so here we are and we want to use the timer to go do stuff, but this is tied to a common area: the config
            //which is only unique depending on who gets it
            //so do we need to have different timers ?
            //will this muck up the feeds list we are using for each "instance"

            //providerconfigs[this.config.id] = this.config;

            //initial request
            self.sendNotificationToNodeHelper("UPDATE", { moduleinstance: self.identifier, providerid: self.config.id });

            setInterval(function () {

                //within this loop, we request an update from the node helper

                self.sendNotificationToNodeHelper("UPDATE", { moduleinstance: self.identifier, providerid: self.config.id });

            }, this.config.datarefreshinterval); //perform every ? milliseconds.

        }

    },

	socketNotificationReceived: function (notification, nhpayload) {

		// as there is only one node helper for all instances of this module
		// we have to filter any responses that are not for us by checking this.identifier

		//console.log(this.name + " received a socket notification: " + notification + " - Payload: " + nhpayload);

		var self = this;

		//here we are getting an update from the node helper which has sent us 0 to many new data
		//we will have to store this data as a key so we can determine who got a copy and send everything as required

		if (notification == "UPDATED_STUFF_" + this.identifier) {

			//clear the consumer payloads that have been built previously

			consumerpayloads = {};

			// payload is an array of RSS 2.0 items, with the outer {} removed so we can process it using 
			// simple javascript not needing json at this stage
			// each item has a unique id created by the node helper
			// each payload returned is flagged with the provider id who requested it
			// the node helper uses a date on an item to determine which ones to send
			// so we have to assume that we wont get duplicates - maybe can add checking laters

			//console.log(">>>>>>>>>>>>>>>>>>>>>>>>>> " + nhpayload.payloadformodule.length);
			//console.log(nhpayload.payloadformodule);

			nhpayload.payloadformodule.forEach(function (stuffitem) {

				//create a new stuff entry and add to the tracking data

				var tse = { stuffID: stuffitem.id, consumerids: [], actualstuff: stuffitem };

				providerstorage[nhpayload.providerid]['trackingStuff'][stuffitem.id] = tse;

			});

			// now we send any new data to the consumer 
			// once a stuff item data has been sent to all consumers, we are asked to supply to, we remove 
			// it from the list, reducing the amount of processing required

			// but first lets send the data and track it with the consumerid we are sending it to

			//trackingStuff.forEach(function (stuffitem) {

			for (var key in providerstorage[nhpayload.providerid]['trackingStuff']) {

				stuffitem = providerstorage[nhpayload.providerid]['trackingStuff'][key];

				// assume we are processing stuff that might not have been sent to everyone yet
				// we will be creating a payload for each consumer as a single blob of mulitple stuff items
				// send this data to anyone who hasnt received it yet

				//look at each consumer we are tracking

				providerstorage[nhpayload.providerid]['trackingconsumerids'].forEach(function (trackingconsumerid) {

					//can we find this consumer in the list of consumers we have already sent this stuff to ?

					if (stuffitem['consumerids'].indexOf(trackingconsumerid) == -1) {

						self.addtopayload(trackingconsumerid, stuffitem.actualstuff) //we assume when we add it to the payload and send it it goes!!

						providerstorage[nhpayload.providerid]['trackingStuff'][stuffitem.stuffID]['consumerids'].push(trackingconsumerid); //and track we have sent this item to this consumer

					}

				});

			};

			//now send the payloads based on the payload contents

			//consumerpayloads.forEach(function (payload) {

			for (var key in consumerpayloads) {

				//for some reason we get a length key here, so we need to ignore it

				if (!(key == 'length')) {

					payload = consumerpayloads[key];

					//var feedDisplayPayload = { consumerid: '', providerid: '', payload: '' };

					var fdp = { consumerid: '', providerid: '', title: '', sourcetitle: '', payload: '' };

					fdp.consumerid = payload.consumerid;
					fdp.providerid = nhpayload.providerid;
					fdp.source = nhpayload.source;
					fdp.payload = payload.stuffitems;

					//console.log(this.identifier + "  >>>>>> Sending data: " + fdp.title + " " + fdp.consumerid + " " + fdp.providerid + " " + payload.stuffitems.length);

					this.sendNotification('FEED_PROVIDER_DATA', fdp);
				}

			};

			//and finally clear out anything that has already been sent to everyone
			//we base this on the count of consumerids making it a bit quicker

			//trackingStuff.forEach(function (stuffitem) {

			for (var key in providerstorage[nhpayload.providerid]['trackingStuff']) {

				stuffitem = providerstorage[nhpayload.providerid]['trackingStuff'][key];

				if (stuffitem.consumerids.length == this.config.consumerids.length) {

					delete providerstorage[nhpayload.providerid]['trackingStuff'][key];

				}

			};

		}

	},

	addtopayload: function (consumerid, stuff) {
		//build a new payload for each consumer that contains everything that needs to be sent
		//in the next update

		//check that the consumer has been added or not
		//if not add them and their data to their payload

		var cpl = { consumerid: '', stuffitems: [] };

		if (!consumerpayloads[consumerid]) {

			cpl['consumerid'] = consumerid;
			cpl['stuffitems'].push(stuff);

			consumerpayloads[consumerid] = cpl;

		}
		else {

			//we have a payload being built for this consumer so just add the stuff to send to the  existing list

			consumerpayloads[consumerid]['stuffitems'].push(stuff);

		}

	},

	//this.sendSocketNotification(notification, payload)
	//notification String - The notification identifier.
	//payload AnyType - Optional.A notification payload.
	//If you want to send a notification to the node_helper, use the sendSocketNotification(notification, payload).
	//Only the node_helper of this module will receive the socket notification.

	sendNotificationToNodeHelper: function (notification, payload) {
		this.sendSocketNotification(notification, payload);
    },


});