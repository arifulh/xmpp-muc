$(function () {

	// Connection object, outside of the Backbone structure.
	// Sends and recieves stanzas, and passes them to the app.
	var Connection = {
		
		// When someone clicks 'join', the main app will pass server info
		initialize : function (options) {
			_.bindAll(this, 'onPresence', 'onMessage');
			this.host = options.host;
			this.bosh = options.bosh;
			this.nick = options.nick;
			this.room = options.room + "@" + options.mucHost;
			this.app.nick = this.nick;
			this.conn = new Strophe.Connection(this.bosh);
			this.connect();
		},
	
		// Anonymous login
		connect : function () {
			this.conn.connect(this.host, "", function (status) {
				if (status === Strophe.Status.CONNECTED) {
					Connection.connected();
				} else if (status === Strophe.Status.DISCONNECTED) {
					Connection.disconnected();
				}
			});
		},

		connected : function () {
			// Incoming presence handler
			this.conn.addHandler(this.onPresence, null, "presence");
			// Incoming group message handler
			this.conn.addHandler(this.onMessage, null, "message", "groupchat");
			// Send initial presence to desired room
			this.conn.send(
				$pres({
					to: this.room + "/" + this.nick
				}).c('x', {
					xmlns: Strophe.NS.MUC
				}));
		},

		disconnect : function () {
			this.conn.send($pres({
				to: this.room + "/" + this.nick,
				type: "unavailable"
			}));
			this.conn.flush();
			this.conn.disconnect();
		},

		disconnected : function () {
			alert('disconnected');
		},

		onPresence : function (presence) {
			var from = $(presence).attr('from');
			var room = Strophe.getBareJidFromJid(from);
			// Make sure message is from room
			if (room === (this.room)) {
				var nick = Strophe.getResourceFromJid(from);
				var type = $(presence).attr('type');
				// Passes nickname of the presence sender to the
				// main app to be either removed or added to the
				// Roster Collection.
				switch (type) {
					case 'unavailable':
						this.app.removeMember(nick);
						break;
					case 'error':
						this.disconnect();
						break;
					default:
						this.app.addMember(nick);
						break;
				}
			}
			return true;
		},

		onMessage : function (message) {
			var from = $(message).attr('from');
			var room = Strophe.getBareJidFromJid(from);
			// Make sure message is from room, then pass
			// message to the main app to be rendered.
			if (room === (this.room)) {
				var nick = Strophe.getResourceFromJid(from);
				if (nick === this.nick) return true;
				var message = $(message).children('body').text();
				this.app.renderMessage(nick, message);
			}
			return true;
		},

		sendMessage : function (message) {
			this.conn.send(
			$msg({
				to: this.room,
				type: "groupchat"
			}).c('body').t(message));
		}
	};

	// Models
	
	var Member = Backbone.Model.extend({
		// "Status" is not really used for anything 
		// right now since the RosterView updates based on whether
		// the model is still in the collection or not
		initialize : function () {
			this.set({ "status": "available" });
		}
	});

	// Collections
	
	Roster = Backbone.Collection.extend({
		model : Member,
	
		// Link this Collection to RosterView
		initialize : function () {
			this.view = new RosterView({ "roster": this });
		}
	});

	// Views

	RosterView = Backbone.View.extend({
		el : $("#members"),

		template : _.template($("#memberul-template").html()),

		// RosterView listens for changes in the Roster Collection,
		// whenever members are added or removed	
		initialize : function (options) {
			_.bindAll(this, 'render');
			this.roster = options.roster;
			this.roster.bind('add', this.render);
			this.roster.bind('remove', this.render);
		},

		render : function () {
			$(this.el).html(this.template({
				items: this.roster.models
			}));
		}

	});

	// This is the main App View
	var AppView = Backbone.View.extend({
		el : $("#chat"),

		events : {
			"click #join" 			: "join",
			"click #disconnect"		: "leave",
			"keypress #messageInput" 	: "createMessage"
		},

		// The Connection object is linked to this main view.
		// Whenver stanzas are recieved by the Connection object, it will
		// call functions in this view.		
		initialize : function () {
			Connection.app = this;
			this.roster = new Roster;
			this.display = $("#display");
			this.input = $("#messageInput");
			this.messageTemplate = _.template($("#message-template").html());
		},
		
		addMember : function (nick) {
			this.roster.add({ "nick": nick });
		},
		
		removeMember : function (nick) {
			var member = this.roster.find(function (m) { return m.get("nick") === nick });
			this.roster.remove(member);
		},
		
		// Pass connection object server information
		join: function () {
			var nickname = $("#nick").val();
			var chatroom = $("#room").val();
			this.$("#login").fadeOut();
			this.$("#disconnect").fadeIn();
			Connection.initialize({
				host: "localhost",
				mucHost: "conference.localhost",
				bosh: "http://localhost:5280/http-bind",
				nick: nickname,
				room: chatroom
			});
		},

		leave : function () {
			Connection.disconnect();
		},

		// Pass message text to Connection object to send it to the server
		createMessage : function (e) {
			if (e.which !== 13) return;
			var message = this.input.val();
			Connection.sendMessage(message);
			this.renderMessage(this.nick, message);
			this.input.val('');
		},
	
		renderMessage : function (nick, message) {
			this.display.append(this.messageTemplate({
				"nick": nick,
				"message": message
			}));
			this.display.attr({
				scrollTop: this.display.attr("scrollHeight")
			});
		}

	});

	// Create app
	window.App = new AppView;
});
