var fs = require('fs');

// Get all top addresses
var addresses = [], addresses_over_x = [], address_map = {};
var addr_file = '../../../address_map.json';

// If we have a save state, use it
fs.exists(addr_file, function(exists) {
	if (exists) {
		console.log("Pulling data.");
		fs.readFile(addr_file, function(err, data) {
			if (err) {
				console.log("Could not read file.");
				process.exit();
			} else {
				// Pull the save state and restore
				var address_map = JSON.parse(data);

				// Restore the addresses
				for (var address in address_map) {
					addresses.push(address)
					if (address_map[address].val > 50000) {
						addresses_over_x.push([address, address_map[address].val]);
					}
				}

				console.log("There are " + addresses_over_x.length + " addresses over 50,000 DCR and " + addresses.length + " addresses in total.");
				console.log("Top rich list: ");

				addresses_over_x.sort(function(a, b) {return a[1] - b[1];});

				for (var i = 0; i < addresses_over_x.length; i++) {
					console.log(addresses_over_x[i]);
				}
			}
		});
	}
});

