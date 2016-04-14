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
	
	READ QUERY
		data = [
			{ path:"path/to/data" },
			...
		];
	
	WRITE QUERY
		data = [
			{ path:"path/to/data", key:"child_property", value:"value_to_be_written" },
			...
		];
	
	LOCK QUERY
		data = [
			{ path:	"path/to/data", lock: <see lock types> },
			...
		];
		
	SUBSCRIPTION QUERY
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
var fs, db, net, srv, rl, tx, pako, log, settings, dblist, databases, identities, users;

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
const ERROR_INVALID_USER = 6;
const ERROR_INVALID_PASS = 7;

/* operations */
const READ = 		0;
const WRITE = 		1;
const LOCK = 		2;
const UNLOCK = 		3;
const SUBSCRIBE = 	4;
const UNSUBSCRIBE = 5;
const AUTH = 		6;

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
	socket.id = identities.shift();
	socket.ip = socket.remoteAddress;
	socket.rl = rl.createInterface({
		input:socket,
		output:socket
	});
	socket.rl.on('line',function(data) {
		parseRequest(socket,data);
	});
	socket.on('close',function() {
		log('disconnected: ' + socket.ip,LOG_INFO);
		identities.push(socket.id);
		socket.rl.close();
	});
	socket.on('db_error',function(e,txt) {
		switch(e) {
		case ERROR_INVALID_REQUEST:
			respond(socket,'ERROR: invalid request: ' + txt);
			break;
		case ERROR_INVALID_LOCK:
			respond(socket,'ERROR: invalid lock: ' + txt);
			break;
		case ERROR_INVALID_PATH:
			respond(socket,'ERROR: invalid path: ' + txt);
			break;
		case ERROR_INVALID_OPER:
			respond(socket,'ERROR: invalid operation: ' + txt);
			break;
		case ERROR_INVALID_DB:
			respond(socket,'ERROR: invalid database: ' + txt);
			break;
		case ERROR_INVALID_USER:
			respond(socket,'ERROR: invalid user: ' + txt);
			break;
		case ERROR_INVALID_PASS:
			respond(socket,'ERROR: invalid password: ' + txt);
			break;
		default:
			respond(socket,'ERROR: unknown: ' + txt);
			break;
		}
	});
	socket.on('json_error',function(e,txt) {
		switch(e) {
		case ERROR_INVALID_REQUEST:
			respond(socket,'ERROR: JSON parsing failed: ' + txt);
			break;
		default:
			respond(socket,'ERROR: unknown: ' + txt);
			break;
		}
	});
	
}
 
/* server functions */
function parseRequest(socket,data) {
	var request = undefined;
	var result = undefined;
	try {
		//data = pako.inflate(data,{to:'string'});
		log('<< ' + request,LOG_DEBUG);
		request = tx.decode(JSON.parse(data));
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
		log(e.stack,LOG_ERROR);
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
	if(request.id == null) {
		request.id = socket.id;
	}
	//var startTime = Date.now();
	switch(request.oper) {
	case AUTH:
		authenticate(socket,request,callback,d);
		break;
	case READ:
		d.read(request,callback);
		break;
	case WRITE:
		d.write(request,callback);
		break;
	case LOCK:
		d.lock(request,callback);
		break;
	case UNLOCK:
		d.unlock(request,callback);
		break;
	case SUBSCRIBE:
		d.subscribe(request,callback);
		break;
	case UNSUBSCRIBE:
		d.unsubscribe(request,callback);
		break;
	default:
		socket.emit('db_error',ERROR_INVALID_OPER,request.oper);
		break;
	}
	
	function callback(response) {
		//var endTime = process.hrtime();
		// if(request.id == null)
			// request.id = socket.id;
		request.data = response;
		//request.elapsed = endTime - startTime;
		return respond(socket,request);
	}
	return true;
}
function respond(socket,response) {
	response = JSON.stringify(tx.encode(response));
	log('>> ' + response,LOG_DEBUG);
	//response = pako.deflate(response,{to:'string'});
	return socket.write(response + "\r\n");
}
function authenticate(socket,request,callback,database) {
	if(users[request.user] && database.users && database.users[request.user]) {
		var usr = users[request.user];
		if(usr.password.toLowerCase() == request.pass.toLowerCase()) 
			return true;
		else 
			socket.emit('db_error',ERROR_INVALID_PASS);
	}
	else {
		socket.emit('db_error',ERROR_INVALID_USER);
	}
	return false;
}
function getPool(num) {
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
		jsondb.settings.locking = "record";
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
	tx = require('./lib/transform');
	net = require('net');
	fs = require('fs');
	rl = require('readline');
	db = require('node-jsondb');
	//pako = require('pako');
	
	settings = require('./settings/settings');
	dblist = require('./settings/databases');
	users = require('./settings/users');
	
	identities = getPool(settings.maxconnections);
	databases = load(dblist);
	srv = net.createServer();
	srv.on('listening',onListen);
	srv.listen(settings.port,settings.host,onCreate);
	log('database server initialized',LOG_INFO);
}

/* and...go */
init();
