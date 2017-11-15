// Only using the legible block files
var fs = require('fs');

var network_map = {}, richest = [];
var network_map_file = './network_map.json';

// If we have a save state, use it
fs.exists(network_map_file, function(exists) {
	if (exists) {
		console.log("Pulling data.");
		fs.readFile(network_map_file, function(err, data) {
			if (err) {
				console.log("Could not read file.");
				process.exit();
			} else {
				// Pull the save state and restore
				var network_map = JSON.parse(data);

				// Restore the addresses
				for (var network in network_map) {
					if (network_map[network].dcr >= 10000) {
						richest.push(network_map[network].dcr);
					}
				}

				console.log("There are " + richest.length + " address networks over 10,000 DCR.");
				console.log("Top rich list: ");

				richest.sort(function(a, b) {return b - a;});

				for (var i = 0; i < richest.length; i++) {
					console.log(richest[i]);
				}
			}
		});
	}
});
