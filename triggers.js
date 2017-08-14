const Homey     = require('homey');

const broker    = require("./broker.js");
var globalVar = require("./global.js");
var logmodule = require("./logmodule.js");

var eventMQTT = null;

module.exports = {
   getTriggerArgs: function() {
      return getTriggerArgs();
   },
   listenForMessage: function() {
      listenForMessage();
   },
   setArgumentChangeEvent: function() {
      setArgumentChangeEvent();
   },
   getEvenMQTT: function() {
      return eventMQTT;
   }
}


function listenForMessage () {
   // Start listening for the events.
   eventMQTT = new Homey.FlowCardTrigger('eventMQTT');
   eventMQTT.register();

   eventMQTT.registerRunListener((args, state ) => {
      logmodule.writelog('info', "Listener eventMQTT called");
      try {
         if ( processMessage(args, state)) {
            return Promise.resolve( true );
         } else {
            return Promise.resolve( false );
         }
       } catch(err) {	
         logmodule.writelog('error', "Error in Listener eventMQTT: " +err);
         return Promise.reject(err);
       }
   })

}


getTriggerArgs = async() => {
   try {
      if (globalVar.getTopicArray().length > 0) {
         globalVar.clearTopicArray();
      };
      logmodule.writelog('info', "Registered topics:" + globalVar.getTopicArray());
      await getEventMQTTArgs().then((result) => {
         logmodule.writelog('info', "Registered topics:" + globalVar.getTopicArray());
         return true;
      });
   } catch(err) {
      logmodule.writelog('error', "getTriggerArgs: "+err);
      return err;
   }
}

getEventMQTTArgs = async() => {
//   return new Promise(function (fulfill, reject) {
   try {
      await eventMQTT.getArgumentValues(function( err, values ) {
         values.forEach(function(element) {
            logmodule.writelog('info', "Trigger Arguments for eventMQTT: " + element.mqttTopic);
//            broker.subscribeToTopic(element.mqttTopic);
              require("./broker.js").subscribeToTopic(element.mqttTopic);
         });
         logmodule.writelog('info', "boe");
         return true;
      });
   } catch(err) {
      logmodule.writelog('error', "getEventMQTTArgs: " +err);
      return err;
   }
//   });
}


function processMessage (args, state) {
   var reconnectClient = false;

   // Make a connection to the broker. But only do this once. When the app is started, the connectedClient
   // variable is set to null, so there is no client connection yet to the broker. If so, then connect to the broker.
   // Otherwise, skip the connection.
   require("./broker.js").connectToBroker(args, state);

   logmodule.writelog ('info', "state.topic = " + state.triggerTopic + " topic = " + args.mqttTopic)

   // MQTT subscription topics can contain "wildcards", i.e a + sign. However the topic returned
   // by MQTT brokers contain the topic where the message is posted on. In that topic, the wildcard
   // is replaced by the actual value. So we will have to take into account any wildcards when matching the topics.

   var arrTriggerTopic = state.triggerTopic.split('/');
   var arrMQTTTopic = args.mqttTopic.split('/');
   var matchTopic = true;

   for (var value in arrTriggerTopic) {
      if ((arrTriggerTopic[value] !== arrMQTTTopic[value]) && (arrMQTTTopic[value] !== '+')) {
         // This is a bit dirty because it would allow events to be delivered also to topics that do not have
         // the trailing event. In de future, when allowing the other message types, this would cause problems
         if (arrMQTTTopic[value] !== undefined) {
            matchTopic = false;
         }
      }
   };

   // If the topic that triggered me the topic I was waiting for?
   if (matchTopic == true) {
      console.log ("triggerTopic = equal" )
      return true;
   }
   // This is not the topic I was waiting for and it is a known topic
   else if (state.triggerTopic !== args.mqttTopic & globalVar.getTopicArray().indexOf(args.mqttTopic) !== -1) {
      logmodule.writelog('info', "We are not waiting for this topic");
      return false;
   };
   return false;
}


function setArgumentChangeEvent() {
   // We need to know when an argument in a trigger has changed, has been added or removed.
   // If so, we need to change, remove or add topic subscriptions. So register to the 
   // trigger update event.
   eventMQTT.on('update', () => {
//   Homey.ManagerFlow.update('eventMQTT', function( callback ) {
      logmodule.writelog('info', "Trigger changed" );

      // get the new arguments
      eventMQTT.getArgumentValues(function( err, values ) {
         logmodule.writelog('info', "topics:" + globalVar.getTopicArray());

         // Check if there are already subscribed topics. If so, then unsubsribe because we 
         // need to loop through all triggers and just unsubscribe and re-subscribe again is faster.
         if (globalVar.getTopicArray().length > 0) {
            require("./broker.js").getConnectedClient().unsubscribe(globalVar.getTopicArray());
            globalVar.clearTopicArray();
         };
         // `args` is an array of trigger objects, one entry per flow
         values.forEach(function(element) {
            logmodule.writelog('info', "Trigger Arguments: " + element.mqttTopic);
            require("./broker.js").subscribeToTopic(element.mqttTopic);
         });
         logmodule.writelog('info', "topics:" + globalVar.getTopicArray());
      });

      // always fire the callback, it's reserved for future argument validation
    //  callback( null, true );
   });
}



