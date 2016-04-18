/** node.js json shared-object database socket service - mcmlxxix - 2016
	
	all packets are to be in JSON format, terminated by a CRLF
		
	REQUEST:{
		id		: <request id>,
		db 		: <database name>,
		oper	: <operation>,
		data	: <see below>,
		user	: <username (auth only)>,
		pass	: <password (auth only)>
	}
	
	oper = READ
		data = [
			{ path:"path/to/data" },
			...
		];
	
	oper = WRITE
		data = [
			{ path:"path/to/data", key:"child_property", value:"value_to_be_written" },
			...
		];
	
	oper = UN/LOCK
		data = [
			{ path:	"path/to/data", lock: <see lock types> },
			...
		];
		
	oper = UN/SUBSCRIBE
		data = [
			{ path:	"path/to/data" },
			...
		];
		
	LOCK TYPES
		read = "r"
		write = "w"
		append = "a"	
	
**/

/* global variables */
var fs, db, net, srv, rl, tx, err, oper, crypto, pako, log, settings, dblist, databases, identities, users;

/* constants */
const LOG_INFO = 1;
const LOG_WARNING = 2;
const LOG_ERROR = 3;
const LOG_DEBUG = 4;

/* server events */
function onError(e) {
	switch(e.code) {
	case 'EADDRINUSE':
		log('server address in use',LOG_ERROR);
		exit(0);
	case 'ECONNRESET':
		break;
	default:
		log(e);
		break;
	}
}
function onListen() {
	log("server listening for connections",LOG_INFO);
}
function onCreate() {
	srv.on('error',onError);
	srv.on('connection',onConnection);
}
function onConnection(socket) {
	log('connected: ' + socket.remoteAddress,LOG_INFO);
	socket.setEncoding('utf8');
	socket.id = identities.shift();
	socket.ip = socket.remoteAddress;
	socket.rl = rl.createInterface({
		input:socket,
		output:socket
	});
	socket.rl.on('line',(data) => {
		parseRequest(socket,data);
	});
	socket.on('close',() => {
		log('disconnected: ' + socket.ip,LOG_INFO);
		identities.push(socket.id);
		socket.rl.close();
	});
	socket.on('error', onError);
}
 
/* server functions */
function parseRequest(socket,data) {
	var request = undefined;
	var result = undefined;
	try {
		//data = pako.inflate(data,{to:'string'});
		log('<< ' + data,LOG_DEBUG);
		request = tx.decode(JSON.parse(data));
	} 
	catch(e) {
		return sendError(socket,{data:data},err.INVALID_REQUEST);
	}
	if(request == undefined) {
		return sendError(socket,{data:data},err.INVALID_REQUEST);
	}
	try {
		result = handleRequest(socket,request);
	}
	catch(e) {
		log(e.stack,LOG_ERROR);
		return false;
	}
	return result;
}
function handleRequest(socket,request) {
	if(request.id == null) {
		request.id = socket.id;
	}
	if(request.db == undefined) {
		return sendError(socket,request,err.INVALID_DB);
	}
	var d = databases[request.db.toUpperCase()];
	if(d == undefined) {
		return sendError(socket,request,err.INVALID_DB);
	}
	if(request.oper == undefined) {
		return sendError(socket,request,err.INVALID_OPER);
	}
	if(request.oper == oper.AUTH) {
		return authenticate(socket,request,callback,d);
	}
	if(socket.user == null) {
		return sendError(socket,request,err.AUTH_REQD);
	}
	//var startTime = Date.now();
	switch(request.oper) {
	case oper.READ:
		d.read(request,callback);
		break;
	case oper.WRITE:
		d.write(request,callback);
		break;
	case oper.LOCK:
		d.lock(request,callback);
		break;
	case oper.UNLOCK:
		d.unlock(request,callback);
		break;
	case oper.SUBSCRIBE:
		d.subscribe(request,callback);
		break;
	case oper.UNSUBSCRIBE:
		d.unsubscribe(request,callback);
		break;
	default:
		sendError(socket,request,err.INVALID_OPER);
		break;
	}
	
	function callback(response) {
		//var endTime = process.hrtime();
		// if(request.id == null)
			// request.id = socket.id;
		//request.data = response;
		//request.elapsed = endTime - startTime;
		return respond(socket,request);
	}
	return true;
}
function sendError(socket,request,e) {
	request.status = e;
	respond(socket,request);
}
function respond(socket,response) {
	response = JSON.stringify(tx.encode(response));
	log('>> ' + response,LOG_DEBUG);
	//response = pako.deflate(response,{to:'string'});
	return socket.write(response + "\r\n");
}
function authenticate(socket,request,callback,database) {
	var usr = request.data;
	if(users[usr.name] && database.users && database.users[usr.name]) {
		var pw = users[usr.name];
		var hash = crypto.createHash('md5').update(pw).digest('hex');
		if(hash == usr.pass) {
			socket.user = usr;
			request.status = err.NONE;
		}
		else {
			request.status = err.INVALID_PASS;
			delete socket.user;
		}
	}
	else {
		request.status = err.INVALID_USER;
		delete socket.user;
	}
	callback(usr);
	return true;
}
function getpool(num) {
	var pool = [];
	for(var i=0;i<num;i++)
		pool.push(i);
	return pool;
}
function load(dblist) {
	var dbs = {};
	for(var d in dblist) {
		var jsondb = db.create(d);
		jsondb.users = dblist[d].users;
		jsondb.settings.locking = dblist[d].locking;
		jsondb.settings.maxconnections = settings.maxconnections;
		fs.exists(dblist[d].file, function (exists) {
			if(exists)
				jsondb.load(dblist[d].file);
			else
				log('database file not found: ' + dblist[d].file,LOG_ERROR);
		});		
		dbs[d.toUpperCase()] = jsondb;
	}
	return dbs;
}
function init() {

	log = require('./lib/log');
	err = require('./lib/constant').error;
	oper = require('./lib/constant').oper;
	tx = require('./lib/transform');
	
	net = require('net');
	fs = require('fs');
	rl = require('readline');
	db = require('node-jsondb');
	crypto = require('crypto');
	//pako = require('pako');
	
	settings = require('./settings/settings');
	dblist = require('./settings/databases');
	users = require('./settings/users');
	
	identities = getpool(settings.maxconnections);
	databases = load(dblist);
	srv = net.createServer();
	srv.on('listening',onListen);
	srv.listen(settings.port,settings.host,onCreate);
	log('database server initialized',LOG_INFO);
}

/* and...go */
init();
