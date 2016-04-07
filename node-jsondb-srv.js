/* 	node.js json shared-object database 
	
	all packets are to be in JSON format, terminated by a CRLF
		
	<database_query>:{
		id		: <request id>,
		db 		: <database name>,
		oper	: <operation>,
		data	: <record query>
	}
	
*/

/* global variables */
var fs, db, net, srv, rl, settings, dblist, databases;
log = require('./lib/log');

/* constants */
const LOG_INFO = 1;
const LOG_WARNING = 2;
const LOG_ERROR = 3;
const LOG_DEBUG = 4;

/* errors */
const ERROR_INVALID_REQUEST = 1;
const ERROR_INVALID_LOCK = 2;
const ERROR_INVALID_PATH = 3;
const ERROR_INVALID_DB = 4;
const ERROR_INVALID_OPER = 5;

/* server events */
function onError(e) {
	switch(e.code) {
	case 'EADDRINUSE':
		log('server address in use',LOG_ERROR);
		exit(0);
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
	socket.ip = socket.remoteAddress;
	socket.rl = rl.createInterface({
		input:socket,
		output:socket
	});
	socket.rl.on('line',function(data) {
		log('<< ' + data,LOG_DEBUG);
		parseRequest(socket,data);
	});
	socket.on('close',function() {
		log('disconnected: ' + socket.ip,LOG_INFO);
		socket.rl.close();
	});
	socket.on('db_error',function(e,txt) {
		switch(e) {
		case ERROR_INVALID_REQUEST:
			response(socket,'ERROR: invalid request: ' + txt);
			break;
		case ERROR_INVALID_LOCK:
			response(socket,'ERROR: invalid lock: ' + txt);
			break;
		case ERROR_INVALID_PATH:
			response(socket,'ERROR: invalid path: ' + txt);
			break;
		case ERROR_INVALID_OPER:
			response(socket,'ERROR: invalid operation: ' + txt);
			break;
		case ERROR_INVALID_DB:
			response(socket,'ERROR: invalid database: ' + txt);
			break;
		default:
			response(socket,'ERROR: unknown: ' + txt);
			break;
		}
	});
}
 
/* server functions */
function parseRequest(socket,data) {
	var request = undefined;
	var result = undefined;
	try {
		request = JSON.parse(data);
	} 
	catch(e) {
		socket.emit('json_error',ERROR_INVALID_REQUEST);
		log("JSON parse error: " + e,LOG_ERROR);
		return false;
	}
	if(request == undefined) {
		socket.emit('db_error',ERROR_INVALID_REQUEST);
		return false;
	}
	try {
		result = handleRequest(socket,request);
	}
	catch(e) {
		log(e,LOG_ERROR);
		return false;
	}
	return result;
}
function handleRequest(socket,request) {
	if(request.db == undefined) {
		socket.emit('db_error',ERROR_INVALID_DB,request.db);
		return false;
	}
	var d = databases[request.db.toUpperCase()];
	if(d == undefined) {
		socket.emit('db_error',ERROR_INVALID_DB,request.db);
		return false;
	}
	if(request.oper == undefined) {
		socket.emit('db_error',ERROR_INVALID_OPER,request.oper);
		return false;
	}
	switch(request.oper.toUpperCase()) {
	case "READ":
		response(socket,request,d.read(request.data));
		break;
	case "WRITE":
		response(socket,request,d.write(request.data));
		break;
	case "LOCK":
		response(socket,request,d.lock(request.data));
		break;
	case "UNLOCK":
		response(socket,request,d.unlock(request.data));
		break;
	case "SUBSCRIBE":
		response(socket,request,d.subscribe(request.data));
		break;
	case "UNSUBSCRIBE":
		response(socket,request,d.unsubscribe(request.data));
		break;
	case "ISLOCKED":
		response(socket,request,d.isLocked(request.data));
		break;
	case "ISSUBSCRIBED":
		response(socket,request,d.isSubscribed(request.data));
		break;
	default:
		socket.emit('db_error',ERROR_INVALID_OPER,request.oper);
		break;
	}
	return true;
}
function response(socket,request,response) {
	request.data = response;
	return socket.write(JSON.stringify(request) + "\r\n");
}
function load(dblist) {
	var dbs = {};
	for(var d in dblist) {
		dbs[d.toUpperCase()] = db.create(d);
		fs.exists(dblist[d].file, function (exists) {
			if(exists)
				dbs[d.toUpperCase()].load(dblist[d].file);
			else
				log('database file not found: ' + dblist[d].file,LOG_ERROR);
		});		
		dbs[d.toUpperCase()].users = dblist[d].users;
	}
	return dbs;
}
function init() {

	net = require('net');
	fs = require('fs');
	rl = require('readline');
	db = require('node-jsondb');
	
	settings = require('./settings/settings');
	dblist = require('./settings/databases');
	//users = require('./settings/users');
	
	databases = load(dblist);
	srv = net.createServer();
	srv.on('listening',onListen);
	srv.listen(settings.port,settings.host,onCreate);
	log('database server initialized',LOG_INFO);
}

/* and...go */
init();
