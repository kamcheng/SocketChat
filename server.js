var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);

server.listen(3000);

// routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

var CHATAPP = {
	rooms : ['room1','room2','room3'], //current available chatrooms
	users : {}
};


io.sockets.on('connection', function (socket) {
	
	// when the client emits 'send room', this listens and executes, and send back how many available rooms
	socket.on('sendrooms', function () {
	    console.log(CHATAPP.rooms);
		socket.emit('availableRooms', CHATAPP.rooms);
	});
	
	// when the client emits 'add room', this listens and executes
	socket.on('addroom', function (room) {
		socket.room = room;
		CHATAPP.rooms.push(room);
		CHATAPP.users[socket.room] = [];
	});
	
	// when the client emits 'adduser', this listens and executes
	socket.on('adduser', function(username, room){
		// store the username in the socket session for this client
		socket.username = username;
		// store the room name in the socket session for this client
		socket.room = room;
		// send client to this room
		socket.join(socket.room);
		// echo to client they've connected
		socket.emit('updatechat', 'SERVER', 'you have connected to ' + socket.room);
		// echo to this room that a person has connected to their room
		socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', username + ' has connected to ' + socket.room);
		
		//keep track of all users in their rooms	
		//CHATAPP.users[socket.room].push(username);
		//user and the room will see this message 
		io.sockets.in(socket.room).emit('updateusers', CHATAPP.users[socket.room]);
		//highlight room where current user in, and unhighlight other rooms
		socket.emit('updaterooms', CHATAPP.rooms, socket.room);
	});
	
	

	// when the client emits 'sendchat', this listens and executes
	socket.on('sendchat', function (data) {
		// we tell the client to execute 'updatechat' with 2 parameters
		// and everyone in the room can see
		io.sockets.in(socket.room).emit('updatechat', socket.username, data);
	});

	socket.on('switchRoom', function(newroom){
		// leave the current room (stored in session)
		socket.leave(socket.room);
		// join new room, received as function parameter
		socket.join(newroom);
		// user see this message
		socket.emit('updatechat', 'SERVER', 'you have connected to '+ newroom);
		// sent message to OLD room
		socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username+' has left ' + socket.room);
		// update socket session room title		
		socket.broadcast.to(newroom).emit('updatechat', 'SERVER', socket.username+' has joined ' + newroom);
		
		//keep track and update users in old room
		var currentRoomUsers = CHATAPP.currentRoomUsers(CHATAPP.users[socket.room], socket.username);
		CHATAPP.users[socket.room] = currentRoomUsers; 
		//keep track and update users in new room
		CHATAPP.users[newroom].push(socket.username);
		
		io.sockets.in(socket.room).emit('updateusers', CHATAPP.users[socket.room]); //update current room users list
		io.sockets.in(newroom).emit('updateusers', CHATAPP.users[newroom]); //update new room users list
		
		socket.emit('updaterooms', CHATAPP.rooms, newroom);
		// current session should update to the new room
		socket.room = newroom;
	});

	// when the user disconnects.. perform this
	socket.on('disconnect', function(){
		// remove the username from global CHATAPP list
		var currentRoomUsers = CHATAPP.currentRoomUsers(CHATAPP.users[socket.room], socket.username);
		CHATAPP.users[socket.room] = currentRoomUsers; //update usernames
		// update list of users in chat, client-side
		socket.broadcast.to(socket.room).emit('updateusers', CHATAPP.users[socket.room]); //update current room users list
		// echo globally that this client has left
		socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username + ' has disconnected');
		
		socket.leave(socket.room);
	});
});