const READ = 		0;
const WRITE = 		1;
const LOCK = 		2;
const UNLOCK = 		3;
const SUBSCRIBE = 	4;
const UNSUBSCRIBE = 5;
const AUTH = 		6;

function encodeRequest(obj) {
	var array = [];
	array[0] = obj.oper;
	array[1] = obj.id;
	array[2] = obj.db;
	switch(obj.oper){
	case READ:
	case WRITE:
	case UNLOCK:
		array[3] = encodeData(obj.data);
		break;
	case LOCK:
		array[3] = encodeData(obj.data);
		array[4] = obj.lock;
		break;
	case SUBSCRIBE:
	case UNSUBSCRIBE:
		break;
	case AUTH:
		array[3] = obj.user;
		array[4] = obj.pass;
		break;
	default:
		/* what to do here? */
		break;
	}
	return array;
}

function decodeRequest(array) {
	var obj = {};
	obj.oper = array[0];
	obj.id = array[1];
	obj.db = array[2];
	switch(obj.oper){
	case READ:
	case WRITE:
	case UNLOCK:
		obj.data = decodeData(array[3]);
		break;
	case LOCK:
		obj.data = decodeData(array[3]);
		obj.lock = array[4];
		break;
	case SUBSCRIBE:
	case UNSUBSCRIBE:
		break;
	case AUTH:
		obj.user = array[3];
		obj.pass = array[4];
		break;
	default:
		/* what to do here? */
		break;
	}
	return obj;
}

function encodeData(array) {
	var data = [];
	for(var i=0;i<array.length;i++) {
		data.push([array[i].path,array[i].key,array[i].value,array[i].status]);
	}
	return data;
}

function decodeData(array) {
	var data = [];
	for(var i=0;i<array.length;i++) {
		data.push({path:array[i][0],key:array[i][1],value:array[i][2],status:array[i][3]});
	}
	return data;
}

module.exports.encode = encodeRequest;
module.exports.decode = decodeRequest;