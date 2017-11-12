// Only using the legible block files
var fs = require('fs');

// Get all top addresses
var address_count = 0;
var all_address_count = 0;
var network_count = 0;
var addr_net_map = {};
var network_map = {};
var blockdir  = './blocks/';
var savefile  = 'network_map.json';

findNetworks();

function findNetworks() {
	var next_block_height = 1;
	while (next_block_height) {
		next_block_height = findNetworksAtBlock(next_block_height);
		if (next_block_height%10000==0) {
			console.log("hrtbt@" + next_block_height);
		}
	}

	console.log("Reached end.");
	collectNetworks();
	report();
	saveProgress();
}

function saveProgress() {
	fs.writeFileSync(savefile, JSON.stringify(network_map));
}

function collectNetworks() {
	network_map = {};
	all_address_count = 0;
	for (var address in addr_net_map) {
		all_address_count++;
		var network_id = addr_net_map[address];
		if (!network_map.hasOwnProperty(network_id)) {
			network_count++;
			network_map[network_id] = [];
		}
		network_map[network_id].push(address);
	}
}

function report() {
	console.log("Total address count: " + all_address_count);
	console.log("Total network count: " + network_count);

	var counts = [];
	for (var network_id in network_map) {
		var size = network_map[network_id].length;
		if (size < 500 || counts.indexOf(size) !== -1) { continue; }
		counts.push(size);
	}

	counts.sort(function(a,b){return a - b;});

	console.log("Network sizes from inputs & staking:");
	console.log(counts.join(', '));
}

function findNetworksAtBlock(height) {
	// Collect the block
	var blocksubdir = "blocks_" + (Math.trunc(height/1000)*1000) + "_" + (Math.trunc(height/1000)*1000 + 999) + "/";
	var location = blockdir + blocksubdir + "block_" + height + ".json";

	// Validate that we have a file for this block
	if (!fs.existsSync(location)) {
		return null;
	}

	// Collect all transactions
	var block_json = fs.readFileSync(location);
	var block = JSON.parse(block_json);

	// Mark some memory up for GC
	block_json = null; delete block_json;

	// For both trees..
	for (var tree_branch = 0; tree_branch < 2; tree_branch++)
	{
		var rawtxes;
		if (tree_branch == 0) {
			// Normal transactions
			rawtxes = block["rawtx"];
		} else {
			// Stake transactions
			rawtxes = block["rawstx"];
		}

		// For all transactions, keep tabs on who's paying and who's receiving
		for (var i = 0; i < rawtxes.length; i++) {
			// Get information about the transaction
			var tx = rawtxes[i];

			// Get the incoming addresses
			var connected_addresses = [];
			for (var j = 0; j < tx.vin.length; j++) {
				// If this is not a coinbase or a stakebase, it has an origin vout
				if (tx.vin.length == 1 && tx.vin[j].hasOwnProperty('coinbase')) {
					continue;
				}

				if (tx.vin[j].hasOwnProperty('stakebase')) {
					continue;
				}

				// Get the origin address and amount
				var address = tx.vin[j].origin_vout["addresses"][0];
				var amount  = tx.vin[j].origin_vout["amount"];

				if (addr_net_map.hasOwnProperty(address)) {
					connected_addresses.push(address);
				} else {
					console.log("ERROR: Could not find address in network map: " + address);
					process.exit();
				}
			}

			// For all incoming addresses, connect them by the first one
			var first_network;
			if (connected_addresses.length > 0) {
				first_network = addr_net_map[connected_addresses[0]];

				for (var ca_idx = 1; ca_idx < connected_addresses.length; ca_idx++) {
					addr_net_map[connected_addresses[ca_idx]] = first_network;
				}
			}

			// Get the outgoing amounts & addresses
			for (var j = 0; j < tx.vout.length; j++) {
				if (!tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
					continue;
				}

				// If we're committing to staking, then include the future addresses
				if (tx.vout[j].scriptPubKey.type == 'sstxcommitment')
				{
					// We MUST have a first_network provided, or else we're staking from a non-existent address
					if (!first_network) {
						console.log("ERROR: No first_network found, but staking committed.");
						process.exit();
					}

					// For each committed address, set to the primary network from input
					for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
						// Get the address
						var address = tx.vout[j].scriptPubKey.addresses[k];

						// Add the address to the chain from the input address
						addr_net_map[address] = first_network;
					}
				}
				else
				{
					for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
						// Get the address
						var address = tx.vout[j].scriptPubKey.addresses[k];

						// Add the address to the chain if it doesn't exist
						if (!addr_net_map.hasOwnProperty(address)) {
							addr_net_map[address] = ++address_count;
						}
					}
				}
			}
		}
	}

	return (height + 1);
}
