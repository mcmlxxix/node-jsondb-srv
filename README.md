# node-jsondb-srv

Socket service for [node-jsondb](https://github.com/mcmlxxix/node-jsondb) 

## Description

[node-jsondb-srv](https://github.com/mcmlxxix/node-jsondb-srv) is a static TCP socket service which accepts connections on a designated port from an instance of [node-jsondb-client](https://github.com/mcmlxxix/node-jsondb-client). 

## Installation

'npm install node-jsondb-srv'

## Configuration

'./settings/settings.js'

	settings = {
		"host":				"localhost",
		"port":				10089,
		"maxconnections": 	200
	}

'./settings/databases.js'

	test:{
		file:		"./db/test.json",
		locking:	"transaction",
		users:{
			admin:	"rw",
			guest:	"r"
		}
	}
	
'./settings/users.js'

	users = {	/* 	<name> 			:	<password> */
					"test"			:	"test",
					"guest"			:	"",
					"admin"			:	"admin"
	}
	
## Locking

The locking mechanism for a given database can either be via transactions, full-database locking, or disabled entirely.

### Transaction 'locking:"transaction"'

With transaction locking, any updates to the database must be done with the target records locked for writing. Given that a single request/query may include multiple records, any locks or writes that fail will cause the entire transaction to be cancelled (the database retains its prior state).

### Full 'locking:"full"'

With full locking, the entire database is locked for writing before any changes are made. This approach may be faster for situations where updates are infrequent. The process of locking individual records can slow things down.

### None 'locking:null'

As the section implies, there is no locking at all. Any client can write without locking. Useful for chat room databases where you are more interested in receiving subscription updates than retaining data.

## Database

Database files are located in './db/' and are stored in '.JSON' format

## Usage

'node node-jsondb-srv'



