// Only using the legible block files
var fs = require('fs');

// Get all top addresses
var total_dcr = 0;
var address_count = 0;
var all_address_count = 0;
var network_count = 0;
var addr_net_map = {};
var network_map = {};
//var blockdir = './blocks/';
//var savefile  = './network_map.json';
var blockdir  = '../../../blocks/';
var savefile  = '../../../network_map.json';

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
	calculateNetworkRichListAndWealthDistribution();
	saveProgress();
}

function saveProgress() {
	fs.writeFileSync(savefile, JSON.stringify(network_map));
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
					total_dcr += tx.vin[j].amountin;
					continue;
				}

				if (tx.vin[j].hasOwnProperty('stakebase')) {
					total_dcr += tx.vin[j].amountin;
					continue;
				}

				// Get the origin address and amount
				var address = tx.vin[j].origin_vout["addresses"][0];
				var amount  = tx.vin[j].origin_vout["amount"];

				if (addr_net_map.hasOwnProperty(address)) {
					connected_addresses.push(address);
					addr_net_map[address].dcr -= parseFloat(tx.vin[j].amountin);
				} else {
					console.log("ERROR: Could not find address in network map: " + address);
					process.exit();
				}
			}

			// For all incoming addresses, connect them by the first one
			var first_network;
			if (connected_addresses.length > 0) {
				first_network = addr_net_map[connected_addresses[0]].nw;

				for (var ca_idx = 1; ca_idx < connected_addresses.length; ca_idx++) {
					addr_net_map[connected_addresses[ca_idx]].nw = first_network;
				}
			}

			// Get the outgoing amounts & addresses
			for (var j = 0; j < tx.vout.length; j++) {
				if (!tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
					continue;
				}

				// If we're committing to staking, then include the future addresses
				// IT TURNS OUT that I'm not certain about this anymore.
				// I think that some staking pools might split the amounts, in which case
				// this would wrongly associate pools with user accounts and user accounts
				// with pools.
				/*if (tx.vout[j].scriptPubKey.type == 'sstxcommitment')
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
						if (!addr_net_map.hasOwnProperty(address)) {
							addr_net_map[address] = {
								'nw' : first_network,
								'dcr' : 0
							};
						} else {
							addr_net_map[address].nw = first_network;
						}
					}
				}
				else if (tx.vout[j].scriptPubKey.type == 'stakesubmission')
				{
					// We MUST have a first_network provided, or else we're staking from a non-existent address
					if (!first_network) {
						console.log("ERROR: No first_network found, but staking committed.");
						process.exit();
					}

					// Need to save to the vin addresses
					// Don't want to assume that this address is owned by the prior, 
					// just want to keep track of the stake balance
				}
				else if (tx.vout[j].scriptPubKey.type == 'stakerevoke')
				{
					// We MUST have a first_network provided, or else we're staking from a non-existent address
					if (!first_network) {
						console.log("ERROR: No first_network found, but staking committed.");
						process.exit();
					}

					// Need to save to the vin addresses
					// Don't want to assume that this address is owned by the prior, 
					// just want to keep track of the stake balance
				}
				else*/
				{
					for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
						// Get the address
						var address = tx.vout[j].scriptPubKey.addresses[k];

						// Add the address to the chain if it doesn't exist
						if (!addr_net_map.hasOwnProperty(address)) {
							addr_net_map[address] = {
								'nw' : ++address_count,
								'dcr' : parseFloat(tx.vout[j].value)
							};
						} else {
							addr_net_map[address].dcr += parseFloat(tx.vout[j].value);
						}
					}
				}
			}
		}
	}

	return (height + 1);
}

function collectNetworks() {
	network_map = {};
	all_address_count = 0;
	for (var address in addr_net_map) {
		all_address_count++;
		var network_id = addr_net_map[address].nw;
		if (!network_map.hasOwnProperty(network_id)) {
			network_count++;
			network_map[network_id] = {
				'addr_count' : 0,
				'dcr' : 0.0,
				'lgst_amt' : 0.0,
				'lgst_addr' : 'NULL'
			};
		}
		network_map[network_id].addr_count++;
		network_map[network_id].dcr += (addr_net_map[address].dcr > 0) ? addr_net_map[address].dcr : 0;
		if (parseFloat(addr_net_map[address].dcr) > parseFloat(network_map[network_id].lgst_amt)) {
			network_map[network_id].lgst_amt  = addr_net_map[address].dcr;
			network_map[network_id].lgst_addr = address;
		}
	}
}

function calculateNetworkRichListAndWealthDistribution() {
	// Notify
	console.log("Building network rich list and wealth distribution...");

	// Notification
	console.log("Total address count: " + all_address_count + " - Total network count: " + network_count);

	var networks = [];
	for (var network_id in network_map) {
		// Ignore all 0 and dust wallets
		if (network_map[network_id].dcr > 0.00000001) {
			networks.push([network_id, network_map[network_id].dcr, network_map[network_id].addr_count, network_map[network_id].lgst_addr]);			
		}
	}

	// Order the list
	console.log("Ordering rich list...");
	networks.sort(function(a, b) {return b[1] - a[1];});

	// Now save the richest 500
	var top_500 = networks.slice(0,500);
	var top_500_data = {
		'top' : top_500,
		'total_dcr' : total_dcr
	};

	fs.writeFileSync('top_500_networks_list.json', JSON.stringify(top_500_data));

	// And determine the wealth distribution
	var bins   = [1, 10, 100, 1000, 10000, 100000, 1000000];
	var counts = [0,  0,   0,    0,     0,      0,       0];
	var value  = [0,  0,   0,    0,     0,      0,       0];
	for (var i = 0; i < networks.length; i++) {
		for (var j = 0; j < bins.length; j++) {
			if (networks[i][1] <= bins[j]) {
				value[j] += networks[i][1];
				counts[j]++;
				break;
			}
		}
	}

	fs.writeFileSync('wealth_distribution_networks.json', JSON.stringify({
		'bins' : bins,
		'counts' : counts,
		'value' : value,
		'total_dcr' : total_dcr
	}));

	console.log("Bins: " + bins);
	console.log("Counts: " + counts);
	console.log("Value: " + value);
}
