databases = {
	test:{
		file:		"./db/test.json",
		locking:	"transaction",
		users:{
			admin:	"rw",
			guest:	"r",
			test:	"rw"
		}
	}/*,
	example:{
		file:	"./db/example.json",
		users:{
			admin:	"w",
			guest:	"r"
		}
	}*/
}

/* dont touch this shit */
module.exports = databases;